/* Which page the address bar hash opens: the home page, the guide (its contents or one chapter), or a mission in the lab. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUIDE } from '../src/data/guide';
import { guideHash, parseHash } from '../src/state/route';

test('no hash is the home page', () => {
  assert.deepEqual(parseHash(''), { page: 'home' });
  assert.deepEqual(parseHash('#'), { page: 'home' });
});

test('#guide is the guide, at its contents page', () => {
  assert.deepEqual(parseHash('#guide'), { page: 'guide', chapter: null });
  assert.deepEqual(parseHash('#guide/'), { page: 'guide', chapter: null });
});

test('every chapter has its own address, and it leads back to that chapter', () => {
  for (const c of GUIDE) assert.deepEqual(parseHash(guideHash(c.id)), { page: 'guide', chapter: c.id });
  assert.equal(guideHash(null), '#guide');
});

test('a chapter that does not exist opens the contents page', () => {
  assert.deepEqual(parseHash('#guide/no-such-chapter'), { page: 'guide', chapter: null });
});

test('a mission hash opens the lab with that board and mission', () => {
  assert.deepEqual(parseHash('#uno-tour'), { page: 'lab', board: 'uno', mission: 'tour' });
  assert.deepEqual(parseHash('esp32-beacon'), { page: 'lab', board: 'esp32', mission: 'beacon' });
});

test('anything else opens the lab at its first mission, as before', () => {
  assert.deepEqual(parseHash('#nonsense'), { page: 'lab', board: null, mission: null });
  assert.deepEqual(parseHash('#guides'), { page: 'lab', board: null, mission: null });
});
