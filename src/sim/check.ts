/* The mission check engine. It runs the student's own sketch on the student's own circuit, with scripted inputs (a wall that moves, a button that is pressed),
   on the sketch's own clock so that a run takes milliseconds and always comes out the same. Then it asks questions of what happened. */
import { BOARDS } from '../data/boards';
import { inputsOf } from '../state/bench';
import { itemId, kindOf, type BoardId, type Item } from '../types';
import { analyze } from './circuit';
import { makeHW, makeReadout, type VirtualHW } from './hardware';
import { run, SimError, type RunControl } from './interpreter';
import { missWords, pageText, seenWords, type Miss, type Seen } from './network';
import type { Frame } from './timeline';

/* --- inputs --- */
/** The parts a check can script, by kind: a sensor module goes by its own kind ("soil"), every other part by its type. */
export type InputKind = 'button' | 'pot' | 'sonar' | 'pad' | 'ldr' | 'temp' | 'soil' | 'pir' | 'reed' | 'ir';
/** From `from` milliseconds on, these inputs have these values. Parts of the same kind all take the same value. A knob, a light sensor or a soil sensor is 0 to 1, the temperature is in °C, the wall is in cm, a button, pad or motion sensor is 0 or 1, a reed switch is 1 while its magnet is near, and an obstacle sensor 1 while something is in front of it. */
export interface InputStep {
  from: number;
  set?: Partial<Record<InputKind, number>>;
  /** The phone beside the bench opens this address on the board at this moment, such as "/" or "/on". Only the ESP32 has Wi-Fi to answer it. */
  visit?: string;
  /** The phone taps the link or button with these words on whatever page it shows at this moment, such as "ON". */
  tap?: string;
}
const REST: Record<InputKind, number> = { button: 0, pad: 0, pot: 0.5, sonar: 100, ldr: 0.5, temp: 25, soil: 0.5, pir: 0, reed: 0, ir: 0 };

export function inputsAt(items: Item[], plan: InputStep[], t: number): Record<string, number> {
  const value = { ...REST };
  for (const step of plan) if (step.from <= t) Object.assign(value, step.set);
  const out: Record<string, number> = {};
  items.forEach((it, k) => {
    const id = itemId(it, k);
    Object.assign(out, inputsOf(it, id));   // a part no check scripts keeps its resting value
    const kind = kindOf(it);
    if ('ctl' in it && kind in value) out[id] = value[kind as InputKind];
  });
  return out;
}

/* --- what a run looked like --- */
/** The board at one moment of a run. */
export interface Sample {
  t: number;
  /** How bright each LED on the bench is, 0 to 1. */
  leds: number[];
  /** How much of the time each LED is being driven, 0 to 1. */
  duties: number[];
  /** The board's own LED. */
  builtin: number;
  /** The highest note sounding, in hertz, 0 when silent. */
  sound: number;
  /** The angle each servo on the bench is told to hold, -1 when it gets no signal or no power. */
  servos: number[];
  /** Everything the sketch has printed so far. */
  serial: string;
  /** What the first LCD on the bench shows: its two lines, one under the other. Empty when there is no LCD. */
  lcd: string;
  /** What the phone shows: the address it last opened and the answer, if one has come. Null before the phone has opened anything, and on a board with no Wi-Fi. */
  page: Seen | null;
}
export interface Trace {
  ms: number;
  ledCount: number;
  /** The colour of each LED, in the same order as `Sample.leds`. */
  ledColors: number[];
  buzzerCount: number;
  servoCount: number;
  lcdCount: number;
  /** The board has Wi-Fi, so the phone can reach it. */
  phone: boolean;
  /** Taps the script asked for that found nothing to tap. */
  missed: Miss[];
  /** Why the sketch stopped early, in words for the student. */
  error: string | null;
  /** The sketch kept running without ever waiting. */
  timedOut: boolean;
  burnt: string[];
  shorted: boolean;
  samples: Sample[];
  at(t: number): Sample;
  /** The state at the start of a stretch of time and every change within it. */
  window(from: number, to: number): Sample[];
}

export const ledOn = (s: Sample) => Math.max(0, ...s.leds) > 0.5;
export const soundOn = (s: Sample) => s.sound > 0;
/** The LED colours in the tray, so a check can ask about "the red LED" whatever id the student's LED has. */
export const LED_COLOR = { red: 0xff3b30, green: 0x2ecc40 } as const;
export type LedColor = keyof typeof LED_COLOR;
/** Some LED of this colour is on. */
export const colorOn = (tr: Trace, color: LedColor) => (s: Sample) => s.leds.some((v, i) => tr.ledColors[i] === LED_COLOR[color] && v > 0.5);
/** The first servo's angle, -1 when it is not being driven. */
export const servoAt = (s: Sample) => s.servos[0] ?? -1;

const MAX_STEPS = 60_000, MAX_FRAMES = 20_000;

export async function observe(board: BoardId, items: Item[], code: string, plan: InputStep[], ms: number): Promise<Trace> {
  const b = BOARDS[board], analysis = analyze(board, items), shorted = analysis.issues.some(i => i.kind === 'short');
  const frames: Frame[] = [], sigs: string[] = [], serial: { t: number; text: string }[] = [], burnt: string[] = [];
  const ledIds = items.flatMap((it, k) => (it.t === 'led' ? [itemId(it, k)] : [])), buzzIds = items.flatMap((it, k) => (it.t === 'buzzer' ? [itemId(it, k)] : []));
  const ledColors = items.flatMap(it => (it.t === 'led' ? [it.color] : [])), servoIds = items.flatMap((it, k) => (it.t === 'servo' ? [itemId(it, k)] : []));
  const lcdIds = items.flatMap((it, k) => (it.t === 'lcd' ? [itemId(it, k)] : []));
  let hw!: VirtualHW, steps = 0, passes = 0, timedOut = false, error: string | null = null;
  hw = makeHW(b, items, () => inputsAt(items, plan, hw.elapsed()), text => serial.push({ t: hw.elapsed(), text }), {
    virtualClock: true,
    onBurn: id => burnt.push(id),
    onChange: () => {   // a frame only when the pins or notes are different from the last one
      const f = hw.snapshot(), sig = JSON.stringify([f.drive, f.tones, f.servos, f.lcd]);
      if (sig !== sigs[sigs.length - 1] && frames.length < MAX_FRAMES) { frames.push(f); sigs.push(sig); }
    },
  });
  hw.skipDelays = true;
  const net = hw.net;
  for (const s of plan) { if (s.visit) net?.visit(s.visit, s.from, 0); if (s.tap) net?.tap(s.tap, s.from); }   // the phone's part of the script, played as the sketch's clock reaches each moment
  let yields = 0;
  hw.pause = () => (++yields % 25 === 0 ? new Promise<void>(r => setTimeout(r, 0)) : Promise.resolve());   // let the page breathe now and then
  frames.push(hw.snapshot()); sigs.push(JSON.stringify([frames[0].drive, frames[0].tones, frames[0].servos, frames[0].lcd]));
  const ctl: RunControl = {
    stop: false,
    onLoop() { hw.advance(5); passes++; if (hw.elapsed() >= ms) ctl.stop = true; },   // a pass of loop() takes a moment, so a sketch that only polls still lets time move on
    step() {
      if (++steps > MAX_STEPS) { timedOut = true; ctl.stop = true; }
      else if (hw.elapsed() >= ms) ctl.stop = true;
    },
  };
  try { await run(code, hw, ctl); }
  catch (e) { error = e instanceof SimError ? `Your sketch stopped with an error on line ${e.line}: ${e.message}` : `Your sketch stopped with an error: ${e instanceof Error ? e.message : e}`; }
  void passes;
  net?.settle(Math.max(ms, hw.elapsed()));   // whatever the script asked for that the sketch never got to: a phone left waiting, or turned away

  /** The board as the pins and inputs leave it, kept for each pin state and set of inputs. What has been printed and what the phone shows are not part of it: neither changes a pin. */
  const cache = new Map<string, Omit<Sample, 't' | 'serial' | 'page'>>();
  const frameBefore = (t: number) => {
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid].t <= t) lo = mid; else hi = mid - 1; }
    return lo;
  };
  /** Everything printed by a moment: the whole text cut at the end of the last print by then (prints arrive in time order). */
  const printed = serial.map(e => e.text).join(''), ends: number[] = [];
  serial.reduce((n, e) => { ends.push(n + e.text.length); return n + e.text.length; }, 0);
  const serialAt = (t: number) => {
    let lo = 0, hi = serial.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (serial[mid].t <= t) lo = mid + 1; else hi = mid; }
    return lo ? printed.slice(0, ends[lo - 1]) : '';
  };
  const at = (t: number): Sample => {
    const i = frameBefore(t), inputs = inputsAt(items, plan, t), key = `${sigs[i]}|${JSON.stringify(inputs)}|${t > 0 ? '' : 'start'}`;
    let s = cache.get(key);
    if (!s) {
      const r = makeReadout(b, analysis, { ...frames[i], inputs }, []), sol = r.circuit;
      s = {
        leds: ledIds.map(id => r.ledGlow(id)), duties: ledIds.map(id => sol.ledDuty(id)), builtin: r.builtinGlow,
        sound: Math.max(0, ...buzzIds.map(id => r.buzzFreq(id))), servos: servoIds.map(id => r.servoAngle(id)), lcd: lcdIds.length ? r.lcd(lcdIds[0]).lines.join('\n') : '',
      };
      cache.set(key, s);
    }
    return { ...s, t, serial: serialAt(t), page: net ? net.seenAt(t) : null };
  };
  const samples = frames.map(f => at(f.t));
  return {
    ms, ledCount: ledIds.length, ledColors, buzzerCount: buzzIds.length, servoCount: servoIds.length, lcdCount: lcdIds.length, phone: !!net, missed: net?.missed ?? [], error, timedOut, burnt, shorted, samples, at,
    window: (from, to) => [at(from), ...frames.filter(f => f.t > from && f.t <= to).map(f => at(f.t))],
  };
}

/* --- scenarios: what to run and how to judge it --- */
export interface Scenario {
  label: string;
  plan: InputStep[];
  /** How long to run, in milliseconds on the sketch's clock. */
  run: number;
  /** Null when the run was as it should be, else what went wrong in words for the student. */
  judge(tr: Trace): string | null;
}

export interface Expect {
  /** Some LED on the bench is on (true) or all are off (false). */
  led?: boolean;
  /** Some buzzer is sounding (true) or all are silent (false). */
  sound?: boolean;
  /** The board's own LED. */
  builtin?: boolean;
  /** Text the sketch has printed by then. */
  serial?: RegExp;
  /** The brightest LED is being driven this share of the time. */
  duty?: [min: number, max: number];
  /** An LED of this colour is on (true) or every LED of this colour is off (false). */
  red?: boolean;
  green?: boolean;
  /** The servo points somewhere in this range of degrees. */
  servo?: [min: number, max: number];
  /** What the LCD shows, its two lines one under the other. */
  lcd?: RegExp;
  /** The phone shows a page the board sent with status 200 (true), and one whose words match this. Judged at the end of the phase. */
  page?: true | RegExp;
}
export interface Phase {
  /** The situation, finishing the sentence "When …" in the messages. */
  when: string;
  /** Inputs from the start of this phase on. Inputs not mentioned keep their last value. */
  set?: Partial<Record<InputKind, number>>;
  /** The phone opens this address at the start of the phase, such as "/". */
  visit?: string;
  /** The phone taps the link or button with these words at the start of the phase, on the page it shows. */
  tap?: string;
  /** How long the phase lasts. */
  ms?: number;
  /** `end`: judge the state just before the phase ends. `during`: something must happen at some point in it (or, for false, never happen). */
  mode?: 'end' | 'during';
  expect: Expect;
}

const percent = (v: number) => `${Math.round(v * 100)}%`;
/** The words a page should say, in quotes when the pattern is plain words, else the pattern itself. */
const like = (re: RegExp) => { const plain = re.source.replace(/\\b/g, ''); return /^[\w\s.,:;!'°%-]*$/.test(plain) ? `"${plain}"` : String(re); };

function judgePhase(tr: Trace, p: Phase, start: number, end: number): string | null {
  const e = p.expect, during = p.mode === 'during', states = during ? tr.window(start, end) : [tr.at(end - 100)];
  const when = `When ${p.when}`, last = states[states.length - 1];
  if (p.tap) {   // a tap that found nothing to tap explains everything that follows from it
    const miss = tr.missed.find(m => m.at >= start && m.at < end);
    if (miss) return `${when}, ${missWords(miss)}.`;
  }
  const lit = (want: boolean, what: string, read: (s: Sample) => boolean, none: boolean): string | null => {
    if (none) return `I could not find ${what === 'LED' ? 'an LED' : `a ${what}`} on your bench.`;
    if (during) {
      const seen = states.some(read);
      if (want && !seen) return `${when}, the ${what} should have turned on, but it stayed off.`;
      if (!want && seen) return `${when}, the ${what} should stay off, but it turned on.`;
      return null;
    }
    return read(last) === want ? null : `${when}, the ${what} should be ${want ? 'on' : 'off'}, but it was ${want ? 'off' : 'on'}.`;
  };
  if (e.led !== undefined) { const m = lit(e.led, 'LED', ledOn, tr.ledCount === 0); if (m) return m; }
  if (e.builtin !== undefined) { const m = lit(e.builtin, 'on-board LED', s => s.builtin > 0.5, false); if (m) return m; }
  for (const color of ['red', 'green'] as const) {
    const want = e[color];
    if (want === undefined) continue;
    const m = lit(want, `${color} LED`, colorOn(tr, color), !tr.ledColors.includes(LED_COLOR[color]));
    if (m) return m;
  }
  if (e.servo) {
    if (tr.servoCount === 0) return 'I could not find a servo on your bench.';
    const a = servoAt(last), [lo, hi] = e.servo, aim = lo === 0 ? `${hi}° or less` : hi === 180 ? `${lo}° or more` : `about ${Math.round((lo + hi) / 2)}°`;
    if (a < 0) return `${when}, the servo should point ${aim}, but it was not getting a signal. Check that the sketch calls attach() with the pin its orange wire is on, and that the servo has 5 V and GND.`;
    if (a < lo || a > hi) return `${when}, the servo should point ${aim}, but it was at ${a}°.`;
  }
  if (e.sound !== undefined) {
    if (tr.buzzerCount === 0) return 'I could not find a buzzer on your bench.';
    const seen = states.some(soundOn);
    if (during) {
      if (e.sound && !seen) return `${when}, the buzzer should have sounded, but it stayed silent.`;
      if (!e.sound && seen) return `${when}, the buzzer should stay silent, but it sounded.`;
    } else if (soundOn(last) !== e.sound) return `${when}, the buzzer should be ${e.sound ? 'sounding' : 'silent'}, but it was ${e.sound ? 'silent' : 'sounding'}.`;
  }
  if (e.lcd) {
    if (tr.lcdCount === 0) return 'I could not find an LCD on your bench.';
    if (!e.lcd.test(last.lcd)) return `${when}, the LCD should show something like ${e.lcd}, but it showed "${last.lcd.split('\n').map(l => l.trimEnd()).join(' / ')}".`;
  }
  if (e.serial && !e.serial.test(last.serial)) return `${when}, the Serial Monitor should show something like ${e.serial}, but it did not.`;
  if (e.page !== undefined) {
    if (!tr.phone) return 'This board has no Wi-Fi, so the phone cannot reach it. Build it on the ESP32.';
    const seen = tr.at(end - 100).page, a = seen?.answer;
    const ok = a?.kind === 'page' && a.status === 200 && (e.page === true || e.page.test(pageText(a)));
    if (!ok) return `${when}, the phone should show ${e.page === true ? 'the board\'s page' : `a page that says ${like(e.page)}`}, but ${seenWords(seen ?? null)}.`;
  }
  if (e.duty) {
    if (tr.ledCount === 0) return 'I could not find an LED on your bench.';
    const d = Math.max(0, ...last.duties), [lo, hi] = e.duty;
    if (d < lo || d > hi) return `${when}, the LED should be driven about ${lo === hi ? percent(lo) : `${percent(lo)} to ${percent(hi)}`} of the time, but it was ${percent(d)}.`;
  }
  return null;
}

/** A scenario made of stretches of time, each with its own inputs and something that should be true by the end of it. */
export function phases(label: string, list: Phase[]): Scenario {
  const plan: InputStep[] = [], spans: { p: Phase; start: number; end: number }[] = [];
  let t = 0;
  for (const p of list) { const ms = p.ms ?? 1500; plan.push({ from: t, set: p.set ?? {}, visit: p.visit, tap: p.tap }); spans.push({ p, start: t, end: t + ms }); t += ms; }
  return { label, plan, run: t, judge: tr => { for (const s of spans) { const m = judgePhase(tr, s.p, s.start, s.end); if (m) return m; } return null; } };
}

/** The stretches of time in which a state held, from the recorded changes. A stretch that ran into the end of the run is marked as cut short. */
function stretches(tr: Trace, state: (s: Sample) => boolean) {
  const out: { on: boolean; from: number; to: number; whole: boolean }[] = [];
  for (const s of tr.samples) {
    const on = state(s), last = out[out.length - 1];
    if (last && last.on === on) continue;
    if (last) last.to = s.t;
    out.push({ on, from: s.t, to: tr.ms, whole: false });
  }
  for (const x of out) x.whole = x.to < tr.ms;
  return out;
}

/** An LED that turns on and off again and again, at a pace the eye can follow. `who` can name one colour of LED, so the others may do as they like. */
export function blinks(label: string, who: 'led' | 'builtin' | LedColor = 'led', plan: InputStep[] = []): Scenario {
  return {
    label, plan, run: 8000,
    judge(tr) {
      const color = who === 'red' || who === 'green' ? who : null;
      if (who === 'led' && tr.ledCount === 0) return 'I could not find an LED on your bench.';
      if (color && !tr.ledColors.includes(LED_COLOR[color])) return `I could not find a ${color} LED on your bench.`;
      const name = who === 'led' ? 'LED' : color ? `${color} LED` : 'on-board LED';
      const list = stretches(tr, color ? colorOn(tr, color) : s => (who === 'led' ? ledOn(s) : s.builtin > 0.5));
      const body = list.slice(1);   // the first stretch is only the moment before setup() has run
      const anyOn = list.some(x => x.on), anyOff = body.some(x => !x.on);
      if (!anyOn) return `The ${name} stays dark: it never turns on.`;
      if (!anyOff) return `The ${name} turns on but never turns off, so it is not blinking.`;
      const lengths = body.filter(x => x.whole).map(x => x.to - x.from), cycles = body.filter(x => x.on && x.whole).length;
      if (lengths.length && Math.min(...lengths) < 150) return `The ${name} flickers too fast to see: it changes every ${Math.round(Math.min(...lengths))} ms. Aim for about a second.`;
      if (cycles < 2) return `The ${name} blinks too slowly: it only went on and off ${cycles === 1 ? 'once' : 'a couple of times'} in 8 seconds. Aim for about once a second.`;
      if (lengths.length && Math.max(...lengths) > 2500) return `The ${name} waits too long between changes (${(Math.max(...lengths) / 1000).toFixed(1)} s). Aim for about a second.`;
      return null;
    },
  };
}

/** A buzzer that slides up and back down through many pitches, like a siren. */
export function sweeps(label: string, lowUnder = 500, highOver = 900): Scenario {
  return {
    label, plan: [], run: 4000,
    judge(tr) {
      if (tr.buzzerCount === 0) return 'I could not find a buzzer on your bench.';
      const notes = tr.samples.map(s => Math.round(s.sound)).filter(n => n > 0);
      if (!notes.length) return 'The buzzer stays silent.';
      const distinct = new Set(notes).size, lo = Math.min(...notes), hi = Math.max(...notes);
      if (distinct < 8) return `Only ${distinct} different note${distinct === 1 ? ' was' : 's were'} played. A siren slides through many pitches.`;
      if (lo > lowUnder || hi < highOver) return `The pitch should slide from under ${lowUnder} Hz to over ${highOver} Hz, but it only went from ${lo} to ${hi} Hz.`;
      let up = false, down = false;
      for (let i = 1; i < notes.length; i++) { if (notes[i] > notes[i - 1]) up = true; if (notes[i] < notes[i - 1]) down = true; }
      return up && down ? null : `The pitch only goes ${up ? 'up' : 'down'}. A siren slides up and back down.`;
    },
  };
}

/** For prediction: how a state differed between an earlier moment and a later one. */
export function reaction(tr: Trace, state: (s: Sample) => boolean, earlier: number, later: number): 'earlier' | 'later' | 'always' | 'never' {
  const a = state(tr.at(earlier)), b = state(tr.at(later));
  return a && b ? 'always' : !a && !b ? 'never' : b ? 'later' : 'earlier';
}

/* --- running a mission's checks --- */
export interface CheckResult { label: string; pass: boolean; detail: string }

/** The wiring check first, then each scenario. A scenario fails with the reason as soon as the circuit or sketch cannot be run properly. */
export async function runChecks(board: BoardId, items: Item[], code: string, scenarios: Scenario[], opts: { wiring?: boolean } = {}): Promise<CheckResult[]> {
  const issues = analyze(board, items).issues, results: CheckResult[] = [];
  if (opts.wiring !== false) {
    results.push(issues.length
      ? { label: 'The wiring has no mistakes', pass: false, detail: issues.slice(0, 2).map(i => `${i.title}. ${i.plain}`).join(' ') + (issues.length > 2 ? ` (and ${issues.length - 2} more)` : '') }
      : { label: 'The wiring has no mistakes', pass: true, detail: '' });
  }
  const short = issues.find(i => i.kind === 'short');
  for (const sc of scenarios) {
    if (short) { results.push({ label: sc.label, pass: false, detail: 'Fix the short circuit first. The power is cut while power and ground touch.' }); continue; }
    const tr = await observe(board, items, code, sc.plan, sc.run);
    let detail: string | null;
    if (tr.error) detail = tr.error;
    else if (tr.timedOut) detail = 'Your sketch never waits: a loop keeps running without a delay(), so nothing else can happen. Put a delay() inside the loop.';
    else if (tr.burnt.length) detail = 'The LED burned out while your sketch ran: too much current went through it. Check that a resistor is in series with the LED.';
    else detail = sc.judge(tr);
    results.push({ label: sc.label, pass: detail === null, detail: detail ?? '' });
  }
  return results;
}
