/* The parts beyond the first missions' kit: the LED in every colour, the RGB LED, the slide, tilt and reed switches, the joystick and the sensor modules.
   Each one can be placed, behaves electrically as its pinout says, is drawn in the schematic and survives a backup. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS, ITEM_INFO } from '../src/data/boards';
import { BASE_PARTS, lockedBy, MISSIONS, partIdOf, PARTS, STUDIO_PARTS, trayParts, type PartId } from '../src/data/missions';
import { wiringRows } from '../src/data/wiring';
import { inputsAt } from '../src/sim/check';
import { analyze, moduleVolts, type Drive } from '../src/sim/circuit';
import { makeHW } from '../src/sim/hardware';
import { run, type RunControl } from '../src/sim/interpreter';
import { layoutSchematic } from '../src/sim/schematic';
import { holesOf, inputsOf, makeItem, placementError, sameTool, toolKind } from '../src/state/bench';
import { isItem } from '../src/state/progress';
import { kindOf, LED_COLORS, MODULE_KINDS, type BoardId, type Item, type ModuleKind } from '../src/types';

const HIGH: Drive = { mode: 'out', level: 1 }, LOW: Drive = { mode: 'out', level: 0 }, PULLUP: Drive = { mode: 'pullup', level: 1 };
const ids = Object.keys(PARTS) as PartId[];
/** The part as it lands on the bench: two-point parts from d10 to d14, the others with their first leg in d10. */
const place = (id: PartId, items: Item[] = []) => makeItem(PARTS[id].tool, items, id === 'pad' ? 'PAD' : 'd10', 'd14');
const titles = (board: BoardId, items: Item[]) => analyze(board, items).issues.map(i => i.title);
const wire = (a: string, b: string): Item => ({ t: 'wire', a, b, c: 'green' });
const POWER: Item[] = [wire('U:5V', 'T+1'), wire('U:GND', 'T-1')];

/* --- the tray --- */
test('the studio-only parts are the ones no mission unlocks, and no mission needs one', () => {
  for (const id of ids) {
    const studio = STUDIO_PARTS.includes(id);
    assert.equal(!BASE_PARTS.includes(id) && lockedBy(id) === null, studio, `${id}: ${studio ? 'no mission unlocks it' : 'the tray starts with it or a mission unlocks it'}`);
  }
  for (const board of ['uno', 'esp32'] as const) for (const m of MISSIONS[board]) {
    for (const it of [...m.circuit, ...(m.start ?? [])]) assert.ok(!STUDIO_PARTS.includes(partIdOf(it)), `${board}/${m.id} is built without studio-only parts`);
    const tray = trayParts(m, []);
    for (const id of STUDIO_PARTS) assert.equal(tray.has(id), !!m.sandbox, `${id} is in the tray of ${board}/${m.id} only if it is the studio`);
  }
});

test('every part of the tray makes an item that is known as that part again, with a name, a pinout card and a wiring row', () => {
  for (const id of ids) {
    const it = place(id);
    assert.equal(partIdOf(it), id, `${id} placed on the bench is ${id}`);
    assert.equal(kindOf(it), toolKind(PARTS[id].tool), `${id}: the tool and the item agree on the kind`);
    assert.ok(ITEM_INFO[kindOf(it)]?.[1].length > 30, `${id} has a card that explains it`);
    assert.ok(wiringRows([it])[0].where.length > 3, `${id} has a row in the wiring table`);
    assert.ok(isItem(it), `${id} survives a backup`);
    assert.equal(ids.filter(other => sameTool(PARTS[id].tool, PARTS[other].tool)).length, 1, `${id} is told apart from every other part`);
  }
});

test('a backup refuses a module or a contact of a kind that does not exist', () => {
  assert.equal(isItem({ ...place('pir'), kind: 'laser' }), false);
  assert.equal(isItem({ ...place('tilt'), kind: 'pir' }), false);
});

/* --- placing --- */
test('the wide parts need their columns, and stay clear of the ESP32', () => {
  assert.match(placementError('uno', [], makeItem({ kind: 'rgb' }, [], 'd28'))!, /An RGB LED needs four columns/);
  assert.equal(placementError('uno', [], makeItem({ kind: 'rgb' }, [], 'd27')), null);
  assert.match(placementError('uno', [], makeItem({ kind: 'joy' }, [], 'd27'))!, /A joystick needs five columns/);
  assert.equal(placementError('uno', [], makeItem({ kind: 'joy' }, [], 'd26')), null);
  assert.match(placementError('uno', [], makeItem({ kind: 'module', sub: 'ir' }, [], 'd29'))!, /An obstacle sensor needs three columns/);
  assert.match(placementError('esp32', [], makeItem({ kind: 'slide' }, [], 'd10'))!, /under the ESP32/);
  assert.equal(placementError('esp32', [], makeItem({ kind: 'slide' }, [], 'd24')), null);
  const joy = place('joystick');
  assert.deepEqual(holesOf(joy), ['d10', 'd11', 'd12', 'd13', 'd14']);
  assert.match(placementError('uno', [joy], makeItem({ kind: 'contact', sub: 'reed' }, [joy], 'd14', 'd16'))!, /already taken/);
});

/* --- LEDs --- */
test('the new LED colours light on a pin, and a blue or white one needs more voltage than a red one', () => {
  const led = (color: number): Item[] => [wire('U:9', 'a10'), { t: 'led', id: 'led', a: 'e10', k: 'e11', color }, { t: 'res', a: 'c11', b: 'c15' }, wire('a15', 'U:GND')];
  const amps = (color: number) => analyze('uno', led(color)).solve({ 9: HIGH }).ledAmps('led');
  for (const [name, color] of Object.entries(LED_COLORS)) {
    assert.deepEqual(titles('uno', led(color)), [], `${name}: nothing wrong with the circuit`);
    assert.ok(amps(color) > 0.004 && amps(color) < 0.02, `${name} LED carries ${amps(color)} A`);
  }
  assert.ok(amps(LED_COLORS.blue) < amps(LED_COLORS.red) && amps(LED_COLORS.white) < amps(LED_COLORS.yellow));
});

test('an LED of any colour is the one LED part, and is placed in the colour picked', () => {
  for (const color of Object.values(LED_COLORS)) {
    const tool = { kind: 'led' as const, color }, it = makeItem(tool, [], 'e10', 'e11');
    assert.equal(partIdOf(it), 'led');
    assert.ok(it.t === 'led' && it.color === color, 'the colour in hand is the colour placed');
    assert.ok(sameTool(tool, PARTS.led.tool), 'the drawer\'s LED tile counts as picked whatever the colour');
  }
});

test('what the colour picker says: 220 Ω lights every colour on the Uno, and all but blue and white on the ESP32, which light with 100 Ω', () => {
  const uno = (color: number, ohms = 220): Item[] => [wire('U:9', 'a10'), { t: 'led', id: 'led', a: 'e10', k: 'e11', color }, { t: 'res', a: 'c11', b: 'c15', ohms }, wire('a15', 'U:GND')];
  const esp = (color: number, ohms = 220): Item[] => [wire('E:D5', 'j22'), { t: 'led', id: 'led', a: 'g22', k: 'g23', color }, { t: 'res', a: 'h23', b: 'h27', ohms }, wire('j27', 'B-27'), wire('E:GND', 'B-5')];
  const lit = (board: BoardId, items: Item[]) => analyze(board, items).solve({ [board === 'uno' ? 9 : 5]: HIGH }).ledGlow('led') > 0.5;   // the checks' "on"
  for (const [name, color] of Object.entries(LED_COLORS)) {
    assert.ok(lit('uno', uno(color)), `${name} lights on the Uno through 220 Ω`);
    const bright = name !== 'blue' && name !== 'white';
    assert.equal(lit('esp32', esp(color)), bright, `${name} ${bright ? 'lights' : 'only glows faintly'} on the ESP32 through 220 Ω`);
    assert.ok(lit('esp32', esp(color, 100)), `${name} lights on the ESP32 through 100 Ω`);
  }
});

const RGB: Item[] = [
  { t: 'rgb', id: 'rgb1', row: 'e', col: 10 },
  wire('U:9', 'j5'), { t: 'res', a: 'f5', b: 'a10' },      // red
  wire('b11', 'U:GND'),                                     // the shared − leg
  wire('U:10', 'j6'), { t: 'res', a: 'f6', b: 'a12' },     // green
  wire('U:11', 'j7'), { t: 'res', a: 'f7', b: 'a13' },     // blue
];

test('an RGB LED lights each colour from its own pin, and mixes them', () => {
  assert.deepEqual(titles('uno', RGB), []);
  const an = analyze('uno', RGB), glow = (drive: Record<number, Drive>) => ['r', 'g', 'b'].map(c => an.solve(drive).ledGlow(`rgb1:${c}`) > 0.3);
  assert.deepEqual(glow({ 9: HIGH, 10: LOW, 11: LOW }), [true, false, false]);
  assert.deepEqual(glow({ 9: LOW, 10: HIGH, 11: LOW }), [false, true, false]);
  assert.deepEqual(glow({ 9: HIGH, 10: LOW, 11: HIGH }), [true, false, true]);
  assert.deepEqual(glow({}), [false, false, false]);
  const dim = an.solve({ 9: { mode: 'out', level: 0.1 } }).ledGlow('rgb1:r'), full = an.solve({ 9: HIGH }).ledGlow('rgb1:r');
  assert.ok(dim > 0 && dim < full, 'analogWrite dims a colour');
});

test('an RGB LED with a colour left unwired is fine, but it needs its ground and its resistors', () => {
  const redOnly = RGB.slice(0, 4);
  assert.deepEqual(titles('uno', redOnly), []);
  assert.deepEqual(titles('uno', RGB.filter(it => !(it.t === 'wire' && it.a === 'b11'))), ['RGB LED has no ground']);
  const bare: Item[] = [{ t: 'rgb', id: 'rgb1', row: 'e', col: 10 }, wire('U:9', 'a10'), wire('b11', 'U:GND')];
  const issue = analyze('uno', bare).issues[0];
  assert.equal(issue.kind, 'led-no-resistor');
  assert.equal(issue.part, 'rgb1', 'the problem points at the part, not at one of the LEDs inside it');
  assert.match(issue.title, /red leg has no resistor/);
  const swapped: Item[] = [{ t: 'rgb', id: 'rgb1', row: 'e', col: 10 }, wire('U:GND', 'a10'), { t: 'res', a: 'b11', b: 'b20' }, wire('a20', 'U:9')];
  assert.deepEqual(analyze('uno', swapped).issues.map(i => i.kind), ['led-backwards']);
});

test('an RGB LED without a resistor burns out as one part and stays dark', () => {
  const bare: Item[] = [{ t: 'rgb', id: 'rgb1', row: 'e', col: 10 }, wire('U:9', 'a10'), wire('b11', 'U:GND')], burnt: string[] = [];
  const hw = makeHW(BOARDS.uno, bare, () => ({}), () => {}, { onBurn: id => burnt.push(id) });
  hw.pinMode(9, 1); hw.digitalWrite(9, 1);
  assert.deepEqual(burnt, ['rgb1']);
  assert.equal(hw.ledGlow('rgb1:r'), 0);
});

/* --- switches --- */
test('a slide switch joins its middle leg to the left or to the right, never both', () => {
  const items: Item[] = [...POWER, { t: 'slide', id: 'sw', row: 'e', col: 10, ctl: 'Switch' }, wire('a10', 'T+10'), wire('a12', 'T-12'), wire('a11', 'U:A0')];
  const an = analyze('uno', items);
  assert.deepEqual(an.issues, []);
  assert.equal(an.solve({}, { sw: 0 }).volt('U:A0').toFixed(2), '5.00');
  assert.equal(an.solve({}, { sw: 1 }).volt('U:A0').toFixed(2), '0.00');
});

test('an LED switched by a slide switch is not called an open circuit, whichever side is used', () => {
  for (const side of [10, 12]) {
    const items: Item[] = [...POWER, { t: 'slide', id: 'sw', row: 'e', col: 10, ctl: 'Switch' }, wire(`a${side}`, 'T+10'), wire('a11', 'a20'), { t: 'led', id: 'led', a: 'e20', k: 'e21', color: 0xff3b30 }, { t: 'res', a: 'c21', b: 'c25' }, wire('a25', 'T-25')];
    assert.deepEqual(titles('uno', items), [], `power on leg ${side}`);
    const lit = [0, 1].map(v => analyze('uno', items).solve({}, { sw: v }).ledGlow('led') > 0.5);
    assert.deepEqual(lit, side === 10 ? [true, false] : [false, true]);
  }
});

test('a tilt switch is closed until it is tilted, and a reed switch is open until a magnet is near', () => {
  const read = (kind: 'tilt' | 'reed', v: number) => {
    const items: Item[] = [{ t: 'contact', kind, id: 'c', a: 'e10', b: 'e12', ctl: '' }, wire('U:2', 'a10'), wire('a12', 'U:GND')];
    assert.deepEqual(analyze('uno', items).issues, []);
    return analyze('uno', items).solve({ 2: PULLUP }, { c: v }).pinVolt(2) > 3 ? 'HIGH' : 'LOW';
  };
  assert.deepEqual([read('tilt', 0), read('tilt', 1)], ['LOW', 'HIGH']);
  assert.deepEqual([read('reed', 0), read('reed', 1)], ['HIGH', 'LOW']);
});

/* --- sensor modules --- */
const module = (kind: ModuleKind, plus = 'T+10', pin = 'U:A0'): Item[] => [...POWER, { t: 'module', kind, id: 'm', row: 'e', col: 10, ctl: '' }, wire('a10', plus), wire('a11', pin), wire('a12', 'T-12')];
const out = (kind: ModuleKind, v: number, items = module(kind)) => +analyze('uno', items).solve({}, { m: v }).volt('U:A0').toFixed(2);

test('every sensor module wired +, OUT, GND has nothing to fix and follows its control', () => {
  for (const kind of MODULE_KINDS) assert.deepEqual(titles('uno', module(kind)), [], kind);
  assert.deepEqual([out('pir', 0), out('pir', 1)], [0, 3.3]);            // HIGH while it sees movement
  assert.deepEqual([out('ir', 0), out('ir', 1)], [5, 0]);                // LOW when something is in the way
  assert.deepEqual([out('gas', 0), out('gas', 1)], [0.1, 3.3]);
  for (const kind of ['soil', 'water', 'flame'] as const) assert.deepEqual([out(kind, 0), out(kind, 0.5), out(kind, 1)], [0, 2.5, 5], kind);
  for (const kind of MODULE_KINDS) for (const v of [0, 0.5, 1]) assert.ok(moduleVolts(kind, v, 3.3) <= 3.3, `${kind} powered from 3.3 V never puts more than 3.3 V on a pin`);
});

test('a motion sensor reads HIGH on both boards, and a sketch sees it', async () => {
  const esp: Item[] = [{ t: 'module', kind: 'pir', id: 'm', row: 'j', col: 24, ctl: '' }, wire('f24', 'E:VIN'), wire('f25', 'E:D4'), wire('f26', 'E:GND')];
  assert.deepEqual(titles('esp32', esp), []);
  const inputs = { m: 0 }, seen: number[] = [];
  const hw = makeHW(BOARDS.esp32, esp, () => inputs, () => {});
  hw.skipDelays = true;
  let pass = 0;
  const ctl: RunControl = { stop: false, onLoop() { seen.push(hw.digitalRead(4)); inputs.m = 1; if (++pass === 2) ctl.stop = true; } };
  await run('void setup() { pinMode(4, INPUT); }\nvoid loop() { delay(10); }', hw, ctl);
  assert.deepEqual(seen, [0, 1]);
  const uno = makeHW(BOARDS.uno, module('pir', 'T+10', 'U:2'), () => ({ m: 1 }), () => {});
  assert.equal(uno.digitalRead(2), 1, '3.3 V counts as HIGH on the 5 V Uno');
});

test('the circuit check says what a sensor module is missing', () => {
  const no = (drop: string) => titles('uno', module('soil').filter(it => !(it.t === 'wire' && (it.a === drop || it.b === drop))));
  assert.deepEqual(no('a12'), ['Soil moisture sensor has no ground']);
  assert.deepEqual(no('a10'), ['Soil moisture sensor has no power']);
  assert.deepEqual(no('a11'), ['Soil moisture sensor is not connected to a pin']);
  const weak: Item[] = [wire('U:3V3', 'T+1'), wire('U:GND', 'T-1'), ...module('gas').slice(2)];
  assert.match(analyze('uno', weak).issues[0].plain, /needs 5 V but its \+ pin only gets 3.3 V/);
  assert.equal(out('gas', 1, weak), 0, 'an unpowered sensor gives no reading');
  const backwards: Item[] = [...POWER, { t: 'module', kind: 'flame', id: 'm', row: 'e', col: 10, ctl: '' }, wire('a10', 'T-10'), wire('a11', 'U:A0'), wire('a12', 'T+12')];
  assert.deepEqual(titles('uno', backwards), ['Flame sensor is in backwards']);
});

/* --- the joystick --- */
const JOY: Item[] = [...POWER, { t: 'joy', id: 'joy1', row: 'e', col: 10, ctl: 'Joystick' }, wire('a10', 'T-10'), wire('a11', 'T+11'), wire('a12', 'U:A0'), wire('a13', 'U:A1'), wire('a14', 'U:2')];

test('a joystick gives a voltage for each direction and joins SW to GND when pressed', () => {
  const an = analyze('uno', JOY), at = (inputs: Record<string, number>) => { const s = an.solve({ 2: PULLUP }, inputs); return [+s.volt('U:A0').toFixed(1), +s.volt('U:A1').toFixed(1), s.pinVolt(2) > 3 ? 'HIGH' : 'LOW']; };
  assert.deepEqual(an.issues, []);
  assert.deepEqual(at(inputsOf(JOY[2], 'joy1')), [2.5, 2.5, 'HIGH'], 'at rest: both in the middle, not pressed');
  assert.deepEqual(at({ joy1: 1, 'joy1:y': 0, 'joy1:sw': 1 }), [5, 0, 'LOW'], 'pushed right and down, and pressed');
  assert.deepEqual(at({ joy1: 0, 'joy1:y': 1, 'joy1:sw': 0 }), [0, 5, 'HIGH'], 'pushed left and up');
  assert.deepEqual(titles('uno', JOY.filter(it => !(it.t === 'wire' && it.a === 'a11'))), ['Joystick has no power'], 'said once, not once for each knob inside');
});

test('a sketch reads the joystick with analogRead and INPUT_PULLUP', async () => {
  const inputs: Record<string, number> = { joy1: 1, 'joy1:y': 0.5, 'joy1:sw': 1 }, lines: string[] = [];
  const hw = makeHW(BOARDS.uno, JOY, () => inputs, text => lines.push(text));
  hw.skipDelays = true;
  const ctl: RunControl = { stop: false, onLoop() { ctl.stop = true; } };
  await run('void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); }\nvoid loop() { Serial.println(analogRead(A0)); Serial.println(analogRead(A1)); Serial.println(digitalRead(2)); }', hw, ctl);
  const [x, y, sw] = lines.join('').trim().split(/\s+/).map(Number);
  assert.ok(x > 1000 && y > 480 && y < 544, `x ${x}, y ${y}`);
  assert.equal(sw, 0, 'pressed reads LOW');
});

test('the checks leave a part they do not script at rest', () => {
  assert.deepEqual(inputsAt(JOY, [{ from: 0, set: { button: 1 } }], 100), { joy1: 0.5, 'joy1:y': 0.5, 'joy1:sw': 0 });
  assert.deepEqual(inputsAt(module('water'), [{ from: 0, set: { soil: 1 } }], 100), { m: 0 }, 'a water sensor is not a soil sensor');
  assert.deepEqual(inputsOf(RGB[0], 'rgb1'), {}, 'an RGB LED has no on-screen control');
});

test('the checks script a reed switch by its kind, and leave a tilt switch alone', () => {
  const contact = (kind: 'reed' | 'tilt'): Item[] => [{ t: 'contact', kind, id: 'c', a: 'e10', b: 'e12', ctl: '' }];
  assert.deepEqual(inputsAt(contact('reed'), [], 0), { c: 0 }, 'the magnet starts away');
  assert.deepEqual(inputsAt(contact('reed'), [{ from: 0, set: { reed: 1 } }], 100), { c: 1 });
  assert.deepEqual(inputsAt(contact('tilt'), [{ from: 0, set: { reed: 1 } }], 100), { c: 0 }, 'a tilt switch is not a reed switch');
});

test('the checks script a sensor module by its kind, and leave it at rest until they do', () => {
  assert.deepEqual(inputsAt(module('soil'), [], 0), { m: 0.5 }, 'damp soil');
  assert.deepEqual(inputsAt(module('soil'), [{ from: 0, set: { soil: 0.7 } }, { from: 1000, set: { soil: 0.1 } }], 1500), { m: 0.1 });
  assert.deepEqual(inputsAt(module('pir'), [], 0), { m: 0 }, 'all still');
  assert.deepEqual(inputsAt(module('pir'), [{ from: 500, set: { pir: 1 } }], 800), { m: 1 });
  assert.deepEqual(inputsAt(module('pir'), [{ from: 0, set: { soil: 1 } }], 100), { m: 0 }, 'a motion sensor is not a soil sensor');
});

/* --- the schematic --- */
test('the schematic draws the new parts with their pin names', () => {
  const box = (items: Item[]) => layoutSchematic('uno', items).boxes.find(b => b.kind === 'box')!;
  assert.deepEqual(box(RGB).pins.map(p => p.name), ['R', '−', 'G', 'B']);
  assert.deepEqual(box(JOY).pins.map(p => p.name), ['GND', '+', 'VRx', 'VRy', 'SW']);
  assert.deepEqual([box(module('gas')).title, box(module('gas')).pins.map(p => p.name).join(' ')], ['MQ-2', '+ OUT GND']);
  const reed = layoutSchematic('uno', [{ t: 'contact', kind: 'reed', id: 'c', a: 'e10', b: 'e12', ctl: '' }, wire('U:2', 'a10'), wire('a12', 'U:GND')]);
  assert.deepEqual(reed.parts.map(p => [p.symbol, p.label]), [['button', 'reed switch']]);
  assert.match(reed.text.join(' '), /Pin 2 → reed switch → GND/);
  const blue = layoutSchematic('uno', [wire('U:9', 'a10'), { t: 'led', id: 'led', a: 'e10', k: 'e11', color: LED_COLORS.blue }]);
  assert.equal(blue.parts[0].label, 'blue LED');
});
