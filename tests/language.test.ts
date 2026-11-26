/* The language the interpreter understands beyond the basics: switch statements, Servo objects, typing to the board (Serial input, char and String), and the servo on the bench: its wiring rules, its signal, and where it points. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS } from '../src/data/boards';
import { MISSIONS } from '../src/data/missions';
import { analyze } from '../src/sim/circuit';
import { observe, servoAt } from '../src/sim/check';
import { makeHW } from '../src/sim/hardware';
import { run, SimError } from '../src/sim/interpreter';
import { makeItem, placementError } from '../src/state/bench';
import type { BoardId, Item } from '../src/types';

/** Runs a sketch for some passes of loop() with delays skipped, and returns the board and what it printed. */
async function play(code: string, opts: { board?: BoardId; circuit?: Item[]; loops?: number } = {}) {
  let serial = '', pass = 0;
  const hw = makeHW(BOARDS[opts.board ?? 'uno'], opts.circuit ?? [], () => ({}), s => { serial += s; });
  hw.sleep = () => new Promise<void>(r => setTimeout(r, 0));
  const ctl = { stop: false, onLoop() { if (++pass >= (opts.loops ?? 1)) ctl.stop = true; } };
  await run(code, hw, ctl);
  return { hw, serial };
}
const sketch = (body: string, extra = '') => `${extra}\nvoid setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() {}`;
const fails = async (code: string, pattern: RegExp, line?: number) => {
  await assert.rejects(play(code), (e: unknown) => {
    assert.ok(e instanceof SimError, 'a SimError');
    assert.match(e.message, pattern);
    if (line != null) assert.equal(e.line, line);
    return true;
  });
};

/* --- switch --- */
test('switch picks the matching case and stops at break', async () => {
  const { serial } = await play(sketch(`
  for (int i = 0; i < 4; i++) {
    switch (i) {
      case 0: Serial.print("zero "); break;
      case 1: Serial.print("one "); break;
      default: Serial.print("many "); break;
    }
  }`));
  assert.equal(serial, 'zero one many many ');
});

test('switch runs on into the next case without a break, and default can sit anywhere', async () => {
  const { serial } = await play(sketch(`
  for (int i = 0; i < 4; i++) {
    switch (i) {
      default: Serial.print("d");
      case 1: Serial.print("1");
      case 2: Serial.print("2"); break;
      case 3: Serial.print("3");
    }
    Serial.print(" ");
  }`));
  assert.equal(serial, 'd12 12 2 3 ');
});

test('switch works with characters, constants and expressions, and does nothing when no case matches', async () => {
  const { serial } = await play(sketch(`
  char c = 'b';
  switch (c) { case 'a': Serial.print("A"); break; case 'b': Serial.print("B"); break; }
  switch (LIMIT * 2) { case LIMIT + LIMIT: Serial.print(" double"); break; }
  switch (7) { case 1: Serial.print("never"); }
  Serial.print(" done");`, 'const int LIMIT = 3;'));
  assert.equal(serial, 'B double done');
});

test('break leaves only the switch, continue goes on to the next pass of the loop, and return leaves the function', async () => {
  const { serial } = await play(sketch(`
  for (int i = 0; i < 3; i++) {
    switch (i) { case 1: continue; case 2: break; }
    Serial.print(i);
  }
  Serial.print(" ");
  Serial.print(pick(2));
  Serial.print(pick(9));`, `int pick(int n) {
  switch (n) {
    case 2: return 20;
    default: return -1;
  }
}`));
  assert.equal(serial, '02 20-1');
});

test('a variable declared in a case can be used in the cases after it', async () => {
  const { serial } = await play(sketch(`
  switch (1) {
    case 1: { int x = 4; Serial.print(x); }
    case 2: int y = 5; Serial.print(y); break;
  }`));
  assert.equal(serial, '45');
});

test('switch mistakes are explained with their line', async () => {
  await fails(sketch('  case 1: break;'), /only works inside a switch/, 4);
  await fails(sketch('  switch (1) { Serial.print("x"); }'), /start with a label/, 4);
  await fails(sketch('  switch (1) { default: break; default: break; }'), /only have one "default:"/, 4);
  await fails(sketch('  switch (1) { case 1 break; }'), /Expected ":"/, 4);
});

/* --- Servo objects --- */
test('a servo starts at 90°, and attach() and write() send the angle on its pin', async () => {
  const { hw, serial } = await play(sketch(`
  Serial.print(arm.attached());
  arm.attach(9);
  Serial.print(arm.attached()); Serial.print(" "); Serial.print(arm.read());
  arm.write(45);
  Serial.print(" "); Serial.print(arm.read());`, '#include <Servo.h>\nServo arm;'));
  assert.equal(serial, '01 90 45');
  assert.deepEqual(hw.servos, { 9: 45 });
  assert.equal(hw.snapshot().drive[9].mode, 'out', 'the signal pin is an output');
});

test('write() keeps to 0 to 180, treats big numbers as microseconds, and an angle written before attach() is where it starts', async () => {
  const { hw, serial } = await play(sketch(`
  arm.write(30); arm.attach(5);
  Serial.print(arm.read());
  arm.write(200); Serial.print(" "); Serial.print(arm.read());
  arm.write(-10); Serial.print(" "); Serial.print(arm.read());
  arm.write(2400); Serial.print(" "); Serial.print(arm.read());
  arm.writeMicroseconds(544); Serial.print(" "); Serial.print(arm.read());
  arm.writeMicroseconds(1472); Serial.print(" "); Serial.print(arm.read());`, 'Servo arm;'));
  assert.equal(serial, '30 180 0 180 0 90');
  assert.deepEqual(hw.servos, { 5: 90 });
});

test('servos can live in arrays and be passed to functions, and detach() stops the pulses', async () => {
  const { hw, serial } = await play(sketch(`
  arms[0].attach(9); arms[1].attach(10);
  point(arms[1], 120);
  Serial.print(arms[0].read()); Serial.print(" "); Serial.print(arms[1].read());
  arms[0].detach();
  Serial.print(" "); Serial.print(arms[0].attached());`, `Servo arms[2];
void point(Servo &s, int angle) { s.write(angle); }`));
  assert.equal(serial, '90 120 0');
  assert.deepEqual(hw.servos, { 10: 120 });
});

test('Servo mistakes are explained', async () => {
  await fails(sketch('  arm.spin(3);', 'Servo arm;'), /has no "\.spin\(\)"/);
  await fails(sketch('  arm.attach();', 'Servo arm;'), /needs 1 value/);
  await fails(sketch('', 'Servo arm = 3;'), /is made with "Servo arm;"/);
  await fails(sketch('  Adafruit_NeoPixel strip(8, 6);'), /"Adafruit_NeoPixel" is not a type this simulator knows.*Servo, LiquidCrystal_I2C and, on the ESP32, WebServer/, 4);
  await fails('Adafruit_NeoPixel strip(8, 6);\nvoid setup() {}\nvoid loop() {}', /"Adafruit_NeoPixel" is not a type/, 1);
  await fails(sketch('  servo arm;'), /"servo" is not a type.*capital letters/);
});

/* --- the servo on the bench --- */
const barrier = MISSIONS.uno.find(m => m.id === 'barrier')!;

test('a servo needs three columns, and on the ESP32 it must sit in the free holes', () => {
  assert.match(placementError('uno', [], makeItem({ kind: 'servo' }, [], 'g29'))!, /three columns/);
  assert.equal(placementError('uno', [], makeItem({ kind: 'servo' }, [], 'g28')), null);
  assert.match(placementError('esp32', [], makeItem({ kind: 'servo' }, [], 'g10'))!, /under the ESP32/);
  assert.equal(placementError('esp32', [], makeItem({ kind: 'servo' }, [], 'g22')), null);
});

test('the circuit check explains a servo with no ground, too little power, power from a pin, or no signal', () => {
  const issue = (items: Item[]) => analyze('uno', items).issues.find(i => i.part === 'servo');
  const swap = (f: (it: Item) => Item | null) => barrier.circuit.flatMap(it => f(it) ?? []);
  assert.equal(issue(barrier.circuit), undefined, 'the reference build is fine');
  assert.equal(issue(swap(it => (it.t === 'wire' && it.a === 'a16' ? null : it)))?.title, 'Servo has no ground');
  assert.match(issue(swap(it => (it.t === 'wire' && it.a === 'U:5V' ? { ...it, a: 'U:3V3' } : it)))!.plain, /only gets 3\.3 V/);
  assert.match(issue(swap(it => (it.t === 'wire' && it.a === 'a17' ? { ...it, b: 'U:8' } : it)))!.plain, /wired to a pin/);
  assert.equal(issue(swap(it => (it.t === 'wire' && it.a === 'a18' ? null : it)))?.title, 'Servo signal is not connected');
});

test('the servo points where the sketch says only while it has power and a signal', async () => {
  const code = 'Servo s;\nvoid setup() { s.attach(9); s.write(140); }\nvoid loop() { delay(100); }';
  const powered = await observe('uno', barrier.circuit, code, [], 500);
  assert.equal(servoAt(powered.at(400)), 140);
  const weak = await observe('uno', barrier.circuit.map(it => (it.t === 'wire' && it.a === 'U:5V' ? { ...it, a: 'U:3V3' } : it)), code, [], 500);
  assert.equal(servoAt(weak.at(400)), -1, 'a servo on 3.3 V cannot turn');
  const elsewhere = await observe('uno', barrier.circuit, code.replace('attach(9)', 'attach(10)'), [], 500);
  assert.equal(servoAt(elsewhere.at(400)), -1, 'the pulses go to a pin the servo is not on');
});

test('the servo is recorded in the timeline, so looking back shows where it pointed', async () => {
  const code = 'Servo s;\nvoid setup() { s.attach(9); }\nvoid loop() { s.write(0); delay(200); s.write(180); delay(200); }';
  const tr = await observe('uno', barrier.circuit, code, [], 1000);
  const angles = new Set(tr.samples.map(servoAt));
  assert.ok(angles.has(0) && angles.has(180), `saw ${[...angles].join(', ')}`);
});

/* --- typing to the board: Serial input, char and String --- */
/** Runs a sketch on the virtual clock with this already typed into the Serial Monitor, for some passes of loop(). Timeouts cost no real time. */
async function typed(code: string, input: string, loops = 1) {
  let serial = '', pass = 0;
  const hw = makeHW(BOARDS.uno, [], () => ({}), s => { serial += s; }, { virtualClock: true });
  hw.skipDelays = true;
  for (const ch of input) hw.serialIn.push(ch.charCodeAt(0));
  const ctl = { stop: false, onLoop() { if (++pass >= loops) ctl.stop = true; } };
  await run(code, hw, ctl);
  return { serial, left: hw.serialIn.length, ms: hw.elapsed() };
}

test('Serial.available(), peek() and read() take what was typed one character at a time', async () => {
  const r = await typed(sketch(`  Serial.println(Serial.available());
  Serial.println(Serial.peek());
  char c = Serial.read();
  Serial.println(c);
  Serial.println(Serial.read());
  Serial.println(Serial.available());`), 'hi\n');
  assert.equal(r.serial, '3\n104\nh\n105\n1\n', 'peek looks without taking; a char prints as a letter, an int as a number');
  assert.equal((await typed(sketch('  Serial.println(Serial.read());'), '')).serial, '-1\n', 'nothing typed');
});

test('readStringUntil() reads a line without its newline, and trim() and the comparisons find the command', async () => {
  const r = await typed(sketch(`  String command = Serial.readStringUntil('\\n');
  Serial.println("[" + command + "]");
  command.trim();
  Serial.println("[" + command + "]");
  if (command == "On") Serial.println("same");
  if (command.equalsIgnoreCase("on")) Serial.println("same, any case");
  command.toUpperCase();
  Serial.println(command);`), '  On \n');
  assert.equal(r.serial, '[  On ]\n[On]\nsame\nsame, any case\nON\n');
  assert.equal(r.left, 0, 'the newline was taken too');
});

test('parseInt() leaves the newline behind, so the next call waits a second and gives 0, as on a real board', async () => {
  const code = 'void setup() { Serial.begin(9600); }\nvoid loop() { if (Serial.available() > 0) { int n = Serial.parseInt(); Serial.println(n * 2); } }';
  const r = await typed(code, '21\n', 3);
  assert.equal(r.serial, '42\n0\n');
  assert.ok(r.ms >= 1000, `the second parseInt() waited for its timeout (${Math.round(r.ms)} ms)`);
  assert.equal((await typed(sketch('  Serial.println(Serial.parseFloat());'), 'x -3.75\n')).serial, '-3.75\n', 'parseFloat skips what cannot start a number');
});

test('readString() waits for the timeout after the last character, and setTimeout() changes it', async () => {
  const slow = await typed(sketch('  Serial.println(Serial.readString());'), 'abc');
  assert.equal(slow.serial, 'abc\n');
  assert.ok(slow.ms >= 1000, `waited ${Math.round(slow.ms)} ms`);
  const quick = await typed(sketch('  Serial.setTimeout(50);\n  Serial.println(Serial.readString());'), 'abc');
  assert.ok(quick.ms < 200, `waited ${Math.round(quick.ms)} ms`);
});

test('a char prints as a character, an unsigned char or a byte as a number', async () => {
  const r = await typed(sketch(`  char c = 'A' + 1;
  unsigned char u = 66;
  byte b = 67;
  String s = "x";
  s += c;
  Serial.println(c);
  Serial.println(u);
  Serial.println(b);
  Serial.println(s);
  Serial.println((char)72);
  Serial.println(s[1]);
  Serial.println(s.charAt(0));`), '');
  assert.equal(r.serial, 'B\n66\n67\nxB\nH\nB\nx\n');
});

test('the String methods for picking a command apart', async () => {
  const r = await typed(sketch(`  String line = "led=on";
  int eq = line.indexOf('=');
  Serial.println(eq);
  Serial.println(line.substring(0, eq));
  Serial.println(line.substring(eq + 1));
  Serial.println(line.startsWith("led"));
  Serial.println(line.endsWith("off"));
  Serial.println(line.indexOf("x"));`), '');
  assert.equal(r.serial, '3\nled\non\n1\n0\n-1\n');
});

test('trim() used as a value says that it changes the String itself', async () => {
  await fails(sketch('  String s = " a ";\n  s = s.trim();'), /changes the String itself and gives nothing back/, 5);
  await fails(sketch('  String s = "a";\n  s.reverse();'), /A String has no "\.reverse\(\)"/);
});
