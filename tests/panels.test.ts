/* Which panels are open over the bench. The map and the brief share the left side, the code has the right side, and on a phone only one sheet can be open. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampWidth, closePanel, closeTop, isOpen, MIN_BENCH, MIN_WIDTH, NONE, openPanel, SHARE, sideOf, togglePanel, widestPanel } from '../src/state/panels';

test('nothing is open to begin with', () => {
  for (const p of ['map', 'brief', 'code'] as const) assert.equal(isOpen(NONE, p), false);
});

test('the brief and the code can be open together on a wide screen', () => {
  const both = openPanel(openPanel(NONE, 'brief', false), 'code', false);
  assert.equal(isOpen(both, 'brief'), true);
  assert.equal(isOpen(both, 'code'), true);
});

test('the map and the brief share the left side: opening one closes the other', () => {
  const map = openPanel(NONE, 'map', false), brief = openPanel(map, 'brief', false);
  assert.equal(isOpen(brief, 'map'), false);
  assert.equal(isOpen(brief, 'brief'), true);
  assert.equal(isOpen(openPanel(brief, 'map', false), 'brief'), false);
});

test('swapping the brief for the map leaves the code open beside it', () => {
  const s = openPanel(openPanel(openPanel(NONE, 'brief', false), 'code', false), 'map', false);
  assert.deepEqual([isOpen(s, 'brief'), isOpen(s, 'map'), isOpen(s, 'code')], [false, true, true]);
});

test('opening a panel on the right leaves the left alone on a wide screen', () => {
  const s = openPanel(openPanel(NONE, 'map', false), 'code', false);
  assert.equal(isOpen(s, 'map'), true);
});

test('on a phone only one sheet is open at a time', () => {
  const a = openPanel(NONE, 'brief', true), b = openPanel(a, 'code', true), c = openPanel(b, 'map', true);
  assert.deepEqual([isOpen(b, 'brief'), isOpen(b, 'code')], [false, true]);
  assert.deepEqual([isOpen(c, 'code'), isOpen(c, 'map')], [false, true]);
});

test('a toggle opens a closed panel and closes an open one', () => {
  const open = togglePanel(NONE, 'code', false);
  assert.equal(isOpen(open, 'code'), true);
  assert.equal(isOpen(togglePanel(open, 'code', false), 'code'), false);
});

test('closing a panel that is not open changes nothing', () => {
  const s = openPanel(NONE, 'code', false);
  assert.deepEqual(closePanel(s, 'map'), s);
});

test('Escape closes the panel that was opened last, then the one before', () => {
  const s = openPanel(openPanel(NONE, 'brief', false), 'code', false);
  const first = closeTop(s);
  assert.equal(isOpen(first, 'code'), false);
  assert.equal(isOpen(first, 'brief'), true);
  const second = closeTop(first);
  assert.equal(isOpen(second, 'brief'), false);
  assert.deepEqual(closeTop(second), second, 'nothing left to close');
});

test('closing the panel that was last opened hands "last" to whatever is still open', () => {
  const s = closePanel(openPanel(openPanel(NONE, 'brief', false), 'code', false), 'code');
  assert.equal(closeTop(s).left, null, 'Escape now closes the brief');
});

/* --- dragging a panel wider or narrower --- */
test('a panel takes the width asked for when it fits', () => {
  assert.equal(clampWidth(620.4, 1600, 0), 620);
});

test('a panel is never dragged too narrow to read', () => {
  assert.equal(clampWidth(40, 1600, 480), MIN_WIDTH);
});

test('a panel stops growing while some of the bench still shows, next to the panel on the other side', () => {
  assert.equal(clampWidth(5000, 1600, 0), 1600 - MIN_BENCH);
  assert.equal(clampWidth(5000, 1600, 700), 1600 - 700 - MIN_BENCH);
  assert.equal(widestPanel(1600, 700), 1600 - 700 - MIN_BENCH);
});

test('with a panel on each side, neither takes more than its share of the screen', () => {
  assert.equal(clampWidth(5000, 1600, 480), Math.floor(1600 * SHARE));
  assert.equal(clampWidth(5000, 1600, 0), 1600 - MIN_BENCH, 'alone, a panel may take nearly all of it');
});

test('on a window with no room to spare a panel keeps its smallest width', () => {
  assert.equal(clampWidth(900, 700, 400), MIN_WIDTH);
});

test('the parts drawer and the code share the right side, and the parts sit beside the brief', () => {
  const both = openPanel(openPanel(NONE, 'brief', false), 'parts', false);
  assert.deepEqual([isOpen(both, 'brief'), isOpen(both, 'parts'), isOpen(both, 'code')], [true, true, false]);
  const swapped = openPanel(both, 'code', false);
  assert.deepEqual([isOpen(swapped, 'brief'), isOpen(swapped, 'parts'), isOpen(swapped, 'code')], [true, false, true]);
  assert.equal(isOpen(openPanel(swapped, 'parts', false), 'code'), false);
});

test('each panel knows its side, and closing the parts drawer leaves the brief open', () => {
  assert.deepEqual((['map', 'brief', 'parts', 'code'] as const).map(sideOf), ['left', 'left', 'right', 'right']);
  const s = closePanel(openPanel(openPanel(NONE, 'brief', false), 'parts', false), 'parts');
  assert.deepEqual([isOpen(s, 'brief'), isOpen(s, 'parts')], [true, false]);
});
