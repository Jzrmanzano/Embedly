/* Where things lie on the table, seen from above, in millimetres from the middle of the bench's own breadboard: x to the right, z towards the student.
   No 3D in here. The 3D bench is built from these numbers, and the rules below keep things from landing on each other: the touch pad and the LCD
   find a free place, a part whose motor or wall would stand on something is refused, and the second breadboard stops against whatever is in its way. */
import { BREADBOARD_COLS, MAIN_COLS, type BoardId, type BreadboardSize, type Item } from '../types';

/** The distance between two holes. */
export const PITCH = 2.54;
/** How long a breadboard of so many columns is, how deep and how tall every breadboard is. */
export const bbLength = (cols: number) => cols * PITCH + 6;
export const BB_DEPTH = 53.4, BB_HEIGHT = 8.5;
/** The x of column c of the bench's own breadboard. */
export const colX = (c: number) => (c - (MAIN_COLS + 1) / 2) * PITCH;
/** How far each row of holes and each rail is from the middle of its breadboard. Rows a to e are on the far half, f to j on the near half. */
export const ROWZ: Record<string, number> = { a: -13.97, b: -11.43, c: -8.89, d: -6.35, e: -3.81, f: 3.81, g: 6.35, h: 8.89, i: 11.43, j: 13.97 };
export const RAILZ: Record<string, number> = { 'T+': -23.5, 'T-': -20.96, 'B-': 20.96, 'B+': 23.5 };

/** The middle of the Uno, which lies on the table to the left of the breadboard. The ESP32 sits on the breadboard itself. */
export const UNO_AT = { x: -100, z: 0 };
const UNO_SIZE = { w: 68.6, d: 53.4 };
/** The Uno's headers, in millimetres from the board's back-left corner: where each starts, how far in from the back edge, and its pins in order ("" for one with no pin).
    The digital header, with the GND beside pin 13, runs along the far edge; the power and analog headers along the near edge. The 3D Uno is built from these. */
export const UNO_HEADERS: { id: string; x0: number; z: number; names: string[] }[] = [
  { id: 'digital', x0: 18.8, z: 2.5, names: ['SCL', 'SDA', 'AREF', 'GND2', '13', '12', '11', '10', '9', '8'] },
  { id: 'digital', x0: 45.2, z: 2.5, names: ['7', '6', '5', '4', '3', '2', '1', '0'] },
  { id: 'power', x0: 27.9, z: UNO_SIZE.d - 2.5, names: ['', 'IOREF', 'RESET', '3V3', '5V', 'GND', 'GNDb', 'VIN'] },
  { id: 'analog', x0: 50.8, z: UNO_SIZE.d - 2.5, names: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] },
];
/** Where an Uno pin is on the table, or null for a name it does not have. */
export function unoPinXZ(name: string): { x: number; z: number } | null {
  for (const h of UNO_HEADERS) {
    const i = h.names.indexOf(name);
    if (name && i >= 0) return { x: UNO_AT.x + h.x0 + i * PITCH - UNO_SIZE.w / 2, z: UNO_AT.z + h.z - UNO_SIZE.d / 2 };
  }
  return null;
}
/** Which edge of the Uno a pin is on: the far one (the digital header) or the near one (power and analog). */
export const unoPinSide = (name: string): 'far' | 'near' | null => { const p = unoPinXZ(name); return p ? (p.z < UNO_AT.z ? 'far' : 'near') : null; };
/** The middle of the touch pad and of the LCD, each at a place of its own in front of the breadboard. */
export const PAD_AT = { x: colX(8), z: 46 };
export const LCD_AT = { x: colX(28), z: 64 };

/** A rectangle on the table: its middle and its size. */
export interface Rect { x: number; z: number; w: number; d: number }
/** Where the second breadboard lies: the x of its left end (where column 31 is) and the z of its middle. */
export interface Place { x: number; z: number }

/** Unless it has been moved, the second breadboard lies just to the right of the first, with a small gap between. */
export const HOME: Place = { x: bbLength(MAIN_COLS) / 2 + 5, z: 0 };
/** How far from the middle of the bench it may go, so it cannot be lost off the edge of the view. */
export const REACH = 360;

export const placeOf = (it: { x?: number; z?: number }): Place => ({ x: it.x ?? HOME.x, z: it.z ?? HOME.z });
export const isHome = (it: { x?: number; z?: number }) => { const p = placeOf(it); return p.x === HOME.x && p.z === HOME.z; };
export function extraRect(size: BreadboardSize, p: Place): Rect {
  const w = bbLength(BREADBOARD_COLS[size]);
  return { x: p.x + w / 2, z: p.z, w, d: BB_DEPTH };
}

/** Do two rectangles overlap? Touching is fine: two breadboards can stand edge to edge. */
export const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.1 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.1;

/* --- the things that stand on the table beside the breadboards --- */
/** The middle of hole `c` in a row or rail `rowZ` from its breadboard's middle: on the bench's own breadboard, or on the second one, at `place` if given or else where it lies. Null for a column the bench does not have. */
export function holeXZ(items: Item[], c: number, rowZ: number, place?: Place): { x: number; z: number } | null {
  if (c <= MAIN_COLS) return { x: colX(c), z: rowZ };
  const bb = items.find(it => it.t === 'breadboard');
  if (bb?.t !== 'breadboard' || c > MAIN_COLS + BREADBOARD_COLS[bb.size]) return null;
  const p = place ?? placeOf(bb), cols = BREADBOARD_COLS[bb.size];
  return { x: p.x + bbLength(cols) / 2 + (c - MAIN_COLS - (cols + 1) / 2) * PITCH, z: p.z + rowZ };
}
/** A servo's motor lies on the table beyond the edge of its breadboard, this far from the breadboard's middle: behind it from rows a to e, in front from f to j. */
export const SERVO_REACH = 46;
export function servoBody(items: Item[], it: Extract<Item, { t: 'servo' }>, place?: Place): Rect | null {
  const mid = holeXZ(items, it.col + 1, ROWZ[it.row], place);
  return mid && { x: mid.x, z: mid.z - ROWZ[it.row] + (it.row <= 'e' ? -1 : 1) * SERVO_REACH, w: 32.5, d: 12.2 };   // the case with its mounting tabs
}
/** The distances the wall in front of a distance sensor can be set to, in cm. */
export const WALL_CM: [number, number] = [2, 100];
/** Where the middle of the wall in front of a distance sensor stands for a distance: in front of the sensor, and never on its breadboard, since it stands on the table. */
export const wallZ = (holeZ: number, bbZ: number, cm: number) => Math.max(holeZ + 17 + cm * 0.6, bbZ + BB_DEPTH / 2 + 3);
/** All the places the wall in front of a distance sensor can stand, from nearest to furthest. */
export function wallSweep(items: Item[], it: Extract<Item, { t: 'sonar' }>, place?: Place): Rect | null {
  const p = holeXZ(items, it.col, ROWZ[it.row], place);
  if (!p) return null;
  const bbZ = p.z - ROWZ[it.row], near = wallZ(p.z, bbZ, WALL_CM[0]) - 3, far = wallZ(p.z, bbZ, WALL_CM[1]) + 3;
  return { x: p.x + 3.81, z: (near + far) / 2, w: 48, d: far - near };
}
const padRect = (p: Place): Rect => ({ x: p.x, z: p.z, w: 18, d: 18 });
/** The display's board, and the backpack's narrower tab on its left that holds the four pins. */
const lcdRects = (p: Place): Rect[] => [{ x: p.x, z: p.z, w: 80, d: 36 }, { x: p.x - 44, z: p.z, w: 12, d: 15 }];
/** Where the touch pad and the LCD may lie, first choice first: their usual places in front of the breadboard, then beside those, then behind, then further out. */
const PAD_SPOTS: Place[] = [PAD_AT, { x: -60, z: 46 }, { x: PAD_AT.x, z: -46 }, { x: -60, z: -46 }, { x: PAD_AT.x, z: 100 }, { x: -60, z: 100 }];
const LCD_SPOTS: Place[] = [LCD_AT, { x: -30, z: 64 }, { x: 95, z: 64 }, { x: LCD_AT.x, z: -72 }, { x: 95, z: -72 }, { x: -30, z: -72 }, { x: LCD_AT.x, z: 114 }, { x: -30, z: 114 }];   // front left is beside the Uno's A4 and A5, where its data wires come from

/** Something on the table, as far as getting in the way goes. `rides`: it is the second breadboard or stands on it, so it moves with it. */
export interface Thing { what: string; rect: Rect; rides: boolean; id?: string }
/** Everything on the table and where it lies, with the places found for the touch pad and the LCD. */
export interface Layout { things: Thing[]; pad: Place | null; lcd: Place | null }

/** The things that are on the table because of the parts on the bench: servo motors and the walls in front of distance sensors. */
function partThings(items: Item[], place?: Place): Thing[] {
  const out: Thing[] = [];
  for (const it of items) {
    if (it.t === 'servo') { const r = servoBody(items, it, place); if (r) out.push({ what: 'a servo motor', rect: r, rides: it.col > MAIN_COLS, id: it.id }); }
    if (it.t === 'sonar') { const r = wallSweep(items, it, place); if (r) out.push({ what: 'the wall in front of a distance sensor', rect: r, rides: it.col > MAIN_COLS, id: it.id }); }
  }
  return out;
}
/** Where everything lies. The touch pad and then the LCD take the first of their places that nothing lies on, the second breadboard and what rides on it
    included, where they lie now. While the second breadboard is being dragged it keeps clear of the pad and the LCD itself, and the 3D bench places them
    from the bench as it was before the drag (see setCircuit in src/scene/world.ts), so they do not hop about under the pointer. */
export function tableLayout(board: BoardId, items: Item[]): Layout {
  const things: Thing[] = [{ what: 'the breadboard', rect: { x: 0, z: 0, w: bbLength(MAIN_COLS), d: BB_DEPTH }, rides: false }];
  if (board === 'uno') things.push({ what: 'the Uno', rect: { ...UNO_AT, ...UNO_SIZE }, rides: false });
  const bb = items.find(it => it.t === 'breadboard');
  if (bb?.t === 'breadboard') things.push({ what: 'the second breadboard', rect: extraRect(bb.size, placeOf(bb)), rides: true, id: bb.id });
  things.push(...partThings(items));
  const clear = (r: Rect) => things.every(t => !overlaps(r, t.rect));
  let pad: Place | null = null, lcd: Place | null = null;
  const padItem = items.find(it => it.t === 'pad'), lcdItem = items.find(it => it.t === 'lcd');
  if (padItem) { pad = PAD_SPOTS.find(p => clear(padRect(p))) ?? PAD_AT; things.push({ what: 'the touch pad', rect: padRect(pad), rides: false, id: padItem.id }); }
  if (lcdItem) { lcd = LCD_SPOTS.find(p => lcdRects(p).every(clear)) ?? LCD_AT; for (const rect of lcdRects(lcd)) things.push({ what: 'the LCD display', rect, rides: false, id: lcdItem.id }); }
  return { things, pad, lcd };
}
/** Every pair of things on the table that lie on each other. An empty list is a bench where nothing collides. */
export function collisions(board: BoardId, items: Item[]): [Thing, Thing][] {
  const { things } = tableLayout(board, items), out: [Thing, Thing][] = [];
  things.forEach((a, i) => things.slice(i + 1).forEach(b => { if ((!a.id || a.id !== b.id) && overlaps(a.rect, b.rect)) out.push([a, b]); }));   // the LCD's board and its tab are one part
  return out;
}

/** What the second breadboard, and everything riding on it, must not lie on: everything else on the table. */
export const obstacles = (board: BoardId, items: Item[]): Rect[] => tableLayout(board, items).things.filter(t => !t.rides).map(t => t.rect);
/** Can a second breadboard of this size lie here, with everything plugged into it? */
export function fits(board: BoardId, items: Item[], size: BreadboardSize, p: Place): boolean {
  const moving = [extraRect(size, p), ...partThings(items, p).filter(t => t.rides).map(t => t.rect)];
  return obstacles(board, items).every(o => moving.every(m => !overlaps(m, o)));
}

const tenth = (v: number) => Math.round(v * 10) / 10, within = (v: number) => Math.max(-REACH, Math.min(REACH, v));
/** Where the second breadboard ends up when it is pushed from `from` towards `want`. It moves in small steps, first along x and then along z,
    so it stops flush against whatever is in the way and slides along it, the way a real one does when pushed into something.
    A breadboard that already lies on something (an LCD put down on top of it) may go anywhere, so it can be moved off. Places are kept to a tenth of a millimetre. */
export function slide(board: BoardId, items: Item[], size: BreadboardSize, from: Place, want: Place): Place {
  const to = { x: within(want.x), z: within(want.z) }, ok = (p: Place) => fits(board, items, size, p);
  if (!ok(from)) return { x: tenth(to.x), z: tenth(to.z) };
  const along = (p: Place, axis: 'x' | 'z', goal: number): Place => {   // as far towards goal along one axis as it can go
    const at = (f: number) => ({ ...p, [axis]: p[axis] + (goal - p[axis]) * f });
    if (ok(at(1))) return at(1);
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (ok(at(m))) lo = m; else hi = m; }
    return at(lo);
  };
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 4));   // 4 mm at a time, so it never jumps through something thin
  let p = from;
  for (let i = 1; i <= steps; i++) p = along(along(p, 'x', from.x + (to.x - from.x) * i / steps), 'z', from.z + (to.z - from.z) * i / steps);
  // Rounded, it may land a hair inside what it stopped against, and then the next push would count it as lying on it. A tenth back the way it came is clear.
  const x = tenth(p.x), z = tenth(p.z), bx = tenth(p.x + Math.sign(from.x - p.x) * 0.1), bz = tenth(p.z + Math.sign(from.z - p.z) * 0.1);
  return [{ x, z }, { x: bx, z }, { x, z: bz }, { x: bx, z: bz }].find(ok) ?? p;
}
