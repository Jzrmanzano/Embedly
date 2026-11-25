/* The rules of placing parts on the bench: which connection points exist, which are taken, and what a part needs. No 3D and no React in here. */
import { ESP_HOLES } from '../data/boards';
import { LCD_PINS, lcdPoint } from '../sim/lcd';
import { fits, placeOf, slide, type Place } from './table';
import { BREADBOARD_COLS, extraColumns, itemId, kindOf, MAIN_COLS, onExtraBoard, type BoardId, type BreadboardSize, type ContactKind, type Item, type ModuleKind, type PartKind, type WireColor } from '../types';

export type ToolKind = Item['t'];
/** The part in hand. `sub` says which sensor module or which contact it is, and `size` how long a breadboard is. */
export interface Tool { kind: ToolKind; color?: number; ohms?: number; sub?: ModuleKind | ContactKind; size?: BreadboardSize }
/** Which kind of part a tool places, named as kindOf names the item it makes. */
export const toolKind = (tool: Tool): PartKind => (tool.kind === 'module' || tool.kind === 'contact' ? tool.sub ?? (tool.kind === 'module' ? 'pir' : 'tilt') : tool.kind);
/** Are these the same part of the tray? A resistor of any value is the resistor, and an LED of any colour is the LED. */
export const sameTool = (a: Tool | null | undefined, b: Tool | null | undefined) => !!a && !!b && a.kind === b.kind && a.sub === b.sub;

/** Parts that go between two points the student picks one after the other. */
export const TWO_POINT: ToolKind[] = ['led', 'res', 'buzzer', 'wire', 'ldr', 'contact'];
/** How many holes side by side the legs of a part take, for the parts that stand in one row. */
export const WIDTH: Partial<Record<Item['t'], number>> = { pot: 3, servo: 3, temp: 3, slide: 3, module: 3, sonar: 4, rgb: 4, joy: 5 };
export const COLS = MAIN_COLS;
const RAILS = ['T+', 'T-', 'B+', 'B-'];
/** Columns 1 to 21 of the breadboard are under the ESP32. Its own pins take their place. */
const ESP_FIRST_FREE = 22;
const UNO_PINS = [...Array.from({ length: 14 }, (_, i) => String(i)), 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', '5V', '3V3', 'GND', 'GND2', 'GNDb', 'VIN'];

export const isHole = (n: string) => /^[a-j]\d+$/.test(n) || /^[TB][+-]\d+$/.test(n);
const colOf = (n: string) => +n.replace(/^\D+/, '');
const rowOf = (n: string) => n[0];

/** Every connection point the student can use on this bench. */
export function allTerminals(board: BoardId, items: Item[]): string[] {
  const out: string[] = [];
  const first = board === 'esp32' ? ESP_FIRST_FREE : 1;
  for (let c = first; c <= COLS; c++) for (const r of 'abcdefghij') out.push(r + c);
  for (let c = 1; c <= COLS; c++) for (const r of RAILS) out.push(r + c);
  const extra = extraColumns(items);
  if (extra) for (let c = extra[0]; c <= extra[1]; c++) for (const r of [...'abcdefghij', ...RAILS]) out.push(r + c);
  if (board === 'uno') out.push(...UNO_PINS.map(p => 'U:' + p));
  else out.push(...Object.keys(ESP_HOLES).filter(p => p !== 'EN').map(p => 'E:' + p));
  if (items.some(it => it.t === 'pad')) out.push('PAD');
  if (items.some(it => it.t === 'lcd')) out.push(...LCD_PINS.map(lcdPoint));
  return out;
}

/** The points an item sticks a leg or wire end into. */
export function holesOf(it: Item): string[] {
  switch (it.t) {
    case 'wire': case 'res': case 'buzzer': case 'ldr': case 'contact': return [it.a, it.b];
    case 'led': return [it.a, it.k];
    case 'button': return [`e${it.col}`, `e${it.col + 1}`, `e${it.col + 2}`, `f${it.col}`, `f${it.col + 1}`, `f${it.col + 2}`];   // the body covers the middle column too, though no leg goes in it
    case 'pot': case 'servo': case 'temp': case 'sonar': case 'rgb': case 'slide': case 'module': case 'joy': return Array.from({ length: WIDTH[it.t]! }, (_, i) => `${it.row}${it.col + i}`);
    case 'pad': case 'lcd': case 'breadboard': return [];   // they lie on the table, not in the breadboard
  }
}

const NAMES: Record<PartKind, string> = {
  led: 'LED', res: 'resistor', buzzer: 'buzzer', wire: 'wire', button: 'button', pot: 'knob', sonar: 'distance sensor', pad: 'touch pad', servo: 'servo', ldr: 'light sensor', temp: 'temperature sensor', lcd: 'LCD display',
  rgb: 'RGB LED', slide: 'slide switch', breadboard: 'breadboard', joy: 'joystick', tilt: 'tilt switch', reed: 'reed switch',
  pir: 'motion sensor', ir: 'obstacle sensor', soil: 'soil moisture sensor', water: 'water level sensor', gas: 'gas sensor', flame: 'flame sensor',
};
const COUNT = ['', 'one', 'two', 'three', 'four', 'five'];
/** "A knob", "An obstacle sensor", "An LED". */
const withArticle = (what: string) => `${/^([aeio]|LED|RGB)/.test(what) ? 'An' : 'A'} ${what}`;

/** Why an item cannot go on the bench as it is, or null when it can. */
export function placementError(board: BoardId, items: Item[], it: Item): string | null {
  const valid = new Set(allTerminals(board, items)), used = new Set(items.flatMap(holesOf)), leads = holesOf(it), what = NAMES[kindOf(it)];
  const wide = it.t === 'button' ? 3 : WIDTH[it.t], extra = extraColumns(items);
  if (wide && 'col' in it && valid.has(leads[0]) && it.col + wide - 1 > (it.col > COLS && extra ? extra[1] : COLS)) return `${withArticle(what)} needs ${COUNT[wide]} columns${it.col <= COLS && extra ? ' on one breadboard' : ''}. Pick a column further left.`;
  if (new Set(leads).size < leads.length) return 'Pick two different points.';
  for (const p of leads) {
    if (it.t !== 'wire' && !isHole(p)) return `${withArticle(what)} goes into the breadboard, not a board pin. Use a wire to reach the pin.`;
    if (!valid.has(p)) {
      if (/^[a-j]\d+$/.test(p) && board === 'esp32' && colOf(p) < ESP_FIRST_FREE) return 'That spot is under the ESP32. Use the free holes on the right, or its pins.';
      if (onExtraBoard(p)) return extra ? `${p} is past the end of the second breadboard, which has columns ${extra[0]} to ${extra[1]}.` : `${p} is not on this bench. The breadboard has columns 1 to ${COLS}. For more, add a second breadboard from the tray.`;
      return `${p} is not a place on this bench.`;
    }
    if (used.has(p)) return `${p} is already taken. Each hole holds one leg or wire end.`;
  }
  if (WIDTH[it.t] && 'col' in it && board === 'esp32' && it.col < ESP_FIRST_FREE) return 'That spot is under the ESP32. Use the free holes on the right.';
  if (it.t === 'pad' && items.some(x => x.t === 'pad')) return 'There is only one touch pad.';
  if (it.t === 'lcd' && items.some(x => x.t === 'lcd')) return 'There is only one LCD display.';
  const second = items.find(x => x.t === 'breadboard');   // the LCD and the touch pad each have a place of their own on the table, which the second breadboard may have been moved onto
  if ((it.t === 'lcd' || it.t === 'pad') && second?.t === 'breadboard' && !fits(board, [...items, it], second.size, placeOf(second))) return `The second breadboard is lying where the ${what} goes. Drag it out of the way first.`;
  if (it.t === 'breadboard' && items.some(x => x.t === 'breadboard')) return 'The bench has room for one more breadboard, and it is already there.';
  return null;
}

/** Points that carry power or ground, so wires to them can be coloured red and black. */
const isPlus = (n: string) => /^[TB]\+/.test(n) || /^[UE]:(5V|3V3|VIN)$/.test(n) || n === lcdPoint('VCC');
const isMinus = (n: string) => /^[TB]-/.test(n) || /^[UE]:GND/.test(n) || n === lcdPoint('GND');
const WIRE_CYCLE: WireColor[] = ['orange', 'yellow', 'green', 'blue', 'purple', 'white'];

export function nextId(items: Item[], prefix: string): string {
  const taken = new Set(items.map((it, k) => itemId(it, k)));
  for (let n = 1; ; n++) if (!taken.has(prefix + n)) return prefix + n;
}

const DEFAULT_CTL: Partial<Record<PartKind, string>> = {
  button: 'Hold to press the button', pot: 'Knob position', sonar: 'Distance to the wall', pad: 'Hold to touch the pad', ldr: 'Light level', temp: 'Temperature',
  slide: 'Switch', joy: 'Joystick', tilt: 'Tilt switch', reed: 'Magnet', pir: 'Movement', ir: 'Path in front', soil: 'Soil moisture', water: 'Water level', gas: 'Gas in the air', flame: 'Flame',
};
/** What an on-screen control starts at: a knob, a light sensor, damp soil and a joystick at rest are in the middle, and everything else is off, far away or at room temperature. */
export const defaultInput = (it: Item): number => (it.t === 'pot' || it.t === 'ldr' || it.t === 'joy' || (it.t === 'module' && it.kind === 'soil') ? 0.5 : it.t === 'sonar' ? 30 : it.t === 'temp' ? 25 : 0);
/** Every on-screen value a part keeps, by the name it is kept under. A joystick keeps three: left to right under its id, down to up and the press of its stick beside it. */
export function inputsOf(it: Item, id: string): Record<string, number> {
  if (!('ctl' in it)) return {};
  return it.t === 'joy' ? { [id]: 0.5, [`${id}:y`]: 0.5, [`${id}:sw`]: 0 } : { [id]: defaultInput(it) };
}

/** Builds the item for a tool and the point(s) the student chose. */
export function makeItem(tool: Tool, items: Item[], a: string, b?: string): Item {
  const col = colOf(a), row = rowOf(a);
  switch (tool.kind) {
    case 'led': return { t: 'led', id: nextId(items, 'led'), a, k: b!, color: tool.color ?? 0xff3b30 };
    case 'res': return { t: 'res', id: nextId(items, 'res'), a, b: b!, ohms: tool.ohms ?? 220 };
    case 'buzzer': return { t: 'buzzer', id: nextId(items, 'buzz'), a, b: b! };
    case 'wire': {
      const color: WireColor = isPlus(a) || isPlus(b!) ? 'red' : isMinus(a) || isMinus(b!) ? 'black' : WIRE_CYCLE[items.filter(x => x.t === 'wire').length % WIRE_CYCLE.length];
      return { t: 'wire', id: nextId(items, 'wire'), a, b: b!, c: color };
    }
    case 'button': return { t: 'button', id: nextId(items, 'btn'), col, ctl: DEFAULT_CTL.button! };
    case 'pot': return { t: 'pot', id: nextId(items, 'pot'), row, col, ctl: DEFAULT_CTL.pot! };
    case 'sonar': return { t: 'sonar', id: nextId(items, 'sonar'), row, col, ctl: DEFAULT_CTL.sonar! };
    case 'pad': return { t: 'pad', id: nextId(items, 'pad'), ctl: DEFAULT_CTL.pad! };
    case 'ldr': return { t: 'ldr', id: nextId(items, 'ldr'), a, b: b!, ctl: DEFAULT_CTL.ldr! };
    case 'temp': return { t: 'temp', id: nextId(items, 'temp'), row, col, ctl: DEFAULT_CTL.temp! };
    case 'servo': return { t: 'servo', id: nextId(items, 'servo'), row, col };
    case 'rgb': return { t: 'rgb', id: nextId(items, 'rgb'), row, col };
    case 'slide': return { t: 'slide', id: nextId(items, 'slide'), row, col, ctl: DEFAULT_CTL.slide! };
    case 'joy': return { t: 'joy', id: nextId(items, 'joy'), row, col, ctl: DEFAULT_CTL.joy! };
    case 'contact': { const kind = toolKind(tool) as ContactKind; return { t: 'contact', kind, id: nextId(items, kind), a, b: b!, ctl: DEFAULT_CTL[kind]! }; }
    case 'module': { const kind = toolKind(tool) as ModuleKind; return { t: 'module', kind, id: nextId(items, kind), row, col, ctl: DEFAULT_CTL[kind]! }; }
    case 'lcd': return { t: 'lcd', id: nextId(items, 'lcd') };
    case 'breadboard': return { t: 'breadboard', id: nextId(items, 'breadboard'), size: tool.size ?? 'short' };
  }
}

/** The bench without its second breadboard, and without the parts and wires plugged into it, which come off with it. */
export const withoutBreadboard = (items: Item[]): Item[] => items.filter(it => it.t !== 'breadboard' && !holesOf(it).some(onExtraBoard));

/** Makes the second breadboard short or long, keeping its left end where it is. A long one only becomes short when nothing is plugged in past the short one's
    last column, and a short one only becomes long when there is room on the table for the extra length. */
export function resizedBreadboard(board: BoardId, items: Item[], size: BreadboardSize): { items: Item[] } | { error: string } {
  const last = COLS + BREADBOARD_COLS[size], beyond = items.flatMap(holesOf).find(p => onExtraBoard(p) && colOf(p) > last);
  if (beyond) return { error: `A short breadboard ends at column ${last}, and ${beyond} is in use. Move what is plugged in past column ${last} first.` };
  const there = items.find(it => it.t === 'breadboard');
  if (there && !fits(board, items, size, placeOf(there))) return { error: `There is no room for a ${size} breadboard where it lies now. Drag it somewhere clearer first.` };
  return { items: items.map(it => (it.t === 'breadboard' ? { ...it, size } : it)) };
}

/** Moves the second breadboard towards a place on the table, as far as it will go (see `slide`). Gives back the bench as it was when there is none, or it does not move. */
export function movedBreadboard(board: BoardId, items: Item[], want: Place): Item[] {
  const k = items.findIndex(it => it.t === 'breadboard'), bb = items[k];
  if (!bb || bb.t !== 'breadboard') return items;
  const from = placeOf(bb), to = slide(board, items, bb.size, from, want);
  return to.x === from.x && to.z === from.z ? items : items.map((it, i) => (i === k ? { ...bb, x: to.x, z: to.z } : it));
}
/** Puts the second breadboard back beside the first, where it started. */
export function homedBreadboard(items: Item[]): Item[] {
  return items.map(it => { if (it.t !== 'breadboard') return it; const { x: _x, z: _z, ...rest } = it; return rest; });
}

/** Turns what a student typed ("e10", "t+5", "13", "gnd", "d5") into a connection point name, or null. */
export function parseTerminal(board: BoardId, text: string, items: Item[] = []): string | null {
  const t = text.trim();
  if (!t) return null;
  const valid = new Set(allTerminals(board, items)), up = t.toUpperCase();
  const candidates = [t, t.toLowerCase(), up, `U:${up}`, `E:${up}`, `E:${up.replace(/^GPIO/, 'D')}`, up === 'GND' && board === 'esp32' ? 'E:GND' : '', /^\d+$/.test(t) && board === 'esp32' ? `E:D${t}` : ''];
  return candidates.find(c => c && valid.has(c)) ?? null;
}

/** Moves one end of a wire to another connection point. Gives back the new bench, or why the wire cannot go there. */
export function movedWire(board: BoardId, items: Item[], id: string, end: 'a' | 'b', to: string): { items: Item[] } | { error: string } {
  const k = items.findIndex((it, i) => itemId(it, i) === id), w = items[k];
  if (!w || w.t !== 'wire') return { error: 'That is not a wire.' };
  if (w[end] === to) return { items };
  const next = { ...w, [end]: to }, error = placementError(board, items.filter((_, i) => i !== k), next);   // the wire's own old ends do not count as taken
  if (error) return { error };
  const carries = isPlus(next.a) || isPlus(next.b) ? 'red' : isMinus(next.a) || isMinus(next.b) ? 'black' : null;
  const colour: WireColor = carries ?? (w.c === 'red' || w.c === 'black' ? WIRE_CYCLE[k % WIRE_CYCLE.length] : w.c);   // keep red and black for power and ground only
  return { items: items.map((it, i) => (i === k ? { ...next, c: colour } : it)) };
}

/** Turns an LED around, which swaps its long and short legs. */
export const flipped = (it: Item): Item => (it.t === 'led' ? { ...it, a: it.k, k: it.a } : it);
