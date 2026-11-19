/* The Serial Plotter: which printed lines are readings, what the series are called, and the y axis it draws them on. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLOT_POINTS, PLOT_SERIES, plotOf, readLine, showValue, tickLabel, ticks } from '../src/sim/plotter';

test('a line gives its numbers, named "name:value" or by their place, split by commas, tabs or spaces', () => {
  assert.deepEqual(readLine('light:512,knob:300'), [{ name: 'light', value: 512 }, { name: 'knob', value: 300 }]);
  assert.deepEqual(readLine('Light: 512'), [{ name: 'Light', value: 512 }], 'the guide\'s own "Light: " is a name');
  assert.deepEqual(readLine('Room temp: 22.5\thumidity:40'), [{ name: 'Room temp', value: 22.5 }, { name: 'humidity', value: 40 }]);
  assert.deepEqual(readLine('1 -2.5 3e2'), [{ name: null, value: 1 }, { name: null, value: -2.5 }, { name: null, value: 300 }]);
  assert.deepEqual(readLine('Light on'), [], 'a message is not a reading');
  assert.deepEqual(readLine('Moisture: 45%'), [], 'a number with a unit stuck to it is not read');
});

test('the readings are the finished lines with numbers in them, oldest first, and messages in between are skipped', () => {
  const p = plotOf('Starting\nlight:10,knob:1\nLight on\nlight:20\nlight:30,knob:3\nlight:4');
  assert.deepEqual(p.names, ['light', 'knob']);
  assert.deepEqual(p.rows, [[10, 1], [20, null], [30, 3]], 'a series missing from a line is a gap, and "light:4" is still being printed');
  assert.deepEqual(plotOf('5 6\r\n7 8\r\n').rows, [[5, 6], [7, 8]], 'numbers with no name are Value 1, Value 2 by their place, and a carriage return is ignored');
  assert.deepEqual(plotOf('5 6\n').names, ['Value 1', 'Value 2']);
  assert.deepEqual(plotOf('').rows, []);
});

test('only the newest readings are kept, and only the first series are drawn', () => {
  const many = Array.from({ length: PLOT_POINTS + 30 }, (_, i) => `n:${i}\n`).join('');
  const p = plotOf(many);
  assert.equal(p.rows.length, PLOT_POINTS);
  assert.deepEqual([p.rows[0][0], p.rows[PLOT_POINTS - 1][0]], [30, PLOT_POINTS + 29]);
  const wide = plotOf(Array.from({ length: PLOT_SERIES + 2 }, (_, i) => `s${i}:${i}`).join(',') + '\n');
  assert.equal(wide.names.length, PLOT_SERIES);
  assert.deepEqual(wide.hidden, [`s${PLOT_SERIES}`, `s${PLOT_SERIES + 1}`]);
});

test('the y axis fits the values with a little room, and its ticks are round numbers inside it', () => {
  const full = ticks(0, 1023);
  assert.deepEqual(full.values, [0, 500, 1000]);
  assert.ok(full.lo < 0 && full.lo > -100 && full.hi > 1023 && full.hi < 1100, `the lines fill the height: ${full.lo} to ${full.hi}, not 0 to 1500`);
  assert.deepEqual(ticks(21.3, 24.8).values, [22, 23, 24]);
  assert.deepEqual(ticks(-5, 5).values, [-5, 0, 5]);
  assert.deepEqual(ticks(-40, 125).values, [0, 50, 100], 'no "-0"');
  const flat = ticks(512, 512);
  assert.ok(flat.lo < 512 && flat.hi > 512, `a flat line sits in the middle: ${flat.lo} to ${flat.hi}`);
  assert.deepEqual(ticks(0, 0).values, [-1, -0.5, 0, 0.5, 1]);
  for (const [a, b] of [[0, 1], [3, 1000], [-40, 125], [0.001, 0.004], [1000, 60000], [7, 7]]) {
    const t = ticks(a, b);
    assert.ok(t.lo <= a && t.hi >= b && t.values.length >= 2 && t.values.length <= 7 && t.values.every(v => v >= t.lo && v <= t.hi), `${a}..${b}: ${t.values.join(' ')}`);
  }
});

test('tick labels are in full under 10,000, in thousands above, with only the decimals the step needs', () => {
  assert.equal(tickLabel(600, 300, 1200), '600');
  assert.equal(tickLabel(0.5, 0.5, 1), '0.5');
  assert.equal(tickLabel(20000, 10000, 60000), '20K');
  assert.equal(tickLabel(2500, 500, 12000), '2.5K');
  assert.equal(tickLabel(0, 20000, 60000), '0', 'zero is 0, not 0K');
  assert.equal(showValue(25.333333), '25.33');
  assert.equal(showValue(512), '512');
});
