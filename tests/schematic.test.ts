/* The schematic drawn from the bench: every part shows up once, nothing is drawn on top of anything else, and the mission circuits come out
   the way a teacher would draw them on the board. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUZZ_BODY, BUZZ_WAVES, isRay, LED_BODY, spanOf, SYMBOLS } from '../src/data/symbols';
import { MISSIONS } from '../src/data/missions';
import { layoutSchematic, UNIT, type Schematic } from '../src/sim/schematic';
import { itemId, type BoardId, type Item } from '../src/types';

const ids = (s: Schematic) => [...s.parts.map(p => p.id), ...s.knobs.map(k => k.id), ...s.boxes.filter(b => b.id !== 'board').map(b => b.id), ...s.pads.map(p => p.id)];
const pinY = (s: Schematic, name: string) => s.boxes.find(b => b.id === 'board')?.pins.find(p => p.name === name)?.y;
/** The rectangle each part, knob and box takes up. */
function rects(s: Schematic): [string, number, number, number, number][] {
  return [
    ...s.parts.map(p => [p.id, p.x, p.y - 18, p.x + spanOf(p.symbol) * UNIT, p.y + 18] as [string, number, number, number, number]),
    ...s.knobs.map(k => [k.id, k.x, k.y - 0.42 * UNIT, k.x + 0.8 * UNIT, k.y + 0.42 * UNIT] as [string, number, number, number, number]),
    ...s.boxes.map(b => [b.id, b.x, b.y, b.x + b.w, b.y + b.h] as [string, number, number, number, number]),
  ];
}
const overlaps = (a: [string, number, number, number, number], b: [string, number, number, number, number]) => a[1] < b[3] && b[1] < a[3] && a[2] < b[4] && b[2] < a[4];

for (const [board, list] of Object.entries(MISSIONS) as [BoardId, (typeof MISSIONS)[BoardId]][]) {
  for (const m of list) {
    if (!m.circuit.length) continue;
    test(`${board}/${m.id}: every part is drawn once, and nothing overlaps`, () => {
      const s = layoutSchematic(board, m.circuit);
      const want = m.circuit.map((it, k) => [it, itemId(it, k)] as const).filter(([it]) => it.t !== 'wire').map(([, id]) => id).sort();
      assert.deepEqual(ids(s).sort(), want);
      const r = rects(s), clash: string[] = [];
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (overlaps(r[i], r[j])) clash.push(`${r[i][0]} and ${r[j][0]}`);
      assert.deepEqual(clash, []);
      assert.equal(s.shorted, false);
      assert.ok(s.text.length > 0 && s.text.every(t => t.length > 3), 'every row is described in words');
    });
  }
}

const blink = MISSIONS.uno.find(m => m.circuit.some(it => it.t === 'led') && m.circuit.length === 4)!.circuit;

test('the LED mission reads pin 13, the LED, the resistor, then ground', () => {
  const s = layoutSchematic('uno', blink);
  assert.deepEqual(s.boxes.find(b => b.id === 'board')?.pins.map(p => p.name), ['13']);
  const row = s.parts.filter(p => p.y === pinY(s, '13')).sort((a, b) => a.x - b.x).map(p => p.symbol);
  assert.deepEqual(row, ['led', 'resistor']);
  assert.ok(s.marks.some(m => m.kind === 'ground' && m.at[1] === pinY(s, '13')), 'the row ends at ground');
  assert.equal(s.text[0], 'Pin 13 → red LED → 220 Ω → GND.');
});

test('an LED put in backwards is drawn backwards', () => {
  const backwards = blink.map(it => (it.t === 'led' ? { ...it, a: it.k, k: it.a } : it));
  assert.equal(layoutSchematic('uno', backwards).parts.find(p => p.symbol === 'led')?.flip, true);
  assert.equal(layoutSchematic('uno', blink).parts.find(p => p.symbol === 'led')?.flip, false);
});

test('the distance sensor sits at the end of the rows from its pins, with power above and ground below', () => {
  const sonar = MISSIONS.uno.find(m => m.circuit.some(it => it.t === 'sonar'))!.circuit;
  const s = layoutSchematic('uno', sonar), box = s.boxes.find(b => b.title === 'HC-SR04')!;
  const leg = (name: string) => box.pins.find(p => p.name === name)!.y;
  assert.equal(leg('TRIG'), pinY(s, '9'));
  assert.equal(leg('ECHO'), pinY(s, '10'));
  assert.ok(s.marks.some(m => m.kind === 'supply' && m.at[1] === leg('VCC') && m.text === '5V'));
  assert.ok(s.marks.some(m => m.kind === 'ground' && m.at[1] === leg('GND')));
});

test('the knob\'s wiper is fed from its analog pin, with 5V on one end and ground on the other', () => {
  const knob = MISSIONS.uno.find(m => m.circuit.some(it => it.t === 'pot'))!.circuit;
  const s = layoutSchematic('uno', knob), k = s.knobs[0];
  assert.equal(k.y, pinY(s, 'A0'));
  assert.ok(s.marks.some(m => m.kind === 'supply' && m.at[1] < k.y && m.dir === 'up'));
  assert.ok(s.marks.some(m => m.kind === 'ground' && m.at[1] > k.y && m.dir === 'down'));
});

test('on the ESP32 the servo\'s signal comes from its pin', () => {
  const servo = MISSIONS.esp32.find(m => m.circuit.some(it => it.t === 'servo'))!.circuit;
  const s = layoutSchematic('esp32', servo), box = s.boxes.find(b => b.title === 'Servo')!;
  assert.equal(box.pins.find(p => p.name === 'signal')!.y, pinY(s, 'D13'));
});

test('a part that is not wired to anything shows its legs as open ends', () => {
  const s = layoutSchematic('uno', [{ t: 'led', id: 'led', a: 'e20', k: 'e21', color: 0xff3b30 }]);
  assert.equal(s.parts.length, 1);
  assert.equal(s.marks.filter(m => m.kind === 'open').length, 2);
  assert.equal(s.boxes.length, 0, 'no board pins are in use');
});

test('two LEDs from one pin hang off the same point', () => {
  const two: Item[] = [
    { t: 'wire', a: 'U:13', b: 'a10', c: 'orange' },
    { t: 'res', a: 'b10', b: 'b14' },
    { t: 'led', id: 'l1', a: 'c14', k: 'c18', color: 0xff3b30 },
    { t: 'led', id: 'l2', a: 'd14', k: 'd19', color: 0x2ecc40 },
    { t: 'wire', a: 'a18', b: 'T-18', c: 'black' }, { t: 'wire', a: 'a19', b: 'T-19', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
  ];
  const s = layoutSchematic('uno', two);
  assert.deepEqual(s.parts.map(p => p.symbol).sort(), ['led', 'led', 'resistor']);
  assert.ok(s.marks.some(m => m.kind === 'dot'), 'the branch point has a dot');
  assert.equal(s.marks.filter(m => m.kind === 'ground').length, 2);
  const [a, b] = s.parts.filter(p => p.symbol === 'led');
  assert.equal(a.x, b.x, 'the two LEDs line up');
  assert.notEqual(a.y, b.y);
});

test('a loop that comes back to itself ends in matching name tags instead of going round for ever', () => {
  const loop: Item[] = [
    { t: 'wire', a: 'U:13', b: 'a10', c: 'orange' },
    { t: 'res', id: 'r1', a: 'b10', b: 'b14', ohms: 220 },
    { t: 'res', id: 'r2', a: 'c10', b: 'c14', ohms: 1000 },
  ];
  const s = layoutSchematic('uno', loop), tags = s.marks.filter(m => m.kind === 'tag').map(m => m.text);
  assert.equal(s.parts.length, 2);
  assert.equal(tags.length, 2);
  assert.equal(tags[0], tags[1]);
});

test('an empty bench is empty, and a short circuit is reported', () => {
  assert.equal(layoutSchematic('uno', []).empty, true);
  assert.equal(layoutSchematic('uno', [{ t: 'wire', a: 'U:5V', b: 'U:GND', c: 'red' }]).shorted, true);
});

test('an LED keeps its colour, so it can light up in it', () => {
  const s = layoutSchematic('uno', [{ t: 'led', id: 'g', a: 'e20', k: 'e21', color: 0x2ecc40 }]);
  assert.equal(s.parts[0].color, 0x2ecc40);
});

test('the LED body that lights up is the triangle of the LED symbol itself', () => {
  const ends = new Set(SYMBOLS.led.paths.flatMap(p => p.points.map(pt => pt.join(','))));
  for (const corner of LED_BODY) assert.ok(ends.has(corner.join(',')), `${corner} is a corner of the LED's lines`);
  assert.equal(SYMBOLS.led.paths.filter(p => isRay(p.points)).length, 4, 'two arrows, each a line and a head');
});

test('the buzzer dome that fills in while it sounds is the dome of the buzzer symbol, and its waves sit above the line', () => {
  const dome = SYMBOLS.buzzer.paths.find(p => p.points.length > 3)!.points.map(pt => pt.join(','));
  for (const pt of BUZZ_BODY) assert.ok(dome.includes(pt.join(',')), `${pt} is on the dome`);
  assert.ok(BUZZ_WAVES.flat().every(([, y]) => y > 0), 'the waves are drawn above the line, not across it');
});

test('the servo\'s box has room for the dial that shows its angle, clear of its pin names', () => {
  const servo = MISSIONS.esp32.find(m => m.circuit.some(it => it.t === 'servo'))!.circuit;
  const box = layoutSchematic('esp32', servo).boxes.find(b => b.kind === 'servo')!;
  const dialLeft = box.x + box.w - 38 - 24, namesRight = box.x + 8 + Math.max(...box.pins.map(p => p.name.length)) * 7;
  assert.ok(dialLeft > namesRight + 8, `the dial starts at ${dialLeft}, after the pin names end at ${namesRight}`);
  assert.equal(layoutSchematic('uno', MISSIONS.uno.find(m => m.circuit.some(it => it.t === 'sonar'))!.circuit).boxes.find(b => b.kind === 'sonar')!.w < box.w, true, 'only the servo gets the extra room');
});
