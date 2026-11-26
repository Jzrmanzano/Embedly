/* Wi-Fi on the ESP32: joining the workshop's network, a WebServer answering the phone beside the bench, the phone's view of it,
   and the check engine scripting the phone (open an address, tap a link) and judging what it shows. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARDS } from '../src/data/boards';
import { observe, phases, runChecks } from '../src/sim/check';
import { makeHW } from '../src/sim/hardware';
import { parse, run, SimError } from '../src/sim/interpreter';
import { ANSWER_MS, BOARD_IP, findTarget, JOIN_MS, makeNetwork, pageText, parseAddress, seenWords, WIFI_CONSTS, WIFI_NAME, WIFI_PASSWORD, type Answer } from '../src/sim/network';
import type { BoardId } from '../src/types';

const { WL_CONNECTED, WL_DISCONNECTED, WL_NO_SSID_AVAIL, WL_CONNECT_FAILED } = WIFI_CONSTS;
const page = (body: string, status = 200, type = 'text/html'): Answer => ({ kind: 'page', status, type, body });

/* --- the network on its own --- */
test('joining takes a moment, and the board has no address until it is on', () => {
  const net = makeNetwork();
  assert.equal(net.status(0), WL_DISCONNECTED, 'before WiFi.begin()');
  net.join(WIFI_NAME, WIFI_PASSWORD, 100);
  assert.equal(net.status(100 + JOIN_MS - 1), WL_DISCONNECTED, 'still joining');
  assert.equal(net.ip(100 + JOIN_MS - 1), '0.0.0.0');
  assert.equal(net.status(100 + JOIN_MS), WL_CONNECTED);
  assert.equal(net.ip(100 + JOIN_MS), BOARD_IP);
  net.join(WIFI_NAME, WIFI_PASSWORD, 5000);
  assert.equal(net.status(5000), WL_CONNECTED, 'asking again for the network it is already on changes nothing');
  net.leave(6000);
  assert.equal(net.status(6000), WL_DISCONNECTED);
});

test('a wrong name or password never gets the board on, and says which was wrong', () => {
  const name = makeNetwork(), password = makeNetwork();
  name.join('workshop', WIFI_PASSWORD, 0);
  password.join(WIFI_NAME, 'Solder123', 0);
  assert.equal(name.status(10_000), WL_NO_SSID_AVAIL, 'capital letters count in the name');
  assert.equal(password.status(10_000), WL_CONNECT_FAILED);
  assert.deepEqual(name.seenAt(0), null, 'the phone has opened nothing yet');
  name.visit('/', 5000, 5000);
  assert.deepEqual(name.seenAt(5000)?.answer, { kind: 'offline', why: 'name', tried: 'workshop' });
  assert.match(seenWords(name.seenAt(5000)), /no Wi-Fi called "workshop"|there is none/);
});

test('the phone is turned away until the board is on the Wi-Fi and a server listens, then waits for handleClient()', () => {
  const net = makeNetwork();
  net.visit('/', 0, 0);
  assert.deepEqual(net.seenAt(0)?.answer, { kind: 'offline', why: 'never' });
  net.join(WIFI_NAME, WIFI_PASSWORD, 0);
  net.visit('/', JOIN_MS, JOIN_MS);
  assert.deepEqual(net.seenAt(JOIN_MS)?.answer, { kind: 'refused', port: 80 }, 'on the Wi-Fi, but nothing listening');
  net.listen(80, JOIN_MS);
  const id = net.visit(`http://${BOARD_IP}/hello?x=1`, 2000, 2000);
  assert.ok(id > 0);
  assert.equal(net.seenAt(2100)?.answer, null, 'waiting for the sketch to answer');
  const req = net.next(80, 2200)!;
  assert.deepEqual([req.path, req.args], ['/hello', [['x', '1']]]);
  assert.equal(net.next(80, 2200), null, 'each request is answered once');
  net.answer(req, page('<p>Hi</p>'), [], 2300);
  assert.deepEqual(net.seenAt(2300)?.answer, page('<p>Hi</p>'));
  assert.equal(net.seenAt(2250)?.answer, null, 'the answer was not there before it was sent');
});

test('a request nobody answers times out, and an answer after the phone gave up is not shown', () => {
  const net = makeNetwork();
  net.join(WIFI_NAME, WIFI_PASSWORD, 0); net.listen(80, 0);
  net.visit('/', 2000, 2000);
  assert.deepEqual(net.seenAt(2000 + ANSWER_MS)?.answer, { kind: 'timeout' });
  const late = net.next(80, 9000)!;
  net.answer(late, page('late'), [], 9000);
  assert.deepEqual(net.seenAt(9000)?.answer, { kind: 'timeout' });
});

test('a redirect sends the phone on to the new address, and the live phone hears the final answer', () => {
  const net = makeNetwork(), heard: [Answer, string][] = [];
  net.join(WIFI_NAME, WIFI_PASSWORD, 0); net.listen(80, 0);
  net.visit('192.168.1.57/set?level=9', 2000, 2000, { done: (a, url) => heard.push([a, url]) });
  net.answer(net.next(80, 2010)!, page('', 303), [['Location', '/']], 2010);
  const again = net.next(80, 2020)!;
  assert.equal(again.path, '/');
  net.answer(again, page('home'), [], 2020);
  assert.deepEqual(heard, [[page('home'), `http://${BOARD_IP}/`]]);
});

test('addresses: the board, another site, and nonsense', () => {
  assert.deepEqual(parseAddress('192.168.1.57/on')?.path, '/on');
  assert.equal(parseAddress(`http://${BOARD_IP}:8080/`)?.port, 8080);
  assert.equal(parseAddress('http://exa mple'), null);
  const net = makeNetwork();
  net.visit('https://example.com/', 0, 0);
  assert.deepEqual(net.seenAt(0)?.answer, { kind: 'elsewhere', host: 'example.com' });
});

test('a page is read for its words, and its links and buttons are found by their labels', () => {
  const html = `<html><head><title>Hidden</title><style>p{color:red}</style></head><body><h1>Gate&nbsp;light</h1><p>The light is <b>off</b>.</p>
    <a href="/on">ON</a> <a href='/off'><button>OFF</button></a>
    <form action="/set" method="get"><input name="level" value="7"><button name="go" value="1">Set it</button></form>
    <form action="/post" method="POST"><input type="submit" value="Save"></form></body></html>`;
  assert.equal(pageText(page(html) as Extract<Answer, { kind: 'page' }>), 'Gate light The light is off . ON OFF Set it');
  assert.deepEqual(findTarget(html, 'on'), { href: '/on', method: 'GET', form: [] });
  assert.deepEqual(findTarget(html, 'OFF'), { href: '/off', method: 'GET', form: [] });
  assert.deepEqual(findTarget(html, 'Set'), { href: '/set', method: 'GET', form: [['level', '7'], ['go', '1']] }, 'a word of the label is enough');
  assert.deepEqual(findTarget(html, 'Save'), { href: '/post', method: 'POST', form: [] });
  assert.equal(findTarget(html, 'Open'), null);
  assert.equal(findTarget('<a href="/button">Turn the light off</a>', 'on'), null, 'a word inside another word is not the label');
});

/* --- the interpreter --- */
async function serve(code: string, visits: { at: number; url?: string; tap?: string }[], ms = 6000, board: BoardId = 'esp32') {
  const plan = visits.map(v => ({ from: v.at, visit: v.url, tap: v.tap }));
  return observe(board, [], code, plan, ms);
}
const JOIN = `  WiFi.begin("Workshop", "solder123");
  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
  }`;

test('a sketch answers each address with its handler, and an address with none gets the library\'s own "Not found"', async () => {
  const code = `#include <WiFi.h>
#include <WebServer.h>
WebServer server(80);
int visits = 0;
void handleRoot() { visits++; server.send(200, "text/plain", "visit " + String(visits)); }
void setup() {
${JOIN}
  server.on("/", HTTP_GET, handleRoot);
  server.begin();
}
void loop() { server.handleClient(); }`;
  const tr = await serve(code, [{ at: 2000, url: '/' }, { at: 2500, url: '/' }, { at: 3000, url: '/nope' }]);
  assert.equal(tr.error, null);
  assert.deepEqual(tr.at(2400).page?.answer, page('visit 1', 200, 'text/plain'));
  assert.deepEqual(tr.at(2900).page?.answer, page('visit 2', 200, 'text/plain'), 'each visit runs the handler again');
  assert.deepEqual(tr.at(3400).page?.answer, page('Not found: /nope', 404));
});

test('a form\'s fields reach server.arg(), and a raw string holds a page as it is written', async () => {
  const code = `#include <WiFi.h>
#include <WebServer.h>
WebServer server(80);
const char PAGE[] PROGMEM = R"html(<form action="/set"><input name="level" value="42"><button>Set</button></form>)html";
void handleRoot() { server.send(200, "text/html", PAGE); }
void handleSet() {
  String said = "level ";
  said += server.arg("level").toInt() + 1;
  said += server.hasArg("nothing") ? " and more" : "";
  server.send(200, F("text/plain"), said);
}
void setup() {
${JOIN}
  server.on("/", handleRoot);
  server.on("/set", handleSet);
  server.begin();
}
void loop() { server.handleClient(); delay(5); }`;
  const tr = await serve(code, [{ at: 2000, url: '/' }, { at: 3000, tap: 'Set' }]);
  assert.equal(tr.error, null);
  assert.deepEqual(tr.missed, []);
  assert.deepEqual(tr.at(3500).page?.answer, page('level 43', 200, 'text/plain'));
  assert.match(tr.at(3500).page!.url, /\/set\?level=42$/);
});

test('onNotFound(), redirects with sendHeader(), and a handler that sends nothing', async () => {
  const code = `#include <WiFi.h>
#include <WebServer.h>
WebServer server(80);
void handleRoot() { server.send(200, "text/plain", "home"); }
void handleBack() { server.sendHeader("Location", "/"); server.send(303); }
void handleQuiet() { }
void handleMissing() { server.send(404, "text/plain", "No page at " + server.uri()); }
void setup() {
${JOIN}
  server.on("/", handleRoot);
  server.on("/back", handleBack);
  server.on("/quiet", handleQuiet);
  server.onNotFound(handleMissing);
  server.begin();
}
void loop() { server.handleClient(); }`;
  const tr = await serve(code, [{ at: 2000, url: '/back' }, { at: 2500, url: '/quiet' }, { at: 3000, url: '/elsewhere' }]);
  assert.equal(tr.error, null);
  assert.deepEqual(tr.at(2400).page?.answer, page('home', 200, 'text/plain'));
  assert.equal(tr.at(2400).page?.url, `http://${BOARD_IP}/`, 'the phone followed the redirect');
  assert.deepEqual(tr.at(2900).page?.answer, { kind: 'silent' });
  assert.deepEqual(tr.at(3400).page?.answer, page('No page at /elsewhere', 404, 'text/plain'));
});

test('WiFi.localIP() is 0.0.0.0 until the board is on, and prints like an address', async () => {
  let out = '';
  const hw = makeHW(BOARDS.esp32, [], () => ({}), s => { out += s; }, { virtualClock: true });
  hw.skipDelays = true;
  const ctl = { stop: false, onLoop() { ctl.stop = true; } };
  await run(`#include <WiFi.h>
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin("Workshop", "solder123");
  Serial.println(WiFi.localIP());
${JOIN}
  IPAddress ip = WiFi.localIP();
  Serial.println(ip);
  Serial.println(WiFi.localIP().toString());
  Serial.println(WiFi.SSID());
}
void loop() {}`, hw, ctl);
  assert.equal(out, `0.0.0.0\n${BOARD_IP}\n${BOARD_IP}\nWorkshop\n`);
});

test('mistakes are explained: brackets after a handler, no Wi-Fi on the Uno, and the ESP8266 library', async () => {
  const fails = async (code: string, board: BoardId, pattern: RegExp) => {
    const hw = makeHW(BOARDS[board], [], () => ({}), () => {}, { virtualClock: true });
    hw.skipDelays = true;
    const ctl = { stop: false, onLoop() { ctl.stop = true; } };
    await assert.rejects(run(code, hw, ctl), (e: unknown) => { assert.ok(e instanceof SimError); assert.match(e.message, pattern); return true; });
  };
  const sketch = (body: string, top = 'WebServer server(80);\nvoid handleRoot() { server.send(200, "text/plain", "hi"); }') => `${top}\nvoid setup() {\n${body}\n}\nvoid loop() {}`;
  await fails(sketch('  server.on("/", handleRoot());'), 'esp32', /take the brackets off/);
  await fails(sketch('  server.on("/", "handleRoot");'), 'esp32', /without brackets/);
  await fails(sketch('  server.on("on", handleRoot);'), 'esp32', /starts with "\/"/);
  await fails(sketch('  WiFi.begin("Workshop", "solder123");', ''), 'uno', /no Wi-Fi/);
  await fails(sketch(''), 'uno', /no Wi-Fi/);
  assert.throws(() => parse(sketch('', 'ESP8266WebServer server(80);')), /On the ESP32 it is called WebServer/);
});

/* --- the check engine --- */
const GATE = `#include <WiFi.h>
#include <WebServer.h>
WebServer server(80);
bool on = false;
void handleRoot() { server.send(200, "text/html", on ? "<p>Lit</p><a href=\\"/off\\">OFF</a>" : "<p>Dark</p><a href=\\"/on\\">ON</a>"); }
void handleOn() { on = true; handleRoot(); }
void handleOff() { on = false; handleRoot(); }
void setup() {
${JOIN}
  server.on("/", handleRoot);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.begin();
}
void loop() { server.handleClient(); delay(10); }`;

test('a check opens an address, taps what the page offers, and judges what the phone shows', async () => {
  const sc = phases('The page follows the taps', [
    { when: 'the board starts', ms: 2000, expect: {} },
    { when: 'the phone opens the page', visit: '/', expect: { page: /dark/i } },
    { when: 'the guard taps ON', tap: 'ON', expect: { page: /lit/i } },
    { when: 'the guard taps OFF', tap: 'OFF', expect: { page: /dark/i } },
  ]);
  const [, good] = await runChecks('esp32', [], GATE, [sc]);
  assert.deepEqual([good.pass, good.detail], [true, '']);
  const [, noOn] = await runChecks('esp32', [], GATE.replace('<a href=\\"/on\\">ON</a>', ''), [sc]);
  assert.equal(noOn.detail, 'When the guard taps ON, the page the phone showed has no link or button called "ON".');
  const [, slow] = await runChecks('esp32', [], GATE.replace('delay(10);', 'delay(4000);'), [sc]);
  assert.match(slow.detail, /^When the phone opens the page, the phone should show a page that says "dark", but it was still waiting for the board to answer/);
  const [, uno] = await runChecks('uno', [], 'void setup() {}\nvoid loop() {}', [sc]);
  assert.match(uno.detail, /no Wi-Fi/);
});

test('the phone\'s script can be replayed: the same sketch gives the same answers every time', async () => {
  const plan = [{ from: 2000, visit: '/' }, { from: 2600, tap: 'ON' }];
  const a = await observe('esp32', [], GATE, plan, 3500), b = await observe('esp32', [], GATE, plan, 3500);
  assert.deepEqual(a.at(3400).page, b.at(3400).page);
  assert.match(pageText(a.at(3400).page!.answer as Extract<Answer, { kind: 'page' }>), /Lit/);
});
