/* Resistor values: how they are written and typed, and the coloured bands that spell them. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bands, DIGIT_COLORS, GOLD, nearestStop, ohmsLabel, parseOhms, RESISTOR_STOPS, SILVER } from '../src/data/resistor';

const name = (hex: string) => ({ ...Object.fromEntries(DIGIT_COLORS.map((c, i) => [c, ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'][i]])), [GOLD]: 'gold', [SILVER]: 'silver' } as Record<string, string>)[hex];
const spell = (ohms: number) => bands(ohms).map(name).join(' ');

test('values are written the way they are said', () => {
  assert.deepEqual([100, 220, 1000, 4700, 10000, 100000, 1e6, 2.2e6, 4.7].map(ohmsLabel), ['100 Ω', '220 Ω', '1 kΩ', '4.7 kΩ', '10 kΩ', '100 kΩ', '1 MΩ', '2.2 MΩ', '4.7 Ω']);
});

test('the bands are the real colour code: two digits, the zeros, then gold', () => {
  assert.equal(spell(220), 'red red brown gold');
  assert.equal(spell(100), 'brown black brown gold');
  assert.equal(spell(330), 'orange orange brown gold');
  assert.equal(spell(470), 'yellow violet brown gold');
  assert.equal(spell(1000), 'brown black red gold');
  assert.equal(spell(4700), 'yellow violet red gold');
  assert.equal(spell(10000), 'brown black orange gold');
  assert.equal(spell(100000), 'brown black yellow gold');
  assert.equal(spell(1e6), 'brown black green gold');
});

test('values under 10 Ω use gold as the multiplier, which is times a tenth', () => {
  assert.equal(spell(4.7), 'yellow violet gold gold');
  assert.equal(spell(1), 'brown black gold gold');
});

test('a value that needs three digits has five bands and a brown last band', () => {
  assert.equal(spell(1050), 'brown black green brown brown');
  assert.equal(spell(249), 'red yellow white black brown');
  assert.equal(bands(220).length, 4);
  assert.equal(bands(4990).length, 5);
});

test('every stop on the slider is a four-band value, ascending, that the bands can spell', () => {
  assert.deepEqual([...RESISTOR_STOPS].sort((a, b) => a - b), RESISTOR_STOPS);
  for (const v of RESISTOR_STOPS) assert.equal(bands(v).length, 4, ohmsLabel(v));
  assert.equal(new Set(RESISTOR_STOPS.map(v => bands(v).join())).size, RESISTOR_STOPS.length, 'no two values look the same');
});

test('typed values are understood in the ways people write them', () => {
  for (const [text, want] of [['220', 220], ['4.7k', 4700], ['4k7', 4700], ['1M', 1e6], ['470 ohm', 470], ['10 kΩ', 10000], ['  2,2k ', 2200], ['0.5', 0.5 < 1 ? null : 0.5], ['1.05K', 1050]] as [string, number | null][]) assert.equal(parseOhms(text), want, text);
  for (const bad of ['', 'abc', '0', '-5', '11M', '4.7.1k', 'k', '1e3']) assert.equal(parseOhms(bad), null, bad);
});

test('the slider sits on the stop closest to any value', () => {
  assert.equal(RESISTOR_STOPS[nearestStop(220)], 220);
  assert.equal(RESISTOR_STOPS[nearestStop(240)], 220);
  assert.equal(RESISTOR_STOPS[nearestStop(5)], 100);
  assert.equal(RESISTOR_STOPS[nearestStop(9e6)], 100000);
});
