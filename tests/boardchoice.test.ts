/* Choosing a board: each mission has the answers it says it has, every board on the shelf is the right answer somewhere, and the reasons read right. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answersOf, CARDS, cardOf, meets, why, type CardId, type Need } from '../src/data/boardchoice';
import { MISSIONS, missionKey } from '../src/data/missions';
import { BOARDS } from '../src/data/boards';
import type { BoardId } from '../src/types';

const choosing = (Object.entries(MISSIONS) as [BoardId, (typeof MISSIONS)[BoardId]][]).flatMap(([board, list]) => list.filter(m => m.choice).map(m => ({ board, m, choice: m.choice! })));

/** Who is right for each mission. If a card's facts change, this says which missions change with them. */
const EXPECTED: Record<string, CardId[]> = {
  'uno-democart': ['uno'],
  'uno-linebot': ['nano'],
  'esp32-mural': ['esp32'],
  'esp32-bagtag': ['c3'],
  'esp32-visitorlight': ['d1mini', 'c3'],
};

test('each mission that asks for a board has exactly the right answers', () => {
  assert.deepEqual(choosing.map(x => missionKey(x.board, x.m.id)).sort(), Object.keys(EXPECTED).sort());
  for (const { board, m, choice } of choosing) assert.deepEqual(answersOf(choice).map(c => c.id), EXPECTED[missionKey(board, m.id)], `${board}/${m.id}`);
});

test('every board on the shelf is the right answer somewhere, and every wrong board misses a need for a reason', () => {
  const right = new Set(choosing.flatMap(x => answersOf(x.choice).map(c => c.id)));
  assert.deepEqual(CARDS.map(c => c.id).filter(id => !right.has(id)), [], 'no board is only ever a trap');
  for (const { m, choice } of choosing) {
    assert.ok(answersOf(choice).length < CARDS.length - 1, `${m.id}: most boards miss something, so the choice means something`);
    for (const c of CARDS) for (const { need } of choice.needs) assert.ok(why(c, need).length > 10, `${m.id}: ${c.id} has a reason for ${need.k}`);
  }
});

test('the answer hint names every board that works, and no board that does not', () => {
  for (const { m, choice } of choosing) {
    const answer = m.hints[2], right = new Set(answersOf(choice).map(c => c.id));
    for (const c of CARDS) assert.equal(answer.includes(c.name), right.has(c.id), `${m.id}: the answer ${right.has(c.id) ? 'names' : 'does not name'} the ${c.name}`);
  }
});

test('no need is already met by every board or by none, so each one rules something out', () => {
  for (const { m, choice } of choosing) for (const { need, text } of choice.needs) {
    const n = CARDS.filter(c => meets(c, need)).length;
    assert.ok(n > 0 && n < CARDS.length, `${m.id}: "${text}" is met by ${n} of ${CARDS.length}`);
  }
});

test('the boards on the bench match the simulator: the Uno at 5 V with no touch pins, the ESP32 at 3.3 V with touch', () => {
  assert.equal(cardOf('uno').volts, 5);
  assert.equal(cardOf('esp32').volts, 3.3);
  assert.equal(cardOf('uno').touch, 0);
  assert.ok(Object.keys(BOARDS.esp32.consts).some(k => /^T\d$/.test(k)), 'the simulated ESP32 has touch pins');
  assert.deepEqual(CARDS.filter(c => c.onBench).map(c => c.id).sort(), Object.keys(BOARDS).sort());
});

test('a board fits a space either way round', () => {
  const tall: Need = { k: 'fits', l: 20, w: 50 };
  assert.equal(meets(cardOf('nano'), tall), true, '45 × 18 mm fits a 20 × 50 mm space turned on its side');
  assert.equal(meets(cardOf('uno'), tall), false);
  assert.match(why(cardOf('uno'), tall), /too big/);
});
