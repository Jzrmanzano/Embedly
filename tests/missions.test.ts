/* Every mission: the structure holds together, the intended solution passes its checks, and wrong solutions do not. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_PARTS, isAvailable, lockedBy, missionKey, MISSIONS, partIdOf, PARTS, STUDIO_PARTS, trayParts, unlockedParts, type Mission } from '../src/data/missions';
import { observe, runChecks } from '../src/sim/check';
import type { BoardId, Item } from '../src/types';

const BOARD_IDS: BoardId[] = ['uno', 'esp32'];
const all = BOARD_IDS.flatMap(board => MISSIONS[board].map(m => ({ board, m })));
const get = (board: BoardId, id: string): Mission => {
  const m = MISSIONS[board].find(x => x.id === id);
  assert.ok(m, `${board}/${id} exists`);
  return m;
};
/** Runs a check over every case, and fails once at the end with every case that broke, named. */
const forEvery = async <T>(cases: T[], name: (c: T) => string, check: (c: T) => Promise<void> | void) => {
  const problems: string[] = [];
  for (const c of cases) {
    try { await check(c); } catch (e) { problems.push(`${name(c)}: ${(e as Error).message.split('\n')[0]}`); }
  }
  assert.deepEqual(problems, []);
};
const failures = (r: { label: string; pass: boolean; detail: string }[]) => r.filter(x => !x.pass).map(x => `${x.label}: ${x.detail}`);

test('every mission is complete and refers only to missions that come before it', () => {
  for (const board of BOARD_IDS) {
    const seen = new Set<string>();
    for (const m of MISSIONS[board]) {
      const where = `${board}/${m.id}`;
      assert.ok(!seen.has(m.id), `${where} has a unique id`);
      assert.ok(m.title && m.place && m.hook && m.story && m.goal, `${where} has its texts`);
      assert.equal(m.hints.length, 3, `${where} has a nudge, an idea and an answer`);
      assert.ok(m.hints.every(h => h.length > 20), `${where} hints say something`);
      assert.ok(m.map[0] >= 0 && m.map[0] <= 100 && m.map[1] >= 0 && m.map[1] <= 100, `${where} is on the map`);
      for (const a of m.after) assert.ok(seen.has(a), `${where} comes after ${a}, which exists earlier in the list`);
      if (m.sandbox) assert.equal(m.checks.length, 0, `${where} is free build, so it has no checks`);
      else if (m.choice) {
        assert.equal(m.checks.length, 0, `${where} is answered on the supply shelf, so it has no checks to run`);
        assert.ok(m.choice.needs.length >= 2, `${where} has needs to weigh`);
        assert.deepEqual(m.unlocks, [], `${where} unlocks no parts, so it never stands in the way of a build`);
      } else {
        assert.ok(m.checks.length >= 2, `${where} has checks`);
        if (m.repair) assert.equal(m.predict, undefined, `${where} is a repair job, which has nothing to predict: the student runs the broken build and sees`);
        else {
          assert.ok(m.predict, `${where} asks for a prediction`);
          assert.ok(m.predict!.options.some(o => o.id === m.predict!.works), `${where} names the option that means it works`);
        }
      }
      seen.add(m.id);
    }
  }
});

test('the parts every mission needs are unlocked by the missions before it', () => {
  for (const board of BOARD_IDS) {
    const byId = new Map(MISSIONS[board].map(m => [m.id, m]));
    for (const m of MISSIONS[board]) {
      if (m.sandbox) continue;
      const before = new Set<string>(), walk = (id: string) => { if (before.has(id)) return; before.add(id); byId.get(id)!.after.forEach(walk); };
      m.after.forEach(walk);
      const have = unlockedParts([...before].map(id => missionKey(board, id)));
      for (const it of m.circuit) {
        const part = partIdOf(it);
        assert.ok(have.has(part), `${board}/${m.id} uses ${part}, which nothing before it unlocks`);
      }
    }
  }
});

test('passing missions unlocks their parts, one mission at a time', () => {
  assert.deepEqual([...unlockedParts([])].sort(), [...BASE_PARTS].sort());
  const after = unlockedParts([missionKey('uno', 'beacon')]);
  for (const p of get('uno', 'beacon').unlocks) assert.ok(after.has(p));
  assert.ok(after.size > BASE_PARTS.length);
  assert.equal(lockedBy('knob')?.mission.id, 'beacon');
  assert.equal(lockedBy('wire'), null, 'a part that starts unlocked is not locked by anything');
  for (const id of Object.keys(PARTS)) assert.ok(BASE_PARTS.includes(id as never) || STUDIO_PARTS.includes(id as never) || lockedBy(id as never), `${id} is unlocked by some mission, or is one only the studio has`);
});

test('a mission opens when the ones before it are passed', () => {
  const nothing = new Set<string>();
  assert.equal(isAvailable('uno', get('uno', 'tour'), nothing), true);
  assert.equal(isAvailable('uno', get('uno', 'beacon'), nothing), true);
  assert.equal(isAvailable('uno', get('uno', 'nightlight'), nothing), false);
  assert.equal(isAvailable('uno', get('uno', 'nightlight'), new Set([missionKey('uno', 'beacon')])), true);
  assert.equal(isAvailable('esp32', get('esp32', 'touchlamp'), new Set([missionKey('uno', 'beacon')])), false, 'progress on one board does not open the other');
});

test('the studio is open from the start with every part, and the missions still lock theirs', () => {
  for (const board of BOARD_IDS) {
    const studio = MISSIONS[board].filter(m => m.sandbox);
    assert.equal(studio.length, 1, `${board} has one studio`);
    assert.equal(isAvailable(board, studio[0], new Set()), true, `${board}: the studio needs no mission passed`);
    assert.deepEqual([...trayParts(studio[0], [])].sort(), Object.keys(PARTS).sort(), `${board}: the studio has every part before anything is passed`);
    for (const m of MISSIONS[board].filter(x => !x.sandbox)) {
      assert.deepEqual([...trayParts(m, [])].sort(), [...BASE_PARTS].sort(), `${board}/${m.id} starts with only the base parts`);
      const passed = [missionKey(board, 'beacon')];
      assert.deepEqual([...trayParts(m, passed)].sort(), [...unlockedParts(passed)].sort(), `${board}/${m.id} has what the passed missions unlocked`);
    }
  }
});

const graded = all.filter(x => !x.m.sandbox && !x.m.choice);
const label = (x: { board: BoardId; m: Mission }) => `${x.board}/${x.m.id}`;

test('every mission: the intended build and sketch pass every check', () => forEvery(graded, label, async ({ board, m }) => {
  const r = await runChecks(board, m.circuit, m.answer, m.checks);
  assert.deepEqual(failures(r), [], `${r.length} results`);
  assert.ok(r.length >= 3, 'a wiring check and at least two others');
}));

test('every mission: the starter sketch is not enough', () => forEvery(graded, label, async ({ board, m }) => {
  const r = await runChecks(board, m.circuit, m.starter, m.checks);
  assert.ok(failures(r).length > 0, 'the starter sketch passes everything, so the student has nothing to do');
}));

test('every mission: an empty bench fails politely', () => forEvery(graded.filter(x => x.m.circuit.length > 0), label, async ({ board, m }) => {   // the tour needs no wiring
  const r = await runChecks(board, [], m.answer, m.checks);
  assert.ok(failures(r).length > 0);
}));

test('every mission: the prediction question tells a working build from a broken one', () => forEvery(graded.filter(x => x.m.predict), label, async ({ board, m }) => {   // a repair job has none
  const p = m.predict!;
  const good = await observe(board, m.circuit, m.answer, p.demo, p.run);
  assert.equal(p.classify(good), p.works, 'the intended build is classified as working');
  const broken = await observe(board, m.circuit, m.starter, p.demo, p.run);
  assert.notEqual(p.classify(broken), p.works, 'the starter sketch is not classified as working');
  assert.ok(p.options.some(o => o.id === p.classify(broken)), 'every outcome has an option the student could have picked');
}));

/* --- wrong solutions that look plausible --- */
const mutate = (code: string, from: string, to: string) => {
  assert.ok(code.includes(from), `the answer contains "${from}"`);
  return code.split(from).join(to);
};
const wrong: [BoardId, string, string, string, string][] = [
  ['uno', 'beacon', 'delay(1000)', 'delay(20)', 'blinks too fast'],
  ['uno', 'nightlight', 'light < 300', 'light > 300', 'works backwards'],
  ['uno', 'lamp', 'analogWrite(LAMP_PIN, brightness);', 'digitalWrite(LAMP_PIN, brightness > 127);', 'only on or off'],
  ['uno', 'chime', 'digitalRead(BUTTON_PIN) == LOW', '1 == 1', 'chimes without being pressed'],
  ['uno', 'parking', 'distance < 20', 'distance > 20', 'lights when far'],
  ['uno', 'greenhouse', 'tone(BUZZER_PIN, 440);', '', 'no sound'],
  ['esp32', 'beacon', 'digitalWrite(LED_PIN, LOW);', '', 'never turns off'],
  ['esp32', 'touchlamp', 'value < THRESHOLD', 'value > THRESHOLD', 'works backwards'],
  ['esp32', 'toggle', 'ledOn = !ledOn;', 'ledOn = true;', 'never turns off again'],
  ['esp32', 'siren', 'tone(BUZZER_PIN, f);', 'tone(BUZZER_PIN, 600);', 'one steady note'],
  ['esp32', 'nightlight', 'light < 1200', 'light > 1200', 'works backwards'],
  ['uno', 'crossing', 'now - lastChange >= 500', 'now - lastChange >= 40', 'flickers the warning light too fast'],
  ['uno', 'crossing', 'digitalRead(BUTTON_PIN) == LOW', 'digitalRead(BUTTON_PIN) == HIGH', 'lights the walk light when nobody presses'],
  ['uno', 'barrier', 'delay(3000);', 'delay(300);', 'drops the arm before the bus is through'],
  ['uno', 'barrier', 'barrier.write(0);    // and down again', '', 'never lowers the arm'],
  ['uno', 'barrier', 'barrier.write(90);', 'barrier.write(180);', 'lifts the arm too far'],
  ['esp32', 'weather', 'map(wind, 0, 4095, 0, 180)', 'map(wind, 0, 4095, 180, 0)', 'points backwards'],
  ['esp32', 'weather', 'map(wind, 0, 4095, 0, 180)', 'map(wind, 0, 1023, 0, 180)', 'uses the Uno\'s 0 to 1023 range'],
  ['uno', 'streetlamp', 'light < DARK_BELOW', 'light > DARK_BELOW', 'works backwards'],
  ['uno', 'streetlamp', 'else if (light > BRIGHT_ABOVE)', 'else if (light > DARK_BELOW)', 'uses one limit, so it flickers at dusk'],
  ['uno', 'heatwarn', '(volts - 0.5) * 100.0', 'volts * 100.0', 'forgets the sensor\'s 0.5 V offset'],
  ['uno', 'heatwarn', 'raw * 5.0 / 1023.0', 'raw * 5 / 1023', 'does the sum in whole numbers'],
  ['uno', 'heatwarn', 'celsius > 30', 'celsius < 30', 'warns when it is cool'],
  ['esp32', 'fridge', 'raw * 3.3 / 4095.0', 'raw * 5.0 / 1023.0', 'uses the Uno\'s numbers'],
  ['esp32', 'fridge', 'celsius > 8', 'celsius > 30', 'waits until the fridge is far too warm'],
];

test('uno/crossing: a sketch that still blinks with delay() misses taps', async () => {
  const m = get('uno', 'crossing'), r = await runChecks('uno', m.circuit, m.starter, m.checks);
  assert.deepEqual(failures(r).map(f => f.split(':')[0]), ['The walk light answers every tap at once'], 'only the tap check fails: the blink itself is fine');
});
test('a sketch with any of the plausible mistakes does not pass', () => forEvery(wrong, ([board, id, , , why]) => `${board}/${id} ${why}`, async ([board, id, from, to, why]) => {
  const m = get(board, id), r = await runChecks(board, m.circuit, mutate(m.answer, from, to), m.checks);
  assert.ok(failures(r).length > 0, `passed, but the sketch ${why}`);
}));

/* --- wrong wiring --- */
const rewire = (items: Item[], f: (it: Item) => Item | null) => items.flatMap(it => f(it) ?? []);
const wrongWiring: [BoardId, string, string, (it: Item) => Item | null][] = [
  ['uno', 'beacon', 'has no resistor', it => (it.t === 'res' ? { t: 'wire', a: it.a, b: it.b, c: 'white' } : it)],
  ['uno', 'beacon', 'has the LED in backwards', it => (it.t === 'led' ? { ...it, a: it.k, k: it.a } : it)],
  ['uno', 'parking', 'has the sensor unpowered', it => (it.t === 'wire' && it.a === 'f18' ? null : it)],
  ['uno', 'chime', 'has the buzzer on the wrong pin', it => (it.t === 'wire' && it.a === 'U:8' ? { ...it, a: 'U:7' } : it)],
  ['esp32', 'touchlamp', 'has the pad unwired', it => (it.t === 'wire' && it.b === 'PAD' ? null : it)],
  ['uno', 'barrier', 'powers the servo from 3.3 V', it => (it.t === 'wire' && it.a === 'U:5V' ? { ...it, a: 'U:3V3' } : it)],
  ['uno', 'barrier', 'powers the servo from a pin', it => (it.t === 'wire' && it.a === 'j25' ? { ...it, b: 'U:8' } : it)],
  ['uno', 'barrier', 'has the servo signal on the wrong pin', it => (it.t === 'wire' && it.b === 'U:9' ? { ...it, b: 'U:10' } : it)],
  ['uno', 'crossing', 'has the red and green LEDs swapped', it => (it.t === 'led' ? { ...it, color: it.color === 0xff3b30 ? 0x2ecc40 : 0xff3b30 } : it)],
  ['esp32', 'weather', 'powers the servo from 3V3', it => (it.t === 'wire' && it.a === 'E:VIN' ? { ...it, a: 'E:3V3' } : it)],
  ['uno', 'streetlamp', 'has no 10 kΩ resistor in the divider', it => (it.t === 'res' && it.ohms === 10000 ? null : it)],
  ['uno', 'streetlamp', 'has the sensor on the wrong pin', it => (it.t === 'wire' && it.b === 'U:A0' ? { ...it, b: 'U:A1' } : it)],
  ['uno', 'heatwarn', 'has the temperature sensor backwards', it => (it.t === 'wire' && (it.a === 'a24' || it.a === 'a26') ? { ...it, a: it.a === 'a24' ? 'a26' : 'a24' } : it)],
  ['uno', 'heatwarn', 'has the sensor without power', it => (it.t === 'wire' && it.a === 'a24' ? null : it)],
  ['esp32', 'fridge', 'has the sensor without power', it => (it.t === 'wire' && it.a === 'j28' ? null : it)],
];
test('a bench with any of the plausible wiring mistakes does not pass', () => forEvery(wrongWiring, ([board, id, why]) => `${board}/${id} ${why}`, async ([board, id, why, f]) => {
  const m = get(board, id), r = await runChecks(board, rewire(m.circuit, f), m.answer, m.checks);
  assert.ok(failures(r).length > 0, `passed, but the bench ${why}`);
}));

test('the same sketch passes on a bench built with different pins when the code matches', async () => {
  const m = get('uno', 'beacon');
  const moved = rewire(m.circuit, it => (it.t === 'wire' && it.a === 'U:13' ? { ...it, a: 'U:12' } : it));
  const r = await runChecks('uno', moved, mutate(m.answer, 'LED_PIN = 13', 'LED_PIN = 12'), m.checks);
  assert.deepEqual(failures(r), [], 'any pin will do, as long as the wire and the sketch agree');
  const mismatch = await runChecks('uno', moved, m.answer, m.checks);
  assert.ok(failures(mismatch).length > 0, 'the wire is on pin 12 but the sketch uses pin 13');
});

/* --- repair jobs --- */
const repairs = all.filter(x => x.m.repair);
test('there are repair jobs on both boards', () => {
  for (const board of BOARD_IDS) assert.ok(repairs.some(r => r.board === board), `${board} has a repair job`);
});
test('every repair job starts on a faulty bench that is not the reference build', () => {
  for (const { board, m } of repairs) {
    assert.ok(m.start && m.start.length > 0, `${board}/${m.id} starts with a bench`);
    assert.notDeepEqual(m.start, m.circuit, `${board}/${m.id}: the bench has a fault in it`);
  }
});
test('every repair job fails with either half of the fault left in', () => forEvery(repairs, label, async ({ board, m }) => {
  const bench = await runChecks(board, m.start!, m.answer, m.checks);
  assert.ok(failures(bench).length > 0, 'the bench alone is enough to pass, so there is no wiring fault to find');
  const sketch = await runChecks(board, m.circuit, m.starter, m.checks);
  assert.ok(failures(sketch).length > 0, 'the sketch alone is enough to pass, so there is no code fault to find');
}));
