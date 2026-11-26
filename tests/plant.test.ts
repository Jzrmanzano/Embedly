/* The soil moisture sensor's potted plant: it stands on the table on its own, the three pins on its probe are wired by name,
   and it can be dragged anywhere that is free, taking the ends of its wires with it. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PARTS } from '../src/data/missions';
import { wiringRows } from '../src/data/wiring';
import { analyze } from '../src/sim/circuit';
import { allTerminals, holesOf, isSoil, makeItem, movable, movedPlant, parseTerminal, placementError } from '../src/state/bench';
import { isItem } from '../src/state/progress';
import { BB_DEPTH, collisions, LCD_AT, PLANT_AT, plantPlace, plantSpot, POT_SIZE, REACH, slidePlant, soilPinXZ, tableLayout, type Place } from '../src/state/table';
import type { BoardId, Item, SoilItem } from '../src/types';

const wire = (a: string, b: string): Item => ({ t: 'wire', a, b, c: 'green' });
const plant = (at?: Place): SoilItem => ({ t: 'module', kind: 'soil', id: 'soil1', ctl: 'Soil moisture', ...at });
const LCD: Item = { t: 'lcd', id: 'lcd1' };
const put = (items: Item[], p: Place): Item[] => items.map(it => (isSoil(it) ? { ...(it as SoilItem), ...p } : it));

test('the tray\'s soil sensor is a potted plant on the table: it takes no holes, and brings the three pins on its probe to the bench', () => {
  const it = makeItem(PARTS.soil.tool, [], 'SOIL');
  assert.deepEqual(it, plant());
  assert.deepEqual(holesOf(it), [], 'it stands on the table, not in the breadboard');
  assert.equal(movable(it), false, 'it is dragged around the table, not from hole to hole');
  assert.deepEqual(allTerminals('uno', [it]).filter(p => p.startsWith('SOIL:')), ['SOIL:VCC', 'SOIL:SIG', 'SOIL:GND']);
  assert.ok(!allTerminals('uno', []).some(p => p.startsWith('SOIL:')), 'no pins without the plant');
  assert.equal(parseTerminal('uno', 'soil:sig', [it]), 'SOIL:SIG', 'the pins can be typed');
  assert.equal((makeItem({ kind: 'wire' }, [it], 'SOIL:VCC', 'B+3') as { c: string }).c, 'red', 'a wire to VCC is red');
  assert.equal((makeItem({ kind: 'wire' }, [it], 'SOIL:GND', 'B-3') as { c: string }).c, 'black', 'and one to GND black');
  assert.match(placementError('uno', [it], plant())!, /only one soil moisture sensor/);
  assert.match(wiringRows([it])[0].where, /VCC, SIG and GND/);
});

test('a backup keeps the plant where it was moved to, and refuses one off the table', () => {
  assert.ok(isItem(plant()));
  assert.ok(isItem(plant({ x: 40, z: -60 })));
  assert.equal(isItem(plant({ x: REACH + 1, z: 0 })), false);
  assert.equal(isItem({ ...plant(), x: 'far' }), false);
});

test('wired by its pins, it reads the soil on both boards, and a mistake is named by the pins on its head', () => {
  const uno: Item[] = [plant(), wire('SOIL:VCC', 'U:5V'), wire('SOIL:SIG', 'U:A0'), wire('SOIL:GND', 'U:GND')];
  assert.deepEqual(analyze('uno', uno).issues, []);
  assert.equal(+analyze('uno', uno).solve({}, { soil1: 0.8 }).volt('U:A0').toFixed(2), 4, 'wetter soil, higher voltage');
  const esp: Item[] = [plant(), wire('SOIL:VCC', 'E:3V3'), wire('SOIL:SIG', 'E:D34'), wire('SOIL:GND', 'E:GND')];
  assert.deepEqual(analyze('esp32', esp).issues, []);
  assert.equal(+analyze('esp32', esp).solve({}, { soil1: 0.5 }).volt('E:D34').toFixed(2), 1.65);
  const backwards: Item[] = [plant(), wire('SOIL:VCC', 'U:GND'), wire('SOIL:SIG', 'U:A0'), wire('SOIL:GND', 'U:5V')];
  const [issue] = analyze('uno', backwards).issues;
  assert.equal(issue.title, 'Soil moisture sensor is in backwards');
  assert.match(issue.plain, /Swap the wires on its VCC and GND pins/);
});

test('the probe stands on the side of the pot towards the bench, its pins VCC, SIG and GND from left to right', () => {
  for (const pot of [{ x: 10, z: 50 }, { x: -60, z: -50 }]) {
    const [vcc, sig, gnd] = ['VCC', 'SIG', 'GND'].map(pin => soilPinXZ(pot, pin)!);
    assert.ok(Math.abs(sig.x - vcc.x - 2.54) < 1e-9 && Math.abs(gnd.x - sig.x - 2.54) < 1e-9, 'one pin apart, left to right');
    assert.ok(Math.abs(vcc.z) < Math.abs(pot.z), `the pins are on the bench's side of a pot at z ${pot.z}`);
    for (const p of [vcc, gnd]) assert.ok(Math.hypot(p.x - pot.x, p.z - pot.z) < POT_SIZE / 2, 'inside the pot');
  }
  assert.equal(soilPinXZ({ x: 0, z: 50 }, 'OUT'), null);
});

test('it stands in front of the breadboard until it is moved, and a new one finds a free place', () => {
  for (const board of ['uno', 'esp32'] as BoardId[]) assert.deepEqual(collisions(board, [plant()]), [], board);
  assert.deepEqual(plantPlace(plant()), PLANT_AT);
  assert.deepEqual(plantSpot('uno', []), PLANT_AT);
  const spot = plantSpot('uno', [LCD])!;
  assert.notDeepEqual(spot, PLANT_AT, 'the LCD lies at its usual place');
  assert.deepEqual(collisions('uno', [LCD, plant(spot)]), []);
  assert.deepEqual(tableLayout('uno', [LCD, plant(spot)]).lcd, LCD_AT, 'and keeps it');
});

test('dragged, it stops against the breadboard instead of going onto it, and goes anywhere free', () => {
  const items = [plant()];
  const to = slidePlant('uno', items, 'soil1', PLANT_AT, { x: PLANT_AT.x, z: 0 });
  assert.ok(Math.abs(to.x - PLANT_AT.x) <= 0.05 && Math.abs(to.z - (BB_DEPTH / 2 + POT_SIZE / 2)) <= 0.15, `pushed towards the breadboard, it stops at its edge: ${JSON.stringify(to)}`);
  assert.deepEqual(plantPlace(movedPlant('uno', items, { x: 200, z: 120 })[0] as SoilItem), { x: 200, z: 120 });
  assert.equal(movedPlant('uno', [LCD], { x: 0, z: 0 }).length, 1, 'with no plant on the bench nothing moves');
});

test('however it is pushed about, it never ends up lying on anything, and nothing ends up lying on it', () => {
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // the same "random" pushes every run
  for (const board of ['uno', 'esp32'] as BoardId[]) {
    let items: Item[] = [LCD, { t: 'breadboard', id: 'bb1', size: 'long' }, { t: 'pad', id: 'pad1', ctl: '' }, plant()], p = PLANT_AT;
    for (let i = 0; i < 300; i++) {
      const want = rand() < 0.2 ? { x: (rand() - 0.5) * 800, z: (rand() - 0.5) * 800 } : { x: p.x + (rand() - 0.5) * 60, z: p.z + (rand() - 0.5) * 60 };
      p = slidePlant(board, items, 'soil1', p, want);
      items = put(items, p);
      assert.deepEqual(collisions(board, items).map(([a, b]) => `${a.what} on ${b.what}`), [], `${board}, push ${i}: ${JSON.stringify(p)}`);
    }
  }
});
