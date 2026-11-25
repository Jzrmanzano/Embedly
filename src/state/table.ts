/* Where things lie on the table, seen from above, in millimetres from the middle of the bench's own breadboard: x to the right, z towards the student.
   No 3D in here. The 3D bench is built from these numbers, and the rules below keep the second breadboard clear of everything else when it is moved. */
import { BREADBOARD_COLS, MAIN_COLS, type BoardId, type BreadboardSize, type Item } from '../types';

/** The distance between two holes. */
export const PITCH = 2.54;
/** How long a breadboard of so many columns is, how deep and how tall every breadboard is. */
export const bbLength = (cols: number) => cols * PITCH + 6;
export const BB_DEPTH = 53.4, BB_HEIGHT = 8.5;
/** The x of column c of the bench's own breadboard. */
export const colX = (c: number) => (c - (MAIN_COLS + 1) / 2) * PITCH;

/** The middle of the Uno, which lies on the table to the left of the breadboard. The ESP32 sits on the breadboard itself. */
export const UNO_AT = { x: -100, z: 0 };
const UNO_SIZE = { w: 68.6, d: 53.4 };
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

/** What the second breadboard must not lie on: the first breadboard, the Uno, and the LCD and the touch pad when they are on the bench. */
export function obstacles(board: BoardId, items: Item[]): Rect[] {
  const out: Rect[] = [{ x: 0, z: 0, w: bbLength(MAIN_COLS), d: BB_DEPTH }];
  if (board === 'uno') out.push({ ...UNO_AT, ...UNO_SIZE });
  if (items.some(it => it.t === 'lcd')) out.push({ x: LCD_AT.x - 5, z: LCD_AT.z, w: 90, d: 36 });   // the display's board, and the backpack's tab on its left
  if (items.some(it => it.t === 'pad')) out.push({ ...PAD_AT, w: 18, d: 18 });
  return out;
}
/** Do two rectangles overlap? Touching is fine: two breadboards can stand edge to edge. */
export const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.1 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 0.1;
/** Can a second breadboard of this size lie here? */
export const fits = (board: BoardId, items: Item[], size: BreadboardSize, p: Place) => obstacles(board, items).every(o => !overlaps(extraRect(size, p), o));

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
