/* The guide must tell the truth: every code example in it has to be accepted by the interpreter, and the ones that say what they print have to print exactly that. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS } from '../src/data/boards';
import { chapterOf, GUIDE, GUIDE_GROUPS } from '../src/data/guide';
import { MISSIONS } from '../src/data/missions';
import { makeHW } from '../src/sim/hardware';
import { parse, run } from '../src/sim/interpreter';

const examples = GUIDE.flatMap(c => c.blocks.flatMap((b, i) => ('code' in b ? [{ where: `${c.id}, block ${i + 1}`, board: c.id === 'touch' ? 'esp32' as const : 'uno' as const, ...b }] : [])));
const isWhole = (code: string) => code.includes('void setup');
/** A few lines from a sketch are checked by putting them where they would go: declarations at the top, the rest inside loop(). */
const asSketch = (code: string) => (isWhole(code) ? code : /^\s*(const |int |float |bool |unsigned )/.test(code) && !code.includes('if (') ? `${code}\nvoid setup() {}\nvoid loop() {}` : `void setup() {}\nvoid loop() {\n${code}\n}`);

test('the guide has chapters in both groups, each with its own id', () => {
  assert.equal(new Set(GUIDE.map(c => c.id)).size, GUIDE.length, 'no id is used twice');
  for (const [group] of GUIDE_GROUPS) assert.ok(GUIDE.some(c => c.group === group), `${group} has chapters`);
  for (const c of GUIDE) assert.ok(c.title && c.lede && c.blocks.length, `${c.id} has a title, a summary and something to read`);
});

test('the chapters of a group sit together, so "next" never jumps between groups and back', () => {
  const order = GUIDE.map(c => c.group).filter((g, i, all) => g !== all[i - 1]);
  assert.deepEqual(order, GUIDE_GROUPS.map(g => g[0]));
});

test('every code example in the guide is code the simulator accepts', () => {
  for (const ex of examples) assert.doesNotThrow(() => parse(asSketch(ex.code)), ex.where);
});

test('every guide example that prints, prints what the guide says', async () => {
  for (const ex of examples.filter(e => e.prints != null)) {
    assert.ok(isWhole(ex.code), `${ex.where}: an example that prints is a whole sketch`);
    let serial = '';
    const hw = makeHW(BOARDS[ex.board], [], () => ({}), s => { serial += s; });
    hw.sleep = () => new Promise<void>(r => setTimeout(r, 0));
    const ctl = { stop: false, onLoop() { ctl.stop = true; } };
    await run(ex.code, hw, ctl);
    assert.equal(serial, ex.prints, ex.where);
  }
});

test('whole sketches in the guide run a pass of loop() on a bare board without an error', async () => {
  for (const ex of examples.filter(e => isWhole(e.code))) {
    const hw = makeHW(BOARDS[ex.board], [], () => ({}), () => {});
    hw.sleep = () => new Promise<void>(r => setTimeout(r, 0));
    const ctl = { stop: false, onLoop() { ctl.stop = true; } };
    await assert.doesNotReject(run(ex.code, hw, ctl), ex.where);
  }
});

test('every mission points at chapters of the guide that exist, and each chapter is reached from some mission', () => {
  const used = new Set<string>();
  for (const [board, list] of Object.entries(MISSIONS)) for (const m of list) {
    assert.ok(m.guide.length > 0, `${board}/${m.id} links to the guide`);
    assert.equal(new Set(m.guide).size, m.guide.length, `${board}/${m.id} lists no chapter twice`);
    for (const id of m.guide) { assert.ok(chapterOf(id), `${board}/${m.id}: "${id}" is a chapter`); used.add(id); }
  }
  assert.deepEqual(GUIDE.map(c => c.id).filter(id => !used.has(id)), []);
});
