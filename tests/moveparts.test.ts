/* Moving a placed part to other holes: it keeps its shape and everything else about it, and goes only where it could have been placed. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holeOffset, holesOf, movable, movedPart, shiftedPart } from '../src/state/bench';
import type { BoardId, Item } from '../src/types';

const led: Item = { t: 'led', id: 'led1', a: 'e10', k: 'e11', color: 0x2ecc40 };
const res: Item = { t: 'res', id: 'res1', a: 'c11', b: 'T-15', ohms: 330 };
const pot: Item = { t: 'pot', id: 'pot1', row: 'd', col: 20, ctl: 'Knob' };
const button: Item = { t: 'button', id: 'btn1', col: 5, ctl: 'Press' };
const wire: Item = { t: 'wire', id: 'wire1', a: 'U:13', b: 'a10', c: 'orange' };
const second: Item = { t: 'breadboard', id: 'breadboard1', size: 'short' };
const move = (items: Item[], id: string, rows: number, cols: number, board: BoardId = 'uno') => movedPart(board, items, id, rows, cols);
const moved = (items: Item[], id: string, rows: number, cols: number, board: BoardId = 'uno') => {
  const r = move(items, id, rows, cols, board);
  assert.ok('items' in r, 'error' in r ? r.error : '');
  return r.items.find(it => 'id' in it && it.id === id)!;
};

test('how far apart two holes are, counting the rails as rows beyond a and j', () => {
  assert.deepEqual(holeOffset('e10', 'e15'), [0, 5]);
  assert.deepEqual(holeOffset('e10', 'f10'), [1, 0], 'across the gap is one row');
  assert.deepEqual(holeOffset('a10', 'T-10'), [-1, 0]);
  assert.deepEqual(holeOffset('j3', 'B+40'), [2, 37]);
  assert.equal(holeOffset('U:13', 'e10'), null, 'a board pin is not a hole');
});

test('a part keeps its shape, its id and everything else about it', () => {
  assert.deepEqual(moved([led], 'led1', 0, 5), { ...led, a: 'e15', k: 'e16' });
  assert.deepEqual(moved([led], 'led1', -3, 2), { ...led, a: 'b12', k: 'b13' });
  assert.deepEqual(moved([res], 'res1', 1, -1), { ...res, a: 'd10', b: 'a14' }, 'a leg in a rail moves to the row beside it');
  assert.deepEqual(moved([pot], 'pot1', 3, -4), { ...pot, row: 'g', col: 16 });
  assert.deepEqual(moved([button], 'btn1', 0, 7), { ...button, col: 12 });
  assert.deepEqual(moved([button], 'btn1', 4, 7), { ...button, col: 12 }, 'a button always sits across the gap, so only moves along');
});

test('its own holes do not count as taken, but every other part\'s do', () => {
  assert.deepEqual(moved([led], 'led1', 0, 1), { ...led, a: 'e11', k: 'e12' }, 'one hole along, into the hole its other leg just left');
  const r = move([led, { ...wire, b: 'e13' }], 'led1', 0, 2);
  assert.ok('error' in r && /e13 is already taken/.test(r.error), JSON.stringify(r));
  const back = move([led, { ...wire, b: 'e13' }], 'led1', 0, 0);
  assert.ok('items' in back && back.items[0] === led, 'not moving at all changes nothing');
});

test('it goes only where it could have been placed', () => {
  const edge = move([led], 'led1', 0, -10);
  assert.ok('error' in edge && /off the breadboard/.test(edge.error), 'not past column 1');
  const far = move([led], 'led1', 0, 25);
  assert.ok('error' in far && /add a second breadboard/.test(far.error), 'not past column 30 with no second breadboard');
  const rail = move([pot], 'pot1', -4, 0);
  assert.ok('error' in rail && /off the breadboard/.test(rail.error), 'a knob stays in rows a to j');
  const wide = move([pot], 'pot1', 0, 9);
  assert.ok('error' in wide && /needs three columns/.test(wide.error), 'nor across the end of the breadboard');
  const esp = move([{ ...pot, col: 24 }], 'pot1', 0, -10, 'esp32');
  assert.ok('error' in esp && /under the ESP32/.test(esp.error));
});

test('it can move onto the second breadboard, but not straddle the gap between the two', () => {
  assert.deepEqual(moved([second, led], 'led1', 0, 30), { ...led, a: 'e40', k: 'e41' });
  assert.deepEqual(holesOf(moved([second, pot], 'pot1', 0, 15)), ['d35', 'd36', 'd37']);
  const straddle = move([second, pot], 'pot1', 0, 9);
  assert.ok('error' in straddle && /three columns on one breadboard/.test(straddle.error), JSON.stringify(straddle));
});

test('wires move by their ends, and what lies on the table stays put', () => {
  for (const it of [wire, second, { t: 'lcd', id: 'lcd1' }, { t: 'pad', id: 'pad1', ctl: '' }] as Item[]) {
    assert.equal(movable(it), false, it.t);
    assert.equal(shiftedPart(it, 0, 1), null, it.t);
    assert.ok('error' in move([it], 'id' in it ? it.id! : '', 0, 1), it.t);
  }
  for (const it of [led, res, pot, button]) assert.ok(movable(it), it.t);
});
