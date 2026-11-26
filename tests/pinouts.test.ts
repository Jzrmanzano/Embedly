/* The pinouts shown behind the "i" must cover every part and agree with how the simulator wires each leg. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PARTS } from '../src/data/missions';
import { PINOUTS } from '../src/data/pinouts';
import { holesOf, makeItem, toolKind } from '../src/state/bench';
import { LCD_PINS } from '../src/sim/lcd';
import { MODULE_KINDS, type PartKind } from '../src/types';

const KINDS: PartKind[] = ['wire', 'led', 'res', 'button', 'pot', 'buzzer', 'sonar', 'pad', 'servo', 'ldr', 'temp', 'rgb', 'slide', 'joy', 'tilt', 'reed', 'lcd', 'breadboard', ...MODULE_KINDS];
const tones = (k: PartKind) => PINOUTS[k].legs.map(l => l.tone);

test('every kind of part, and every part in the tray, has a pinout with something to say', () => {
  assert.deepEqual(Object.keys(PINOUTS).sort(), [...KINDS].sort());
  for (const id of Object.keys(PARTS) as (keyof typeof PARTS)[]) assert.ok(PINOUTS[toolKind(PARTS[id].tool)], `${id} has a pinout`);
  for (const k of KINDS) {
    const p = PINOUTS[k];
    assert.ok(p.title && p.tip && p.legs.length > 0, `${k} has a title, a tip and legs`);
    for (const l of p.legs) assert.ok(l.name && l.note.length > 12, `${k} leg ${l.name} says where it goes`);
  }
});

test('the parts with a + and a − say which leg is which, in the order the simulator wires them', () => {
  assert.deepEqual(tones('led'), ['plus', 'minus']);            // a (anode), then k (cathode)
  assert.deepEqual(tones('buzzer'), ['plus', 'minus']);         // a, then b
  assert.deepEqual(tones('temp'), ['plus', 'signal', 'minus']); // the leg in col, col + 1, col + 2
  assert.deepEqual(tones('sonar'), ['plus', 'signal', 'signal', 'minus']);   // VCC, TRIG, ECHO, GND
  assert.deepEqual(tones('servo'), ['minus', 'plus', 'signal']);             // GND, +, signal, as servoLegs
  assert.deepEqual(PINOUTS.sonar.legs.map(l => l.name), ['VCC', 'TRIG', 'ECHO', 'GND']);
  for (const k of MODULE_KINDS) assert.deepEqual(tones(k), ['plus', 'signal', 'minus'], `${k}: +, OUT, GND`);   // the pin in col, col + 1, col + 2
  assert.deepEqual(tones('rgb'), ['signal', 'minus', 'signal', 'signal']);   // red, the shared − leg, green, blue, as rgbLegs
  assert.deepEqual(PINOUTS.joy.legs.map(l => l.name), ['GND', '+', 'VRx', 'VRy', 'SW']);   // as joyLegs
  assert.deepEqual(PINOUTS.lcd.legs.map(l => l.name), [...LCD_PINS]);   // the names its connection points go by
  assert.deepEqual(tones('lcd'), ['minus', 'plus', 'signal', 'signal']);
});

test('the parts with no polarity do not pretend to have one', () => {
  for (const k of ['res', 'ldr', 'wire', 'button', 'tilt', 'reed'] as const) assert.ok(tones(k).every(t => t === 'free'), `${k} has no + or −`);
  assert.deepEqual(tones('pad'), ['signal']);
});

test('leg counts match the legs the bench gives each part', () => {
  const counts: Partial<Record<PartKind, number>> = { wire: 2, led: 2, res: 2, button: 4, pot: 3, buzzer: 2, sonar: 4, pad: 1, servo: 3, ldr: 2, temp: 3 };
  for (const k of Object.keys(counts) as PartKind[]) assert.equal(PINOUTS[k].legs.length, counts[k], k);
  for (const id of Object.keys(PARTS) as (keyof typeof PARTS)[]) {   // every part of the tray: as many legs in its pinout as holes it takes on the bench
    const tool = PARTS[id].tool, k = toolKind(tool);
    if (k === 'button' || k === 'pad' || k === 'lcd' || k === 'soil' || k === 'breadboard') continue;   // a button covers a column no leg goes in, the pad, the LCD and the potted soil probe stand on the table, and a breadboard's "legs" are its strips
    assert.equal(PINOUTS[k].legs.length, holesOf(makeItem(tool, [], 'd10', 'd14')).length, `${id}: one pinout leg for each hole`);
  }
});
