/* The workshop's Wi-Fi, as the ESP32's sketch and the phone beside the bench see it. There is one network with one router, the board, and the phone.
   Nothing leaves the browser: the sketch's WiFi and WebServer calls and the phone's requests meet here, on the sketch's own clock.

   A request from the phone arrives at a moment. If the board is on the Wi-Fi and a server is listening then, it waits until the sketch calls
   server.handleClient(), which runs the handler for its address. The handler's server.send() is the answer. The phone gives up after ANSWER_MS.
   A check scripts the phone ahead of time (open this address at 3 s, tap ON at 4.5 s), and the answers are worked out as the sketch reaches those moments. */

export const WIFI_NAME = 'Workshop', WIFI_PASSWORD = 'solder123';
/** The address the router gives the board. */
export const BOARD_IP = '192.168.1.57';
/** How long joining the Wi-Fi takes, on the sketch's clock. */
export const JOIN_MS = 1200;
/** How long the phone waits for an answer before it gives up. */
export const ANSWER_MS = 4000;

/** The constants a Wi-Fi sketch uses, with the values the ESP32's core gives them. */
export const WIFI_CONSTS = {
  WL_IDLE_STATUS: 0, WL_NO_SSID_AVAIL: 1, WL_CONNECTED: 3, WL_CONNECT_FAILED: 4, WL_CONNECTION_LOST: 5, WL_DISCONNECTED: 6,
  WIFI_STA: 1, WIFI_AP: 2, WIFI_AP_STA: 3,
  HTTP_GET: 1, HTTP_POST: 3, HTTP_ANY: 255,
};
const W = WIFI_CONSTS;

/** Why the board cannot be reached: it is not running, has not called WiFi.begin(), is still joining, asked for a network that is not there, gave the wrong password, or left. */
export type OfflineWhy = 'stopped' | 'never' | 'joining' | 'name' | 'password' | 'left';
/** What the phone got back. */
export type Answer =
  | { kind: 'page'; status: number; type: string; body: string }
  /** A handler ran but sent nothing back. */
  | { kind: 'silent' }
  /** Nothing came back in time, so the phone gave up. */
  | { kind: 'timeout' }
  /** The board is on the Wi-Fi, but no web server is listening on this port. */
  | { kind: 'refused'; port: number }
  | { kind: 'offline'; why: OfflineWhy; tried?: string }
  /** An address that is not the board. The workshop's Wi-Fi has no internet. */
  | { kind: 'elsewhere'; host: string }
  /** Not an address at all. */
  | { kind: 'bad' };
/** What the phone shows at a moment: the address it last opened, and the answer, or null while it waits for one. */
export interface Seen { url: string; at: number; answer: Answer | null }
/** A tap in a check's script that found nothing to tap: the page had not come yet, there was no page, or it had no such link or button. */
export interface Miss { at: number; label: string; why: 'loading' | 'nopage' | 'missing' }

/** A request on its way to the sketch. `root` is the phone's own request, which a redirect carries on under a new address. */
export interface Visit { id: number; root: number; url: string; path: string; port: number; method: number; args: [string, string][]; at: number; hops: number }
type Done = (answer: Answer, url: string) => void;
type Plan = { at: number; kind: 'visit'; id: number; url: string; method: number; form: [string, string][] } | { at: number; kind: 'tap'; label: string };

export interface Network {
  /** WiFi.begin(): starts joining a network. */
  join(ssid: string, password: string, now: number): void;
  /** WiFi.disconnect(). */
  leave(now: number): void;
  /** WiFi.status(), as a WL_ number. */
  status(now: number): number;
  /** WiFi.localIP(): the board's address, or 0.0.0.0 until it is on. */
  ip(now: number): string;
  /** The network asked for, or "" before WiFi.begin(). */
  ssid(now: number): string;
  /** server.begin() and server.close(). */
  listen(port: number, now: number): void;
  close(port: number, now: number): void;
  /** The phone opens an address, now (the live phone) or at a moment still to come (a check's script). `done` hears the answer and the address it came from. Gives the request's id. */
  visit(url: string, at: number, now: number, opts?: { method?: 'GET' | 'POST'; form?: [string, string][]; done?: Done }): number;
  /** A check's script: at this moment the guard taps the link or button with this label on whatever page the phone shows. */
  tap(label: string, at: number): void;
  /** server.handleClient(): takes the oldest request waiting for this port, or null when there is none. */
  next(port: number, now: number): Visit | null;
  /** The board's answer to a request. A redirect sends the phone on to the new address. */
  answer(v: Visit, a: Answer, headers: [string, string][], now: number): void;
  /** The live phone stops waiting for this request. */
  giveUp(id: number): void;
  /** Works out everything the script asked for up to this moment. A check calls it at the end of its run. */
  settle(now: number): void;
  /** What the phone shows at a moment, or null before it has opened anything. */
  seenAt(t: number): Seen | null;
  /** Taps in a check's script that found nothing to tap. */
  missed: Miss[];
}

/** An address the phone can open: "http://192.168.1.57/on", "192.168.1.57/on" or, in a check's script, just "/on". Null when it is not one. */
export function parseAddress(url: string): { host: string; port: number; path: string; args: [string, string][]; href: string } | null {
  const text = url.trim(), full = text.startsWith('/') ? `http://${BOARD_IP}${text}` : /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
  let u: URL;
  try { u = new URL(full); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const port = u.port ? +u.port : u.protocol === 'https:' ? 443 : 80;
  let path: string;
  try { path = decodeURIComponent(u.pathname) || '/'; } catch { path = u.pathname || '/'; }
  return { host: u.hostname, port, path, args: [...u.searchParams], href: u.href };
}

/** A link's target, from the page it is on. */
export function resolveAddress(href: string, base: string): string {
  try { return new URL(href, parseAddress(base)?.href ?? `http://${BOARD_IP}/`).href; } catch { return href; }
}

export function makeNetwork(): Network {
  /** Every WiFi.begin() and WiFi.disconnect(), in the order they happened, so that the board's state at any earlier moment can be looked up. */
  const joins: { at: number; ssid: string; password: string }[] = [], leaves: number[] = [];
  /** When a server started and stopped listening on each port. */
  const ports = new Map<number, { from: number; to: number }>();
  /** Each request the phone made: its moment and the address it is at now (a redirect moves it on). */
  const roots = new Map<number, { at: number; url: string }>();
  const results = new Map<number, { t: number; answer: Answer }>(), callbacks = new Map<number, Done>();
  const waiting: Visit[] = [], plan: Plan[] = [], missed: Miss[] = [];
  let ids = 0;

  const joinAt = (t: number) => { for (let i = joins.length - 1; i >= 0; i--) if (joins[i].at <= t) return joins[i]; return null; };
  const leftSince = (from: number, t: number) => leaves.some(l => l >= from && l <= t);
  /** Why the board was not on the Wi-Fi at a moment, or null when it was. */
  function offline(t: number): Answer | null {
    const j = joinAt(t);
    if (!j) return { kind: 'offline', why: leaves.some(l => l <= t) ? 'left' : 'never' };
    if (leftSince(j.at, t)) return { kind: 'offline', why: 'left' };
    if (t < j.at + JOIN_MS) return { kind: 'offline', why: 'joining' };
    if (j.ssid !== WIFI_NAME) return { kind: 'offline', why: 'name', tried: j.ssid };
    if (j.password !== WIFI_PASSWORD) return { kind: 'offline', why: 'password' };
    return null;
  }
  /** Why a request to this port at this moment could not get through, or null when the board was on the Wi-Fi and listening. */
  function blocked(t: number, port: number): Answer | null {
    const off = offline(t);
    if (off) return off;
    const l = ports.get(port);
    return l && t >= l.from && t < l.to ? null : { kind: 'refused', port };
  }

  function finish(root: number, answer: Answer, t: number) {
    if (results.has(root)) return;
    const r = roots.get(root)!;
    if (t - r.at > ANSWER_MS) { answer = { kind: 'timeout' }; t = r.at + ANSWER_MS; }   // the phone had already given up
    results.set(root, { t, answer });
    const done = callbacks.get(root);
    callbacks.delete(root);
    done?.(answer, r.url);
  }
  /** A request reaches the network: straight to the sketch's queue, or turned away. */
  function arrive(root: number, url: string, at: number, method: number, form: [string, string][], hops: number) {
    const a = parseAddress(url);
    roots.get(root)!.url = a?.href ?? url;
    if (!a) { finish(root, { kind: 'bad' }, at); return; }
    if (a.host !== BOARD_IP) { finish(root, { kind: 'elsewhere', host: a.host }, at); return; }
    const no = blocked(at, a.port);
    if (no) { finish(root, no, at); return; }
    waiting.push({ id: ++ids, root, url: a.href, path: a.path, port: a.port, method, args: [...a.args, ...form], at, hops });
  }
  /** A tap in the script: on the page the phone shows at that moment, find the link or button and follow it. */
  function tapAt(label: string, at: number) {
    const seen = net.seenAt(at);
    if (!seen || !seen.answer || seen.answer.kind !== 'page') { missed.push({ at, label, why: seen && !seen.answer ? 'loading' : 'nopage' }); return; }
    const target = findTarget(seen.answer.body, label);
    if (!target) { missed.push({ at, label, why: 'missing' }); return; }
    const url = resolveAddress(target.href, seen.url), id = ++ids;
    roots.set(id, { at, url });
    arrive(id, target.method === 'POST' ? url : withArgs(url, target.form), at, target.method === 'POST' ? W.HTTP_POST : W.HTTP_GET, target.method === 'POST' ? target.form : [], 0);
  }

  const net: Network = {
    missed,
    join(ssid, password, now) {
      const j = joinAt(now);
      if (j && j.ssid === ssid && j.password === password && !leftSince(j.at, now)) return;   // already on, or on the way: nothing changes
      joins.push({ at: now, ssid, password });
    },
    leave(now) { leaves.push(now); },
    status(now) {
      const off = offline(now);
      if (!off) return W.WL_CONNECTED;
      if (off.kind !== 'offline') return W.WL_DISCONNECTED;
      return off.why === 'name' ? W.WL_NO_SSID_AVAIL : off.why === 'password' ? W.WL_CONNECT_FAILED : W.WL_DISCONNECTED;
    },
    ip: now => (offline(now) ? '0.0.0.0' : BOARD_IP),
    ssid: now => joinAt(now)?.ssid ?? '',
    listen(port, now) { const l = ports.get(port); if (!l || l.to <= now) ports.set(port, { from: now, to: Infinity }); },
    close(port, now) { const l = ports.get(port); if (l && l.to > now) l.to = now; },
    visit(url, at, now, opts = {}) {
      const id = ++ids;
      roots.set(id, { at, url });
      if (opts.done) callbacks.set(id, opts.done);
      const method = opts.method === 'POST' ? W.HTTP_POST : W.HTTP_GET, form = opts.form ?? [];
      if (at <= now) arrive(id, url, at, method, form, 0);
      else { plan.push({ at, kind: 'visit', id, url, method, form }); plan.sort((x, y) => x.at - y.at); }
      return id;
    },
    tap(label, at) { plan.push({ at, kind: 'tap', label }); plan.sort((x, y) => x.at - y.at); },
    settle(now) {
      while (plan.length && plan[0].at <= now) {
        const p = plan.shift()!;
        if (p.kind === 'visit') arrive(p.id, p.url, p.at, p.method, p.form, 0); else tapAt(p.label, p.at);
      }
    },
    next(port, now) {
      net.settle(now);
      const i = waiting.findIndex(v => v.port === port);
      return i < 0 ? null : waiting.splice(i, 1)[0];
    },
    answer(v, a, headers, now) {
      if (a.kind === 'page' && a.status >= 300 && a.status < 400) {   // a redirect: the phone opens the address it is sent to
        const to = headers.find(([k]) => k.toLowerCase() === 'location')?.[1];
        if (to && v.hops < 5) { arrive(v.root, resolveAddress(to, v.url), now, a.status === 307 || a.status === 308 ? v.method : W.HTTP_GET, [], v.hops + 1); return; }
      }
      finish(v.root, a, now);
    },
    giveUp(id) { if (roots.has(id)) finish(id, { kind: 'timeout' }, roots.get(id)!.at + ANSWER_MS); },
    seenAt(t) {
      let id = -1, best: { at: number; url: string } | null = null;
      for (const [k, r] of roots) if (r.at <= t && (!best || r.at >= best.at)) { id = k; best = r; }
      if (!best) return null;
      const res = results.get(id);
      const answer = res && res.t <= t ? res.answer : t - best.at >= ANSWER_MS ? { kind: 'timeout' as const } : null;
      return { url: best.url, at: best.at, answer };
    },
  };
  return net;
}

/** An address with a form's fields as its query, the way a browser sends a form that uses GET: they take the place of any query the address had. */
export const withArgs = (url: string, args: [string, string][]) => {
  if (!args.length) return url;
  try { const u = new URL(url); u.search = new URLSearchParams(args).toString(); return u.href; } catch { return url; }
};

/* --- reading a page the way a person would: its words, and the links and buttons on it --- */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', copy: '©' };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
/** The words a page shows, without its tags, styles or title. A plain-text answer is its own words. */
export function pageText(a: Extract<Answer, { kind: 'page' }>): string {
  if (!/html/i.test(a.type)) return squash(a.body);
  return squash(decode(a.body.replace(/<(script|style|title|head)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, ' ').replace(/<[^>]*>/g, ' ')));
}
const attr = (attrs: string, name: string): string | null => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '') : null;
};
/** Finds the link or button on a page whose words are this label, the way a check's script taps it: words that are exactly the label first, then words that hold it as a whole word. */
export function findTarget(html: string, label: string): { href: string; method: 'GET' | 'POST'; form: [string, string][] } | null {
  const want = squash(label).toLowerCase(), words = (s: string) => squash(decode(s.replace(/<[^>]*>/g, ' '))).toLowerCase();
  const found: { text: string; href: string; method: 'GET' | 'POST'; form: [string, string][] }[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const href = attr(m[1], 'href');
    if (href != null) found.push({ text: words(m[2]), href, method: 'GET', form: [] });
  }
  for (const f of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi)) {
    const action = attr(f[1], 'action') ?? '', method = (attr(f[1], 'method') ?? '').toUpperCase() === 'POST' ? 'POST' : 'GET';
    const fields: [string, string][] = [];
    for (const i of f[2].matchAll(/<input\b([^>]*)>/gi)) {
      const type = (attr(i[1], 'type') ?? 'text').toLowerCase(), name = attr(i[1], 'name');
      if (name && !['submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) fields.push([name, attr(i[1], 'value') ?? '']);
    }
    const buttons: { text: string; name: string | null; value: string }[] = [];
    for (const b of f[2].matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button\s*>/gi)) {
      const type = (attr(b[1], 'type') ?? 'submit').toLowerCase();
      if (type === 'submit') buttons.push({ text: words(b[2]), name: attr(b[1], 'name'), value: attr(b[1], 'value') ?? '' });
    }
    for (const i of f[2].matchAll(/<input\b([^>]*)>/gi)) {
      if ((attr(i[1], 'type') ?? '').toLowerCase() === 'submit') buttons.push({ text: words(attr(i[1], 'value') ?? 'Submit'), name: attr(i[1], 'name'), value: attr(i[1], 'value') ?? '' });
    }
    for (const b of buttons) found.push({ text: b.text, href: action, method, form: b.name ? [...fields, [b.name, b.value]] : fields });
  }
  const exact = found.find(x => x.text === want), word = found.find(x => new RegExp(`(^|\\W)${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\W)`).test(x.text));
  const hit = exact ?? word;
  return hit ? { href: hit.href, method: hit.method, form: hit.form } : null;
}

/* --- in words --- */
const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 307: 'Temporary Redirect', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
export const statusLine = (status: number) => `${status} ${REASONS[status] ?? ''}`.trim();
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Why the board could not be reached, as the end of a sentence. */
export function offlineWords(why: OfflineWhy, tried?: string): string {
  switch (why) {
    case 'stopped': return 'the board is not running. Press Run first';
    case 'never': return 'the board never joined the Wi-Fi. Call WiFi.begin() in setup()';
    case 'joining': return 'the board was still joining the Wi-Fi';
    case 'name': return `the board looked for a Wi-Fi called "${tried ?? ''}", and there is none. The workshop's Wi-Fi is called "${WIFI_NAME}", and capital letters count`;
    case 'password': return `the board gave the Wi-Fi the wrong password. It is "${WIFI_PASSWORD}", and capital letters count`;
    case 'left': return 'the board had left the Wi-Fi';
  }
}
/** What the phone showed, as the end of a sentence that starts "but". */
export function seenWords(seen: Seen | null): string {
  if (!seen) return 'it had not opened any page';
  const a = seen.answer;
  if (!a) return 'it was still waiting for the board to answer. The board answers only while server.handleClient() runs, so call it on every pass of loop() and keep delays short';
  switch (a.kind) {
    case 'page': { const words = pageText(a); return a.status === 200 ? `it showed a page that says "${short(words)}"` : `it showed "${short(words) || statusLine(a.status)}" (${statusLine(a.status)})`; }
    case 'silent': return 'the board sent back nothing at all: a handler ran, but it never called server.send()';
    case 'timeout': return 'the board never answered, and the phone gave up waiting. The board answers only while server.handleClient() runs, so call it on every pass of loop() and keep delays short';
    case 'refused': return 'no web server was running on the board, though it was on the Wi-Fi. Call server.begin() in setup()';
    case 'offline': return offlineWords(a.why, a.tried);
    case 'elsewhere': return `${a.host} is not the board, and the workshop's Wi-Fi has no internet`;
    case 'bad': return 'that is not an address the phone can open';
  }
}
/** A tap that found nothing, as the end of a sentence. */
export const missWords = (m: Miss) =>
  m.why === 'missing' ? `the page the phone showed has no link or button called "${m.label}"`
    : m.why === 'loading' ? `the phone was still waiting for a page, so there was no "${m.label}" to tap`
      : `the phone was not showing a page, so there was no "${m.label}" to tap`;
