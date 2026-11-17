/* The electrical side of the bench. A circuit is the list of parts and wires the student placed.
   `analyze` joins everything that is wired together into nets (breadboard columns, power rails, board pins),
   reports the mistakes a student can make, and `solve` finds the voltage of every net and the current in every part
   for a given state of the board's pins. All numbers are simple DC values: enough to teach, small enough to explain. */
import { ESP_HOLES } from '../data/boards';
import { itemId, type BoardId, type Item, type ModuleKind } from '../types';

/** What a pin is doing right now. `level` runs from 0 to 1 (a PWM duty cycle for analogWrite). */
export interface Drive { mode: 'out' | 'in' | 'pullup'; level: number }

export type IssueKind = 'short' | 'overvoltage' | 'led-backwards' | 'led-no-resistor' | 'led-open' | 'part-bypassed' | 'unpowered';
export interface Issue {
  kind: IssueKind;
  severity: 'error' | 'warn';
  /** The id of the part the problem is about. */
  part?: string;
  title: string;
  /** What went wrong and how to fix it, in plain words. */
  plain: string;
}

export interface Solution {
  /** Power was joined straight to ground. Nothing else in the solution is meaningful. */
  shorted: boolean;
  /** Volts at a connection point such as "e10", "T+5" or "U:13". */
  volt(point: string): number;
  /** Amps through an LED, or 0 when it is dark or burnt out. */
  ledAmps(id: string): number;
  /** 0 to 1: how bright the LED looks. */
  ledGlow(id: string): number;
  /** 0 to 1: the share of the time the LED is being driven while it conducts. A dimmed LED has a low duty, even though it looks nearly full bright. */
  ledDuty(id: string): number;
  /** Volts across a buzzer. */
  buzzVolts(id: string): number;
  /** Volts between a servo's + and GND legs. */
  servoVolts(id: string): number;
  /** Output pins that are currently driving the net a part is on. */
  pinsDriving(id: string): number[];
  /** Amps in a wire, positive when conventional current runs from its first end (`a`) to its second (`b`). */
  wireAmps(id: string): number;
  /** Amps a pin supplies (negative when it sinks current). */
  pinAmps(pin: number): number;
  /** Volts on the net a pin is wired to. */
  pinVolt(pin: number): number;
}

export interface Analysis {
  issues: Issue[];
  /** Pins of this board by number, as a connection-point name. */
  solve(drive: Record<number, Drive> | ((pin: number) => Drive), inputs?: Record<string, number>, burnt?: Iterable<string>): Solution;
  /** The Uno or ESP32 pin the given connection point is wired to, directly or through wires only. */
  pinAt(point: string): number | null;
  /** True when the two connection points are joined by wires, rails or breadboard columns alone. */
  joined(a: string, b: string): boolean;
  /** The pin a servo's signal leg is wired to, or null. */
  servoPin(id: string): number | null;
  /** The net a connection point is on. */
  netOf(point: string): Net;
}

/** Everything joined by wires, rails and breadboard columns: an id shared by all of it, the board pins on it, and its voltage when it is GND (0) or a supply. */
export interface Net { id: string; pins: number[]; volts: number | null }

/** A pin a sketch can use: its number in code, its name on the board, and its connection point. */
export interface BoardPin { num: number; name: string; point: string }
export function boardPins(board: BoardId): BoardPin[] {
  if (board === 'uno') return Array.from({ length: 20 }, (_, n) => (n <= 13 ? { num: n, name: String(n), point: `U:${n}` } : { num: n, name: `A${n - 14}`, point: `U:A${n - 14}` }));
  return Object.keys(ESP_HOLES).flatMap(name => {
    const num = /^D(\d+)$/.test(name) ? +name.slice(1) : ESP_PIN_NUM[name];
    return num == null ? [] : [{ num, name, point: `E:${name}` }];
  });
}

/** The connection points of a servo's three legs. */
export const servoLegs = (it: { row: string; col: number }) => ({ gnd: `${it.row}${it.col}`, vcc: `${it.row}${it.col + 1}`, sig: `${it.row}${it.col + 2}` });
/** The connection points of an RGB LED's four legs: red, the shared − leg, green and blue. */
export const rgbLegs = (it: { row: string; col: number }) => ({ r: `${it.row}${it.col}`, com: `${it.row}${it.col + 1}`, g: `${it.row}${it.col + 2}`, b: `${it.row}${it.col + 3}` });
/** The three LEDs inside an RGB LED, in the order of its legs, with the voltage each one drops. */
export const RGB_CHANNELS = [['r', 'red', 1.9], ['g', 'green', 2.2], ['b', 'blue', 3]] as const;
/** The connection points of a joystick's five pins. */
export const joyLegs = (it: { row: string; col: number }) => ({ gnd: `${it.row}${it.col}`, vcc: `${it.row}${it.col + 1}`, x: `${it.row}${it.col + 2}`, y: `${it.row}${it.col + 3}`, sw: `${it.row}${it.col + 4}` });
/** The least voltage each sensor module works from. The motion sensor and the gas sensor need 5 V. */
export const MODULE_MIN_VOLTS: Record<ModuleKind, number> = { pir: 4.5, gas: 4.5, ir: 3, soil: 3, water: 3, flame: 3 };
/** What a sensor module puts on its OUT pin. `value` is its on-screen control: 0 or 1 for the motion and obstacle sensors, 0 to 1 for the others.
    The motion sensor gives 3.3 V while it sees movement. The obstacle sensor goes LOW when something is in front of it. The gas sensor gives
    0.1 V in clean air and up to 3.3 V in thick smoke. The soil, water and flame sensors give a share of their supply. */
export function moduleVolts(kind: ModuleKind, value: number, supply: number): number {
  const v = Math.min(1, Math.max(0, value));
  switch (kind) {
    case 'pir': return v > 0.5 ? 3.3 : 0;
    case 'ir': return v > 0.5 ? 0 : supply;
    case 'gas': return Math.min(3.3, 0.1 + 3.2 * v);
    case 'soil': case 'water': case 'flame': return supply * v;
  }
}
/** What each module draws from its supply, as a resistance. The gas sensor's heater takes about 150 mA. */
const MODULE_OHMS: Record<ModuleKind, number> = { pir: 50000, ir: 250, soil: 1000, water: 250, gas: 33, flame: 330 };
const MODULE_NAME: Record<ModuleKind, string> = { pir: 'motion sensor', ir: 'obstacle sensor', soil: 'soil moisture sensor', water: 'water level sensor', gas: 'gas sensor', flame: 'flame sensor' };
const R_MODULE_OUT = 100;
/** A servo needs about 5 V to turn. */
export const SERVO_MIN_VOLTS = 4.5;

export const LED_BURN_AMPS = 0.03, PIN_MAX_AMPS = 0.04;
/** A light-dependent resistor: about 1 kΩ in bright light, 10 kΩ at half light and 100 kΩ in the dark. `light` runs from 0 (dark) to 1 (bright). */
export const ldrOhms = (light: number) => 1000 * 100 ** (1 - Math.min(1, Math.max(0, light)));
/** A TMP36 gives 0.5 V at 0 °C and 10 mV more for each degree. */
export const tempVolts = (celsius: number) => 0.5 + 0.01 * Math.min(125, Math.max(-40, celsius));
/** A TMP36 works from 2.7 V up. */
export const TEMP_MIN_VOLTS = 2.7;
const R_TEMP_OUT = 100, R_TEMP_Q = 100000;
const R_PIN = 25, R_PULLUP = 30000, R_LED = 10, R_BUZZER = 1000, R_POT = 10000, R_SONAR = 333, R_SERVO = 500, R_SWITCH = 0.05, G_MIN = 1e-9;

class Sets {
  private p = new Map<string, string>();
  find(x: string): string {
    let r = x;
    while ((this.p.get(r) ?? r) !== r) r = this.p.get(r)!;
    for (let c = x; c !== r;) { const n = this.p.get(c) ?? c; this.p.set(c, r); c = n; }
    return r;
  }
  union(a: string, b: string) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

const ESP_PIN_NUM: Record<string, number> = { RX2: 16, TX2: 17, RX0: 3, TX0: 1, VN: 39, VP: 36 };
const holeNode = (n: string): string | null => {
  let m;
  if ((m = /^([a-j])(\d+)$/.exec(n))) return `c${m[2]}${m[1] <= 'e' ? 't' : 'b'}`;
  if ((m = /^([TB][+-])\d+$/.exec(n))) return m[1];
  return null;
};
const ledDrop = (color: number) => { const r = color >> 16 & 255, g = color >> 8 & 255, b = color & 255; return b > r ? 3 : g > r ? 2.2 : 1.9; };

interface El {
  kind: 'R' | 'D' | 'SW' | 'POT' | 'LOAD' | 'TEMP' | 'MOD'; id: string; a: string; b: string; w?: string; ohms: number; vf: number; it: Item;
  /** The on-screen value that moves it, when that is not kept under its own id. */
  src?: string;
  /** A switch that is closed while its value is off: a tilt switch standing upright, the left side of a slide switch. */
  inv?: boolean;
  /** The part it belongs to, when a part is made of several elements (the three LEDs of an RGB LED, the two knobs and the button of a joystick). */
  own?: string;
}
const POWER: Record<string, number> = { GND: 0, V3: 3.3, V5: 5, V9: 9 };

export function analyze(board: BoardId, items: Item[]): Analysis {
  const sets = new Sets(), logic = board === 'uno' ? 5 : 3.3;
  /** Every zero-resistance join between two nets, kept so the current in each wire can be traced afterwards. */
  const edges: { a: string; b: string; wire?: string }[] = [];
  const join = (a: string, b: string, wire?: string) => { sets.union(a, b); edges.push({ a, b, wire }); };
  const pinNode = new Map<number, string>();
  const pinName = new Map<number, string>();
  if (board === 'uno') for (let n = 0; n <= 19; n++) pinNode.set(n, 'P' + n);
  else for (const [name, hole] of Object.entries(ESP_HOLES)) {
    const node = holeNode(hole)!, num = /^D(\d+)$/.exec(name) ? +name.slice(1) : ESP_PIN_NUM[name];
    if (name === 'GND' || name === 'GNDf') join(node, 'GND');
    else if (name === '3V3') join(node, 'V3');
    else if (name === 'VIN') join(node, 'V5');
    else if (num != null) { pinNode.set(num, node); pinName.set(num, name); }
  }
  const term = (name: string): string => {
    let m;
    if ((m = /^U:(.+)$/.exec(name))) {
      const x = m[1];
      if (/^GND/.test(x)) return 'GND';
      if (x === '5V') return 'V5'; if (x === '3V3') return 'V3'; if (x === 'VIN') return 'V9';
      if (/^\d+$/.test(x) && +x <= 13) return 'P' + x;
      if ((m = /^A([0-5])$/.exec(x))) return 'P' + (14 + +m[1]);
      return name;
    }
    if ((m = /^E:(.+)$/.exec(name))) return holeNode(ESP_HOLES[m[1]] ?? '') ?? name;
    return holeNode(name) ?? name;
  };
  const root = (name: string) => sets.find(term(name));

  /* 1. Everything wired together shares a net. */
  const els: El[] = [], uses = new Map<string, number>(), sonars: { id: string; vcc: string; trig: string; echo: string; gnd: string }[] = [];
  const pads: { id: string; at: string }[] = [], buzzers: El[] = [], servos: { id: string; el: El; sig: string }[] = [];
  const touch = (n: string) => uses.set(sets.find(term(n)), (uses.get(sets.find(term(n))) ?? 0) + 1);
  const ids = items.map((it, k) => itemId(it, k));
  const needsRoot: [El, string[]][] = [];
  items.forEach((it, k) => {
    const id = ids[k], mk = (kind: El['kind'], a: string, b: string, extra: Partial<El> = {}): El => ({ kind, id, a, b, ohms: 0, vf: 0, it, ...extra });
    switch (it.t) {
      case 'wire': join(term(it.a), term(it.b), id); break;
      case 'res': needsRoot.push([mk('R', it.a, it.b, { ohms: it.ohms ?? 220 }), [it.a, it.b]]); break;
      case 'led': needsRoot.push([mk('D', it.a, it.k, { vf: ledDrop(it.color) }), [it.a, it.k]]); break;
      case 'buzzer': { const e = mk('R', it.a, it.b, { ohms: R_BUZZER }); buzzers.push(e); needsRoot.push([e, [it.a, it.b]]); break; }
      case 'ldr': needsRoot.push([mk('R', it.a, it.b, { ohms: ldrOhms(0.5) }), [it.a, it.b]]); break;
      case 'temp': {
        const [vcc, out, gnd] = [0, 1, 2].map(i => `${it.row}${it.col + i}`);
        needsRoot.push([mk('TEMP', vcc, gnd, { w: out, ohms: R_TEMP_Q }), [vcc, out, gnd]]); break;
      }
      case 'button': {
        const c = it.col, [e0, e1, f0, f1] = [`e${c}`, `e${c + 2}`, `f${c}`, `f${c + 2}`];
        join(term(e0), term(f0)); join(term(e1), term(f1));
        needsRoot.push([mk('SW', e0, e1), [e0, e1, f0, f1]]); break;
      }
      case 'pot': {
        const [t1, t2, t3] = [0, 1, 2].map(i => `${it.row}${it.col + i}`);
        needsRoot.push([mk('POT', t1, t3, { w: t2, ohms: R_POT }), [t1, t2, t3]]); break;
      }
      case 'sonar': {
        const [vcc, trig, echo, gnd] = [0, 1, 2, 3].map(i => `${it.row}${it.col + i}`);
        needsRoot.push([mk('LOAD', vcc, gnd, { ohms: R_SONAR }), [vcc, trig, echo, gnd]]);
        sonars.push({ id, vcc, trig, echo, gnd }); break;
      }
      case 'pad': pads.push({ id, at: 'PAD' }); break;
      case 'contact': needsRoot.push([mk('SW', it.a, it.b, { inv: it.kind === 'tilt' }), [it.a, it.b]]); break;
      case 'slide': {
        const [l, c, r] = [0, 1, 2].map(i => `${it.row}${it.col + i}`);
        needsRoot.push([mk('SW', c, l, { id: `${id}:l`, src: id, inv: true, own: id }), [l, c, r]]);
        needsRoot.push([mk('SW', c, r, { id: `${id}:r`, src: id, own: id }), []]); break;
      }
      case 'module': {
        const [vcc, out, gnd] = [0, 1, 2].map(i => `${it.row}${it.col + i}`);
        needsRoot.push([mk('MOD', vcc, gnd, { w: out, ohms: MODULE_OHMS[it.kind] }), [vcc, out, gnd]]); break;
      }
      case 'rgb': {
        const l = rgbLegs(it);
        RGB_CHANNELS.forEach(([ch, , vf], i) => needsRoot.push([mk('D', l[ch], l.com, { id: `${id}:${ch}`, vf, own: id }), i ? [l[ch]] : [l[ch], l.com]]));
        break;
      }
      case 'joy': {
        const l = joyLegs(it);
        needsRoot.push([mk('POT', l.vcc, l.gnd, { id: `${id}:x`, w: l.x, ohms: R_POT, src: id, own: id }), [l.gnd, l.vcc, l.x, l.y, l.sw]]);
        needsRoot.push([mk('POT', l.vcc, l.gnd, { id: `${id}:y`, w: l.y, ohms: R_POT, src: `${id}:y`, own: id }), []]);
        needsRoot.push([mk('SW', l.sw, l.gnd, { id: `${id}:sw`, src: `${id}:sw`, own: id }), []]); break;
      }
      case 'servo': {
        const { gnd, vcc, sig } = servoLegs(it), e = mk('LOAD', vcc, gnd, { ohms: R_SERVO });
        servos.push({ id, el: e, sig });
        needsRoot.push([e, [gnd, vcc, sig]]); break;
      }
    }
  });
  for (const [el, terms] of needsRoot) { els.push(el); terms.forEach(touch); }
  items.forEach(it => { if (it.t === 'wire') { touch(it.a); touch(it.b); } });

  /* 2. Power nets: a net holding two supplies of different voltage is a short. */
  const fixed = new Map<string, number>();
  let shorted = false;
  for (const [name, v] of Object.entries(POWER)) {
    const r = sets.find(name);
    if (fixed.has(r) && fixed.get(r) !== v) shorted = true; else fixed.set(r, v);
  }
  const volts = (r: string) => fixed.get(sets.find(r));
  const gnd = sets.find('GND');
  const issues: Issue[] = [];

  /* Parts that pass current both ways without changing it much join nets into groups, used to find which pins drive what. */
  const links = (closed: (e: El) => boolean) => {
    const g = new Sets();
    for (const e of els) if (e.kind === 'R' || (e.kind === 'SW' && closed(e))) g.union(sets.find(term(e.a)), sets.find(term(e.b)));
    return g;
  };
  const pinRoots = [...pinNode].map(([n, node]) => [n, sets.find(node)] as const);
  const pinsIn = (g: Sets, r: string, filter: (p: number) => boolean = () => true) => pinRoots.filter(([p, pr]) => g.find(pr) === g.find(r) && filter(p)).map(([p]) => p);
  const supplyIn = (g: Sets, r: string) => [...fixed].some(([fr, v]) => v > 0 && g.find(fr) === g.find(r));
  const gndIn = (g: Sets, r: string) => g.find(gnd) === g.find(r);

  /* 3. Report the mistakes. */
  if (shorted) {
    issues.push({ kind: 'short', severity: 'error', title: 'Short circuit',
      plain: 'A wire or part joins power (5V or 3V3) straight to GND. Nothing limits the current, so on a real board the USB port would cut the power to protect itself. Look for a wire that links a + row to a - row, and remove it.' });
  } else {
    const g = links(e => !(e.it.t === 'slide' && e.inv));   // every switch closed, and a slide switch pushed to one side
    /** Every switch in its other position, so that an LED behind a switch is judged with the switch on. */
    const switched = Object.fromEntries(els.filter(e => e.kind === 'SW').map(e => [e.src ?? e.id, 1]));
    for (const [p, pr] of pinRoots) {
      const v = volts(pr);
      if (v != null && v > logic + 0.3) issues.push({ kind: 'overvoltage', severity: 'error', title: `${v} V on a pin`,
        plain: `${v} V is wired to ${pinName.get(p) ?? 'pin ' + p}, but this board's pins only handle ${logic} V. On a real board that can destroy the chip. Move the wire to a ${logic} V source.` });
    }
    els.forEach(e => {
      const ra = sets.find(term(e.a)), rb = sets.find(term(e.b));
      const rgb = e.it.t === 'rgb', colour = rgb ? RGB_CHANNELS.find(c => e.id.endsWith(`:${c[0]}`))![1] : '', part = e.own ?? e.id;
      const what = e.kind === 'D' ? (rgb ? 'RGB LED' : 'LED') : e.kind === 'R' && e.it.t === 'buzzer' ? 'buzzer' : e.kind === 'R' && e.it.t === 'ldr' ? 'light sensor' : e.kind === 'R' ? 'resistor' : '';
      if (what && ra === rb) { issues.push({ kind: 'part-bypassed', severity: 'warn', part, title: `The ${what} is bypassed`,
        plain: `Both legs of the ${what} are in the same group of connected holes (${e.a} and ${e.b}), so current goes around it and it does nothing. Put each leg in a different column.` }); return; }
      if (e.kind === 'D') {
        const sourceA = pinsIn(g, ra).length > 0 || supplyIn(g, ra), sourceK = pinsIn(g, rb).length > 0 || supplyIn(g, rb);
        if (gndIn(g, ra) && sourceK) {
          if (!rgb) issues.push({ kind: 'led-backwards', severity: 'error', part, title: 'LED is in backwards',
            plain: 'An LED only lets current through one way: the long leg (+) must face the pin or power, the short leg (-) must face GND. This one is the wrong way round, so it stays dark. Select it and press Flip.' });
          else if (!issues.some(i => i.part === part && i.kind === 'led-backwards')) issues.push({ kind: 'led-backwards', severity: 'error', part, title: 'RGB LED is wired backwards',
            plain: 'This RGB LED has a shared − leg: the long one, second from the left. It must go to GND, and the three colour legs must each face a pin through a resistor. Here the long leg is on a pin or on power and a colour leg is on GND, so it stays dark.' });
          return;
        }
        const drive: Record<number, Drive> = {};
        for (const p of pinsIn(g, ra)) drive[p] = { mode: 'out', level: 1 };
        for (const p of pinsIn(g, rb)) drive[p] = { mode: 'out', level: 0 };
        const amps = Math.max(solveAll(drive, {}, []).ledAmps(e.id), Object.keys(switched).length ? solveAll(drive, switched, []).ledAmps(e.id) : 0);
        if (amps > LED_BURN_AMPS) issues.push({ kind: 'led-no-resistor', severity: 'error', part, title: rgb ? `RGB LED: the ${colour} leg has no resistor` : 'LED has no resistor',
          plain: `With nothing to limit it, about ${Math.round(amps * 1000)} mA would flow through the ${rgb ? `${colour} LED inside` : 'LED'}. It can only take about 20 mA, so it burns out. Put a resistor in series with ${rgb ? 'that leg' : 'it'}.` });
        else if (rgb) {   // a colour leg left unwired is a colour not used, which is fine; the shared leg must reach GND
          if (e.id.endsWith(':r') && !gndIn(g, rb)) issues.push({ kind: 'unpowered', severity: 'warn', part, title: 'RGB LED has no ground',
            plain: 'The RGB LED\'s long leg (−), second from the left, is not connected to GND, so none of its colours can light. Wire it to GND, and give each colour leg its own resistor.' });
        }
        else if (amps < 0.0002) {
          const lonely = (r: string) => (uses.get(r) ?? 0) <= 1 && !fixed.has(r) && !pinRoots.some(([, pr]) => pr === r);
          const dangling = lonely(ra) ? e.a : lonely(rb) ? e.b : null;
          issues.push({ kind: 'led-open', severity: 'warn', part, title: 'Open circuit at the LED',
            plain: dangling ? `The LED leg in ${dangling} is not connected to anything. Current needs a complete loop: pin or power, through the LED, and back to GND.`
              : !sourceA && !sourceK ? 'The LED is not connected to a pin or to power. Current needs a complete loop: pin or power, through the LED, and back to GND.'
              : 'The loop is not complete, so no current flows. Check that every part and wire in the chain is in the right column and that something leads back to GND.' });
        }
      }
    });
    const live = (r: string, minV: number) => (volts(r) ?? 0) >= minV;
    els.forEach(e => {
      const ra = sets.find(term(e.a)), rb = sets.find(term(e.b));
      if (e.kind === 'POT' && e.it.t === 'joy') {   // the two knobs inside a joystick share its + and GND pins, so say it once
        if (e.id.endsWith(':x') && !(live(ra, 3) && rb === gnd)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.own, title: 'Joystick has no power',
          plain: 'The joystick has a knob inside for each direction, and they divide a voltage. Wire its + pin to power (5V on the Uno, 3V3 on the ESP32) and its GND pin to GND, or VRx and VRy read nothing.' });
      }
      else if (e.kind === 'POT') {
        const ok = (live(ra, 3) && rb === gnd) || (live(rb, 3) && ra === gnd);
        if (!ok) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Knob has no power',
          plain: 'A potentiometer divides a voltage, so its outer legs need power on one side and GND on the other. The middle leg then reads between them.' });
      }
      if (e.kind === 'MOD' && e.it.t === 'module') {
        const name = MODULE_NAME[e.it.kind], Name = name[0].toUpperCase() + name.slice(1), min = MODULE_MIN_VOLTS[e.it.kind], out = sets.find(term(e.w!)), onPin = pinRoots.some(([, pr]) => pr === out);
        if (live(rb, 2.7) && ra === gnd) issues.push({ kind: 'unpowered', severity: 'error', part: e.id, title: `${Name} is in backwards`,
          plain: `The ${name}'s + pin is on GND and its GND pin is on power, the wrong way round. A real module can be damaged like this. Swap the two outer pins: + on the left, GND on the right.` });
        else if (rb !== gnd) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: `${Name} has no ground`, plain: `The ${name}'s GND pin, on the right, is not connected to GND, so it cannot work.` });
        else if (!live(ra, min)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: `${Name} has no power`,
          plain: (volts(ra) ?? 0) > 0 ? `The ${name} needs 5 V but its + pin only gets ${volts(ra)} V, so it gives no reading. Power it from 5V${board === 'esp32' ? ' (VIN on the ESP32)' : ''}.`
            : `The ${name}'s + pin, on the left, is not connected to ${min > 4 ? (board === 'esp32' ? 'VIN (5 V)' : '5V') : (board === 'esp32' ? '3V3' : '5V')}, so it gives no reading.` });
        else if (!onPin) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: `${Name} is not connected to a pin`, plain: `The ${name}'s middle (OUT) pin is not wired to a pin of the board, so the sketch cannot read it.` });
      }
      if (e.kind === 'TEMP') {
        const out = sets.find(term(e.w!)), onPin = pinRoots.some(([, pr]) => pr === out);
        if (live(rb, TEMP_MIN_VOLTS) && ra === gnd) issues.push({ kind: 'unpowered', severity: 'error', part: e.id, title: 'Temperature sensor is in backwards',
          plain: 'The sensor\'s left leg is on GND and its right leg is on power, the wrong way round. A real TMP36 wired like this gets hot enough to burn a finger. Swap the two outer legs: + on the left, GND on the right.' });
        else if (rb !== gnd) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Temperature sensor has no ground', plain: 'The sensor\'s right leg is not connected to GND, so it cannot work.' });
        else if (!live(ra, TEMP_MIN_VOLTS)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Temperature sensor has no power',
          plain: 'The sensor\'s left leg is not connected to 5V or 3.3V, so it gives no reading. It needs at least 2.7 V.' });
        else if (!onPin) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Temperature sensor is not connected to a pin', plain: 'The sensor\'s middle (OUT) leg is not wired to an analog pin, so the sketch cannot read it.' });
      }
      if (e.kind === 'LOAD' && e.it.t === 'servo') {
        const sig = sets.find(term(servoLegs(e.it).sig)), onPin = (r: string) => pinRoots.some(([, pr]) => pr === r);
        if (rb !== gnd) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Servo has no ground', plain: 'The servo\'s brown GND leg is not connected to GND, so it cannot turn.' });
        else if (!live(ra, SERVO_MIN_VOLTS)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Servo has no power',
          plain: onPin(ra) ? 'The servo\'s red + leg is wired to a pin. A pin cannot give a motor enough current. Power it from 5V (or VIN on the ESP32) and use the orange signal leg for the pin.'
            : (volts(ra) ?? 0) > 0 ? `The servo needs about 5 V but its red + leg only gets ${volts(ra)} V, so it cannot turn. Power it from 5V${board === 'esp32' ? ' (VIN on the ESP32)' : ''}.`
            : 'The servo\'s red + leg is not connected to a 5 V supply, so it cannot turn.' });
        else if (!onPin(sig)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Servo signal is not connected', plain: 'The servo\'s orange signal leg is not wired to a pin, so the sketch cannot tell it where to turn.' });
      }
      else if (e.kind === 'LOAD') {
        if (rb !== gnd) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Sensor has no ground', plain: 'The distance sensor\'s GND leg is not connected to GND, so it cannot work.' });
        else if (!live(ra, 4.5)) issues.push({ kind: 'unpowered', severity: 'warn', part: e.id, title: 'Sensor has no power',
          plain: (volts(ra) ?? 0) > 0 ? `The distance sensor needs 5 V but only gets ${volts(ra)} V, so its readings fail.` : 'The distance sensor\'s VCC leg is not connected to a 5 V supply, so it cannot work.' });
      }
    });
  }

  /* 4. Solve the circuit for the pins' present state. */
  function solveAll(driveIn: Record<number, Drive> | ((p: number) => Drive), inputs: Record<string, number> = {}, burnt: Iterable<string> = []): Solution {
    const drive = (p: number): Drive => (typeof driveIn === 'function' ? driveIn(p) : driveIn[p]) ?? { mode: 'in', level: 0 };
    const dead = new Set(burnt), isDead = (e: El) => dead.has(e.own ?? e.id), closed = (e: El) => ((inputs[e.src ?? e.id] ?? 0) > 0.5) !== !!e.inv;
    const blank: Solution = { shorted: true, volt: () => 0, ledAmps: () => 0, ledGlow: () => 0, ledDuty: () => 0, buzzVolts: () => 0, servoVolts: () => 0, pinsDriving: () => [], pinAmps: () => 0, pinVolt: () => 0, wireAmps: () => 0 };
    if (shorted) return blank;

    /** What a part resists right now: a light sensor changes with the light on it. */
    const ohmsOf = (e: El) => (e.it.t === 'ldr' ? ldrOhms(inputs[e.id] ?? 0.5) : e.ohms);
    /** A temperature sensor gives its voltage only while it has power and ground. */
    const tempOn = (a: string, bb: string) => (fixed.get(a) ?? 0) >= TEMP_MIN_VOLTS && bb === gnd;
    /** The voltage a sensor module puts on its OUT pin, or null while it has no power or no ground. */
    const moduleOut = (e: El, a: string, bb: string) => (e.it.t === 'module' && (fixed.get(a) ?? 0) >= MODULE_MIN_VOLTS[e.it.kind] && bb === gnd ? moduleVolts(e.it.kind, inputs[e.id] ?? 0, fixed.get(a)!) : null);
    const idx = new Map<string, number>();
    const node = (r: string) => { r = sets.find(r); if (!fixed.has(r) && !idx.has(r)) idx.set(r, idx.size); return r; };
    const ref = (n: string) => node(term(n));
    const parts = els.map(e => ({ e, a: ref(e.a), b: ref(e.b), w: e.w ? ref(e.w) : '' }));
    const pins = pinRoots.map(([p, r]) => ({ p, r: node(r), d: drive(p) })).filter(x => x.d.mode !== 'in');
    pinRoots.forEach(([, r]) => node(r));
    const on = new Map<string, boolean>();
    let x: number[] = [];
    const n = () => idx.size;

    for (let pass = 0; pass < 30; pass++) {
      const N = n(), G = Array.from({ length: N }, () => new Array<number>(N).fill(0)), b = new Array<number>(N).fill(0);
      for (let i = 0; i < N; i++) G[i][i] += G_MIN;
      const between = (ra: string, rb: string, g: number) => {
        const ia = idx.get(ra), ib = idx.get(rb);
        if (ia != null) { G[ia][ia] += g; if (ib != null) G[ia][ib] -= g; else b[ia] += g * (fixed.get(rb) ?? 0); }
        if (ib != null) { G[ib][ib] += g; if (ia != null) G[ib][ia] -= g; else b[ib] += g * (fixed.get(ra) ?? 0); }
      };
      for (const { p, r, d } of pins) {
        const i = idx.get(r), vs = d.mode === 'pullup' ? logic : d.level > 0 ? logic : 0, g = 1 / (d.mode === 'pullup' ? R_PULLUP : R_PIN);
        if (i != null) { G[i][i] += g; b[i] += g * vs; }
        void p;
      }
      for (const { e, a, b: bb, w } of parts) {
        if (e.kind === 'R' || e.kind === 'LOAD') between(a, bb, 1 / ohmsOf(e));
        else if (e.kind === 'TEMP') {
          between(a, bb, 1 / e.ohms);
          const i = idx.get(w);
          if (i != null && tempOn(a, bb)) { G[i][i] += 1 / R_TEMP_OUT; b[i] += tempVolts(inputs[e.id] ?? 25) / R_TEMP_OUT; }
        }
        else if (e.kind === 'MOD') {
          between(a, bb, 1 / e.ohms);
          const i = idx.get(w), out = moduleOut(e, a, bb);
          if (i != null && out != null) { G[i][i] += 1 / R_MODULE_OUT; b[i] += out / R_MODULE_OUT; }
        }
        else if (e.kind === 'SW') { if (closed(e)) between(a, bb, 1 / R_SWITCH); }
        else if (e.kind === 'POT') {
          const v = Math.min(1, Math.max(0, inputs[e.src ?? e.id] ?? 0.5));
          between(a, w, 1 / Math.max(1, e.ohms * (1 - v))); between(w, bb, 1 / Math.max(1, e.ohms * v));
        } else if (e.kind === 'D' && on.get(e.id) && !isDead(e)) {
          between(a, bb, 1 / R_LED);
          const ia = idx.get(a), ib = idx.get(bb), c = e.vf / R_LED;
          if (ia != null) b[ia] += c;
          if (ib != null) b[ib] -= c;
        }
      }
      x = gauss(G, b);
      let changed = false;
      for (const { e, a, b: bb } of parts) {
        if (e.kind !== 'D' || isDead(e)) continue;
        const vd = volt(a) - volt(bb), was = !!on.get(e.id), now = was ? (vd - e.vf) / R_LED >= 0 : vd > e.vf;
        if (now !== was) { on.set(e.id, now); changed = true; }
      }
      if (!changed) break;
    }
    function volt(r: string) { const i = idx.get(r); return i != null ? x[i] : fixed.get(r) ?? 0; }

    const g = links(closed);
    const amps = (e: El, a: string, bb: string) => {   // below a microamp is only the leakage that keeps floating nets solvable
      const i = e.kind === 'D' && on.get(e.id) && !isDead(e) ? Math.max(0, (volt(a) - volt(bb) - e.vf) / R_LED) : 0;
      return i < 1e-6 ? 0 : i;
    };
    const part = (id: string) => parts.find(q => q.e.id === id);
    /** An LED fed from a pin is on for as long as that pin is high; one fed straight from a supply is always on. */
    const dutyOf = (q: { a: string }) => Math.max(0, ...pinRoots.filter(([p, pr]) => drive(p).mode === 'out' && g.find(pr) === g.find(q.a)).map(([p]) => drive(p).level)) || 1;
    const driving = (id: string) => {
      const q = part(id);
      return q ? pinRoots.filter(([p, pr]) => drive(p).mode !== 'in' && drive(p).level > 0 && (g.find(pr) === g.find(q.a) || g.find(pr) === g.find(q.b))).map(([p]) => p) : [];
    };
    /** Current in each wire. The parts and pins say how much current enters or leaves each net; the wires of a net are then taken as a tree, and each wire carries what the part of the tree beyond it injects. */
    let flows: Map<string, number> | null = null;
    function traceWires(): Map<string, number> {
      const inj = new Map<string, number>(), add = (h: string, i: number) => inj.set(h, (inj.get(h) ?? 0) + i);
      for (const { e, a, b: bb, w } of parts) {
        const va = volt(a), vb = volt(bb);
        let i = 0;
        if (e.kind === 'R' || e.kind === 'LOAD') i = (va - vb) / ohmsOf(e);
        else if (e.kind === 'TEMP') {
          i = (va - vb) / e.ohms;
          if (tempOn(a, bb)) add(term(e.w!), (tempVolts(inputs[e.id] ?? 25) - volt(w)) / R_TEMP_OUT);
        }
        else if (e.kind === 'MOD') {
          i = (va - vb) / e.ohms;
          const out = moduleOut(e, a, bb);
          if (out != null) add(term(e.w!), (out - volt(w)) / R_MODULE_OUT);
        }
        else if (e.kind === 'SW') i = closed(e) ? (va - vb) / R_SWITCH : 0;
        else if (e.kind === 'D') i = amps(e, a, bb);
        else if (e.kind === 'POT') {
          const v = Math.min(1, Math.max(0, inputs[e.src ?? e.id] ?? 0.5)), vw = volt(w), i12 = (va - vw) / Math.max(1, e.ohms * (1 - v)), i23 = (vw - vb) / Math.max(1, e.ohms * v);
          add(term(e.a), -i12); add(term(e.w!), i12 - i23); add(term(e.b), i23);
          continue;
        }
        add(term(e.a), -i); add(term(e.b), i);
      }
      for (const { p, r, d } of pins) {
        const vs = d.mode === 'pullup' || d.level > 0 ? logic : 0;
        add(pinNode.get(p)!, (vs - volt(r)) / (d.mode === 'pullup' ? R_PULLUP : R_PIN));
      }
      const next = new Map<string, { to: string; edge: number }[]>();
      edges.forEach((ed, k) => {
        if (ed.a === ed.b) return;
        for (const [x, y] of [[ed.a, ed.b], [ed.b, ed.a]]) next.set(x, [...(next.get(x) ?? []), { to: y, edge: k }]);
      });
      const out = new Map<string, number>(), seen = new Set<string>();
      for (const start of next.keys()) {
        if (seen.has(start)) continue;
        const comp = [start];   // find the whole net first, so the walk can begin at a supply pin
        for (let i = 0; i < comp.length; i++) for (const { to } of next.get(comp[i])!) if (!comp.includes(to)) comp.push(to);
        comp.forEach(h => seen.add(h));
        const root = comp.find(h => h in POWER) ?? start, order = [root], via = new Map<string, number>(), parent = new Map<string, string>();
        for (let i = 0; i < order.length; i++) for (const { to, edge } of next.get(order[i])!) if (to !== root && !parent.has(to)) { parent.set(to, order[i]); via.set(to, edge); order.push(to); }
        const sub = new Map<string, number>();
        for (let i = order.length - 1; i > 0; i--) {   // leaves first: what a branch injects must leave through its edge
          const h = order[i], s = (sub.get(h) ?? 0) + (inj.get(h) ?? 0), ed = edges[via.get(h)!];
          sub.set(parent.get(h)!, (sub.get(parent.get(h)!) ?? 0) + s);
          if (ed.wire != null) out.set(ed.wire, (out.get(ed.wire) ?? 0) + (ed.a === h ? s : -s));
        }
      }
      return out;
    }
    return {
      shorted: false,
      wireAmps: id => (flows ??= traceWires()).get(id) ?? 0,
      volt: point => volt(sets.find(term(point))),
      ledAmps: id => { const q = part(id); return q ? amps(q.e, q.a, q.b) : 0; },
      ledGlow: id => {
        const q = part(id); if (!q) return 0;
        const i = amps(q.e, q.a, q.b); if (i <= 0) return 0;
        return Math.sqrt(Math.min(1, dutyOf(q) * i / 0.005));
      },
      ledDuty: id => { const q = part(id); return q && amps(q.e, q.a, q.b) > 0 ? dutyOf(q) : 0; },
      buzzVolts: id => { const q = part(id); return q ? Math.abs(volt(q.a) - volt(q.b)) : 0; },
      servoVolts: id => { const q = part(id); return q && q.e.it.t === 'servo' ? volt(q.a) - volt(q.b) : 0; },
      pinsDriving: driving,
      pinVolt: p => { const r = pinRoots.find(([n2]) => n2 === p)?.[1]; return r ? volt(r) : 0; },
      pinAmps: p => {
        const d = drive(p), r = pinRoots.find(([n2]) => n2 === p)?.[1];
        if (!r || d.mode === 'in') return 0;
        return ((d.mode === 'pullup' || d.level > 0 ? logic : 0) - volt(r)) / (d.mode === 'pullup' ? R_PULLUP : R_PIN);
      },
    };
  }

  return {
    issues, solve: solveAll,
    pinAt: point => { const r = root(point); return pinRoots.find(([, pr]) => pr === r)?.[0] ?? null; },
    joined: (a, b) => root(a) === root(b),
    servoPin: id => { const s = servos.find(x => x.id === id); if (!s) return null; const r = root(s.sig); return pinRoots.find(([, pr]) => pr === r)?.[0] ?? null; },
    netOf: point => { const r = root(point); return { id: r, pins: pinRoots.filter(([, pr]) => pr === r).map(([p]) => p), volts: fixed.get(r) ?? null }; },
  };
}

/** Solves G x = b by Gaussian elimination. The matrices here have a few dozen rows at most. */
function gauss(G: number[][], b: number[]): number[] {
  const n = b.length, A = G.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-18) continue;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (f) for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = A[r][n];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = Math.abs(A[r][r]) < 1e-18 ? 0 : s / A[r][r];
  }
  return x;
}
