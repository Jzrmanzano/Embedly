/* The circuit on the bench drawn as a schematic. The board sits on the left with only the pins in use. Each pin starts a row that runs
   right through its parts until it reaches ground, power, another pin or a leg with nothing on it, and a part joined part-way along a row
   hangs below it on a branch. The knob, the distance sensor, the servo and the touch pad sit at the end of the rows that feed them.
   Ground and power are drawn with their usual symbols wherever a row reaches them, rather than as long rails, as most schematics do.
   A connection that cannot be drawn as a line gets a name tag at both ends. This is layout only: no React and no DOM. */
import { spanOf } from '../data/symbols';
import { itemId, type BoardId, type Item } from '../types';
import { analyze, boardPins, servoLegs, type Net } from './circuit';

/** Pixels per symbol unit (about a tenth of an inch on paper). */
export const UNIT = 68;
const PITCH = 72, GAP = 22, STUB = 16, TOP = 56;
const BOARD_X = 8, BOARD_W = 100, X0 = BOARD_X + BOARD_W + 22, BLOCK_X = X0 + 112, BOX_W = 84;

export type Point = [x: number, y: number];
/** A two-legged part on a row, drawn from its left leg at (x, y). `flip` puts its second leg on the left. */
export interface PartAt { id: string; symbol: 'resistor' | 'led' | 'button' | 'buzzer'; x: number; y: number; flip: boolean; label: string; /** An LED's colour, for lighting it up while the sketch runs. */ color?: number }
/** A knob, drawn with its wiper leg at (x, y) and its two ends above and below. */
export interface KnobAt { id: string; x: number; y: number; label: string }
/** A labelled box: the board (pins on its right) or a module (pins on its left). */
export interface BoxAt { id: string; kind: 'board' | 'sonar' | 'servo'; title: string; x: number; y: number; w: number; h: number; side: 'left' | 'right'; pins: { name: string; y: number }[] }
/** Room in the servo's box for the dial that shows its angle. */
export const DIAL_ROOM = 64;
/** Ground and power symbols, legs with nothing on them, name tags, and the dots where lines join. */
export interface Mark { kind: 'ground' | 'supply' | 'open' | 'tag' | 'dot'; at: Point; text?: string; dir?: 'left' | 'right' | 'up' | 'down' }
export interface Schematic {
  width: number;
  height: number;
  parts: PartAt[];
  knobs: KnobAt[];
  boxes: BoxAt[];
  pads: { id: string; at: Point }[];
  lines: Point[][];
  marks: Mark[];
  /** Each row in words, for screen readers. */
  text: string[];
  /** Power is joined straight to ground. */
  shorted: boolean;
  /** Nothing is on the bench. */
  empty: boolean;
}

/** How wide a name tag is for its text, so the layout can leave room for it. */
export const tagWidth = (text: string) => Math.round(text.length * 6.6 + 14);

interface Two { id: string; symbol: PartAt['symbol']; legs: [Net, Net]; label: string; color?: number }
interface Leg { name: string; net: Net }
interface Block { id: string; kind: 'knob' | 'sonar' | 'servo' | 'pad'; title: string; legs: Leg[] }

const ohmsText = (ohms: number) => (ohms >= 1000 ? `${ohms / 1000} kΩ` : `${ohms} Ω`);
const ledText = (color: number) => (color === 0x2ecc40 ? 'green LED' : color === 0xff3b30 ? 'red LED' : 'LED');

export function layoutSchematic(board: BoardId, items: Item[]): Schematic {
  const an = analyze(board, items), net = (point: string) => an.netOf(point);
  const kind = (n: Net) => (n.volts === 0 ? 'ground' : n.volts != null ? 'supply' : 'signal');
  const supplyName = (n: Net) => (n.volts === 3.3 ? '3.3V' : n.volts === 5 && board === 'uno' ? '5V' : 'VIN');
  const pins = boardPins(board), pinName = (num: number) => pins.find(p => p.num === num)?.name ?? String(num);
  const pinWords = (num: number) => (board === 'uno' ? `pin ${pinName(num)}` : pinName(num));

  /* --- what is on the bench --- */
  const twos: Two[] = [], blocks: Block[] = [];
  items.forEach((it, k) => {
    const id = itemId(it, k);
    switch (it.t) {
      case 'led': twos.push({ id, symbol: 'led', legs: [net(it.a), net(it.k)], label: ledText(it.color), color: it.color }); break;
      case 'res': twos.push({ id, symbol: 'resistor', legs: [net(it.a), net(it.b)], label: ohmsText(it.ohms ?? 220) }); break;
      case 'buzzer': twos.push({ id, symbol: 'buzzer', legs: [net(it.a), net(it.b)], label: 'buzzer' }); break;
      case 'button': twos.push({ id, symbol: 'button', legs: [net(`e${it.col}`), net(`e${it.col + 2}`)], label: 'button' }); break;
      case 'pot': {
        const [a, w, b] = [0, 1, 2].map(i => net(`${it.row}${it.col + i}`));
        const [top, bottom] = kind(a) === 'ground' || kind(b) === 'supply' ? [b, a] : [a, b];   // power above, ground below
        blocks.push({ id, kind: 'knob', title: 'knob', legs: [{ name: 'top', net: top }, { name: 'wiper', net: w }, { name: 'bottom', net: bottom }] });
        break;
      }
      case 'sonar': blocks.push({ id, kind: 'sonar', title: 'HC-SR04', legs: ['VCC', 'TRIG', 'ECHO', 'GND'].map((name, i) => ({ name, net: net(`${it.row}${it.col + i}`) })) }); break;
      case 'servo': { const l = servoLegs(it); blocks.push({ id, kind: 'servo', title: 'servo', legs: [{ name: 'GND', net: net(l.gnd) }, { name: '+', net: net(l.vcc) }, { name: 'signal', net: net(l.sig) }] }); break; }
      case 'pad': blocks.push({ id, kind: 'pad', title: 'touch pad', legs: [{ name: 'pad', net: net('PAD') }] }); break;
      case 'wire': break;
    }
  });
  const touched = new Set<string>();   // nets that a wire end or a leg is on
  items.forEach(it => { if (it.t === 'wire') { touched.add(net(it.a).id); touched.add(net(it.b).id); } });
  twos.forEach(t => t.legs.forEach(l => touched.add(l.id)));
  blocks.forEach(b => b.legs.forEach(l => touched.add(l.net.id)));
  const used = pins.filter(p => touched.has(net(p.point).id));

  /* --- the drawing --- */
  const parts: PartAt[] = [], knobs: KnobAt[] = [], boxes: BoxAt[] = [], pads: Schematic['pads'] = [], lines: Point[][] = [], marks: Mark[] = [], text: string[] = [];
  const boardPinsAt: { name: string; y: number }[] = [];
  let slots = 0;
  const take = () => TOP + PITCH * slots++;
  const placed = new Set<string>(), rowed = new Set<number>();
  /** Where each net was first drawn. A row that reaches a net drawn somewhere else ends in a name tag instead of a line. */
  const home = new Map<string, { at: Point; dir: Mark['dir']; open: boolean }>();
  const named = new Map<string, string>();
  let letters = 0;
  const nameOf = (n: Net) => {
    if (n.pins.length) return pinWords(n.pins[0]);
    if (!named.has(n.id)) named.set(n.id, String.fromCharCode(65 + letters++));
    return named.get(n.id)!;
  };
  const linksOn = (n: Net) => twos.filter(t => !placed.has(t.id) && (t.legs[0].id === n.id || t.legs[1].id === n.id));

  /** How a line that stops at (x, y) on a net ends: ground, power, a tag naming where it continues, or a leg with nothing on it. */
  function end(n: Net, x: number, y: number, words: string[], dir: Mark['dir'] = 'right') {
    const k = kind(n);
    if (k === 'ground') { marks.push({ kind: 'ground', at: [x, y], dir: dir === 'up' ? 'up' : 'down' }); words.push('GND'); }
    else if (k === 'supply') { marks.push({ kind: 'supply', at: [x, y], text: supplyName(n), dir: dir === 'down' ? 'down' : 'up' }); words.push(supplyName(n)); }
    else if (n.pins.length || home.has(n.id)) { marks.push({ kind: 'tag', at: [x, y], text: nameOf(n), dir }); words.push(`joins ${nameOf(n)}`); }
    else { home.set(n.id, { at: [x, y], dir, open: true }); words.push('nothing'); }   // an open end, unless something else turns out to join it
  }

  /** Draws a row from (x, y) on a net, going right through one part after another. `first` is a part that must come first (a branch). */
  function run(start: Net, x: number, y: number, words: string[], first: Two | null = null, lead = GAP) {
    const junctions: { x: number; y: number; on: Net; extra: Two[] }[] = [];
    let n = start, at = x, fresh = true;
    for (;;) {
      if (!fresh) {
        if (kind(n) !== 'signal' || n.pins.length || home.has(n.id)) { lines.push([[at, y], [at + STUB, y]]); end(n, at + STUB, y, words); break; }
        home.set(n.id, { at: [at, y], dir: 'up', open: false });
      }
      const cands = fresh && first ? [first, ...linksOn(n).filter(t => t !== first)] : linksOn(n);
      fresh = false;
      if (!cands.length) {   // a pin wired to nothing, or a leg with nothing on it
        lines.push([[at, y], [at + 10, y]]);
        if (n === start) marks.push({ kind: 'open', at: [at + 10, y] });
        else home.set(n.id, { at: [at + 10, y], dir: 'right', open: true });
        words.push('nothing');
        break;
      }
      const [next, ...extra] = cands;
      [next, ...extra].forEach(t => placed.add(t.id));
      if (extra.length) { junctions.push({ x: at + 8, y, on: n, extra }); marks.push({ kind: 'dot', at: [at + 8, y] }); }
      const flip = next.legs[0].id !== n.id, px = at + (at === x ? lead : GAP);
      lines.push([[at, y], [px, y]]);
      parts.push({ id: next.id, symbol: next.symbol, x: px, y, flip, label: next.label, ...(next.color != null ? { color: next.color } : {}) });
      words.push(next.label);
      at = px + spanOf(next.symbol) * UNIT;
      n = flip ? next.legs[0] : next.legs[1];
    }
    // Branches, the rightmost junction first, so that no branch line crosses another branch's row.
    for (const j of junctions.reverse()) j.extra.forEach((t, i) => {
      const by = take(), line = text.push('') - 1, w: string[] = [];
      lines.push([[j.x, j.y], [j.x, by]]);
      if (i < j.extra.length - 1) marks.push({ kind: 'dot', at: [j.x, by] });
      run(j.on, j.x, by, w, t, GAP - 8);   // starts at the branch line, with its first part in line with the one above
      text[line] = `Also joined there: ${w.join(' → ')}.`;
    });
  }

  /* 1. The knob, the distance sensor, the servo and the touch pad, each with the rows that feed them. */
  for (const b of blocks) {
    if (b.kind === 'knob') {
      take();
      const y = take();
      take();
      const [top, wiper, bottom] = b.legs, cx = BLOCK_X + 0.4 * UNIT, reach = 0.42 * UNIT;
      knobs.push({ id: b.id, x: BLOCK_X, y, label: b.title });
      feed(wiper.net, y, b, wiper.name);
      lines.push([[cx, y - reach], [cx, y - reach - STUB / 2]]);
      lines.push([[cx, y + reach], [cx, y + reach + STUB / 2]]);
      const tw: string[] = [], bw: string[] = [];
      end(top.net, cx, y - reach - STUB / 2, tw, 'up');
      end(bottom.net, cx, y + reach + STUB / 2, bw, 'down');
      text.push(`The knob's ends go to ${tw.join('')} and ${bw.join('')}.`);
      continue;
    }
    const ys = b.legs.map(() => take());
    if (b.kind === 'pad') pads.push({ id: b.id, at: [BLOCK_X, ys[0]] });
    else boxes.push({ id: b.id, kind: b.kind, title: b.kind === 'sonar' ? 'HC-SR04' : 'Servo', x: BLOCK_X, y: ys[0] - 26, w: BOX_W + (b.kind === 'servo' ? DIAL_ROOM : 0), h: ys[ys.length - 1] - ys[0] + 52, side: 'left', pins: b.legs.map((l, i) => ({ name: l.name, y: ys[i] })) });
    b.legs.forEach((l, i) => feed(l.net, ys[i], b, l.name));
  }
  /** A leg of a box: a row straight from the board pin it is wired to, or a short line ending in ground, power or a tag. */
  function feed(n: Net, y: number, b: Block, leg: string) {
    const what = b.kind === 'pad' ? 'the touch pad' : `${leg} of the ${b.title}`;
    const pin = n.pins.find(p => !rowed.has(p));
    if (kind(n) === 'signal' && pin != null && !home.has(n.id)) {
      rowed.add(pin);
      boardPinsAt.push({ name: pinName(pin), y });
      home.set(n.id, { at: [X0, y], dir: 'up', open: false });
      lines.push([[X0, y], [BLOCK_X, y]]);
      text.push(`${cap(pinWords(pin))} → ${what}.`);
      return;
    }
    const words: string[] = [];
    lines.push([[BLOCK_X, y], [BLOCK_X - 28, y]]);
    end(n, BLOCK_X - 28, y, words, 'left');
    text.push(`${cap(what)} → ${words.join('')}.`);
  }

  /* 2. A row for each other pin in use. */
  for (const p of used) {
    if (rowed.has(p.num)) continue;
    rowed.add(p.num);
    const y = take(), n = net(p.point), words = [cap(pinWords(p.num))], line = text.push('') - 1;
    boardPinsAt.push({ name: p.name, y });
    if (kind(n) !== 'signal' || home.has(n.id)) { lines.push([[X0, y], [X0 + STUB, y]]); end(n, X0 + STUB, y, words); }
    else { home.set(n.id, { at: [X0, y], dir: 'up', open: false }); run(n, X0, y, words); }
    text[line] = `${words.join(' → ')}.`;
  }

  /* 3. Parts not reached from a pin: from power if they touch it, or from wherever they are joined, or from a leg with nothing on it. */
  for (const t of twos) {
    if (placed.has(t.id)) continue;
    const y = take(), words: string[] = [], line = text.push('') - 1;
    const [a, b] = t.legs, startLeg = [a, b].find(l => kind(l) === 'supply') ?? [a, b].find(l => kind(l) === 'signal' && (home.has(l.id) || l.pins.length)) ?? (kind(a) === 'ground' && kind(b) === 'signal' ? b : a);
    const k = kind(startLeg);
    if (k === 'supply') { marks.push({ kind: 'supply', at: [X0, y], text: supplyName(startLeg), dir: 'up' }); words.push(supplyName(startLeg)); }
    else if (k === 'ground') { marks.push({ kind: 'ground', at: [X0, y], dir: 'down' }); words.push('GND'); }
    else if (home.has(startLeg.id) || startLeg.pins.length) { marks.push({ kind: 'tag', at: [X0, y], text: nameOf(startLeg), dir: 'left' }); words.push(nameOf(startLeg)); }
    else { home.set(startLeg.id, { at: [X0, y], dir: 'left', open: true }); words.push('nothing'); }
    run(startLeg, X0, y, words, t);
    text[line] = `${cap(words.join(' → '))}.`;
  }

  /* 4. Net names need both ends: where a named net was first drawn gets its tag too. Ends that nothing else joins stay open. */
  for (const [id, h] of home) {
    if (named.has(id)) marks.push({ kind: 'tag', at: h.at, text: named.get(id)!, dir: h.dir });
    else if (h.open) marks.push({ kind: 'open', at: h.at });
  }

  /* 5. The board, around the pins in use. */
  if (boardPinsAt.length) {
    const ys = boardPinsAt.map(p => p.y), top = Math.min(...ys) - 40, bottom = Math.max(...ys) + 24;
    boxes.unshift({ id: 'board', kind: 'board', title: board === 'uno' ? 'Arduino Uno' : 'ESP32', x: BOARD_X, y: top, w: BOARD_W, h: bottom - top, side: 'right', pins: boardPinsAt });
    boardPinsAt.forEach(p => lines.push([[BOARD_X + BOARD_W, p.y], [X0, p.y]]));
  }

  /* --- how big it all is --- */
  let width = X0 + 40;
  const reach = (x: number) => { width = Math.max(width, x + 24); };
  lines.flat().forEach(([x]) => reach(x));
  parts.forEach(p => reach(p.x + spanOf(p.symbol) * UNIT));
  knobs.forEach(k => reach(k.x + 0.8 * UNIT));
  boxes.forEach(b => reach(b.x + b.w));
  pads.forEach(p => reach(p.at[0] + 30));
  marks.forEach(m => reach(m.at[0] + (m.kind === 'tag' && m.dir === 'right' ? tagWidth(m.text ?? '') + 8 : 16)));
  const height = Math.max(TOP + PITCH * Math.max(slots, 1) - PITCH / 2 + 12, 120);
  return { width, height, parts, knobs, boxes, pads, lines, marks, text, shorted: an.issues.some(i => i.kind === 'short'), empty: items.length === 0 };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
