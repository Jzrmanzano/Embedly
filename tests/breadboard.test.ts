/* The second breadboard from the tray: short or long, to the right of the bench's own, its columns numbered on from 31 and its rails its own. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partIdOf, PARTS } from '../src/data/missions';
import { wiringRows } from '../src/data/wiring';
import { analyze, type Drive } from '../src/sim/circuit';
import { layoutSchematic } from '../src/sim/schematic';
import { allTerminals, homedBreadboard, makeItem, movedBreadboard, parseTerminal, placementError, resizedBreadboard, withoutBreadboard } from '../src/state/bench';
import { isItem } from '../src/state/progress';
import { BB_DEPTH, bbLength, fits, HOME, isHome, placeOf, REACH, slide, type Place } from '../src/state/table';
import { collisions } from '../src/state/table';
import { extraColumns, onExtraBoard, type BreadboardSize, type Item } from '../src/types';

const HIGH: Drive = { mode: 'out', level: 1 };
const board = (size: BreadboardSize): Extract<Item, { t: 'breadboard' }> => ({ t: 'breadboard', id: 'breadboard1', size });
const wire = (a: string, b: string): Item => ({ t: 'wire', a, b, c: 'green' });
const holes = (items: Item[]) => allTerminals('uno', items).filter(p => /^[a-j]\d+$/.test(p));

test('the tray places a second breadboard of the size picked, and it is the breadboard part', () => {
  for (const size of ['short', 'long'] as const) {
    const it = makeItem({ ...PARTS.breadboard.tool, size }, [], 'BB');
    assert.deepEqual(it, board(size));
    assert.equal(partIdOf(it), 'breadboard');
  }
  assert.deepEqual(makeItem({ kind: 'breadboard' }, [], 'BB'), board('short'), 'short unless asked');
});

test('its columns carry on from the first breadboard: 31 to 60 when short, 31 to 93 when long', () => {
  assert.equal(extraColumns([]), null);
  assert.equal(holes([]).length, 30 * 10);
  assert.ok(!allTerminals('uno', []).includes('a31') && !allTerminals('uno', []).includes('T+31'));
  assert.deepEqual(extraColumns([board('short')]), [31, 60]);
  assert.deepEqual(extraColumns([board('long')]), [31, 93]);
  assert.equal(holes([board('short')]).length, 60 * 10);
  assert.equal(holes([board('long')]).length, 93 * 10);
  for (const p of ['a31', 'j60', 'T+31', 'B-60']) assert.ok(allTerminals('uno', [board('short')]).includes(p), p);
  assert.ok(!allTerminals('uno', [board('short')]).includes('a61'));
  assert.ok(allTerminals('uno', [board('long')]).includes('j93') && !allTerminals('uno', [board('long')]).includes('a94'));
  assert.ok(allTerminals('esp32', [board('short')]).includes('a31'), 'the ESP32 sits on the first breadboard, so all of the second is free');
  assert.equal(parseTerminal('uno', 'E45', [board('short')]), 'e45');
  assert.equal(parseTerminal('uno', 'E45', []), null);
  assert.deepEqual(['a31', 'T+31', 'B-93', 'a30', 'T+30', 'U:13'].map(onExtraBoard), [true, true, true, false, false, false]);
});

test('a part goes on the second breadboard only while it is there, and says so when it is not', () => {
  const led = (items: Item[], a: string, b: string) => makeItem({ kind: 'led' }, items, a, b);
  assert.match(placementError('uno', [], led([], 'e40', 'e41'))!, /add a second breadboard from the tray/);
  assert.equal(placementError('uno', [board('short')], led([board('short')], 'e40', 'e41')), null);
  assert.match(placementError('uno', [board('short')], led([board('short')], 'e70', 'e71'))!, /past the end of the second breadboard, which has columns 31 to 60/);
  assert.equal(placementError('uno', [board('long')], led([board('long')], 'e70', 'e71')), null);
  assert.match(placementError('uno', [board('short')], board('long'))!, /already there/, 'there is room for one more');
});

test('a part with several legs stays on one breadboard', () => {
  const pot = (items: Item[], at: string) => placementError('uno', items, makeItem({ kind: 'pot' }, items, at));
  assert.match(pot([board('short')], 'd29')!, /three columns on one breadboard/, 'not across the gap between the two');
  assert.equal(pot([board('short')], 'd31'), null);
  assert.equal(pot([board('short')], 'd58'), null);
  assert.match(pot([board('short')], 'd59')!, /three columns/);
  assert.equal(pot([board('long')], 'd59'), null);
  assert.equal(pot([board('long')], 'd91'), null);
  assert.match(pot([board('long')], 'd92')!, /three columns/);
  assert.match(pot([], 'd40')!, /second breadboard/, 'with no second breadboard the hole is missing, not the room');
  assert.equal(placementError('uno', [board('short')], makeItem({ kind: 'button' }, [board('short')], 'e40')), null);
});

test('its columns join a to e and f to j, like the first one', () => {
  const an = analyze('uno', [board('long')]);
  assert.ok(an.joined('a45', 'e45') && an.joined('f45', 'j45'));
  assert.ok(!an.joined('e45', 'f45') && !an.joined('a45', 'a46'));
  assert.ok(!an.joined('a15', 'a45'), 'column 45 is not column 15');
});

test('its rails are its own until a wire joins them to the first breadboard\'s', () => {
  const an = analyze('uno', [board('short')]);
  assert.ok(an.joined('T+31', 'T+60') && an.joined('B-31', 'B-60'), 'each rail runs its whole length');
  assert.ok(!an.joined('T+1', 'T+31') && !an.joined('B-30', 'B-31'), 'the two breadboards are not joined underneath');
  assert.ok(!an.joined('T+31', 'B+31') && !an.joined('T+31', 'T-31'));
  const bridged = analyze('uno', [board('short'), wire('T+30', 'T+31')]);
  assert.ok(bridged.joined('T+1', 'T+60'));
});

test('an LED built on the second breadboard lights, and the schematic and wiring table do not mind the breadboard', () => {
  const items: Item[] = [
    board('short'), wire('U:5V', 'T+1'), wire('U:GND', 'T-1'), wire('T+30', 'T+31'), wire('T-30', 'T-31'),
    wire('U:9', 'a40'), { t: 'led', id: 'led', a: 'e40', k: 'e41', color: 0xff3b30 }, { t: 'res', a: 'c41', b: 'c45' }, wire('a45', 'T-45'),
  ];
  const an = analyze('uno', items);
  assert.deepEqual(an.issues.map(i => i.title), []);
  assert.ok(an.solve({ 9: HIGH }).ledGlow('led') > 0.5);
  assert.equal(an.solve({}).volt('T+50').toFixed(2), '5.00', 'the + rail of the second breadboard carries 5 V through the bridge');
  const s = layoutSchematic('uno', items);
  assert.deepEqual(s.parts.map(p => p.symbol).sort(), ['led', 'resistor']);
  const rows = wiringRows(items);
  assert.match(rows[0].where, /columns 31 to 60/);
  assert.equal(rows[0].part, 'Short breadboard');
  assert.match(rows[3].where, /plus rail, far side to plus rail, far side, second breadboard/);
});

test('taking the breadboard off takes what is plugged into it, and nothing else', () => {
  const items: Item[] = [
    wire('U:9', 'a10'), { t: 'led', id: 'near', a: 'e10', k: 'e11', color: 0xff3b30 },
    board('long'), wire('U:5V', 'T+40'), { t: 'led', id: 'far', a: 'e40', k: 'e41', color: 0xff3b30 }, { t: 'pot', id: 'pot', row: 'd', col: 70, ctl: '' },
  ];
  assert.deepEqual(withoutBreadboard(items), items.slice(0, 2));
});

test('a long breadboard becomes short only when nothing is plugged in past column 60', () => {
  const items: Item[] = [board('long'), wire('U:5V', 'T+40')];
  const r = resizedBreadboard('uno', items, 'short');
  assert.ok('items' in r && r.items[0].t === 'breadboard' && r.items[0].size === 'short');
  const busy = resizedBreadboard('uno', [...items, { t: 'pot', id: 'pot', row: 'd', col: 59, ctl: '' }], 'short');
  assert.ok('error' in busy && /ends at column 60, and d61 is in use/.test(busy.error), JSON.stringify(busy));
  const grow = resizedBreadboard('uno', [board('short')], 'long');
  assert.ok('items' in grow && grow.items[0].t === 'breadboard' && grow.items[0].size === 'long');
});

test('a backup keeps a breadboard of either size, where it was moved to, and refuses one that is not a breadboard', () => {
  assert.ok(isItem(board('short')) && isItem(board('long')) && isItem({ ...board('long'), x: -250, z: 120.5 }));
  assert.equal(isItem({ t: 'breadboard', id: 'breadboard1', size: 'huge' }), false);
  assert.equal(isItem({ t: 'breadboard', id: 'breadboard1' }), false);
  assert.equal(isItem({ ...board('short'), x: 'left' }), false);
  assert.equal(isItem({ ...board('short'), z: 1e9 }), false, 'nowhere the view can reach');
});

/* --- moving it around the table --- */
const at = (items: Item[]) => { const bb = items.find(it => it.t === 'breadboard'); return bb?.t === 'breadboard' ? placeOf(bb) : null; };

test('it starts beside the first breadboard, clear of everything on either board, and goes anywhere free', () => {
  for (const b of ['uno', 'esp32'] as const) for (const size of ['short', 'long'] as const) {
    assert.ok(fits(b, [{ t: 'lcd', id: 'lcd1' }, { t: 'pad', id: 'pad1', ctl: '' }], size, HOME), `${b}, ${size}: home is free even with the LCD and the touch pad out`);
  }
  assert.deepEqual(at([board('short')]), HOME);
  assert.ok(isHome(board('short')));
  const moved = movedBreadboard('uno', [board('short')], { x: 60, z: -120 });
  assert.deepEqual(at(moved), { x: 60, z: -120 }, 'behind the bench, out of the way');
  assert.ok(!isHome(moved[0] as { x?: number; z?: number }));
  assert.deepEqual(homedBreadboard(moved), [board('short')], 'put back where it started');
});

test('it stops against the first breadboard and the Uno instead of going through them, and slides along them', () => {
  const flush = bbLength(30) / 2;   // its left end against the first breadboard's right end
  const left = slide('uno', [], 'short', HOME, { x: -60, z: 0 });
  assert.ok(Math.abs(left.x - flush) <= 0.15 && left.z === 0, `pushed left into the first breadboard, it stops against it: ${JSON.stringify(left)}`);
  assert.ok(fits('uno', [], 'short', left));
  const diagonal = slide('uno', [], 'short', HOME, { x: -60, z: 10 });
  assert.ok(Math.abs(diagonal.x - flush) <= 0.15 && diagonal.z === 10, `pushed in at an angle, it slides along the edge: ${JSON.stringify(diagonal)}`);
  const fromBehind = slide('uno', [], 'short', { x: -140, z: -100 }, { x: -140, z: 0 });
  assert.ok(fits('uno', [], 'short', fromBehind) && Math.abs(fromBehind.z + BB_DEPTH) <= 0.15, `it cannot be laid over the Uno from behind: ${JSON.stringify(fromBehind)}`);
  assert.deepEqual(slide('esp32', [], 'short', { x: -140, z: -100 }, { x: -140, z: 0 }), { x: -140, z: 0 }, 'on the ESP32 bench nothing lies there');
  const far = slide('uno', [], 'long', HOME, { x: 5000, z: -5000 });
  assert.deepEqual(far, { x: REACH, z: -REACH }, 'not off the edge of the table');
});

test('however it is pushed about, it never ends up lying on anything', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // the same "random" pushes every run
  const things: Item[] = [{ t: 'lcd', id: 'lcd1' }];
  for (const b of ['uno', 'esp32'] as const) for (const size of ['short', 'long'] as const) {
    let p = HOME;
    for (let i = 0; i < 400; i++) {
      const want = rand() < 0.2 ? { x: (rand() - 0.5) * 800, z: (rand() - 0.5) * 800 } : { x: p.x + (rand() - 0.5) * 60, z: p.z + (rand() - 0.5) * 60 };   // mostly small drags, now and then a fling
      p = slide(b, things, size, p, want);
      assert.ok(fits(b, things, size, p), `${b}, ${size}, push ${i}: ${JSON.stringify(p)} lies on something`);
    }
  }
});

test('one that has been left on something can still be dragged off it', () => {
  const onLcd: Place = { x: -40, z: 64 };
  assert.ok(!fits('uno', [{ t: 'lcd', id: 'lcd1' }], 'short', onLcd));
  assert.deepEqual(slide('uno', [{ t: 'lcd', id: 'lcd1' }], 'short', onLcd, { x: -40, z: 150 }), { x: -40, z: 150 });
});

test('the LCD and the touch pad make room for the second breadboard when it lies on their usual place, and a long one needs room to grow', () => {
  const there = { ...board('short'), x: -60, z: 60 };
  for (const [b, kind, at] of [['uno', 'lcd', 'LCD'], ['esp32', 'pad', 'PAD']] as const) {
    const it = makeItem({ kind }, [there], at);
    assert.equal(placementError(b, [there], it), null, `${kind}: it takes another free place`);
    assert.deepEqual(collisions(b, [there, it]), [], `${kind}: and lies on nothing there`);
  }
  assert.equal(placementError('uno', [board('short')], makeItem({ kind: 'lcd' }, [board('short')], 'LCD')), null);
  const behind = { ...board('short'), x: -250, z: -27 - BB_DEPTH / 2 };   // just behind the Uno: a long one there passes behind it
  assert.ok(fits('uno', [], 'short', placeOf(behind)));
  const grown = resizedBreadboard('uno', [behind], 'long');
  assert.ok('items' in grown, 'nothing in the way of a long one there, so it grows to the right');
  const blocked = { ...board('short'), x: -150 - bbLength(30), z: 0 };   // to the left of the Uno, with the Uno in the way of a longer one
  const r = resizedBreadboard('uno', [blocked], 'long');
  assert.ok('error' in r && /no room for a long breadboard/.test(r.error), JSON.stringify(r));
});
