import { BOARDS } from '../data/boards';
import { isAvailable, lockedBy, MISSIONS, PARTS, trayParts, unlockedParts, type PartId } from '../data/missions';
import { ensureAudio } from '../sim/audio';
import { observe, runChecks } from '../sim/check';
import { analyze } from '../sim/circuit';
import { makeHW, makeReadout, type Readout, type VirtualHW } from '../sim/hardware';
import { run as runSketch, SimError, type RunControl } from '../sim/interpreter';
import { ANSWER_MS, parseAddress, type Answer } from '../sim/network';
import { pushFrame, type Frame } from '../sim/timeline';
import { BREADBOARD_COLS, itemId, MAIN_COLS, type BoardId, type BreadboardSize, type Item } from '../types';
import { clampWidth, closePanel as closePanelIn, closeTop, isOpen, openPanel as openPanelIn, widestPanel, type Panel, type Side } from './panels';
import { flipped, holesOf, homedBreadboard, inputsOf, makeItem, movedBreadboard, movedPart, movedWire, parseTerminal, placementError, resizedBreadboard, sameTool, TWO_POINT, withoutBreadboard, type Tool } from './bench';
import { placeOf, slide, type Place } from './table';
import { guideHash, parseHash } from './route';
import { cardOf, fitsAll, type CardId } from '../data/boardchoice';
import { TEMPLATES } from '../data/templates';
import { benchOf, burntOf, codeOf, FRESH_PHONE, keyOf, missionOf, saveBenches, saveProgress, saveSketches, saveWidths, useLab, type Tab } from './store';
import { emptyProgress, makeBackup, parseBackup, describe, type Progress } from './progress';

const set = useLab.setState, get = useLab.getState;

/* --- messages about the bench --- */
let noticeId = 0, noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function say(tone: 'error' | 'warn' | 'info', text: string, keepFor = 9000) {
  const id = ++noticeId;
  clearTimeout(noticeTimer);
  set({ notice: { id, tone, text } });
  if (keepFor) noticeTimer = setTimeout(() => { if (get().notice?.id === id) set({ notice: null }); }, keepFor);
}
export const dismissNotice = () => set({ notice: null });

/* --- running sketches --- */
let active: { hw: VirtualHW; ctl: RunControl } | null = null;
let serialBuf = '', flushQueued = false;

/** The virtual board of the sketch that is running, for the 3D view to read pin states from. */
export const activeHW = () => active?.hw ?? null;

/* --- recording a run, stepping through it and looking back --- */
let frames: Frame[] = [], lastHW: VirtualHW | null = null, stepping = false, waiter: (() => void) | null = null, bumpQueued = false;
let replayed: { cursor: number; tick: number; readout: Readout } | null = null;
export const getFrames = () => frames;
function bump() {
  if (bumpQueued) return;
  bumpQueued = true;
  requestAnimationFrame(() => { bumpQueued = false; set(s => ({ frameTick: s.frameTick + 1 })); });
}
function forgetRun() { frames = []; lastHW = null; replayed = null; set(s => ({ cursor: null, paused: false, line: null, frameTick: s.frameTick + 1 })); }
function release() { const w = waiter; waiter = null; w?.(); }

/** What the 3D view and the voltage readout should show: the frame being looked at, else the running board, else nothing. */
export function currentReadout(): Readout | null {
  const s = get();
  if (s.cursor != null && frames[s.cursor] && lastHW) {
    if (!replayed || replayed.cursor !== s.cursor || replayed.tick !== s.frameTick) {
      replayed = { cursor: s.cursor, tick: s.frameTick, readout: makeReadout(BOARDS[s.board], lastHW.analysis, frames[s.cursor], burntOf(s)) };
    }
    return replayed.readout;
  }
  return active?.hw.readout() ?? null;
}

function print(text: string) {
  serialBuf = (serialBuf + text).slice(-6000);
  if (flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(() => { flushQueued = false; set({ serial: serialBuf }); });
}
export function clearSerial() { serialBuf = ''; set({ serial: '' }); }
/** Sends a line typed into the Serial Monitor to the running sketch, ending in a newline as the Arduino IDE sends it. False when no sketch is running to receive it. */
export function sendSerial(text: string): boolean {
  if (!active) return false;
  for (const ch of `${text}\n`) active.hw.serialIn.push(ch.charCodeAt(0));
  return true;
}

/** Step mode: runs one more line, or starts the sketch held at its first line. While the sketch is running freely this pauses it at the next line. */
export function stepOnce() {
  if (!active) { requestRun(true); return; }
  stepping = true; active.hw.skipDelays = true;
  set({ cursor: null });
  if (waiter) release(); else active.hw.wakeUp();
}
/** Leaves step mode and lets the sketch run at full speed again. */
export function resumeRun() {
  if (!active) return;
  stepping = false; active.hw.skipDelays = false;
  set({ paused: false, line: null, cursor: null });
  release();
}
/** Looks at an earlier frame. Only while the sketch is stopped or held at a line. */
export function scrubTo(i: number) {
  if (!frames.length) return;
  const s = get();
  if (s.running && !s.paused) return;
  set({ cursor: Math.max(0, Math.min(frames.length - 1, Math.round(i))) });
}
export const goLive = () => set({ cursor: null });
export function setProbe(probe: { name: string; x: number; y: number } | null) {
  const cur = get().probe;
  if (!probe && !cur) return;
  if (probe && cur && probe.name === cur.name && Math.hypot(probe.x - cur.x, probe.y - cur.y) < 3) return;
  set({ probe });
}

export function stopRun() {
  if (!active) return;
  active.ctl.stop = true; active.hw.wakeUp(); release(); active = null; stepping = false;
  set({ running: false, paused: false, line: null });
}
/** Starts the sketch. With stepFirst it is held before its first line, ready for Step. */
export function startRun(stepFirst = false) {
  stopRun();
  const s = get(), key = keyOf(s), bench = benchOf(s);
  clearSerial(); set({ errLine: null }); forgetRun();
  const trouble = analyze(s.board, bench).issues.find(i => i.kind === 'short');
  if (trouble) {
    print(`⚠ Not started: ${trouble.title}. ${trouble.plain}\n`);
    say('error', `${trouble.title}. The power was cut, so the sketch did not start. ${trouble.plain}`, 0);
    return;
  }
  set({ running: true });
  if (s.sound) ensureAudio();
  let hw: VirtualHW | undefined, hwDone = false;
  hw = makeHW(BOARDS[s.board], bench, () => get().inputs, print, {
    burnt: burntOf(s),
    onBurn: id => {
      const why = analyze(s.board, bench).issues.find(i => i.part === id && i.kind === 'led-no-resistor');
      const text = `The LED burned out. ${why ? why.plain : 'Too much current flowed through it.'} Remove it and place a new one.`;
      print(`\n🔥 ${text}\n`); say('error', text, 0);
      set(st => {
        const burnt = { ...st.burnt, [key]: [...(st.burnt[key] ?? []), id] };
        saveBenches(st.benches, burnt);
        return { burnt };
      });
    },
    onAlert: text => { print(`\n⚠ ${text}\n`); say('warn', text, 0); },
    onChange: () => { if (!stepping && !hwDone) { pushFrame(frames, hw!.snapshot()); bump(); } },
  });
  stepping = stepFirst; hw.skipDelays = stepFirst; lastHW = hw;
  const ctl: RunControl = {
    stop: false,
    step(line) {
      hw.line = line;
      if (!stepping) return;
      pushFrame(frames, hw.snapshot()); bump();
      set({ paused: true, line, cursor: null });
      return new Promise<void>(r => { waiter = r; });
    },
  };
  const mine = (active = { hw, ctl });
  runSketch(codeOf(s), hw, ctl)
    .catch((e: unknown) => {
      if (active !== mine) return;
      if (e instanceof SimError) { print(`\n⚠ Line ${e.line}: ${e.message}\n`); set({ errLine: e.line }); }
      else print(`\n⚠ The simulator hit a problem: ${e instanceof Error ? e.message : e}\n`);
    })
    .then(() => { hwDone = true; if (active === mine) { active = null; stepping = false; set({ running: false, paused: false, line: null }); } });
}
/* --- the phone beside the bench, on the same Wi-Fi as the ESP32. It opens the pages the running sketch serves. --- */
let phoneAsk = 0, phoneTimer: ReturnType<typeof setTimeout> | undefined;
/** The phone opens an address: typed into it, or a link or form on the page it shows. The answer, or why there is none, shows on the phone. */
export function browse(url: string, opts: { method?: 'GET' | 'POST'; form?: [string, string][] } = {}) {
  const ask = ++phoneAsk, hw = active?.hw, net = hw?.net, at = parseAddress(url)?.href ?? url;
  clearTimeout(phoneTimer);
  const show = (answer: Answer, from: string) => { if (ask === phoneAsk) { clearTimeout(phoneTimer); set({ phone: { url: from, answer, loading: false } }); } };   // a newer request has the phone now
  if (!hw || !net) { show({ kind: 'offline', why: 'stopped' }, at); return; }
  set({ phone: { url: at, answer: get().phone.answer, loading: true } });   // the old page stays on the screen while the new one comes
  const now = hw.now(), id = net.visit(at, now, now, { ...opts, done: show });
  if (ask === phoneAsk && get().phone.loading) phoneTimer = setTimeout(() => net.giveUp(id), ANSWER_MS);
}
/** A blank phone for a new mission. */
function resetPhone() { phoneAsk++; clearTimeout(phoneTimer); set({ phone: FRESH_PHONE }); }

/* --- pages: the address bar hash says which page shows (see route.ts), and in the lab which mission is open (#uno-beacon) --- */
const passedKeys = () => new Set(Object.keys(get().passed));
const saveMissionProgress = () => { const { passed, hintsUsed, predictions, picks } = get(); saveProgress({ passed, hintsUsed, predictions, picks }); };

export function openFromHash() {
  const route = parseHash(location.hash), was = get();
  stopRun();
  if (route.page === 'guide') {   // the guide is a page of its own. The bench is left as it was, as if Stop had been pressed.
    if (location.hash !== guideHash(route.chapter)) history.replaceState(null, '', guideHash(route.chapter));
    set({ page: 'guide', guide: route.chapter, help: false, asking: null, tool: null, pending: null, point: null, drag: null });
    return;
  }
  if (route.page === 'boards') {   // so is the board comparison, and it leaves the bench the same way
    set({ page: 'boards', help: false, asking: null, tool: null, pending: null, point: null, drag: null });
    return;
  }
  let board = was.board, mission = was.mission;   // the home page keeps the last mission, so the guide can still lead back to it
  if (route.page === 'lab') {
    board = route.board && Object.hasOwn(BOARDS, route.board) ? (route.board as BoardId) : 'uno';
    const list = MISSIONS[board];
    mission = Math.max(0, list.findIndex(x => x.id === route.mission));
    if (!isAvailable(board, list[mission], passedKeys())) {   // a mission that is still closed: start at the workshop tour instead
      mission = 0;
      history.replaceState(null, '', `#${board}-${list[0].id}`);
    }
    if ((was.page === 'guide' || was.page === 'boards') && was.labSeen && board === was.board && mission === was.mission) {   // back from the guide or the boards to the same mission: everything is as it was left
      set({ page: 'lab' });
      if (was.page === 'guide') focusToggle('guide');
      return;
    }
  }
  forgetRun();
  serialBuf = '';
  resetPhone();
  const home = route.page === 'home';
  const choosing = !home && !!MISSIONS[board][mission].choice;
  set(s => {
    const open = home || (isPhone() && !s.templateFocus) ? s.panels : openPanelIn(s.panels, 'brief', isNarrow());   // a new mission opens its brief, except on a phone where it would cover the bench, unless a template was asked for
    return { page: home ? 'home' : 'lab', labSeen: s.labSeen || !home, board, mission, hot: null, serial: '', errLine: null, tool: null, pending: null, point: null, notice: null, results: null, asking: null, checking: false, drag: null, bbDrag: null, partDrag: null, panels: choosing ? closePanelIn(closePanelIn(open, 'code'), 'parts') : home || isNarrow() || open.right ? open : openPanelIn(open, 'parts', false) };   // choosing a board needs no code or parts, and on a wide screen the parts are at hand
  });
  syncInputs();
}

/** Gives every part with an on-screen control a value, and drops the values of parts that are gone. */
function syncInputs() {
  const s = get(), inputs: Record<string, number> = {};
  benchOf(s).forEach((it, k) => { for (const [name, rest] of Object.entries(inputsOf(it, itemId(it, k)))) inputs[name] = s.inputs[name] ?? rest; });
  set({ inputs });
}
export const goTo = (board: BoardId, missionId: string) => { location.hash = `${board}-${missionId}`; };

/* --- editing the bench --- */
const HISTORY = 60;
/** The last nudge with the arrow keys, so a quick run of them on the same thing is one undo step. */
let lastNudge: { what: string; at: number } | null = null;
/** Does this change join the undo step before it? Only a nudge of the same thing, a moment after the last one, does. Any other change ends the run. */
function joinsLast(nudge?: string): boolean {
  const what = nudge ? `${keyOf(get())}:${nudge}` : null, now = Date.now(), same = !!what && lastNudge?.what === what && now - lastNudge.at < 1500;
  lastNudge = what ? { what, at: now } : null;
  return same;
}
/** Replaces the bench with a new one, remembering the old one for undo, and says so if the new one is a short circuit. `nudge` names what an arrow key moved. */
function change(items: Item[], burnt = burntOf(get()), nudge?: string) {
  const s = get(), key = keyOf(s), before = { items: benchOf(s), burnt: burntOf(s) };
  stopRun(); forgetRun();
  const benches = { ...s.benches, [key]: items }, burntAll = { ...s.burnt, [key]: burnt };
  saveBenches(benches, burntAll);
  set({
    benches, burnt: burntAll,
    undo: joinsLast(nudge) ? s.undo : { ...s.undo, [key]: [...(s.undo[key] ?? []).slice(-HISTORY), before] }, redo: { ...s.redo, [key]: [] }, results: null,
  });
  syncInputs();
  const short = analyze(s.board, items).issues.find(i => i.kind === 'short');
  if (short) { set(st => ({ sparks: st.sparks + 1 })); say('error', `${short.title}! ${short.plain}`, 0); }
  else if (get().notice?.tone === 'error') dismissNotice();
}
function restore(from: 'undo' | 'redo') {
  const s = get(), key = keyOf(s), stack = s[from][key];
  if (!stack?.length) return;
  const snap = stack[stack.length - 1], other = from === 'undo' ? 'redo' : 'undo', here = { items: benchOf(s), burnt: burntOf(s) };
  stopRun(); forgetRun(); lastNudge = null;
  const benches = { ...s.benches, [key]: snap.items }, burnt = { ...s.burnt, [key]: snap.burnt };
  saveBenches(benches, burnt);
  const stacks = { undo: s.undo, redo: s.redo };
  stacks[from] = { ...s[from], [key]: stack.slice(0, -1) };
  stacks[other] = { ...s[other], [key]: [...(s[other][key] ?? []), here] };
  set({ benches, burnt, ...stacks, results: null });
  syncInputs();
  dismissNotice();
}
export const undo = () => restore('undo');
export const redo = () => restore('redo');
export function resetBench() {
  if (!benchOf(get()).length && !burntOf(get()).length) return;
  change([], []); set({ hot: null, tool: null, pending: null });
  say('info', 'The bench is clear. Undo brings the circuit back.', 5000);
}
/** Builds the mission's reference circuit. Only offered with the last hint. */
export function showAnswer() {
  change(missionOf(get()).circuit.map(it => ({ ...it })), []); set({ hot: null, tool: null, pending: null });
  say('info', 'This is the mission\'s reference circuit. Undo puts your own back.', 6000);
}
export function removeItem(id: string) {
  const bench = benchOf(get());
  if (bench.some((it, k) => it.t === 'breadboard' && itemId(it, k) === id)) {   // what is plugged into the second breadboard comes off with it
    const kept = new Set(withoutBreadboard(bench)), gone = bench.filter(it => !kept.has(it) && it.t !== 'breadboard');
    const removed = new Set(bench.flatMap((it, k) => (kept.has(it) ? [] : [itemId(it, k)]))), wires = gone.filter(it => it.t === 'wire').length, parts = gone.length - wires;
    const count = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? '' : 's'}` : '');
    change([...kept], burntOf(get()).filter(b => !removed.has(b)));
    set({ hot: null });
    say('info', gone.length ? `The second breadboard is off the bench, along with ${[count(parts, 'part'), count(wires, 'wire')].filter(Boolean).join(' and ')} plugged into it. Undo puts it all back.` : 'The second breadboard is off the bench.', 7000);
    return;
  }
  change(bench.filter((it, k) => itemId(it, k) !== id), burntOf(get()).filter(b => b !== id));
  set({ hot: null });
}
export function flipItem(id: string) {
  change(benchOf(get()).map((it, k) => (itemId(it, k) === id ? flipped(it) : it)));
}

/* --- changing a placed part: an LED's colour, a resistor's value, the second breadboard's size. The next one placed takes the same. --- */
/** Changes one placed part. A quick run of changes to the same part, such as dragging a resistor's value along, is one undo step. */
function editPart(id: string, edit: (it: Item) => Item) {
  const bench = benchOf(get()), items = bench.map((it, k) => (itemId(it, k) === id ? edit(it) : it));
  if (items.some((it, k) => it !== bench[k])) change(items, burntOf(get()), `edit:${id}`);
}
/** Gives a placed LED another colour. */
export function setPartColor(id: string, color: number) {
  editPart(id, it => (it.t === 'led' && it.color !== color ? { ...it, color } : it));
  setLedColor(color);
}
/** Gives a placed resistor another value: its bands change with it. */
export function setPartOhms(id: string, ohms: number) {
  editPart(id, it => (it.t === 'res' && (it.ohms ?? 220) !== ohms ? { ...it, ohms } : it));
  setOhms(ohms);
}
/** Makes the second breadboard short or long, if what is plugged into it still fits. */
export function resizeBreadboard(size: BreadboardSize) {
  placeBreadboard(size);
  const bb = secondOf(benchOf(get()));
  if (bb?.t === 'breadboard') setBreadboardSize(bb.size);
}
const addItem = (it: Item) => change([...benchOf(get()), it]);

/* --- moving a placed part to other holes --- */
/** The pointer drags a placed part: it has moved so many rows and columns, and is over the hole `to`. */
export function dragPart(id: string, rows: number, cols: number, to: string) {
  const d = get().partDrag;
  if (d?.id !== id || d.rows !== rows || d.cols !== cols || d.to !== to) set({ partDrag: { id, rows, cols, to } });
}
/** The pointer came up: the part goes into the holes it was dragged to, or stays where it was and the student is told why. */
export function dropPart() {
  const d = get().partDrag, bench = benchOf(get());
  set({ partDrag: null });
  if (!d) return;
  const r = movedPart(get().board, bench, d.id, d.rows, d.cols);
  if ('error' in r) say('warn', r.error, 6000);
  else if (r.items !== bench) { dismissNotice(); change(r.items); }
}
/** The arrow keys move the selected part a hole at a time. A quick run of them is one undo step. */
export function nudgePart(id: string, rows: number, cols: number) {
  const bench = benchOf(get()), r = movedPart(get().board, bench, id, rows, cols);
  if ('error' in r) say('warn', r.error, 5000);
  else if (r.items !== bench) change(r.items, burntOf(get()), `part:${id}`);
}

/* --- moving the second breadboard around the table --- */
/** Moves something on the table without changing the circuit, so a running sketch keeps running. It is remembered for undo, and a quick run of nudges is one undo step. */
function moveOnTable(items: Item[], nudge?: string) {
  const s = get(), key = keyOf(s);
  const benches = { ...s.benches, [key]: items };
  saveBenches(benches, s.burnt);
  set({ benches, undo: joinsLast(nudge) ? s.undo : { ...s.undo, [key]: [...(s.undo[key] ?? []).slice(-HISTORY), { items: benchOf(s), burnt: burntOf(s) }] }, redo: { ...s.redo, [key]: [] } });
}
const secondOf = (items: Item[]) => items.find(it => it.t === 'breadboard');
/** The pointer drags the second breadboard towards a place on the table. It goes as far as it can without landing on anything. */
export function dragBreadboard(want: Place) {
  const s = get(), bb = secondOf(benchOf(s));
  if (bb?.t !== 'breadboard') return;
  const to = slide(s.board, benchOf(s), bb.size, s.bbDrag ?? placeOf(bb), want);
  if (to.x !== s.bbDrag?.x || to.z !== s.bbDrag?.z) set({ bbDrag: to });
}
/** The pointer came up: the second breadboard stays where it was dragged. It is not selected, as its card would cover the place it was just put. */
export function dropBreadboard() {
  const s = get(), to = s.bbDrag, bench = benchOf(s), k = bench.findIndex(it => it.t === 'breadboard'), bb = bench[k];
  set({ bbDrag: null });
  if (!to || bb?.t !== 'breadboard') return;
  const from = placeOf(bb);
  if (to.x !== from.x || to.z !== from.z) moveOnTable(bench.map((it, i) => (i === k ? { ...bb, x: to.x, z: to.z } : it)));
}
/** The arrow keys move the selected second breadboard a step at a time. */
export function nudgeBreadboard(dx: number, dz: number) {
  const s = get(), bench = benchOf(s), bb = secondOf(bench);
  if (bb?.t !== 'breadboard') return;
  const from = placeOf(bb), items = movedBreadboard(s.board, bench, { x: from.x + dx, z: from.z + dz });
  if (items !== bench) moveOnTable(items, 'breadboard');
  else say('info', 'The second breadboard cannot go any further that way.', 3000);
}
/** Puts the second breadboard back beside the first, where it started. */
export function homeBreadboard() {
  const bench = benchOf(get());
  if (secondOf(bench)) moveOnTable(homedBreadboard(bench));
}

/* --- moving the end of a wire --- */
const wireEnds = (name: string) => {
  const found: { id: string; end: 'a' | 'b' }[] = [];
  benchOf(get()).forEach((it, k) => { if (it.t === 'wire') for (const end of ['a', 'b'] as const) if (it[end] === name) found.push({ id: itemId(it, k), end }); });
  return found;
};
/** Is a wire plugged into this point? */
export const isWireEnd = (name: string) => wireEnds(name).length > 0;
/** The pointer went down on a wire end: it now follows the pointer. Returns true when there was a wire end to take hold of. */
export function beginMove(name: string): boolean {
  const e = wireEnds(name)[0];
  if (!e) return false;
  set({ drag: { ...e, to: name }, pending: null });
  return true;
}
export const moveTo = (to: string | null) => set(s => (s.drag && s.drag.to !== to ? { drag: { ...s.drag, to } } : {}));
/** The pointer came up: plug the wire end into the point it is over, if that is allowed. */
export function finishMove(to: string | null) {
  const d = get().drag, bench = benchOf(get());
  set({ drag: null });
  if (!d || !to) return;
  const r = movedWire(get().board, bench, d.id, d.end, to);
  if ('error' in r) { say('warn', r.error, 6000); return; }
  if (r.items !== bench) { change(r.items); set({ hot: d.id }); }
}
/** The keyboard way: type where each end of the selected wire should go. */
export function moveWireTyped(id: string, aText: string, bText: string): string | null {
  const s = get(), bench = benchOf(s);
  let items = bench;
  for (const [end, text] of [['a', aText], ['b', bText]] as const) {
    const to = parseTerminal(s.board, text, bench);
    if (!to) return `"${text}" is not a place on this bench. Holes look like e10, rails like T+5, pins like 13 or gnd.`;
    const r = movedWire(s.board, items, id, end, to);
    if ('error' in r) return r.error;
    items = r.items;
  }
  if (items !== bench) change(items);
  return null;
}

/* --- choosing and placing parts --- */
/** The tray part a tool belongs to. */
const partOf = (tool: Tool): PartId | undefined =>
  (Object.keys(PARTS) as PartId[]).find(id => sameTool(tool, PARTS[id].tool));   // a resistor of any value is the resistor, an LED of any colour the LED

/** Picks the resistor value to place. A resistor that is already in hand changes value at once. */
export function setOhms(ohms: number) {
  set(s => ({ ohms, tool: s.tool?.kind === 'res' ? { ...s.tool, ohms } : s.tool }));
}
/** Picks the colour of the next LED to place. An LED that is already in hand changes colour at once. */
export function setLedColor(color: number) {
  set(s => ({ ledColor: color, tool: s.tool?.kind === 'led' ? { ...s.tool, color } : s.tool }));
}
/** Picks the size of the second breadboard. Nothing changes on the bench until the tile is pressed. */
export const setBreadboardSize = (bbSize: BreadboardSize) => set({ bbSize });
/** Puts a second breadboard of this size on the bench, or makes the one there this size. */
function placeBreadboard(size: BreadboardSize) {
  const bench = benchOf(get()), there = bench.find(it => it.t === 'breadboard'), span = `columns ${MAIN_COLS + 1} to ${MAIN_COLS + BREADBOARD_COLS[size]}`;
  if (!there) {
    addItem(makeItem({ kind: 'breadboard', size }, bench, 'BB'));
    say('info', `A ${size} breadboard is on the right of the bench: ${span}. Its rails are its own, so wire them to the first breadboard's rails or to the board.`, 8000);
  } else if (there.size === size) say('info', `The ${size} breadboard is already on the bench. Select it to make it ${size === 'short' ? 'long' : 'short'} or to take it off.`, 6000);
  else {
    const r = resizedBreadboard(get().board, bench, size);
    if ('error' in r) say('warn', r.error, 8000);
    else { change(r.items); say('info', `The second breadboard is ${size} now: ${span}.`, 6000); }
  }
}
export function pickTool(tool: Tool | null) {
  const part = tool && partOf(tool);
  if (part && !trayParts(missionOf(get()), Object.keys(get().passed)).has(part)) {   // a part that no mission has unlocked yet. The studio has them all.
    const by = lockedBy(part);
    say('info', `The ${PARTS[part].label} is locked here.${by ? ` Pass the mission “${by.mission.title}” to unlock it, or use it in the Open Studio, where every part is open.` : ''}`, 7000);
    return;
  }
  const same = tool && get().tool?.kind === tool.kind && get().tool?.color === tool.color && get().tool?.ohms === tool.ohms && get().tool?.sub === tool.sub;
  if (!tool || same) { set({ tool: null, pending: null, point: null }); return; }
  set(s => ({ tool, pending: null, hot: null, panels: isPhone() ? closePanelIn(s.panels, 'parts') : s.panels }));   // on a phone the drawer would cover the bench
  if (tool.kind === 'breadboard') { placeBreadboard(tool.size ?? 'short'); set({ tool: null }); return; }   // it lies on the table beside the first one, so it goes there at once
  if (tool.kind === 'pad' || tool.kind === 'lcd') {   // parts that lie at a place of their own on the table go there at once
    const it = makeItem(tool, benchOf(get()), tool.kind === 'pad' ? 'PAD' : 'LCD');
    const err = placementError(get().board, benchOf(get()), it);
    if (err) say('warn', err, 6000); else addItem(it);
    set({ tool: null });
  } else dismissNotice();
}
export const cancelTool = () => set({ tool: null, pending: null });
export const setPoint = (point: string | null) => { if (get().point !== point) set({ point }); };

let dragging = false;
function finishTwo(a: string, b: string) {
  const s = get(), tool = s.tool!, it = makeItem(tool, benchOf(s), a, b), err = placementError(s.board, benchOf(s), it);
  set({ pending: null });
  if (err) say('warn', err, 6000); else { dismissNotice(); addItem(it); }
}
/** The pointer went down on a connection point (or on nothing). Returns true when the press belongs to the placing tool, so the camera should not move. */
export function pressPoint(name: string | null): boolean {
  const { tool, pending } = get();
  if (!tool || !name) return false;
  if (TWO_POINT.includes(tool.kind)) {
    if (pending && pending !== name) { finishTwo(pending, name); return true; }
    const probe = firstPointError(name);
    if (probe) { say('warn', probe, 6000); return true; }
    set({ pending: name }); dragging = true;
    return true;
  }
  const it = makeItem(tool, benchOf(get()), name), err = placementError(get().board, benchOf(get()), it);
  if (err) say('warn', err, 6000); else { dismissNotice(); addItem(it); }
  return true;
}
/** The pointer came up. A drag from one point to another places the part; a click on one point keeps it waiting for the second. */
export function releasePoint(name: string | null) {
  if (!dragging) return;
  dragging = false;
  const { pending } = get();
  if (!pending) return;
  if (name && name !== pending) finishTwo(pending, name);
  else if (!name) set({ pending: null });
}
function firstPointError(name: string): string | null {
  const s = get(), tool = s.tool!;
  if (benchOf(s).flatMap(holesOf).includes(name)) return `${name} is already taken. Each hole holds one leg or wire end.`;
  if (tool.kind !== 'wire' && !/^[a-j]\d+$|^[TB][+-]\d+$/.test(name)) return 'Parts go into the breadboard. Use a wire to reach a board pin.';
  return null;
}
/** Places a part from typed point names, the keyboard way: "e10 e11" for an LED, "d24" for a knob. */
export function placeTyped(text: string): string | null {
  const s = get(), tool = s.tool;
  if (!tool) return 'Choose a part first.';
  const words = text.split(/[\s,]+/).filter(Boolean), want = TWO_POINT.includes(tool.kind) ? 2 : tool.kind === 'pad' || tool.kind === 'lcd' || tool.kind === 'breadboard' ? 0 : 1;
  if (words.length !== want) return want === 2 ? 'Type two points, such as e10 e11.' : 'Type one hole, such as d24.';
  const pts = words.map(w => parseTerminal(s.board, w, benchOf(s)));
  const bad = pts.findIndex(p => !p);
  if (bad >= 0 && s.board === 'esp32' && /^[a-j]([1-9]|1d|2[01])$/i.test(words[bad])) return 'That spot is under the ESP32. Use the free holes on the right (columns 22 to 30), or its pins such as d5 and gnd.';
  if (bad >= 0) return `"${words[bad]}" is not a place on this bench. Holes look like e10, rails like T+5, pins like 13 or gnd.`;
  const it = makeItem(tool, benchOf(s), pts[0]!, pts[1] ?? undefined), err = placementError(s.board, benchOf(s), it);
  if (err) return err;
  addItem(it); set({ pending: null });
  return null;
}

/* --- everything else --- */
export const setTab = (tab: Tab) => set({ tab });
/** Selects a part, or clears the selection when it is already selected or id is null. */
export const selectHot = (id: string | null) => set(s => ({ hot: id && id !== s.hot ? id : null }));
export const setInput = (id: string, value: number) => set(s => ({ inputs: { ...s.inputs, [id]: value } }));
export function editCode(code: string) {
  set(s => ({ edits: { ...s.edits, [keyOf(s)]: code }, errLine: null, results: null }));
  saveSketches(get().edits);
}
export function resetCode() {
  stopRun();
  set(s => { const edits = { ...s.edits }; delete edits[keyOf(s)]; return { edits, errLine: null, results: null }; });
  saveSketches(get().edits, 0);
}
export const setNav = (nav: 'pan' | 'rotate') => set({ nav });
export const toggleLabels = () => set(s => ({ labels: !s.labels }));
export function toggleSound() {
  set(s => ({ sound: !s.sound }));
  if (get().sound) ensureAudio();
}

/* --- missions: predicting, checking, hints and progress --- */

/** The Run and Step buttons come here. Before the first run of a mission, the student is asked what they expect to see. */
export function requestRun(stepFirst = false) {
  const s = get(), m = missionOf(s);
  const short = analyze(s.board, benchOf(s)).issues.some(i => i.kind === 'short');   // a short circuit cannot run anyway: let the run say so
  if (!m.predict || m.sandbox || s.predictions[keyOf(s)] || short) { startRun(stepFirst); return; }
  set({ asking: { step: stepFirst } });
}
export const cancelPrediction = () => set({ asking: null });

/** The student has picked what they think will happen. Play the sketch on the quiet, compare, then run it for real. */
export async function submitPrediction(picked: string) {
  const s = get(), m = missionOf(s), p = m.predict, key = keyOf(s), step = s.asking?.step ?? false;
  set({ asking: null });
  if (!p) { startRun(step); return; }
  const tr = await observe(s.board, benchOf(s), codeOf(s), p.demo, p.run);
  if (keyOf(get()) !== key) return;   // the student moved to another mission meanwhile
  if (tr.error || tr.timedOut || tr.shorted) {   // there is nothing to compare yet: let the run itself show what is wrong
    say('warn', 'Your sketch ran into a problem, so there is nothing to compare with your prediction yet. The Serial Monitor shows what went wrong. Fix it and press Run again.', 0);
    startRun(step);
    return;
  }
  const actual = p.classify(tr), right = picked === actual, name = (id: string) => p.options.find(o => o.id === id)?.label ?? id;
  set(st => ({ predictions: { ...st.predictions, [key]: { picked, actual, right } } }));
  saveMissionProgress();
  say(right ? 'info' : 'warn', `${right ? 'Your prediction was right.' : `Not quite. You predicted “${name(picked)}”. What happened: “${name(actual)}”.`} ${p.explain[actual] ?? ''}`, 0);
  startRun(step);
}

/** Runs the mission's checks on the student's own build and sketch. The mission is passed only when every one of them passes. */
/** Chooses a board on the supply shelf. The choice is remembered, and the mission is passed when the board meets every need. */
export function pickBoard(card: CardId) {
  const s = get(), m = missionOf(s), key = keyOf(s);
  if (!m.choice) return;
  set(st => ({ picks: { ...st.picks, [key]: card } }));
  saveMissionProgress();
  if (fitsAll(cardOf(card), m.choice)) passMission();
}

export async function checkMission() {
  const s = get(), m = missionOf(s), key = keyOf(s), bench = benchOf(s), code = codeOf(s);
  if (m.sandbox || s.checking) return;
  set({ checking: true, results: null });
  const results = await runChecks(s.board, bench, code, m.checks);
  const now = get();
  if (keyOf(now) !== key || benchOf(now) !== bench || codeOf(now) !== code) { set({ checking: false }); return; }   // something changed while the checks ran
  set({ checking: false, results });
  if (results.every(r => r.pass)) passMission();
}

function passMission() {
  const s = get(), m = missionOf(s), key = keyOf(s), before = passedKeys();
  if (s.passed[key]) { say('info', `Still passing: ${m.title}.`, 6000); return; }
  const guess = s.predictions[key];
  set(st => ({ passed: { ...st.passed, [key]: { at: Date.now(), hints: st.hintsUsed[key] ?? 0, predicted: guess ? (guess.right ? 'right' : 'wrong') : 'skipped' } } }));
  saveMissionProgress();
  const after = passedKeys(), had = unlockedParts(before), have = unlockedParts(after);
  const parts = [...have].filter(id => !had.has(id)).map(id => PARTS[id].label);
  const opened = MISSIONS[s.board].filter(x => !isAvailable(s.board, x, before) && isAvailable(s.board, x, after)).map(x => x.title);
  say('info', [`Mission complete: ${m.title}.`, parts.length ? `New in the tray: ${parts.join(', ')}.` : '', opened.length ? `Now open on the map: ${opened.join(', ')}.` : ''].filter(Boolean).join(' '), 0);
}

/** Opens the next of the three hints: a nudge, then the idea, then the answer. */
export function revealHint() {
  const key = keyOf(get()), n = get().hintsUsed[key] ?? 0;
  if (n >= 3) return;
  set(st => ({ hintsUsed: { ...st.hintsUsed, [key]: n + 1 } }));
  saveMissionProgress();
}
/** The home page's link to a template: the studio opens with its brief on the Mission tab, scrolled to that template. Called as the link is followed. */
export const showTemplate = (id: string) => set({ templateFocus: id, tab: 'mission' });
/** The brief has scrolled to the template asked for. */
export const templateShown = () => set({ templateFocus: null });

/** Puts a template's build on the bench and its sketch in the editor, in the Open Studio. Undo takes the build off again; the sketch it replaced is gone, so the brief asks first. */
export function loadTemplate(id: string) {
  const s = get(), t = TEMPLATES[s.board].find(x => x.id === id);
  if (!t || !missionOf(s).sandbox) return;
  change(t.circuit.map(it => ({ ...it })), []);
  set(st => ({ edits: { ...st.edits, [keyOf(st)]: t.sketch }, errLine: null, results: null, hot: null, tool: null, pending: null }));
  saveSketches(get().edits, 0);
  say('info', `${t.title} is on the bench, and its sketch is in the editor. Press Run to try it. Undo takes the parts off again.`, 8000);
}

/** Puts the mission's reference sketch in the editor. Only offered with the last hint. */
export function fillAnswerCode() {
  set(s => ({ edits: { ...s.edits, [keyOf(s)]: missionOf(s).answer }, errLine: null, results: null }));
  saveSketches(get().edits, 0);
}

/* --- everything the browser remembers: backing it up, restoring it, starting again --- */
const everything = (): Progress => { const { passed, hintsUsed, predictions, picks, benches, burnt, edits } = get(); return { passed, hintsUsed, predictions, picks, benches, burnt, edits }; };
/** The text of a backup file holding all the work done so far. */
export const progressBackup = () => makeBackup(everything());
/** Replaces everything the browser remembers with this progress, and saves it. */
function adopt(p: Progress) {
  stopRun(); forgetRun();
  set({ ...p, undo: {}, redo: {}, results: null, asking: null, hot: null, tool: null, pending: null, notice: null, errLine: null, serial: '' });
  saveProgress(p); saveBenches(p.benches, p.burnt); saveSketches(p.edits, 0);
  syncInputs();
}
/** Puts back a backup file's work in place of what is there now. Gives back what was restored, or why it could not be. */
export function restoreProgress(text: string): { ok: true; summary: string } | { ok: false; error: string } {
  const r = parseBackup(text);
  if (!r.ok) return r;
  adopt(r.progress);
  return { ok: true, summary: describe(r.progress) };
}
/** Forgets every passed mission, bench and sketch. */
export const resetProgress = () => adopt(emptyProgress());

/* --- panels over the bench --- */
/** Narrow screens show one panel at a time. */
const isNarrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 1100px)').matches;
const isPhone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;

/** Puts the keyboard focus back on the button that opens a panel once it has closed, or on the Guide link on the way back from the guide. */
function focusToggle(name: Panel | 'guide') {
  requestAnimationFrame(() => {
    const buttons = [...document.querySelectorAll<HTMLElement>(`[data-toggle="${name}"]`)];
    (buttons.find(b => b.offsetParent !== null) ?? buttons[0])?.focus();
  });
}
export function openPanel(name: Panel) {
  set(s => ({ panels: openPanelIn(s.panels, name, isNarrow()), focusPanel: { name, n: (s.focusPanel?.n ?? 0) + 1 } }));
}
export function closePanel(name: Panel) {
  set(s => ({ panels: closePanelIn(s.panels, name) }));
  focusToggle(name);
}
export function togglePanel(name: Panel) { if (isOpen(get().panels, name)) closePanel(name); else openPanel(name); }
/** Escape: closes the panel opened last. Says whether there was one. */
export function escapePanel(): boolean {
  const { panels } = get(), next = closeTop(panels);
  if (next === panels) return false;
  const name = (panels.last && isOpen(panels, panels.last) ? panels.last : panels.right ?? panels.left) as Panel;
  set({ panels: next });
  focusToggle(name);
  return true;
}
/** The width of the bench between its two rails, which the drawers share. */
const benchRoom = () => (document.getElementById('bench')?.clientWidth ?? innerWidth) - [...document.querySelectorAll<HTMLElement>('.rail')].reduce((n, r) => n + r.offsetWidth, 0);
/** The room there is for the panel on one side: the widest it may be right now. */
export function panelRoom(side: Side): number {
  const across = benchRoom();
  return widestPanel(across, document.querySelector<HTMLElement>(`.drawer.${side === 'left' ? 'right' : 'left'}`)?.offsetWidth ?? 0);
}
/** Makes the panel on one side this wide (kept within what fits), or gives it its usual width back with null. */
export function resizePanel(side: Side, width: number | null) {
  const across = benchRoom();
  const other = document.querySelector<HTMLElement>(`.drawer.${side === 'left' ? 'right' : 'left'}`)?.offsetWidth ?? 0;
  const widths = { ...get().widths, [side]: width == null ? null : clampWidth(width, across, other) };
  set({ widths });
  saveWidths(widths);
}
export const setHelp = (help: boolean) => set({ help });

/* --- the guide, a page of its own at #guide --- */
/** Goes to the guide, at the chapter last read there (or its contents page). */
export function showGuide() { location.hash = guideHash(get().guide); }
/** Leaves the guide for the bench, at the mission that was open. */
export function backToBench() { const s = get(); goTo(s.board, missionOf(s).id); }
