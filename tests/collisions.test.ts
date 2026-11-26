/* Nothing on the table lies on anything else: the breadboards, the Uno, servo motors, the wall in front of a distance sensor, the touch pad and the LCD.
   Every mission's build, every repair job's bench and every template is checked, and so are the rules that keep it that way. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MISSIONS } from '../src/data/missions';
import { TEMPLATES } from '../src/data/templates';
import { makeItem, movedBreadboard, movedPart, placementError } from '../src/state/bench';
import { BB_DEPTH, collisions, fits, HOME, LCD_AT, overlaps, PAD_AT, SERVO_REACH, servoBody, tableLayout, wallSweep } from '../src/state/table';
import type { BoardId, Item } from '../src/types';

const BOARDS: BoardId[] = ['uno', 'esp32'];
const said = (board: BoardId, items: Item[]) => collisions(board, items).map(([a, b]) => `${a.what} on ${b.what}`);
const servo = (row: string, col: number, id = `s${row}${col}`): Item => ({ t: 'servo', id, row, col });
const sonar = (row: string, col: number, id = 'sonar1'): Item => ({ t: 'sonar', id, row, col, ctl: '' });
const LCD: Item = { t: 'lcd', id: 'lcd1' }, PAD: Item = { t: 'pad', id: 'pad1', ctl: '' };

test('no mission build, repair job bench or template has anything on the table lying on anything else', () => {
  const problems: string[] = [];
  for (const board of BOARDS) {
    for (const m of MISSIONS[board]) for (const [name, items] of [['build', m.circuit], ['start', m.start ?? []]] as const) {
      for (const c of said(board, items)) problems.push(`${board}/${m.id} ${name}: ${c}`);
    }
    for (const t of TEMPLATES[board]) for (const c of said(board, t.circuit)) problems.push(`template ${board}/${t.id}: ${c}`);
  }
  assert.deepEqual(problems, []);
});

test('the LCD and the touch pad keep their usual places while nothing is in the way', () => {
  for (const board of BOARDS) assert.deepEqual(tableLayout(board, [LCD, PAD]), { ...tableLayout(board, [LCD, PAD]), pad: PAD_AT, lcd: LCD_AT });
});

test('the LCD moves out of the way of the wall in front of a distance sensor, as in the distance meter', () => {
  const t = TEMPLATES.uno.find(x => x.id === 'distance')!, lay = tableLayout('uno', t.circuit), sweep = wallSweep(t.circuit, t.circuit.find(it => it.t === 'sonar') as Extract<Item, { t: 'sonar' }>)!;
  assert.notDeepEqual(lay.lcd, LCD_AT, 'its usual place is where the wall stands');
  assert.ok(!overlaps(lay.things.find(x => x.what === 'the LCD display')!.rect, sweep));
  assert.deepEqual(said('uno', [LCD, sonar('j', 18)]), []);
});

test('the touch pad moves out of the way of a servo motor in front of the bench', () => {
  const lay = tableLayout('uno', [PAD, servo('g', 8)]);
  assert.notDeepEqual(lay.pad, PAD_AT);
  assert.deepEqual(said('uno', [PAD, servo('g', 8)]), []);
});

test('a servo\'s motor lies beyond the edge of its own breadboard, wherever that has been moved', () => {
  assert.equal(servoBody([], servo('g', 10) as Extract<Item, { t: 'servo' }>)!.z, SERVO_REACH);
  assert.equal(servoBody([], servo('b', 10) as Extract<Item, { t: 'servo' }>)!.z, -SERVO_REACH);
  const bb: Item = { t: 'breadboard', id: 'BB1', size: 'short', x: HOME.x, z: 90 };
  assert.equal(servoBody([bb], servo('g', 40) as Extract<Item, { t: 'servo' }>)!.z, 90 + SERVO_REACH);
  const wall = wallSweep([bb], sonar('a', 40) as Extract<Item, { t: 'sonar' }>)!;
  assert.ok(wall.z - wall.d / 2 >= 90 + BB_DEPTH / 2 - 0.01, 'the wall in front of a sensor never stands on its breadboard, even in row a');
});

test('a part whose motor or wall would lie on something is refused, and says what it would hit', () => {
  assert.match(placementError('uno', [servo('g', 10)], servo('g', 14))!, /servo's motor would lie on a servo motor/);
  assert.equal(placementError('uno', [servo('g', 10)], servo('b', 14)), null, 'the other side of the breadboard is free');
  assert.equal(placementError('uno', [servo('g', 10)], servo('g', 24)), null, 'and so is further along');
  assert.match(placementError('uno', [servo('g', 20)], sonar('j', 14))!, /wall the sensor measures to would run into a servo motor/);
  assert.match(placementError('uno', [sonar('j', 14)], servo('h', 20))!, /would lie on the wall in front of a distance sensor/);
  const moved: Item = { t: 'breadboard', id: 'BB1', size: 'short', x: -40, z: 70 };
  assert.match(placementError('uno', [moved], servo('g', 15))!, /lie on the second breadboard/);
});

test('moving a part to other holes is refused when its motor would land on something', () => {
  const items = [servo('g', 10, 'a'), servo('g', 24, 'b')];
  const r = movedPart('uno', items, 'b', 0, -10);
  assert.ok('error' in r && /servo's motor would lie on/.test(r.error));
});

test('the second breadboard stops against a servo motor, and what is plugged into it cannot be carried onto the Uno', () => {
  const bench: Item[] = [{ t: 'breadboard', id: 'BB1', size: 'short' }, servo('g', 10)];
  assert.ok(fits('uno', bench, 'short', HOME));
  assert.ok(!fits('uno', bench, 'short', { x: -40, z: 75 }), 'the motor in front of the bench is in the way');
  const riding: Item[] = [{ t: 'breadboard', id: 'BB1', size: 'short' }, servo('b', 40)], onUno = { x: -110, z: 75 };   // the breadboard is clear of the Uno there, but the motor behind it is not
  assert.ok(fits('uno', riding.slice(0, 1), 'short', onUno), 'the breadboard alone would fit');
  assert.ok(!fits('uno', riding, 'short', onUno), 'its servo\'s motor would land on the Uno');
  const moved = movedBreadboard('uno', riding, onUno).find(it => it.t === 'breadboard') as Extract<Item, { t: 'breadboard' }>;
  assert.ok(moved.x !== onUno.x || moved.z !== onUno.z, 'so it stops short of there');
  assert.deepEqual(said('uno', movedBreadboard('uno', riding, onUno)), []);
});

test('putting an LCD or a touch pad on a crowded bench finds them room, or says there is none', () => {
  const crowd: Item[] = [sonar('j', 1, 'w1'), sonar('j', 20, 'w2'), servo('b', 2, 'b1'), servo('b', 15, 'b2'), servo('b', 28, 'b3')];   // walls across the front, motors across the back
  assert.deepEqual(said('uno', crowd), []);
  const err = placementError('uno', crowd, makeItem({ kind: 'lcd' }, crowd, 'LCD'));
  if (err) assert.match(err, /no room left on the table for the LCD/);
  else assert.deepEqual(said('uno', [...crowd, LCD]), [], 'when it is allowed, it lies on nothing');
});
