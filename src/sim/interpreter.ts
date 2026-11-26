/* An interpreter for the subset of Arduino C++ the lessons use. */
import { WIFI_CONSTS, type Network, type Visit } from './network';

export interface Hardware {
  consts: Record<string, number>;
  sleep(ms: number): Promise<void>;
  pause(): Promise<void>;
  now(): number;
  pinMode(pin: number, mode: number): void;
  digitalWrite(pin: number, value: number): void;
  digitalRead(pin: number): number;
  analogRead(pin: number): number;
  analogWrite(pin: number, value: number): void;
  tone(pin: number, freq: number, duration?: number): void;
  noTone(pin: number): void;
  pulseIn(pin: number): number;
  touchRead(pin: number): number;
  /** Sends servo pulses on a pin for this angle (0 to 180), or stops them with null. */
  servo(pin: number, angle: number | null): void;
  print(text: string): void;
  /** What has been typed into the Serial Monitor and not read yet, one character code each, oldest first. Serial.read() takes from the front. */
  serialIn?: number[];
  /** Sends a LiquidCrystal_I2C command to whatever display answers at this address on the I2C pins. */
  lcd?(addr: number, op: string, args?: number[]): void;
  /** The Wi-Fi the board can join, on a board that has Wi-Fi. */
  net?: Network;
}
export interface RunControl {
  stop: boolean;
  onLoop?: () => void;
  /** Called with the line of each statement just before it runs. Return a promise to hold the sketch there. */
  step?: (line: number) => Promise<void> | void;
}

export class SimError extends Error {
  line: number;
  constructor(msg: string, line: number) { super(msg); this.line = line; }
}

type Tok =
  | { t: 'str' | 'id' | 'op' | 'eof'; v: string; line: number }
  | { t: 'chr'; v: number; line: number }
  | { t: 'num'; v: number; f: boolean; line: number };
type IdTok = { t: 'id'; v: string; line: number };

/** `chr`: a plain char, which prints as the character it holds (an unsigned char or a byte prints as a number, as on a real board). */
interface Ty { float: boolean; str: boolean; isVoid: boolean; obj?: 'Servo' | 'LCD' | 'Server'; chr?: boolean }
/** The library objects that are made with values in brackets, like "LiquidCrystal_I2C lcd(0x27, 16, 2);" and "WebServer server(80);". */
const MADE_WITH = new Set<Ty['obj']>(['LCD', 'Server']);
type Expr =
  | { k: 'num'; v: number; f?: boolean }
  | { k: 'str'; v: string }
  | { k: 'chr'; v: number }
  | { k: 'id'; name: string; line: number }
  | { k: 'bin'; op: string; l: Expr; r: Expr; line: number }
  | { k: 'un'; op: string; a: Expr; line: number }
  | { k: 'incr'; op: string; pre: boolean; a: Expr; line: number }
  | { k: 'assign'; op: string; l: Expr; r: Expr; line: number }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr }
  | { k: 'seq'; a: Expr; b: Expr }
  | { k: 'cast'; ty: Ty; a: Expr; digits?: Expr }
  | { k: 'sizeof'; a: Expr }
  | { k: 'idx'; a: Expr; i: Expr; line: number }
  | { k: 'call'; name: string; args: Expr[]; line: number }
  | { k: 'mcall'; obj: Expr; name: string; args: Expr[]; line: number };
type CallExpr = Extract<Expr, { k: 'call' }>;
type McallExpr = Extract<Expr, { k: 'mcall' }>;
interface VarDecl { name: string; line: number; arr?: boolean; size?: Expr; init?: Expr; list?: Expr[]; ctor?: Expr[] }
type Stmt =
  | { k: 'block'; body: Stmt[] }
  | { k: 'empty' } | { k: 'break' } | { k: 'continue' }
  | { k: 'decl'; ty: Ty; vars: VarDecl[] }
  | { k: 'expr'; e: Expr; line: number }
  | { k: 'if'; c: Expr; a: Stmt; b: Stmt | null; line: number }
  | { k: 'while' | 'dowhile'; c: Expr; body: Stmt; line: number }
  | { k: 'for'; init: Stmt | null; c: Expr | null; step: Expr | null; body: Stmt; line: number }
  | { k: 'return'; e: Expr | null; line: number }
  | { k: 'switch'; e: Expr; cases: { v: Expr | null; at: number; line: number }[]; body: Stmt[]; line: number };
type DeclStmt = Extract<Stmt, { k: 'decl' }>;
interface Func { params: { name: string; ty: Ty }[]; ty: Ty; body: Stmt; line: number }
export interface Program { globals: DeclStmt[]; funcs: Map<string, Func> }

/** A Servo object: the pin it is attached to (-1 when it is not) and the last angle written to it. */
interface ServoObj { servo: true; pin: number; angle: number }
/** A LiquidCrystal_I2C display as the sketch knows it: the address it talks to, its size, and whether the sketch has asked for the backlight. */
interface LcdObj { lcd: true; addr: number; cols: number; rows: number; light: boolean }
/** A WebServer: the port it listens on, the function that answers each address, and the request it is answering right now, if any. */
interface WebObj { web: true; port: number; routes: { path: string; method: number; fn: string }[]; notFound: string | null; req: Visit | null; sent: boolean; headers: [string, string][] }
/** A function named without brackets, as in server.on("/", handleRoot): the function itself, to be run later. */
interface FnRef { fn: string }
type Val = number | string | Val[] | ServoObj | LcdObj | WebObj | FnRef;
interface Rec { float: boolean; str: boolean; chr?: boolean; v: Val }
const isServo = (v: unknown): v is ServoObj => typeof v === 'object' && v !== null && !Array.isArray(v) && (v as ServoObj).servo === true;
const isLcd = (v: unknown): v is LcdObj => typeof v === 'object' && v !== null && !Array.isArray(v) && (v as LcdObj).lcd === true;
const isWeb = (v: unknown): v is WebObj => typeof v === 'object' && v !== null && !Array.isArray(v) && (v as WebObj).web === true;
const isFn = (v: unknown): v is FnRef => typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as FnRef).fn === 'string';
const { HTTP_ANY, HTTP_GET, WL_CONNECTED } = WIFI_CONSTS;
const NO_WIFI = 'This board has no Wi-Fi. Switch to the ESP32, which has Wi-Fi built in.';
/** Servo.write() takes degrees but, like the real library, treats big numbers as a pulse width in microseconds. */
const SERVO_MIN_US = 544, SERVO_MAX_US = 2400;
const usToDeg = (us: number) => Math.round(Math.min(180, Math.max(0, ((us - SERVO_MIN_US) * 180) / (SERVO_MAX_US - SERVO_MIN_US))));

const TYPES = new Set('int long short float double bool boolean byte char void unsigned signed const static volatile String uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t word Servo LiquidCrystal_I2C LiquidCrystal WebServer IPAddress'.split(' '));
const FLOATS = new Set(['float', 'double']);
const FLOAT_FN = new Set(['sqrt', 'pow', 'sin', 'cos', 'tan']);
const MIXED_FN = new Set(['min', 'max', 'abs', 'constrain']);
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
const BIN = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
const STOP = { stop: true }, BRK = { brk: true }, CNT = { cnt: true };
type Flow = void | typeof BRK | typeof CNT | { ret: Val };
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', 0: '\0' };
const unesc = (s: string) => s.replace(/\\(.)/g, (_m, c: string) => ESCAPES[c] ?? c);

function lex(src: string, line0 = 1): { toks: Tok[]; lastLine: number } {
  const re = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|R"([^()\\\s"]{0,16})\([\s\S]*?\)\1"|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])'|0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fFuUlL]*|[A-Za-z_]\w*|<<=|>>=|\+\+|--|&&|\|\||[-+*\/%&|^!=<>]=|<<|>>|[-+*\/%&|^!=<>~?:;,.(){}\[\]]/y;
  const toks: Tok[] = [], defs = new Map<string, Tok[]>();
  let line = line0, pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new SimError(`Unexpected character "${src[pos]}"`, line);
    const s = m[0], c = s[0];
    pos = re.lastIndex;
    if (/\s/.test(c) || s.startsWith('//') || s.startsWith('/*')) { /* skip */ }
    else if (c === '#') {
      const d = /^#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/.exec(s.replace(/\/\/.*$/, '').trim());
      if (d) defs.set(d[1], lex(d[2], line).toks);
    }
    else if (c === '"') toks.push({ t: 'str', v: unesc(s.slice(1, -1)), line });
    else if (s.startsWith('R"')) { const d = m[1] ?? ''; toks.push({ t: 'str', v: s.slice(3 + d.length, s.length - 2 - d.length), line }); }   // a raw string, R"(...)": taken as it is written, over as many lines as it needs
    else if (s === 'PROGMEM') { /* where a real board keeps a constant makes no difference here */ }
    else if (c === "'") toks.push({ t: 'chr', v: unesc(s.slice(1, -1)).charCodeAt(0), line });
    else if (/[0-9.]/.test(c) && s !== '.') {
      const hex = /^0[xX]/.test(s), bin = /^0[bB]/.test(s);
      const body = hex || bin ? s : s.replace(/[fFuUlL]+$/, '');
      const v = hex ? parseInt(body, 16) : bin ? parseInt(body.slice(2), 2) : parseFloat(body);
      toks.push({ t: 'num', v, f: !hex && !bin && (/[.eE]/.test(body) || /[fF]$/.test(s)), line });
    }
    else if (/[A-Za-z_]/.test(c)) {
      const def = defs.get(s);
      if (def) def.forEach(d => toks.push({ ...d, line }));
      else toks.push({ t: 'id', v: s, line });
    }
    else toks.push({ t: 'op', v: s, line });
    line += (s.match(/\n/g) || []).length;
  }
  return { toks, lastLine: line };
}

/** Library objects that are easy to reach for, and what to use here instead. */
const INSTEAD: Record<string, string> = {
  ESP8266WebServer: 'ESP8266WebServer is for the ESP8266 boards. On the ESP32 it is called WebServer: #include <WebServer.h> and WebServer server(80);',
  WiFiServer: 'This simulator has the WebServer library, which answers pages for you: #include <WebServer.h> and WebServer server(80);',
  AsyncWebServer: 'This simulator has the WebServer library instead: #include <WebServer.h> and WebServer server(80);',
};
/** "Adafruit_NeoPixel strip;" and the like: a library object the simulator does not have. */
const unknownType = (name: string, line: number) =>
  new SimError(INSTEAD[name] ?? `"${name}" is not a type this simulator knows. Check the spelling and capital letters. The library objects it has are Servo, LiquidCrystal_I2C and, on the ESP32, WebServer.`, line);

export function parse(src: string): Program {
  const { toks, lastLine } = lex(src);
  let i = 0;
  const EOF: Tok = { t: 'eof', v: 'the end of the code', line: lastLine };
  const peek = (o = 0): Tok => toks[i + o] || EOF;
  const isOp = (v: string, o = 0) => { const t = peek(o); return t.t === 'op' && t.v === v; };
  const isId = (v: string, o = 0) => { const t = peek(o); return t.t === 'id' && t.v === v; };
  const isType = (o = 0) => { const t = peek(o); return t.t === 'id' && TYPES.has(t.v); };
  const eat = (v: string) => (isOp(v) ? toks[i++] : null);
  const show = (t: Tok) => t.t === 'str' ? 'a text string' : t.t === 'eof' ? t.v : `"${t.t === 'chr' ? String.fromCharCode(t.v) : t.v}"`;
  const need = (v: string): Tok => {
    const t = eat(v); if (t) return t;
    const prev = toks[i - 1] || peek();
    if (v === ';') throw new SimError('Missing ";" at the end of this line', prev.line);
    throw new SimError(`Expected "${v}" but found ${show(peek())}`, peek().line);
  };
  const ident = (): IdTok => {
    const t = peek();
    if (t.t !== 'id' || TYPES.has(t.v)) throw new SimError(`Expected a name but found ${show(t)}`, t.line);
    i++; return t as IdTok;
  };
  function readType(): Ty {
    const ty: Ty = { float: false, str: false, isVoid: false };
    let unsigned = false;
    while (isType()) {
      const w = toks[i++].v as string;
      if (FLOATS.has(w)) ty.float = true; if (w === 'String') ty.str = true; if (w === 'void') ty.isVoid = true; if (w === 'Servo') ty.obj = 'Servo';
      if (w === 'char') ty.chr = true; if (w === 'unsigned') unsigned = true;
      if (w === 'LiquidCrystal_I2C') ty.obj = 'LCD';
      if (w === 'WebServer') ty.obj = 'Server';
      if (w === 'IPAddress') ty.str = true;   // an address such as 192.168.1.57, kept as its text
      if (w === 'LiquidCrystal') throw new SimError('This simulator has the I2C display, with four wires: use #include <LiquidCrystal_I2C.h> and LiquidCrystal_I2C lcd(0x27, 16, 2);', toks[i - 1].line);
    }
    while (isOp('*') || isOp('&')) { i++; if (!ty.obj) ty.str = true; }   // a Servo& parameter is still the Servo itself
    if (unsigned || ty.str) ty.chr = false;   // an unsigned char is a small number, and a char* is text
    return ty;
  }
  function declRest(ty: Ty, nameTok: IdTok): DeclStmt {
    const vars: VarDecl[] = [];
    for (;;) {
      const v: VarDecl = { name: nameTok.v, line: nameTok.line };
      if (eat('[')) { v.arr = true; if (!isOp(']')) v.size = expr(); need(']'); }
      if (eat('=')) {
        if (eat('{')) { v.list = []; while (!isOp('}')) { v.list.push(assign()); if (!eat(',')) break; } need('}'); }
        else v.init = assign();
      } else if (isOp('(') && MADE_WITH.has(ty.obj)) {   // LiquidCrystal_I2C lcd(0x27, 16, 2); or WebServer server(80);
        i++; v.ctor = [];
        while (!isOp(')')) { v.ctor.push(assign()); if (!eat(',')) break; }
        need(')');
      } else if (isOp('(')) throw new SimError(`Objects like "${v.name}(...)" are not supported in this simulator yet`, v.line);
      vars.push(v);
      if (!eat(',')) break;
      while (isOp('*')) i++;
      nameTok = ident();
    }
    need(';');
    return { k: 'decl', ty, vars };
  }
  function block(): Stmt {
    need('{'); const body: Stmt[] = [];
    while (!isOp('}')) { if (peek().t === 'eof') throw new SimError('Missing "}" to close a block', peek().line); body.push(stmt()); }
    need('}'); return { k: 'block', body };
  }
  function stmt(): Stmt {
    const t = peek(), line = t.line;
    if (isOp('{')) return block();
    if (eat(';')) return { k: 'empty' };
    if (t.t === 'id') {
      if (t.v === 'if') { i++; need('('); const c = expr(); need(')'); const a = stmt(); let b: Stmt | null = null; if (isId('else')) { i++; b = stmt(); } return { k: 'if', c, a, b, line }; }
      if (t.v === 'while') { i++; need('('); const c = expr(); need(')'); return { k: 'while', c, body: stmt(), line }; }
      if (t.v === 'do') { i++; const body = stmt(); if (!isId('while')) throw new SimError('Expected "while" after the do block', peek().line); i++; need('('); const c = expr(); need(')'); need(';'); return { k: 'dowhile', c, body, line }; }
      if (t.v === 'for') {
        i++; need('(');
        let init: Stmt | null = null, c: Expr | null = null, step: Expr | null = null;
        if (!eat(';')) { if (isType()) { const ty = readType(); init = declRest(ty, ident()); } else { init = { k: 'expr', e: expr(), line }; need(';'); } }
        if (!isOp(';')) c = expr(); need(';');
        if (!isOp(')')) step = expr(); need(')');
        return { k: 'for', init, c, step, body: stmt(), line };
      }
      if (t.v === 'return') { i++; let e: Expr | null = null; if (!isOp(';')) e = expr(); need(';'); return { k: 'return', e, line }; }
      if (t.v === 'break') { i++; need(';'); return { k: 'break' }; }
      if (t.v === 'continue') { i++; need(';'); return { k: 'continue' }; }
      if (t.v === 'switch') {
        i++; need('('); const e = expr(); need(')'); need('{');
        const cases: { v: Expr | null; at: number; line: number }[] = [], body: Stmt[] = [];
        while (!isOp('}')) {
          const c = peek();
          if (c.t === 'eof') throw new SimError('Missing "}" to close the switch', c.line);
          if (isId('case')) { i++; cases.push({ v: ternary(), at: body.length, line: c.line }); need(':'); }
          else if (isId('default')) {
            if (cases.some(x => !x.v)) throw new SimError('A switch can only have one "default:"', c.line);
            i++; need(':'); cases.push({ v: null, at: body.length, line: c.line });
          }
          else if (!cases.length) throw new SimError('Inside a switch, start with a label such as "case 1:" or "default:"', c.line);
          else body.push(stmt());
        }
        need('}');
        return { k: 'switch', e, cases, body, line };
      }
      if (t.v === 'case' || t.v === 'default') throw new SimError(`"${t.v}" only works inside a switch`, line);
      if (isType()) { const ty = readType(); return declRest(ty, ident()); }
      if (peek(1).t === 'id') throw unknownType(t.v, line);
    }
    const e = expr(); need(';');
    return { k: 'expr', e, line };
  }
  function expr(): Expr { let e = assign(); while (eat(',')) e = { k: 'seq', a: e, b: assign() }; return e; }
  function assign(): Expr {
    const l = ternary(), t = peek();
    if (t.t === 'op' && ASSIGN.has(t.v)) {
      if (l.k !== 'id' && l.k !== 'idx') throw new SimError('The left side of "=" must be a variable', t.line);
      i++; return { k: 'assign', op: t.v, l, r: assign(), line: t.line };
    }
    return l;
  }
  function ternary(): Expr { const c = binary(0); if (eat('?')) { const a = assign(); need(':'); const b = assign(); return { k: 'cond', c, a, b }; } return c; }
  function binary(lv: number): Expr {
    if (lv === BIN.length) return unary();
    let l = binary(lv + 1);
    for (;;) { const t = peek(); if (t.t !== 'op' || !BIN[lv].includes(t.v)) return l; i++; l = { k: 'bin', op: t.v, l, r: binary(lv + 1), line: t.line }; }
  }
  function unary(): Expr {
    const t = peek();
    if (t.t === 'op') {
      if (t.v === '!' || t.v === '-' || t.v === '+' || t.v === '~') { i++; return { k: 'un', op: t.v, a: unary(), line: t.line }; }
      if (t.v === '++' || t.v === '--') { i++; return { k: 'incr', op: t.v, pre: true, a: unary(), line: t.line }; }
      if (t.v === '(' && isType(1)) { let j = 1; while (isType(j) || isOp('*', j)) j++; if (isOp(')', j)) { i++; const ty = readType(); need(')'); return { k: 'cast', ty, a: unary() }; } }
    }
    if (isId('sizeof')) { i++; need('('); let n: Expr; if (isType()) { readType(); n = { k: 'num', v: 2 }; } else n = { k: 'sizeof', a: expr() }; need(')'); return n; }
    return postfix();
  }
  function args(): Expr[] { const a: Expr[] = []; need('('); while (!isOp(')')) { a.push(assign()); if (!eat(',')) break; } need(')'); return a; }
  function postfix(): Expr {
    let e = primary();
    for (;;) {
      const t = peek();
      if (isOp('[')) { i++; const ix = expr(); need(']'); e = { k: 'idx', a: e, i: ix, line: t.line }; }
      else if (isOp('(') && e.k === 'id') e = { k: 'call', name: e.name, args: args(), line: e.line };
      else if (isOp('.')) { i++; const n = ident(); if (!isOp('(')) throw new SimError(`Expected "(" after ".${n.v}"`, n.line); e = { k: 'mcall', obj: e, name: n.v, args: args(), line: n.line }; }
      else if (isOp('++') || isOp('--')) { i++; e = { k: 'incr', op: t.v as string, pre: false, a: e, line: t.line }; }
      else return e;
    }
  }
  function primary(): Expr {
    const t = peek();
    if (t.t === 'num') { i++; return { k: 'num', v: t.v, f: t.f }; }
    if (t.t === 'str') { i++; return { k: 'str', v: t.v }; }
    if (t.t === 'chr') { i++; return { k: 'chr', v: t.v }; }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') { i++; return { k: 'num', v: t.v === 'true' ? 1 : 0 }; }
      if (isType() && isOp('(', 1)) { const ty = readType(); const a = args(); return { k: 'cast', ty, a: a[0] || { k: 'num', v: 0 }, digits: a[1] }; }
      if (TYPES.has(t.v)) throw new SimError(`"${t.v}" cannot be used here`, t.line);
      i++; return { k: 'id', name: t.v, line: t.line };
    }
    if (eat('(')) { const e = expr(); need(')'); return e; }
    throw new SimError(`Did not expect ${show(t)} here`, t.line);
  }

  const prog: Program = { globals: [], funcs: new Map() };
  while (peek().t !== 'eof') {
    if (peek().t === 'id' && peek(1).t === 'id' && !isType()) throw unknownType(peek().v as string, peek().line);
    if (!isType()) throw new SimError(`Expected a declaration such as "int x = 0;" or a function such as "void setup() { }" but found ${show(peek())}`, peek().line);
    const ty = readType(), name = ident();
    if (isOp('(') && !MADE_WITH.has(ty.obj)) {   // a function, except that "LiquidCrystal_I2C lcd(0x27, 16, 2);" makes a display and "WebServer server(80);" a server
      need('('); const params: Func['params'] = [];
      while (!isOp(')')) { if (isId('void') && isOp(')', 1)) { i++; break; } const pt = readType(); const pn = ident(); if (eat('[')) need(']'); params.push({ name: pn.v, ty: pt }); if (!eat(',')) break; }
      need(')');
      prog.funcs.set(name.v, { params, ty, body: block(), line: name.line });
    } else prog.globals.push(declRest(ty, name));
  }
  return prog;
}

class Env {
  m = new Map<string, Rec>();
  p: Env | null;
  constructor(p: Env | null) { this.p = p; }
  get(n: string): Rec | undefined { for (let e: Env | null = this; e; e = e.p) { const r = e.m.get(n); if (r) return r; } }
}

/** Runs setup() once and then loop() until ctl.stop is set. Rejects with a SimError when the sketch is wrong. */
export async function run(src: string, hw: Hardware, ctl: RunControl): Promise<void> {
  const prog = parse(src);
  const G = new Env(null);
  let ops = 0, depth = 0;
  const tick = async () => { if (ctl.stop) throw STOP; if (++ops % 400 === 0) await hw.pause(); };
  const err = (msg: string, line: number) => new SimError(msg, line);
  const constOf = (name: string): number | undefined => (Object.hasOwn(hw.consts, name) ? hw.consts[name] : undefined);

  function isF(n: Expr, env: Env): boolean {
    switch (n.k) {
      case 'num': return !!n.f;
      case 'id': return !!env.get(n.name)?.float;
      case 'idx': return isF(n.a, env);
      case 'bin': return '+-*/%'.includes(n.op) && (isF(n.l, env) || isF(n.r, env));
      case 'un': return n.op !== '!' && isF(n.a, env);
      case 'incr': return isF(n.a, env);
      case 'assign': return isF(n.l, env);
      case 'cond': return isF(n.a, env) || isF(n.b, env);
      case 'seq': return isF(n.b, env);
      case 'cast': return n.ty.float;
      case 'call': if (FLOAT_FN.has(n.name)) return true; if (MIXED_FN.has(n.name)) return n.args.some(a => isF(a, env)); return !!prog.funcs.get(n.name)?.ty.float;
      case 'mcall': return n.name === 'toFloat' || n.name === 'parseFloat';
    }
    return false;
  }
  /** Whether an expression is a char, which prints as a character: a char literal or variable, a cast to char, one character of a String or a char array, or a function that returns a char. */
  function isC(n: Expr, env: Env): boolean {
    switch (n.k) {
      case 'chr': return true;
      case 'id': return !!env.get(n.name)?.chr;
      case 'idx': { if (n.a.k !== 'id') return false; const r = env.get(n.a.name); return !!r && (!!r.chr || typeof r.v === 'string'); }
      case 'cast': return !!n.ty.chr;
      case 'cond': return isC(n.a, env) && isC(n.b, env);
      case 'assign': return isC(n.l, env);
      case 'call': return !!prog.funcs.get(n.name)?.ty.chr;
      case 'mcall': return n.name === 'charAt';
    }
    return false;
  }
  const fmt = (v: Val, n: Expr | undefined, env: Env, digits?: Val): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[array]';
    if (isServo(v)) return '[Servo]';
    if (isLcd(v)) return '[LCD]';
    if (isWeb(v)) return '[WebServer]';
    if (isFn(v)) return '[function]';
    if (n && isC(n, env)) return String.fromCharCode(v);
    if (n && isF(n, env)) return Number(v).toFixed(digits == null ? 2 : (digits as number));
    return String(Math.trunc(v));
  };
  /* What is typed into the Serial Monitor arrives here. Reading it works as Arduino's Stream does: the timed reads wait up to Serial.setTimeout() (1 s at first) for a character. */
  const inbox = hw.serialIn ?? [];
  let serialTimeout = 1000;
  const waitForInput = async () => {
    const start = hw.now();
    while (!inbox.length && hw.now() - start < serialTimeout) { await hw.sleep(Math.min(10, serialTimeout)); if (ctl.stop) throw STOP; }
  };
  const timedRead = async () => { await waitForInput(); return inbox.length ? inbox.shift()! : -1; };
  const timedPeek = async () => { await waitForInput(); return inbox.length ? inbox[0] : -1; };
  const isDigit = (c: number) => c >= 48 && c <= 57;
  /** Serial.parseInt() and parseFloat(): skip whatever cannot start a number, read while the number goes on, and leave the rest (such as the newline) to be read later. 0 when no number came in time. */
  async function parseNumber(float: boolean): Promise<number> {
    for (;;) { const c = await timedPeek(); if (c < 0) return 0; if (isDigit(c) || c === 45 || (float && c === 46)) break; inbox.shift(); }
    let text = '';
    for (;;) {
      const c = await timedPeek();
      if (c < 0 || !(isDigit(c) || (c === 45 && !text) || (float && c === 46 && !text.includes('.')))) break;
      text += String.fromCharCode(c); inbox.shift();
    }
    const v = float ? parseFloat(text) : parseInt(text, 10);
    return Number.isFinite(v) ? v : 0;
  }
  /** The String methods that change the String itself and give nothing back, as in Arduino. */
  const CHANGES_STRING = new Set(['trim', 'toLowerCase', 'toUpperCase']);
  const coerce = (rec: { float: boolean; str: boolean }, v: Val): Val => {
    if (isServo(v) || isLcd(v) || isWeb(v) || isFn(v)) return v;
    if (rec.str) return typeof v === 'string' ? v : String(v);
    if (typeof v === 'string') return v;
    if (rec.float) return Number(v);
    return Number.isFinite(v) ? Math.trunc(v as number) : 0;
  };
  function arith(op: string, a: number, b: number, floaty: boolean, line: number): number {
    switch (op) {
      case '+': return a + b; case '-': return a - b; case '*': return a * b;
      case '/': if (floaty) return a / b; if (b === 0) throw err('Division by zero', line); return Math.trunc(a / b);
      case '%': if (b === 0) throw err('Division by zero', line); return a % b;
      case '&': return a & b; case '|': return a | b; case '^': return a ^ b; case '<<': return a << b; case '>>': return a >> b;
      case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
      case '<': return a < b ? 1 : 0; case '>': return a > b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
    }
    throw err(`Cannot use "${op}" here`, line);
  }
  const outside = (ix: number, len: number) => `Index ${ix} is outside the array (it has ${len} items, numbered 0 to ${len - 1})`;
  async function slot(n: Expr, env: Env): Promise<{ get(): Val; set(v: Val): Val }> {   // a place that can be read and written
    if (n.k === 'id') {
      const r = env.get(n.name);
      if (!r) throw err(constOf(n.name) !== undefined ? `"${n.name}" is a built-in constant and cannot be changed` : `"${n.name}" is not defined. Check the spelling, or declare it first.`, n.line);
      return { get: () => r.v, set: v => (r.v = coerce(r, v)) };
    }
    if (n.k === 'idx') {
      const a = await ev(n.a, env), ix = (await ev(n.i, env)) as number;
      if (!Array.isArray(a)) throw err('Only arrays can be changed with [ ]', n.line);
      if (ix < 0 || ix >= a.length) throw err(outside(ix, a.length), n.line);
      const f = isF(n.a, env);
      return { get: () => a[ix], set: v => (a[ix] = f ? Number(v) : Math.trunc(v as number)) };
    }
    throw err('This cannot be assigned to', 'line' in n ? n.line : 0);
  }
  async function ev(n: Expr, env: Env): Promise<Val> {
    switch (n.k) {
      case 'num': case 'chr': case 'str': return n.v;
      case 'id': {
        const r = env.get(n.name); if (r) return r.v;
        const c = constOf(n.name); if (c !== undefined) return c;
        if (prog.funcs.has(n.name)) return { fn: n.name };   // a function named without brackets, to be run later: server.on("/", handleRoot)
        throw err(`"${n.name}" is not defined. Check the spelling, or declare it first.`, n.line);
      }
      case 'bin': {
        if (n.op === '&&') return (await ev(n.l, env)) && (await ev(n.r, env)) ? 1 : 0;
        if (n.op === '||') return (await ev(n.l, env)) || (await ev(n.r, env)) ? 1 : 0;
        const a = await ev(n.l, env), b = await ev(n.r, env);
        if (n.op === '+' && (typeof a === 'string' || typeof b === 'string')) return fmt(a, n.l, env) + fmt(b, n.r, env);
        return arith(n.op, a as number, b as number, isF(n.l, env) || isF(n.r, env), n.line);
      }
      case 'un': { const a = (await ev(n.a, env)) as number; return n.op === '!' ? (a ? 0 : 1) : n.op === '-' ? -a : n.op === '~' ? ~a : +a; }
      case 'incr': { const s = await slot(n.a, env), old = s.get(), nv = s.set((old as number) + (n.op === '++' ? 1 : -1)); return n.pre ? nv : old; }
      case 'assign': {
        const s = await slot(n.l, env); let v = await ev(n.r, env);
        if (n.op !== '=') {
          const cur = s.get(), op = n.op.slice(0, -1);
          v = op === '+' && typeof cur === 'string' ? cur + fmt(v, n.r, env) : arith(op, cur as number, v as number, isF(n.l, env) || isF(n.r, env), n.line);
        }
        return s.set(v);
      }
      case 'cond': return (await ev(n.c, env)) ? ev(n.a, env) : ev(n.b, env);
      case 'seq': await ev(n.a, env); return ev(n.b, env);
      case 'cast': {
        const v = await ev(n.a, env);
        if (n.ty.str) return fmt(v, n.a, env, n.digits ? await ev(n.digits, env) : undefined);
        if (typeof v === 'string') return n.ty.float ? parseFloat(v) || 0 : parseInt(v, 10) || 0;
        return n.ty.float ? v : Math.trunc(v as number);
      }
      case 'sizeof': { if (n.a.k === 'idx') return 2; const v = await ev(n.a, env); return Array.isArray(v) ? v.length * 2 : typeof v === 'string' ? v.length + 1 : 2; }
      case 'idx': {
        const a = await ev(n.a, env), ix = (await ev(n.i, env)) as number;
        if (typeof a === 'string') return ix < a.length ? a.charCodeAt(ix) : 0;
        if (!Array.isArray(a)) throw err('[ ] only works on arrays', n.line);
        if (ix < 0 || ix >= a.length) throw err(outside(ix, a.length), n.line);
        return a[ix];
      }
      case 'call': return call(n, env);
      case 'mcall': return mcall(n, env);
    }
  }
  async function callFn(name: string, f: Func, vals: Val[], line: number): Promise<Val> {
    if (vals.length !== f.params.length) throw err(`${name}() needs ${f.params.length} value(s) but got ${vals.length}`, line);
    if (++depth > 200) throw err(`${name}() keeps calling itself and never stops`, line);
    const env = new Env(G);
    f.params.forEach((p, k) => { const rec: Rec = { float: p.ty.float, str: p.ty.str, chr: !!p.ty.chr, v: 0 }; rec.v = Array.isArray(vals[k]) ? vals[k] : coerce(rec, vals[k]); env.m.set(p.name, rec); });
    const r = await exec(f.body, env);
    depth--;
    return r && 'ret' in r ? r.ret : 0;
  }
  async function call(n: CallExpr, env: Env): Promise<Val> {
    const vals: Val[] = [];
    for (const x of n.args) vals.push(await ev(x, env));
    const f = prog.funcs.get(n.name);
    if (f) return callFn(n.name, f, vals, n.line);
    const a = vals as number[];
    const need = (k: number) => { if (a.length < k) throw err(`${n.name}() needs ${k} value(s) inside the brackets`, n.line); };
    switch (n.name) {
      case 'pinMode': need(2); hw.pinMode(a[0], a[1]); return 0;
      case 'digitalWrite': need(2); hw.digitalWrite(a[0], a[1]); return 0;
      case 'digitalRead': need(1); return hw.digitalRead(a[0]);
      case 'analogRead': need(1); return hw.analogRead(a[0]);
      case 'analogWrite': need(2); hw.analogWrite(a[0], a[1]); return 0;
      case 'delay': need(1); await hw.sleep(Math.max(0, a[0])); if (ctl.stop) throw STOP; return 0;
      case 'delayMicroseconds': return 0;
      case 'millis': return Math.floor(hw.now());
      case 'micros': return Math.floor(hw.now() * 1000);
      case 'map': need(5); if (a[2] === a[1]) throw err('map() needs a starting range with two different numbers', n.line); return Math.trunc((a[0] - a[1]) * (a[4] - a[3]) / (a[2] - a[1]) + a[3]);
      case 'constrain': need(3); return Math.min(Math.max(a[0], a[1]), a[2]);
      case 'min': need(2); return Math.min(a[0], a[1]);
      case 'max': need(2); return Math.max(a[0], a[1]);
      case 'abs': need(1); return Math.abs(a[0]);
      case 'sqrt': need(1); return Math.sqrt(a[0]);
      case 'pow': need(2); return Math.pow(a[0], a[1]);
      case 'sin': return Math.sin(a[0]); case 'cos': return Math.cos(a[0]); case 'tan': return Math.tan(a[0]);
      case 'round': return Math.round(a[0]);
      case 'isnan': return Number.isNaN(a[0]) ? 1 : 0;
      case 'random': { need(1); const lo = a.length > 1 ? a[0] : 0, hi = a.length > 1 ? a[1] : a[0]; return lo + Math.floor(Math.random() * Math.max(0, hi - lo)); }
      case 'randomSeed': return 0;
      case 'tone': need(2); hw.tone(a[0], a[1], a[2]); return 0;
      case 'noTone': need(1); hw.noTone(a[0]); return 0;
      case 'pulseIn': need(2); return hw.pulseIn(a[0]);
      case 'touchRead': need(1); return hw.touchRead(a[0]);
      case 'F': return vals[0] ?? '';   // F("text") keeps text out of a real board's memory; here it is just the text
    }
    throw err(`"${n.name}()" is not a function this simulator knows. Check the spelling and capital letters.`, n.line);
  }
  /** `asStatement`: the call is a line of its own, so nothing is done with what it gives back. */
  async function mcall(n: McallExpr, env: Env, asStatement = false): Promise<Val> {
    const a: Val[] = [];
    for (const x of n.args) a.push(await ev(x, env));
    if (n.obj.k === 'id' && n.obj.name === 'Serial' && !env.get('Serial')) {
      const charArg = (k: number) => { if (a.length <= k) throw err(`Serial.${n.name}() needs a character inside the brackets, such as '\\n'`, n.line); return a[k] as number; };
      switch (n.name) {
        case 'begin': return 0;
        case 'print': case 'println': hw.print((n.args.length ? fmt(a[0], n.args[0], env, a[1]) : '') + (n.name === 'println' ? '\n' : '')); return 0;
        case 'printf': {
          let k = 1;
          hw.print(String(a[0]).replace(/%(?:\.(\d+))?([dfsuc%])/g, (_m, d: string | undefined, c: string) =>
            c === '%' ? '%' : c === 'f' ? Number(a[k++]).toFixed(d == null ? 6 : +d) : c === 'c' ? String.fromCharCode(a[k++] as number) : c === 's' ? String(a[k++]) : String(Math.trunc(a[k++] as number))));
          return 0;
        }
        case 'available': return inbox.length;
        case 'read': return inbox.length ? inbox.shift()! : -1;
        case 'peek': return inbox.length ? inbox[0] : -1;
        case 'setTimeout': if (!a.length) throw err('Serial.setTimeout() needs a number of milliseconds inside the brackets', n.line); serialTimeout = Math.max(0, a[0] as number); return 0;
        case 'flush': return 0;
        case 'readString': case 'readStringUntil': {   // reads until the character (which is taken but not kept), or until nothing more comes in time
          const until = n.name === 'readStringUntil' ? charArg(0) : null;
          let text = '';
          for (;;) { const c = await timedRead(); if (c < 0 || c === until) break; text += String.fromCharCode(c); }
          return text;
        }
        case 'parseInt': return parseNumber(false);
        case 'parseFloat': return parseNumber(true);
      }
      throw err(`Serial.${n.name}() is not supported in this simulator`, n.line);
    }
    if (n.obj.k === 'id' && n.obj.name === 'WiFi' && !env.get('WiFi')) {
      const net = hw.net, now = hw.now();
      if (!net) throw err(NO_WIFI, n.line);
      switch (n.name) {
        case 'begin':
          if (typeof a[0] !== 'string') throw err('WiFi.begin() needs the Wi-Fi\'s name and its password, each in quotes, like WiFi.begin("Workshop", "solder123")', n.line);
          net.join(a[0], typeof a[1] === 'string' ? a[1] : '', now);
          return net.status(now);
        case 'status': return net.status(now);
        case 'isConnected': return net.status(now) === WL_CONNECTED ? 1 : 0;
        case 'localIP': return net.ip(now);
        case 'SSID': return net.ssid(now);
        case 'RSSI': return net.status(now) === WL_CONNECTED ? -54 : 0;   // a strong signal: the router is across the room
        case 'macAddress': return '24:6F:28:5C:3A:91';
        case 'disconnect': net.leave(now); return 1;
        case 'mode': case 'setHostname': case 'setSleep': case 'setAutoReconnect': case 'persistent': return 1;
      }
      throw err(`WiFi.${n.name}() is not supported in this simulator. It has begin(), status(), localIP(), isConnected(), SSID(), RSSI(), macAddress(), disconnect() and mode().`, n.line);
    }
    const v = await ev(n.obj, env);
    if (isWeb(v)) return webCall(v, n, a, env);
    if (isServo(v)) {
      const num = (k: number) => { if (a.length <= k) throw err(`.${n.name}() needs ${k + 1} value(s) inside the brackets`, n.line); return a[k] as number; };
      switch (n.name) {
        case 'attach': {
          const pin = num(0);
          if (v.pin >= 0 && v.pin !== pin) hw.servo(v.pin, null);
          v.pin = pin; hw.servo(pin, v.angle);
          return 1;
        }
        case 'write': case 'writeMicroseconds': {
          const x = num(0);
          v.angle = n.name === 'writeMicroseconds' || x >= SERVO_MIN_US ? usToDeg(x) : Math.round(Math.min(180, Math.max(0, x)));
          if (v.pin >= 0) hw.servo(v.pin, v.angle);
          return 0;
        }
        case 'read': return v.angle;
        case 'readMicroseconds': return Math.round(SERVO_MIN_US + (v.angle * (SERVO_MAX_US - SERVO_MIN_US)) / 180);
        case 'attached': return v.pin >= 0 ? 1 : 0;
        case 'detach': if (v.pin >= 0) hw.servo(v.pin, null); v.pin = -1; return 0;
      }
      throw err(`A Servo has no ".${n.name}()". It has attach(), write(), read(), attached() and detach().`, n.line);
    }
    if (isLcd(v)) {
      const send = (op: string, args: number[] = []) => hw.lcd?.(v.addr, op, args);
      const num = (k: number) => { if (typeof a[k] !== 'number') throw err(`.${n.name}() needs ${k + 1} number(s) inside the brackets`, n.line); return a[k] as number; };
      const codes = (text: string) => Array.from(text, ch => ch.charCodeAt(0));
      switch (n.name) {
        case 'init': case 'begin': send('init', [v.light ? 1 : 0]); return 0;
        case 'backlight': v.light = true; send('light', [1]); return 0;
        case 'noBacklight': v.light = false; send('light', [0]); return 0;
        case 'setBacklight': v.light = !!num(0); send('light', [v.light ? 1 : 0]); return 0;
        case 'clear': case 'home': case 'display': case 'noDisplay': case 'blink': case 'noBlink': case 'noCursor': send(n.name); return 0;
        case 'cursor': send('showCursor'); return 0;
        case 'scrollDisplayLeft': send('scrollLeft'); return 0;
        case 'scrollDisplayRight': send('scrollRight'); return 0;
        case 'setCursor': send('cursor', [num(0), Math.min(num(1), v.rows - 1)]); return 0;
        case 'print': case 'println': {   // the same text as Serial.print would send. println adds "\r\n", which a display shows as two junk characters
          const text = (n.args.length ? fmt(a[0], n.args[0], env, a[1]) : '') + (n.name === 'println' ? '\r\n' : '');
          send('write', codes(text));
          return text.length;
        }
        case 'write': { const c = typeof a[0] === 'string' ? codes(a[0]) : [num(0)]; send('write', c); return c.length; }
        case 'createChar': throw err('lcd.createChar() is not supported in this simulator yet', n.line);
      }
      throw err(`A LiquidCrystal_I2C display has no ".${n.name}()". It has init(), backlight(), noBacklight(), clear(), home(), setCursor(), print(), write(), cursor(), noCursor(), blink(), noBlink(), display(), noDisplay(), scrollDisplayLeft() and scrollDisplayRight().`, n.line);
    }
    if (typeof v === 'string') {
      const text = (k: number): string => { const x = a[k]; return typeof x === 'string' ? x : typeof x === 'number' ? String.fromCharCode(x) : ''; };   // given as text, or as one character
      const num = (k: number) => { if (typeof a[k] !== 'number') throw err(`.${n.name}() needs a number inside the brackets`, n.line); return a[k] as number; };
      if (CHANGES_STRING.has(n.name)) {
        if (!asStatement) throw err(`${n.name}() changes the String itself and gives nothing back, so it cannot be used as a value. Write it on a line of its own, like "text.${n.name}();".`, n.line);
        const changed = n.name === 'trim' ? v.trim() : n.name === 'toLowerCase' ? v.toLowerCase() : v.toUpperCase();
        if (n.obj.k === 'id' || n.obj.k === 'idx') (await slot(n.obj, env)).set(changed);
        return 0;
      }
      switch (n.name) {
        case 'length': return v.length;
        case 'toInt': return parseInt(v, 10) || 0;
        case 'toFloat': return parseFloat(v) || 0;
        case 'equals': return v === text(0) ? 1 : 0;
        case 'equalsIgnoreCase': return v.toLowerCase() === text(0).toLowerCase() ? 1 : 0;
        case 'indexOf': return v.indexOf(text(0), a.length > 1 ? num(1) : 0);
        case 'lastIndexOf': return v.lastIndexOf(text(0));
        case 'startsWith': return v.startsWith(text(0)) ? 1 : 0;
        case 'endsWith': return v.endsWith(text(0)) ? 1 : 0;
        case 'substring': return v.substring(num(0), a.length > 1 ? num(1) : v.length);
        case 'charAt': { const ix = num(0); return ix >= 0 && ix < v.length ? v.charCodeAt(ix) : 0; }
        case 'toString': case 'c_str': return v;   // an address from WiFi.localIP() is already text here, and so is a String
      }
      throw err(`A String has no ".${n.name}()" in this simulator. It has length(), trim(), toLowerCase(), toUpperCase(), toInt(), toFloat(), equals(), equalsIgnoreCase(), indexOf(), lastIndexOf(), startsWith(), endsWith(), substring(), charAt() and c_str().`, n.line);
    }
    throw err(`".${n.name}()" is not supported in this simulator`, n.line);
  }
  /** What a WebServer does. Its handlers run inside server.handleClient(), one request at a time, as on the real board. */
  async function webCall(v: WebObj, n: McallExpr, a: Val[], env: Env): Promise<Val> {
    const net = hw.net!, line = n.line;
    const text = (k: number, what: string) => { if (typeof a[k] !== 'string') throw err(`server.${n.name}() needs ${what} in quotes`, line); return a[k] as string; };
    const handler = (k: number): string => {
      const f = a[k];
      if (isFn(f)) return f.fn;
      throw err(`server.${n.name}() needs the name of the function that answers, such as handleRoot, written without brackets. With brackets, the function runs at once instead of when the phone asks.`, line);
    };
    switch (n.name) {
      case 'on': {
        if (a.length < 2) throw err('server.on() needs an address and the function that answers it, like server.on("/", handleRoot)', line);
        const path = text(0, 'the address, such as "/on",');
        if (!path.startsWith('/')) throw err(`An address on the board starts with "/", like "/${path}"`, line);
        v.routes.push({ path, method: a.length > 2 ? (a[1] as number) : HTTP_ANY, fn: handler(a.length - 1) });
        return 0;
      }
      case 'onNotFound': v.notFound = handler(0); return 0;
      case 'begin': net.listen(v.port, hw.now()); return 0;
      case 'close': case 'stop': net.close(v.port, hw.now()); return 0;
      case 'handleClient': { const req = net.next(v.port, hw.now()); if (req) await serve(v, req, line); return 0; }
      case 'send': {
        if (!v.req) throw err('server.send() answers the phone, so it only works inside a function the server runs for an address. If you wrote server.on("/", handleRoot()), take the brackets off: server.on("/", handleRoot)', line);
        if (typeof a[0] !== 'number') throw err('server.send() needs a status number first, like server.send(200, "text/html", page)', line);
        if (!v.sent) net.answer(v.req, { kind: 'page', status: a[0], type: a.length > 1 ? String(a[1]) : 'text/html', body: a.length > 2 ? fmt(a[2], n.args[2], env) : '' }, v.headers, hw.now());
        v.sent = true;   // a second send() in the same handler goes nowhere: the phone already has its answer
        return 0;
      }
      case 'sendHeader': v.headers.push([text(0, 'the header\'s name'), String(a[1] ?? '')]); return 0;
      case 'arg': { const args = v.req?.args ?? []; return typeof a[0] === 'number' ? args[a[0]]?.[1] ?? '' : args.find(([k]) => k === a[0])?.[1] ?? ''; }
      case 'argName': return v.req?.args[a[0] as number]?.[0] ?? '';
      case 'hasArg': return v.req?.args.some(([k]) => k === a[0]) ? 1 : 0;
      case 'args': return v.req?.args.length ?? 0;
      case 'uri': return v.req?.path ?? '';
      case 'method': return v.req?.method ?? HTTP_GET;
    }
    throw err(`A WebServer has no ".${n.name}()" in this simulator. It has on(), onNotFound(), begin(), handleClient(), send(), sendHeader(), arg(), hasArg(), args(), argName(), uri(), method() and close().`, line);
  }
  /** Answers one request: runs the handler for its address, or the not-found one, or sends the library's own "Not found" page. */
  async function serve(v: WebObj, req: Visit, line: number) {
    const net = hw.net!;
    v.req = req; v.sent = false; v.headers = [];
    try {
      const fn = v.routes.find(r => r.path === req.path && (r.method === HTTP_ANY || r.method === req.method))?.fn ?? v.notFound;
      if (fn) {
        await callFn(fn, prog.funcs.get(fn)!, [], line);
        if (!v.sent) net.answer(req, { kind: 'silent' }, [], hw.now());
      } else net.answer(req, { kind: 'page', status: 404, type: 'text/html', body: `Not found: ${req.path}` }, [], hw.now());   // the library's own words
    } finally { v.req = null; }
  }
  async function declare(n: DeclStmt, env: Env): Promise<void> {
    for (const d of n.vars) {
      const rec: Rec = { float: n.ty.float, str: n.ty.str && !d.arr, chr: !!n.ty.chr, v: 0 };
      const fresh = (): ServoObj => ({ servo: true, pin: -1, angle: 90 });   // a new servo starts at 90°, as in the real library
      if (n.ty.obj === 'LCD') {
        const how = 'LiquidCrystal_I2C lcd(0x27, 16, 2);';
        if (d.arr || d.init || d.list) throw err(`A display is made with "${how}": its address, then its columns and rows`, d.line);
        if (!d.ctor || d.ctor.length < 3) throw err(`LiquidCrystal_I2C needs the display's address, columns and rows, like "${how}"`, d.line);
        const nums: number[] = [];
        for (const x of d.ctor.slice(0, 3)) nums.push(Math.trunc((await ev(x, env)) as number));
        rec.v = { lcd: true, addr: nums[0], cols: nums[1], rows: nums[2], light: false };   // the backlight stays off at init() until backlight() is called, as in the library
        env.m.set(d.name, rec);
        continue;
      }
      if (n.ty.obj === 'Server') {
        if (!hw.net) throw err(NO_WIFI, d.line);
        if (d.arr || d.init || d.list) throw err('A web server is made with "WebServer server(80);": the port it listens on, in brackets', d.line);
        const port = d.ctor?.length ? Math.trunc((await ev(d.ctor[0], env)) as number) : 80;   // 80 is the port a browser asks on when the address names none
        rec.v = { web: true, port, routes: [], notFound: null, req: null, sent: false, headers: [] };
        env.m.set(d.name, rec);
        continue;
      }
      if (n.ty.obj) {
        if (d.init || d.list) throw err(`A ${n.ty.obj} is made with "${n.ty.obj} ${d.name};" and set up later with ${d.name}.attach(pin)`, d.line);
        rec.v = d.arr ? Array.from({ length: d.size ? Math.max(0, (await ev(d.size, env)) as number) : 0 }, fresh) : fresh();
      } else if (d.arr) {
        if (d.list) { const items: Val[] = []; for (const it of d.list) { const x = await ev(it, env); items.push(typeof x === 'string' || n.ty.float ? x : Math.trunc(x as number)); } rec.v = items; }
        else if (d.init) rec.v = await ev(d.init, env);
        else rec.v = new Array<Val>(d.size ? Math.max(0, (await ev(d.size, env)) as number) : 0).fill(0);
      } else rec.v = coerce(rec, d.init ? await ev(d.init, env) : (rec.str ? '' : 0));
      env.m.set(d.name, rec);
    }
  }
  /** The line a statement starts on, or 0 for the ones that are only braces or keywords. */
  const lineOf = (n: Stmt): number => (n.k === 'decl' ? n.vars[0]?.line ?? 0 : 'line' in n ? n.line : 0);
  async function exec(n: Stmt, env: Env): Promise<Flow> {
    await tick();
    if (ctl.step) {
      const line = lineOf(n), held = line ? ctl.step(line) : undefined;
      if (held) { await held; if (ctl.stop) throw STOP; }
    }
    switch (n.k) {
      case 'block': { const e = new Env(env); for (const s of n.body) { const r = await exec(s, e); if (r) return r; } return; }
      case 'decl': return declare(n, env);
      case 'expr': if (n.e.k === 'mcall') await mcall(n.e, env, true); else await ev(n.e, env); return;
      case 'if': if (await ev(n.c, env)) return exec(n.a, env); if (n.b) return exec(n.b, env); return;
      case 'while': while (await ev(n.c, env)) { const r = await exec(n.body, env); if (r === BRK) break; if (r && r !== CNT) return r; await tick(); } return;
      case 'dowhile': do { const r = await exec(n.body, env); if (r === BRK) break; if (r && r !== CNT) return r; await tick(); } while (await ev(n.c, env)); return;
      case 'for': {
        const e = new Env(env);
        if (n.init) await exec(n.init, e);
        while (!n.c || await ev(n.c, e)) { const r = await exec(n.body, e); if (r === BRK) break; if (r && r !== CNT) return r; if (n.step) await ev(n.step, e); await tick(); }
        return;
      }
      case 'switch': {
        const v = await ev(n.e, env);
        let start = -1;
        for (const c of n.cases) if (c.v && (await ev(c.v, env)) === v) { start = c.at; break; }
        if (start < 0) start = n.cases.find(c => !c.v)?.at ?? -1;
        if (start < 0) return;
        const e = new Env(env);
        for (let k = start; k < n.body.length; k++) {   // runs on into the next case until a break, as in C++
          const r = await exec(n.body[k], e);
          if (r === BRK) return;
          if (r) return r;
        }
        return;
      }
      case 'return': return { ret: n.e ? await ev(n.e, env) : 0 };
      case 'break': return BRK;
      case 'continue': return CNT;
    }
  }

  try {
    for (const g of prog.globals) await declare(g, G);
    const setup = prog.funcs.get('setup'), loop = prog.funcs.get('loop');
    if (!setup || !loop) throw err('A sketch needs both a setup() and a loop() function', 1);
    await callFn('setup', setup, [], setup.line);
    while (!ctl.stop) { await callFn('loop', loop, [], loop.line); ctl.onLoop?.(); await hw.pause(); }
  } catch (e) { if (e !== STOP) throw e; }
}
