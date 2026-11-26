/* The Open Studio's templates: every one can be built by hand on the bench, has no wiring mistakes, and does what it says. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapterOf } from '../src/data/guide';
import { partIdOf, PARTS } from '../src/data/missions';
import { TEMPLATES, type Template } from '../src/data/templates';
import { analyze } from '../src/sim/circuit';
import { runChecks } from '../src/sim/check';
import { parse } from '../src/sim/interpreter';
import { placementError } from '../src/state/bench';
import { isItem } from '../src/state/progress';
import type { BoardId } from '../src/types';

const BOARDS: BoardId[] = ['uno', 'esp32'];
const all = BOARDS.flatMap(board => TEMPLATES[board].map(t => ({ board, t })));
const name = ({ board, t }: { board: BoardId; t: Template }) => `${board}/${t.id}`;
const failures = (r: { label: string; pass: boolean; detail: string }[]) => r.filter(x => !x.pass).map(x => `${x.label}: ${x.detail}`);
/** Runs a check over every template, and fails once at the end naming every one that broke. */
const forEvery = async (check: (x: { board: BoardId; t: Template }) => Promise<void> | void) => {
  const problems: string[] = [];
  for (const x of all) { try { await check(x); } catch (e) { problems.push(`${name(x)}: ${(e as Error).message.split('\n')[0]}`); } }
  assert.deepEqual(problems, []);
};

test('both boards have templates, each with its own id, its texts, and guide chapters that exist', () => {
  for (const board of BOARDS) {
    assert.ok(TEMPLATES[board].length >= 3, `${board} has templates`);
    assert.equal(new Set(TEMPLATES[board].map(t => t.id)).size, TEMPLATES[board].length, `${board}: no id is used twice`);
  }
  for (const { board, t } of all) {
    assert.ok(t.title && t.about.length > 20 && t.tryIt.length > 20, `${board}/${t.id} says what it is and what to try`);
    assert.ok(t.guide.length > 0 && t.guide.every(id => chapterOf(id)), `${board}/${t.id} points at guide chapters that exist`);
    assert.ok(t.proof.length > 0, `${board}/${t.id} has a proof`);
  }
});

test('every template is built from the tray\'s parts, and survives a backup', () => forEvery(({ t }) => {
  for (const it of t.circuit) {
    assert.ok(PARTS[partIdOf(it)], `${JSON.stringify(it)} is a part of the tray`);
    assert.ok(isItem(it), `${JSON.stringify(it)} survives a backup`);
  }
}));

test('every template can be put together by hand on the bench, one part at a time', () => forEvery(({ board, t }) => {
  t.circuit.forEach((it, k) => assert.equal(placementError(board, t.circuit.slice(0, k), it), null, JSON.stringify(it)));
}));

test('every template\'s wiring has no mistakes, and its sketch is one the simulator accepts', () => forEvery(({ board, t }) => {
  assert.deepEqual(analyze(board, t.circuit).issues.map(i => i.title), []);
  parse(t.sketch);
}));

test('every template does what it says: its build and sketch pass its own proof', () => forEvery(async ({ board, t }) => {
  assert.deepEqual(failures(await runChecks(board, t.circuit, t.sketch, t.proof)), []);
}));

test('no proof passes without its build, so each one really looks at the bench', () => forEvery(async ({ board, t }) => {
  assert.ok(failures(await runChecks(board, [], t.sketch, t.proof)).length > 0, 'the proof passes on an empty bench');
}));
