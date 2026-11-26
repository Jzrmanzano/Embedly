/* The reference builds and the templates are laid out so their connections are easy to follow, on both boards.
   1. A wire from a board pin lands on the pin's own side of the breadboard. The ESP32 covers the middle of the breadboard, and the Uno's digital pins are
      along its far edge and its power and analog pins along its near one, so a wire to the other side cuts across the bench, over everything else.
   2. No two long wires cross each other over a breadboard. A short jumper from a row to the rail beside it lies low, under the arcs, and does not count. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESP_FAR, ESP_HOLES, ESP_NEAR } from '../src/data/boards';
import { MISSIONS } from '../src/data/missions';
import { TEMPLATES } from '../src/data/templates';
import { LCD_PINS } from '../src/sim/lcd';
import { BB_DEPTH, bbLength, extraRect, holeXZ, placeOf, RAILZ, ROWZ, tableLayout, unoPinSide, unoPinXZ } from '../src/state/table';
import { MAIN_COLS, type BoardId, type Item } from '../src/types';

type Wire = Extract<Item, { t: 'wire' }>;
/** Which side of a breadboard a point is on: rows a to e and the T rails are the far side, f to j and the B rails the near side. Off-board points have none. */
const sideOf = (p: string): 'far' | 'near' | null => (/^([a-e]\d+|T[+-]\d+)$/.test(p) ? 'far' : /^([f-j]\d+|B[+-]\d+)$/.test(p) ? 'near' : null);
const pinSide = (p: string): 'far' | 'near' | null => {
  let m;
  if ((m = /^E:(.+)$/.exec(p))) return ESP_FAR.includes(m[1]) ? 'far' : ESP_NEAR.includes(m[1]) ? 'near' : null;
  if ((m = /^U:(.+)$/.exec(p))) return unoPinSide(m[1]);
  return null;
};

/** Where a point is on the table, seen from above. */
function at(board: BoardId, items: Item[], p: string): [number, number] | null {
  let m;
  if ((m = /^U:(.+)$/.exec(p))) { const q = unoPinXZ(m[1]); return q && [q.x, q.z]; }
  if ((m = /^E:(.+)$/.exec(p))) return ESP_HOLES[m[1]] ? at(board, items, ESP_HOLES[m[1]]) : null;
  if ((m = /^([TB][+-])(\d+)$/.exec(p))) { const q = holeXZ(items, +m[2], RAILZ[m[1]]); return q && [q.x, q.z]; }
  if ((m = /^([a-j])(\d+)$/.exec(p))) { const q = holeXZ(items, +m[2], ROWZ[m[1]]); return q && [q.x, q.z]; }
  const lay = tableLayout(board, items);
  if (p === 'PAD' && lay.pad) return [lay.pad.x, lay.pad.z];
  if ((m = /^LCD:(\w+)$/.exec(p)) && lay.lcd) return [lay.lcd.x - 47.5, lay.lcd.z + (LCD_PINS.indexOf(m[1] as never) - 1.5) * 2.54];
  return null;
}

/** The wires that leave a board pin for the other side of a breadboard. */
function acrossTheBench(items: Item[]): string[] {
  return items.flatMap(it => {
    if (it.t !== 'wire') return [];
    for (const [pin, to] of [[it.a, it.b], [it.b, it.a]]) {
      const from = pinSide(pin), side = sideOf(to);
      if (from && side && from !== side) return [`${pin} (${from} side) to ${to} (${side} side)`];
    }
    return [];
  });
}

/** Pairs of long wires whose paths cross over a breadboard, seen from above. */
function tangles(board: BoardId, items: Item[]): string[] {
  const boards = [{ x: 0, z: 0, w: bbLength(MAIN_COLS), d: BB_DEPTH }];
  const second = items.find(it => it.t === 'breadboard');
  if (second?.t === 'breadboard') boards.push(extraRect(second.size, placeOf(second)));
  const onBoard = (x: number, z: number) => boards.some(b => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2);
  const wires = items.filter((it): it is Wire => it.t === 'wire').map(w => ({ w, a: at(board, items, w.a), b: at(board, items, w.b) }))
    .filter((x): x is { w: Wire; a: [number, number]; b: [number, number] } => !!x.a && !!x.b && Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]) > 15);
  const out: string[] = [];
  for (let i = 0; i < wires.length; i++) for (let j = i + 1; j < wires.length; j++) {
    const [p, q] = [wires[i], wires[j]];
    if ([p.w.a, p.w.b].some(e => e === q.w.a || e === q.w.b)) continue;   // wires that share an end meet there, they do not cross
    const d = (q.b[1] - q.a[1]) * (p.b[0] - p.a[0]) - (q.b[0] - q.a[0]) * (p.b[1] - p.a[1]);
    if (!d) continue;
    const s = ((q.b[0] - q.a[0]) * (p.a[1] - q.a[1]) - (q.b[1] - q.a[1]) * (p.a[0] - q.a[0])) / d, t = ((p.b[0] - p.a[0]) * (p.a[1] - q.a[1]) - (p.b[1] - p.a[1]) * (p.a[0] - q.a[0])) / d;
    if (s <= 0 || s >= 1 || t <= 0 || t >= 1) continue;
    const x = p.a[0] + s * (p.b[0] - p.a[0]), z = p.a[1] + s * (p.b[1] - p.a[1]);
    if (onBoard(x, z)) out.push(`${p.w.a}–${p.w.b} crosses ${q.w.a}–${q.w.b}`);
  }
  return out;
}

const builds = (['uno', 'esp32'] as BoardId[]).flatMap(board => [
  ...MISSIONS[board].flatMap(m => [{ name: `${board}/${m.id}`, board, items: m.circuit }, ...(m.start ? [{ name: `${board}/${m.id} (start)`, board, items: m.start }] : [])]),
  ...TEMPLATES[board].map(t => ({ name: `template ${board}/${t.id}`, board, items: t.circuit })),
]);

test('no reference build or template has a wire from a board pin cutting across the bench to the other side', () => {
  assert.deepEqual(builds.flatMap(b => acrossTheBench(b.items).map(c => `${b.name}: ${c}`)), []);
});

test('no reference build or template has two long wires crossing over a breadboard', () => {   // a repair job's bench is somebody's rushed install, and may be untidy
  assert.deepEqual(builds.filter(b => !b.name.endsWith('(start)')).flatMap(b => tangles(b.board, b.items).map(c => `${b.name}: ${c}`)), []);
});

test('the checks themselves notice a wire that cuts across, and wires that cross', () => {
  assert.deepEqual(acrossTheBench([{ t: 'wire', a: 'E:D34', b: 'j29', c: 'green' }]), ['E:D34 (far side) to j29 (near side)']);
  assert.deepEqual(acrossTheBench([{ t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' }]), ['U:GND (near side) to T-2 (far side)']);
  assert.deepEqual(acrossTheBench([{ t: 'wire', a: 'B+48', b: 'a48', c: 'red' }, { t: 'wire', a: 'E:D4', b: 'PAD', c: 'white' }]), [], 'a jumper across a breadboard, and the touch pad, are fine');
  const crossed: Item[] = [{ t: 'wire', a: 'a5', b: 'j20', c: 'red' }, { t: 'wire', a: 'a20', b: 'j5', c: 'red' }];
  assert.equal(tangles('uno', crossed).length, 1);
  assert.deepEqual(tangles('uno', [{ t: 'wire', a: 'a5', b: 'j20', c: 'red' }, { t: 'wire', a: 'j12', b: 'B-12', c: 'black' }]), [], 'a short jumper to a rail does not count');
});

test('the ESP32 builds with more than the LED on them use a long breadboard, so nothing is squeezed into the nine free columns', () => {
  for (const b of builds.filter(x => x.board === 'esp32')) {
    const parts = b.items.filter(it => !['wire', 'res', 'led', 'breadboard', 'pad'].includes(it.t));
    const long = b.items.some(it => it.t === 'breadboard' && it.size === 'long');
    if (parts.length >= 2 || parts.some(it => it.t === 'module' || it.t === 'pot' || it.t === 'temp' || it.t === 'servo')) assert.ok(long, `${b.name} is built on the long breadboard`);
  }
});
