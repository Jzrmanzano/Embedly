/* Progress: counting, where to go next, and the backup file that can be saved and restored. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missionKey, MISSIONS } from '../src/data/missions';
import { boardProgress, cleanProgress, emptyProgress, graded, isItem, makeBackup, nextMission, parseBackup, sideProgress, sideQuests, sidesOf, type Progress } from '../src/state/progress';
import type { BoardId } from '../src/types';

const BOARDS: BoardId[] = ['uno', 'esp32'];
const pass = (board: BoardId, ...ids: string[]) => Object.fromEntries(ids.map(id => [missionKey(board, id), { at: 1, hints: 0, predicted: 'skipped' }]));

test('a new student has passed nothing, and the studio is not counted', () => {
  for (const board of BOARDS) {
    const { done, total } = boardProgress(board, {});
    assert.equal(done, 0);
    assert.equal(total, graded(board).length);
    assert.ok(!graded(board).some(m => m.sandbox));
    assert.equal(total, MISSIONS[board].filter(m => !m.sandbox && !m.repair).length, 'the main quest is every mission but the studio and the side quests');
  }
});

test('passing missions moves the count, and only on that board', () => {
  const passed = pass('uno', 'tour', 'beacon');
  assert.equal(boardProgress('uno', passed).done, 2);
  assert.equal(boardProgress('esp32', passed).done, 0);
});

test('the next mission is the first open one that is not passed, and null when there is nothing left', () => {
  for (const board of BOARDS) {
    assert.equal(nextMission(board, {})?.id, MISSIONS[board][0].id, 'a new student starts at the tour');
    const done: Record<string, unknown> = {};
    let steps = 0;
    for (let m = nextMission(board, done); m; m = nextMission(board, done)) {   // walking it to the end passes every mission, each one open when it is offered
      assert.ok(!done[missionKey(board, m.id)], `${m.id} is not offered twice`);
      done[missionKey(board, m.id)] = {};
      assert.ok(++steps <= MISSIONS[board].length, 'it ends');
    }
    assert.equal(steps, graded(board).length, `${board}: every mission is offered once, so every one can be reached`);
    assert.equal(nextMission(board, done), null);
  }
  assert.equal(nextMission('uno', pass('uno', 'tour'))?.id, 'beacon');
});

test('every reference build and every faulty starting bench is made of parts a backup accepts', () => {
  for (const board of BOARDS) for (const m of MISSIONS[board]) for (const it of [...m.circuit, ...(m.start ?? [])]) assert.ok(isItem(it), `${board}/${m.id}: ${JSON.stringify(it)}`);
});

const sample = (): Progress => ({
  ...emptyProgress(),
  passed: pass('uno', 'tour', 'beacon') as Progress['passed'],
  hintsUsed: { 'uno-beacon': 2 },
  predictions: { 'uno-beacon': { picked: 'blinks', actual: 'blinks', right: true } },
  picks: { 'uno-democart': 'uno' },
  benches: { 'uno-beacon': MISSIONS.uno.find(m => m.id === 'beacon')!.circuit, 'uno-heatwarn': MISSIONS.uno.find(m => m.id === 'heatwarn')!.circuit },
  burnt: { 'uno-beacon': ['led'] },
  edits: { 'uno-beacon': 'void setup() {}\nvoid loop() {}' },
});

test('a backup written and read back is the same progress', () => {
  const p = sample(), back = parseBackup(makeBackup(p, new Date('2026-11-17T08:00:00Z')));
  assert.ok(back.ok);
  assert.deepEqual(back.progress, p);
  assert.match(makeBackup(p, new Date('2026-11-17T08:00:00Z')), /"savedAt": "2026-11-17T08:00:00.000Z"/);
});

test('files that are not a backup are refused with a reason', () => {
  for (const text of ['', 'not json', '[]', '{}', '{"app":"other","version":1}', '{"app":"embedly","version":2}', 'null']) {
    const r = parseBackup(text);
    assert.equal(r.ok, false, text);
    assert.ok(!r.ok && r.error.length > 10);
  }
});

test('what cannot be trusted is dropped, and the rest is kept', () => {
  const dirty = {
    app: 'embedly', version: 1,
    passed: { 'uno-beacon': { at: 5, hints: 99, predicted: 'right' }, 'uno-nothere': { at: 1, hints: 0, predicted: 'right' }, 'uno-tour': { at: 'x' }, 'uno-lamp': 'yes' },
    hintsUsed: { 'uno-beacon': 7, 'uno-lamp': 'many' },
    benches: {
      'uno-beacon': [{ t: 'wire', a: 'U:13', b: 'a10', c: 'orange' }],
      'uno-lamp': [{ t: 'wire', a: 'U:13' }],                      // missing fields
      'uno-chime': [{ t: 'rocket', a: 'x' }],                        // not a part
      'uno-tour': 'a bench',
      'uno-nothere': [],
    },
    edits: { 'uno-beacon': 'code', 'uno-lamp': 42, 'uno-tour': 'x'.repeat(50_000) },
    burnt: { 'uno-beacon': ['led', 3] },
  };
  const r = parseBackup(JSON.stringify(dirty));
  assert.ok(r.ok);
  const p = r.progress;
  assert.deepEqual(Object.keys(p.passed), ['uno-beacon']);
  assert.equal(p.passed['uno-beacon'].hints, 3, 'hints are at most 3');
  assert.deepEqual(p.hintsUsed, { 'uno-beacon': 3 });
  assert.deepEqual(Object.keys(p.benches), ['uno-beacon']);
  assert.deepEqual(p.edits, { 'uno-beacon': 'code' });
  assert.deepEqual(p.burnt, {});
});

test('a backup cannot smuggle in keys that change how objects behave', () => {
  const r = parseBackup('{"app":"embedly","version":1,"passed":{"__proto__":{"at":1,"hints":0,"predicted":"right"},"constructor":{"at":1,"hints":0,"predicted":"right"}}}');
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.progress.passed), []);
  assert.equal(({} as Record<string, unknown>).at, undefined);
  assert.deepEqual(cleanProgress(undefined), emptyProgress());
});

test('the road never puts a mission before one it needs, and starts at the tour', () => {
  for (const board of BOARDS) {
    const road = graded(board), seen = new Set<string>();
    assert.equal(road[0].id, MISSIONS[board][0].id);
    assert.equal(road.length + sideQuests(board).length, MISSIONS[board].length - 1, 'every mission but the studio is on the road or a side quest');
    assert.ok(!road.some(m => m.repair), 'no repair job is on the road');
    for (const m of road) {
      for (const a of m.after) assert.ok(seen.has(a), `${board}/${m.id} comes after ${a}`);
      seen.add(m.id);
    }
  }
});

test('repair jobs are side quests: they branch off the road, count apart, and are never offered as the next mission', () => {
  for (const board of BOARDS) {
    const road = new Set(graded(board).map(m => m.id)), sides = sideQuests(board);
    assert.ok(sides.length > 0, `${board} has side quests`);
    for (const q of sides) {
      assert.ok(q.after.length > 0 && q.after.every(a => road.has(a)), `${board}/${q.id} branches off a mission on the road`);
      assert.ok(sidesOf(board, q.after[0]).includes(q), 'and is found beside it');
    }
    const everything = Object.fromEntries(MISSIONS[board].filter(m => !m.sandbox).map(m => [missionKey(board, m.id), {}]));
    assert.equal(boardProgress(board, everything).done, road.size, 'side quests do not add to the main count');
    assert.equal(sideProgress(board, everything).done, sides.length);
    const allRoad = Object.fromEntries([...road].map(id => [missionKey(board, id), {}]));
    assert.equal(nextMission(board, allRoad), null, 'with the road finished, nothing is offered, even though side quests are open');
    assert.deepEqual(sideProgress(board, allRoad), { done: 0, total: sides.length });
  }
});
