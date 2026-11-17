/* The circuit checker: breadboard connectivity, mistakes a student can make, and the voltages and currents of a working circuit. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS } from '../src/data/boards';
import { OLD_LESSONS, oldLesson } from './fixtures-lessons';
import { analyze, type Drive } from '../src/sim/circuit';
import { makeHW } from '../src/sim/hardware';
import { run } from '../src/sim/interpreter';
import type { BoardId, Item } from '../src/types';

const HIGH: Drive = { mode: 'out', level: 1 }, LOW: Drive = { mode: 'out', level: 0 };
const kinds = (board: BoardId, items: Item[]) => analyze(board, items).issues.map(i => i.kind).sort();
const lesson = (board: BoardId, id: string) => oldLesson(board, id).circuit;

/** A correct Uno blink circuit that each test below damages in one way. */
const GOOD: Item[] = [
  { t: 'wire', a: 'U:13', b: 'a10', c: 'orange' },
  { t: 'led', id: 'led', a: 'e10', k: 'e11', color: 0xff3b30 },
  { t: 'res', a: 'c11', b: 'c15' },
  { t: 'wire', a: 'a15', b: 'U:GND2', c: 'black' },
];
const without = (items: Item[], i: number) => items.filter((_, k) => k !== i);

test('a correct circuit has no problems and lights its LED when the pin is high', () => {
  assert.deepEqual(kinds('uno', GOOD), []);
  const on = analyze('uno', GOOD).solve({ 13: HIGH });
  assert.ok(on.ledAmps('led') > 0.008 && on.ledAmps('led') < 0.02, `current ${on.ledAmps('led')}`);
  assert.ok(on.ledGlow('led') > 0.9);
  const off = analyze('uno', GOOD).solve({ 13: LOW });
  assert.equal(off.ledAmps('led'), 0);
  assert.equal(off.ledGlow('led'), 0);
});

test('breadboard columns: a to e are joined, f to j are joined, and the two halves are not', () => {
  const wired = (a: string, b: string): Item[] => [{ t: 'wire', a: 'U:5V', b: a, c: 'red' }, { t: 'wire', a: b, b: 'U:A0', c: 'green' }];
  const volts = (a: string, b: string) => analyze('uno', wired(a, b)).solve({}).volt('U:A0');
  assert.equal(volts('a10', 'e10'), 5);      // same column, same half
  assert.equal(volts('f10', 'j10'), 5);
  assert.equal(volts('e10', 'f10'), 0);      // across the centre gap
  assert.equal(volts('a10', 'a11'), 0);      // next column
});

test('power rails run the whole length of the board', () => {
  const items: Item[] = [{ t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' }, { t: 'wire', a: 'T+30', b: 'U:A1', c: 'green' }, { t: 'wire', a: 'T-30', b: 'U:A2', c: 'green' }];
  const s = analyze('uno', items).solve({});
  assert.equal(s.volt('U:A1'), 5);
  assert.equal(s.volt('U:A2'), 0);      // the minus rail is not connected to anything yet
});

test('LED in backwards is reported and stays dark', () => {
  const flipped = GOOD.map(it => (it.t === 'led' ? { ...it, a: it.k, k: it.a } : it));
  const a = analyze('uno', flipped);
  assert.deepEqual(a.issues.map(i => i.kind), ['led-backwards']);
  assert.match(a.issues[0].plain, /backwards|wrong way/i);
  assert.equal(a.solve({ 13: HIGH }).ledAmps('led'), 0);
});

test('missing resistor burns the LED and says why', () => {
  const noRes = GOOD.filter(it => it.t !== 'res').concat({ t: 'wire', a: 'c11', b: 'c15', c: 'white' });
  const a = analyze('uno', noRes);
  assert.deepEqual(a.issues.map(i => i.kind), ['led-no-resistor']);
  assert.match(a.issues[0].plain, /resistor/i);
  assert.ok(a.solve({ 13: HIGH }).ledAmps('led') > 0.03, 'enough current to burn it out');
  // once burnt it is an open circuit, so nothing flows
  assert.equal(a.solve({ 13: HIGH }, {}, ['led']).ledAmps('led'), 0);
});

test('open circuit: a missing ground wire is reported', () => {
  const open = without(GOOD, 3);
  const a = analyze('uno', open);
  assert.deepEqual(a.issues.map(i => i.kind), ['led-open']);
  assert.equal(a.solve({ 13: HIGH }).ledAmps('led'), 0);
});

test('open circuit: an LED leg connected to nothing is reported', () => {
  const lonely = GOOD.map(it => (it.t === 'led' ? { ...it, k: 'e25' } : it));
  const a = analyze('uno', lonely);
  assert.deepEqual(a.issues.map(i => i.kind), ['led-open']);
  assert.match(a.issues[0].plain, /not connected|nothing/i);
});

test('a short from 5 V to GND is an error', () => {
  const s: Item[] = [{ t: 'wire', a: 'U:5V', b: 'T+3', c: 'red' }, { t: 'wire', a: 'U:GND', b: 'T-3', c: 'black' }, { t: 'wire', a: 'T+9', b: 'T-9', c: 'yellow' }];
  const a = analyze('uno', s);
  assert.deepEqual(a.issues.map(i => i.kind), ['short']);
  assert.equal(a.issues[0].severity, 'error');
  assert.equal(a.solve({}).shorted, true);
  assert.deepEqual(kinds('uno', s.slice(0, 2)), []);   // the same wires without the cross-wire are fine
});

test('a part with both legs in one column is bypassed', () => {
  const bad = GOOD.map(it => (it.t === 'res' ? { ...it, a: 'b15', b: 'd15' } : it));
  assert.ok(kinds('uno', bad).includes('part-bypassed'));
});

test('push button with the internal pull-up reads high until pressed', () => {
  const items: Item[] = [
    { t: 'button', id: 'btn', col: 20, ctl: 'Hold' },
    { t: 'wire', a: 'U:2', b: 'a20', c: 'yellow' }, { t: 'wire', a: 'a22', b: 'T-22', c: 'black' }, { t: 'wire', a: 'U:GND', b: 'T-1', c: 'black' },
  ];
  assert.deepEqual(kinds('uno', items), []);
  const pull: Drive = { mode: 'pullup', level: 1 };
  const a = analyze('uno', items);
  assert.ok(a.solve({ 2: pull }, { btn: 0 }).volt('U:2') > 4.9);
  assert.ok(a.solve({ 2: pull }, { btn: 1 }).volt('U:2') < 0.1);
});

test('potentiometer wiper gives a fraction of the supply', () => {
  const pot = lesson('uno', 'knob');
  const a = analyze('uno', pot);
  assert.deepEqual(a.issues, []);
  assert.ok(Math.abs(a.solve({}, { pot: 0.5 }).volt('U:A0') - 2.5) < 0.01);
  assert.ok(a.solve({}, { pot: 1 }).volt('U:A0') > 4.99);
  assert.ok(a.solve({}, { pot: 0 }).volt('U:A0') < 0.01);
});

test('ESP32 pins share breadboard columns, and its logic level is 3.3 V', () => {
  const blink = lesson('esp32', 'blink');
  const a = analyze('esp32', blink);
  assert.deepEqual(a.issues, []);
  const on = a.solve({ 5: HIGH });
  assert.ok(Math.abs(on.volt('E:D5') - 3.3) < 0.2);
  assert.equal(on.volt('E:D5'), on.volt('j11'), 'D5 is the hole j11');
  assert.ok(on.ledAmps('led') > 0.003, `current ${on.ledAmps('led')}`);
});

test('5 V on an ESP32 pin is reported as damaging', () => {
  const bad: Item[] = [{ t: 'wire', a: 'E:VIN', b: 'E:D34', c: 'red' }];
  assert.ok(kinds('esp32', bad).includes('overvoltage'));
});

test('an unpowered distance sensor is reported', () => {
  const sonar = lesson('uno', 'distance').filter(it => !(it.t === 'wire' && it.a === 'f18'));
  assert.ok(kinds('uno', sonar).includes('unpowered'));
});

test('the sensor lessons themselves have no problems', () => {
  for (const id of ['blink', 'button', 'knob', 'sound', 'distance']) assert.deepEqual(analyze('uno', lesson('uno', id)).issues, [], 'uno ' + id);
  for (const l of OLD_LESSONS.esp32) assert.deepEqual(analyze('esp32', l.circuit).issues, [], 'esp32 ' + l.id);
});

/* --- what happens while a sketch runs on the student's circuit --- */

const BLINK = 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); delay(10); digitalWrite(13, LOW); delay(10); }';
async function runOn(board: BoardId, items: Item[], code: string, inputs: Record<string, number> = {}) {
  const burned: string[] = [], alerts: string[] = [];
  const hw = makeHW(BOARDS[board], items, () => inputs, () => {}, { onBurn: id => burned.push(id), onAlert: t => alerts.push(t) });
  hw.sleep = () => new Promise<void>(r => setTimeout(r, 0));
  let pass = 0;
  const ctl = { stop: false, onLoop() { if (++pass >= 3) ctl.stop = true; } };
  await run(code, hw, ctl);
  return { hw, burned, alerts };
}

test('a sketch on a correct circuit makes the LED glow without burning it', async () => {
  const { burned, hw } = await runOn('uno', GOOD, 'void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); } void loop() {}');
  assert.deepEqual(burned, []);
  assert.ok(hw.ledGlow('led') > 0.9);
});

test('driving an LED that has no resistor burns it out, once, and it stays dark', async () => {
  const noRes = GOOD.filter(it => it.t !== 'res').concat({ t: 'wire', a: 'c11', b: 'c15', c: 'white' });
  const { burned, hw } = await runOn('uno', noRes, BLINK);
  assert.deepEqual(burned, ['led']);
  assert.equal(hw.ledGlow('led'), 0);
});

test('a pin wired straight to ground is reported as overloaded when the sketch drives it', async () => {
  const bad: Item[] = [{ t: 'wire', a: 'U:13', b: 'U:GND', c: 'red' }];
  const { alerts } = await runOn('uno', bad, BLINK);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /Pin 13/);
});

test('the LED stays dark when the sketch uses a different pin than the wire', async () => {
  const { hw } = await runOn('uno', GOOD, 'void setup() { pinMode(12, OUTPUT); digitalWrite(12, HIGH); } void loop() {}');
  assert.equal(hw.ledGlow('led'), 0);
});

test('a buzzer sounds only when it is wired to the pin that plays the note', async () => {
  const buzz: Item[] = [{ t: 'buzzer', id: 'bz', a: 'e20', b: 'e23' }, { t: 'wire', a: 'U:8', b: 'a20', c: 'purple' }, { t: 'wire', a: 'a23', b: 'U:GND', c: 'black' }];
  const play = (pin: number) => runOn('uno', buzz, `void setup() { tone(${pin}, 440); } void loop() {}`).then(r => r.hw.buzzFreq('bz'));
  assert.equal(await play(8), 440);
  assert.equal(await play(7), 0);
});

test('a distance sensor with no power returns nothing', async () => {
  const sonar = lesson('uno', 'distance'), code = 'void setup() { Serial.println(pulseIn(10, HIGH)); } void loop() {}';
  const read = async (items: Item[]) => {
    let out = '';
    const hw = makeHW(BOARDS.uno, items, () => ({ sonar: 20 }), s => { out += s; });
    await run(code, hw, { stop: false, onLoop() { this.stop = true; } });
    return +out;
  };
  assert.ok(await read(sonar) > 1000);
  assert.equal(await read(sonar.filter(it => !(it.t === 'wire' && it.a === 'f18'))), 0);
});

/* --- the light sensor and the temperature sensor --- */
const LDR_DIVIDER: Item[] = [
  { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' },
  { t: 'ldr', id: 'ldr', a: 'e24', b: 'e25', ctl: 'Light level' }, { t: 'wire', a: 'a24', b: 'T+24', c: 'red' },
  { t: 'res', a: 'c25', b: 'c28', ohms: 10000 }, { t: 'wire', a: 'a28', b: 'T-28', c: 'black' }, { t: 'wire', a: 'a25', b: 'U:A0', c: 'green' },
];
const TEMP_SENSOR = (supply: 'U:5V' | 'U:3V3'): Item[] => [
  { t: 'wire', a: supply, b: 'T+1', c: 'red' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' },
  { t: 'temp', id: 'temp', row: 'd', col: 24, ctl: 'Temperature' }, { t: 'wire', a: 'a24', b: 'T+24', c: 'red' }, { t: 'wire', a: 'a26', b: 'T-26', c: 'black' }, { t: 'wire', a: 'a25', b: 'U:A0', c: 'green' },
];

test('a light sensor in a divider reads high in the light and low in the dark', () => {
  const a = analyze('uno', LDR_DIVIDER);
  assert.deepEqual(a.issues, []);
  const at = (light: number) => a.solve({}, { ldr: light }).pinVolt(14);
  assert.ok(at(1) > 4.3 && at(1) < 4.7, `bright ${at(1)}`);
  assert.ok(Math.abs(at(0.5) - 2.5) < 0.1, `half light ${at(0.5)}`);
  assert.ok(at(0) > 0.3 && at(0) < 0.6, `dark ${at(0)}`);
  assert.ok(at(1) > at(0.7) && at(0.7) > at(0.4) && at(0.4) > at(0), 'more light always reads higher');
});

test('a light sensor with the fixed resistor on the other side reads the other way round', () => {
  const swapped: Item[] = [
    { t: 'wire', a: 'U:5V', b: 'T+1', c: 'red' }, { t: 'wire', a: 'U:GND', b: 'T-2', c: 'black' },
    { t: 'res', a: 'e24', b: 'e25', ohms: 10000 }, { t: 'wire', a: 'a24', b: 'T+24', c: 'red' },
    { t: 'ldr', id: 'ldr', a: 'c25', b: 'c28', ctl: 'Light level' }, { t: 'wire', a: 'a28', b: 'T-28', c: 'black' }, { t: 'wire', a: 'a25', b: 'U:A0', c: 'green' },
  ];
  const a = analyze('uno', swapped);
  assert.ok(a.solve({}, { ldr: 0 }).pinVolt(14) > a.solve({}, { ldr: 1 }).pinVolt(14), 'darker reads higher');
});

test('a light sensor current shows in the wires and a light sensor in a loop with itself is reported as bypassed', () => {
  const a = analyze('uno', LDR_DIVIDER), s = a.solve({}, { ldr: 0.5 });
  assert.ok(Math.abs(s.wireAmps('wire1')) < 1, 'the wires exist');
  const bypass = analyze('uno', [{ t: 'ldr', id: 'ldr', a: 'e24', b: 'a24', ctl: 'Light level' }]);
  assert.ok(bypass.issues.some(i => i.kind === 'part-bypassed' && /light sensor/.test(i.title)));
});

test('a temperature sensor gives 0.5 V at 0 degrees and 10 mV for each degree more, on either supply', () => {
  for (const [supply, logic] of [['U:5V', 5], ['U:3V3', 3.3]] as const) {
    const a = analyze('uno', TEMP_SENSOR(supply));
    assert.deepEqual(a.issues, [], `${supply} has no problems`);
    const at = (c: number) => a.solve({}, { temp: c }).pinVolt(14);
    assert.ok(Math.abs(at(0) - 0.5) < 0.01, `0 degrees on ${logic} V: ${at(0)}`);
    assert.ok(Math.abs(at(25) - 0.75) < 0.01, `25 degrees on ${logic} V: ${at(25)}`);
    assert.ok(Math.abs(at(100) - 1.5) < 0.01, `100 degrees on ${logic} V: ${at(100)}`);
    assert.ok(Math.abs(at(-20) - 0.3) < 0.01, `-20 degrees on ${logic} V: ${at(-20)}`);
  }
});

test('a temperature sensor gives nothing without power, and the mistakes are named', () => {
  const kind = (items: Item[]) => analyze('uno', items).issues.map(i => `${i.kind}:${i.title}`);
  const noPower = TEMP_SENSOR('U:5V').filter(it => !(it.t === 'wire' && it.a === 'a24'));
  assert.deepEqual(kind(noPower), ['unpowered:Temperature sensor has no power']);
  assert.ok(analyze('uno', noPower).solve({}, { temp: 25 }).pinVolt(14) < 0.1, 'no output');
  const noGround = TEMP_SENSOR('U:5V').filter(it => !(it.t === 'wire' && it.a === 'a26'));
  assert.deepEqual(kind(noGround), ['unpowered:Temperature sensor has no ground']);
  const backwards = TEMP_SENSOR('U:5V').map((it): Item => (it.t === 'wire' && it.a === 'a24' ? { ...it, a: 'a26' } : it.t === 'wire' && it.a === 'a26' ? { ...it, a: 'a24' } : it));
  assert.deepEqual(kind(backwards), ['unpowered:Temperature sensor is in backwards']);
  const noPin = TEMP_SENSOR('U:5V').filter(it => !(it.t === 'wire' && it.a === 'a25'));
  assert.deepEqual(kind(noPin), ['unpowered:Temperature sensor is not connected to a pin']);
});

test('a temperature sensor on the ESP32 reads in 12 bits against 3.3 V', async () => {
  const items: Item[] = [
    { t: 'wire', a: 'E:3V3', b: 'B+4', c: 'red' }, { t: 'wire', a: 'E:GND', b: 'B-5', c: 'black' },
    { t: 'temp', id: 'temp', row: 'g', col: 28, ctl: 'Temperature' }, { t: 'wire', a: 'j28', b: 'B+28', c: 'red' }, { t: 'wire', a: 'j30', b: 'B-30', c: 'black' }, { t: 'wire', a: 'j29', b: 'E:D34', c: 'green' },
  ];
  assert.deepEqual(kinds('esp32', items), []);
  let out = '';
  const hw = makeHW(BOARDS.esp32, items, () => ({ temp: 25 }), s => { out += s; });
  hw.sleep = () => Promise.resolve();
  const ctl = { stop: false, onLoop() { ctl.stop = true; } };
  await run('void setup() { Serial.begin(115200); }\nvoid loop() { int raw = analogRead(34); Serial.println(raw); }', hw, ctl);
  assert.ok(Math.abs(+out - 931) <= 2, `0.75 V of 3.3 V is about 931, got ${out.trim()}`);
});
