/* The 16×2 LCD on its I2C backpack: what the display does with each command, the wiring it needs, a sketch driving it through
   LiquidCrystal_I2C, and the check engine and timeline seeing what it shows. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS } from '../src/data/boards';
import { observe, phases, runChecks } from '../src/sim/check';
import { analyze } from '../src/sim/circuit';
import { makeHW, makeReadout } from '../src/sim/hardware';
import { run, SimError } from '../src/sim/interpreter';
import { applyLcd, freshLcd, glyph, lcdView } from '../src/sim/lcd';
import { layoutSchematic } from '../src/sim/schematic';
import { allTerminals, placementError } from '../src/state/bench';
import type { BoardId, Item } from '../src/types';

const wire = (a: string, b: string): Item => ({ t: 'wire', a, b, c: 'green' });
const UNO: Item[] = [{ t: 'lcd', id: 'lcd' }, wire('LCD:GND', 'U:GND'), wire('LCD:VCC', 'U:5V'), wire('LCD:SDA', 'U:A4'), wire('LCD:SCL', 'U:A5')];
const ESP: Item[] = [{ t: 'lcd', id: 'lcd' }, wire('LCD:GND', 'E:GND'), wire('LCD:VCC', 'E:VIN'), wire('LCD:SDA', 'E:D21'), wire('LCD:SCL', 'E:D22')];
const titles = (board: BoardId, items: Item[]) => analyze(board, items).issues.map(i => i.title);
const swap = (items: Item[], f: (it: Item) => Item | null) => items.flatMap(it => f(it) ?? []);

const HELLO = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("Hello!");
  lcd.setCursor(3, 1);
  lcd.print(42);
}

void loop() {
  delay(100);
}`;
/** Runs a sketch on the virtual clock for some passes of loop(), and gives what the LCD shows at the end. */
async function shows(code: string, items: Item[] = UNO, board: BoardId = 'uno', loops = 1) {
  const hw = makeHW(BOARDS[board], items, () => ({}), () => {}, { virtualClock: true });
  hw.skipDelays = true;
  let pass = 0;
  const ctl = { stop: false, onLoop() { if (++pass >= loops) ctl.stop = true; } };
  await run(code, hw, ctl);
  return hw.readout().lcd('lcd');
}
const fails = async (code: string, pattern: RegExp) =>
  assert.rejects(shows(code), (e: unknown) => { assert.ok(e instanceof SimError); assert.match(e.message, pattern); return true; });

/* --- the display itself --- */
test('a display just powered up shows a row of blocks with its backlight on, and init() clears it and switches the light off', () => {
  const s = freshLcd();
  assert.deepEqual(lcdView(s, true).lines, ['█'.repeat(16), ' '.repeat(16)]);
  assert.equal(lcdView(s, true).light, true);
  applyLcd(s, 'write', [65]);
  assert.equal(lcdView(s, true).blocks, true, 'text before init() goes nowhere');
  applyLcd(s, 'init', [0]);
  assert.deepEqual([lcdView(s, true).blocks, lcdView(s, true).light, lcdView(s, true).lines[0].trim()], [false, false, '']);
  applyLcd(s, 'init', [1]);
  assert.equal(lcdView(s, true).light, true, 'backlight() before init() keeps the light on');
  assert.deepEqual(lcdView(s, false), { powered: false, light: false, blocks: false, lines: [' '.repeat(16), ' '.repeat(16)], cursor: null }, 'no power, nothing shows');
});

test('characters go where the cursor is, and past the 40th of a line carry on at the start of the other line', () => {
  const s = freshLcd(), codes = (t: string) => Array.from(t, c => c.charCodeAt(0));
  applyLcd(s, 'init', [1]);
  applyLcd(s, 'write', codes('Hi'));
  applyLcd(s, 'cursor', [14, 1]);
  applyLcd(s, 'write', codes('OK!'));
  assert.deepEqual(lcdView(s, true).lines, ['Hi              ', '              OK'], 'the "!" is in column 16, off the screen');
  applyLcd(s, 'cursor', [39, 0]);
  applyLcd(s, 'write', codes('xy'));
  assert.equal(lcdView(s, true).lines[1][0], 'y');
  applyLcd(s, 'scrollLeft');
  assert.equal(lcdView(s, true).lines[0].slice(0, 2), 'i ', 'the window has moved one to the left');
  applyLcd(s, 'noDisplay');
  assert.equal(lcdView(s, true).lines[0].trim(), '', 'hidden, but kept');
  applyLcd(s, 'display'); applyLcd(s, 'clear');
  assert.deepEqual(lcdView(s, true).lines.map(l => l.trim()), ['', '']);
  applyLcd(s, 'showCursor'); applyLcd(s, 'blink');
  assert.deepEqual(lcdView(s, true).cursor, { row: 0, col: 0, blink: true });
});

test('the display\'s own character set: ASCII, a yen sign for the backslash, the degree sign at 223, and junk for what it lacks', () => {
  assert.deepEqual(['A', 'z', '~', '\\', '°', '\r', '\n'].map(c => glyph(c.charCodeAt(0))), ['A', 'z', '→', '¥', '▒', '▒', '▒']);
  assert.equal(glyph(223), '°');
});

/* --- wiring it --- */
test('the LCD wired to 5V, GND, SDA and SCL has nothing to fix on either board, and its pins are places on the bench', () => {
  assert.deepEqual(titles('uno', UNO), []);
  assert.deepEqual(titles('esp32', ESP), []);
  assert.deepEqual(analyze('uno', UNO).lcdBus('lcd'), { powered: true, wired: true });
  assert.deepEqual(analyze('esp32', ESP).lcdBus('lcd'), { powered: true, wired: true });
  const byAref = swap(UNO, it => (it.t === 'wire' && it.b === 'U:A4' ? { ...it, b: 'U:SDA' } : it.t === 'wire' && it.b === 'U:A5' ? { ...it, b: 'U:SCL' } : it));
  assert.deepEqual(titles('uno', byAref), [], 'the SDA and SCL pins by AREF are A4 and A5');
  assert.ok(allTerminals('uno', UNO).includes('LCD:SDA') && !allTerminals('uno', []).includes('LCD:SDA'), 'the pins exist while an LCD is on the bench');
  assert.equal(placementError('uno', UNO, { t: 'lcd', id: 'lcd2' }), 'There is only one LCD display.');
});

test('the circuit check says what an LCD is missing', () => {
  const no = (point: string) => titles('uno', UNO.filter(it => !(it.t === 'wire' && it.a === point)));
  assert.deepEqual(no('LCD:GND'), ['LCD has no ground']);
  assert.deepEqual(no('LCD:VCC'), ['LCD has no power']);
  assert.deepEqual(no('LCD:SDA'), ['LCD\'s SDA is not on the I2C pin']);
  assert.deepEqual(no('LCD:SCL'), ['LCD\'s SCL is not on the I2C pin']);
  const weak = analyze('esp32', swap(ESP, it => (it.t === 'wire' && it.b === 'E:VIN' ? { ...it, b: 'E:3V3' } : it))).issues;
  assert.match(weak[0].plain, /needs 5 V but its VCC pin only gets 3.3 V.*VIN/);
  const crossed = swap(UNO, it => (it.t === 'wire' && it.b === 'U:A4' ? { ...it, b: 'U:A5' } : it.t === 'wire' && it.b === 'U:A5' ? { ...it, b: 'U:A4' } : it));
  assert.deepEqual(titles('uno', crossed), ['LCD\'s SDA and SCL are swapped']);
  const backwards = swap(UNO, it => (it.t === 'wire' && it.a === 'LCD:GND' ? { ...it, b: 'U:5V' } : it.t === 'wire' && it.a === 'LCD:VCC' ? { ...it, b: 'U:GND' } : it));
  assert.deepEqual(titles('uno', backwards), ['LCD is wired backwards']);
  assert.deepEqual(layoutSchematic('uno', UNO).boxes.find(b => b.kind === 'box')!.pins.map(p => p.name), ['GND', 'VCC', 'SDA', 'SCL']);
});

/* --- a sketch driving it --- */
test('a sketch prints on the LCD through LiquidCrystal_I2C, on the Uno and on the ESP32', async () => {
  const uno = await shows(HELLO);
  assert.deepEqual([uno.light, uno.lines], [true, ['Hello!          ', '   42           ']]);
  assert.deepEqual((await shows(HELLO, ESP, 'esp32')).lines, uno.lines);
});

test('the classic LCD mistakes look as they do on a real display', async () => {
  const blocks = await shows(HELLO.replace('0x27', '0x3F'));
  assert.deepEqual([blocks.blocks, blocks.light], [true, true], 'the wrong address: power, but only a row of blocks');
  const crossed = swap(UNO, it => (it.t === 'wire' && it.b === 'U:A4' ? { ...it, b: 'U:A5' } : it.t === 'wire' && it.b === 'U:A5' ? { ...it, b: 'U:A4' } : it));
  assert.equal((await shows(HELLO, crossed)).blocks, true, 'SDA and SCL swapped: the sketch never reaches it');
  const dark = await shows(HELLO.replace('  lcd.backlight();\n', ''));
  assert.deepEqual([dark.light, dark.lines[0].trim()], [false, 'Hello!'], 'no backlight(): the text is there, in the dark');
  assert.equal((await shows(HELLO.replace('lcd.print("Hello!");', 'lcd.println("Hi");'))).lines[0].slice(0, 4), 'Hi▒▒', 'println() leaves two junk characters');
  assert.equal((await shows(HELLO.replace('lcd.print("Hello!");', 'lcd.print(21.5); lcd.print((char)223); lcd.print("C");'))).lines[0].trim(), '21.50°C');
  assert.equal((await shows(HELLO.replace('lcd.print("Hello!");', 'lcd.print("21°C");'))).lines[0].trim(), '21▒C', 'a ° typed into the sketch is not in the display\'s character set');
  const unpowered = await shows(HELLO, UNO.filter(it => !(it.t === 'wire' && it.a === 'LCD:VCC')));
  assert.equal(unpowered.powered, false);
});

test('the sketch is told plainly when it writes an LCD the simulator does not have, or makes one wrongly', async () => {
  await fails('#include <LiquidCrystal.h>\nLiquidCrystal lcd(12, 11, 5, 4, 3, 2);\nvoid setup() {}\nvoid loop() {}', /I2C display.*LiquidCrystal_I2C lcd\(0x27, 16, 2\)/);
  await fails('LiquidCrystal_I2C lcd;\nvoid setup() {}\nvoid loop() {}', /needs the display's address, columns and rows/);
  await fails(HELLO.replace('lcd.print(42);', 'lcd.printf("%d", 42);'), /has no "\.printf\(\)".*setCursor\(\)/);
});

/* --- checks and the timeline --- */
test('a check can read what the LCD shows, and the timeline remembers it', async () => {
  const code = HELLO.replace('void loop() {\n  delay(100);\n}', 'int n = 0;\nvoid loop() {\n  lcd.setCursor(0, 1);\n  lcd.print(n);\n  n = n + 1;\n  delay(500);\n}').replace('  lcd.setCursor(3, 1);\n  lcd.print(42);\n', '');
  const tr = await observe('uno', UNO, code, [], 1800);
  assert.equal(tr.lcdCount, 1);
  assert.match(tr.at(1700).lcd, /^Hello! {10}\n3 {15}$/);
  assert.match(tr.at(200).lcd, /\n0/);
  const [result] = (await runChecks('uno', UNO, code, [phases('The count shows', [{ when: 'it has run a while', ms: 1800, expect: { lcd: /Hello!\s*\n3/ } }])], { wiring: false }));
  assert.equal(result.pass, true, result.detail);
  const [wrong] = await runChecks('uno', UNO, code, [phases('The count shows', [{ when: 'it has run a while', ms: 1800, expect: { lcd: /Goodbye/ } }])], { wiring: false });
  assert.match(wrong.detail, /the LCD should show something like \/Goodbye\/, but it showed "Hello! \/ 3"/);
  const hw = makeHW(BOARDS.uno, UNO, () => ({}), () => {}, { virtualClock: true });
  hw.skipDelays = true;
  const frames: ReturnType<typeof hw.snapshot>[] = [];
  let pass = 0;
  const ctl = { stop: false, onLoop() { frames.push(hw.snapshot()); if (++pass >= 3) ctl.stop = true; } };
  await run(code, hw, ctl);
  assert.equal(makeReadout(BOARDS.uno, hw.analysis, frames[0]).lcd('lcd').lines[1].trim(), '0', 'looking back at the first pass shows the 0 it printed then');
  assert.equal(makeReadout(BOARDS.uno, hw.analysis, frames[2]).lcd('lcd').lines[1].trim(), '2');
});
