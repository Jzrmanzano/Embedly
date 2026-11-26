/* Builds the 3D bench for one lesson: the board, the breadboard and the wired parts.
   Everything is modelled in millimetres from toon-shaded solids with an ink outline. */
import * as T from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { ESP_FAR, ESP_HOLES, ESP_NEAR } from '../data/boards';
import { bands, ohmsLabel } from '../data/resistor';
import { COLS as LCD_COLS, DARK_LCD, LCD_PINS, type LcdView } from '../sim/lcd';
import { BB_DEPTH, BB_HEIGHT, bbLength, CANDLE_REACH, colX, LCD_AT, PAD_AT, placeOf, plantPlace, probeAt, RAILZ, ROWZ, SERVO_REACH, soilPinXZ, tableLayout, UNO_AT, UNO_HEADERS, wallZ } from '../state/table';
import { BREADBOARD_COLS, breadboardName, itemId, kindOf, MAIN_COLS, SOIL_PINS, soilPoint, type BoardId, type BreadboardSize, type Info, type Item, type RowModule, type SoilItem } from '../types';

export interface WorldSpec {
  board: BoardId;
  /** Board parts to label, or null to leave the board unlabelled. */
  parts: Record<string, Info> | null;
  info: Record<string, Info>;
}
/** A label over a part. A `sign` makes it a polarity badge on one leg of a part (an LED's long leg is +, its short leg is −) instead of the part's name. */
export interface Hot { id: string; title: string; pos: T.Vector3; sign?: '+' | '-' }
export interface World {
  group: T.Group;
  hots: Hot[];
  /** Drives a part: LED brightness, button pressed, knob position, buzzer frequency, wall distance. */
  set(id: string, value: number): void;
  /** Shows what an LCD displays. */
  lcd(id: string, view: LcdView): void;
  highlight(id: string | null): void;
  animate(timeMs: number): void;
  /** Replaces every placed part and wire. LEDs in `burnt` show as burnt out. */
  /** Builds the parts. `settled` is the bench as it was before a drag began: the touch pad and the LCD are placed from it, so they stay put while something is dragged. */
  setCircuit(items: Item[], burnt: string[], settled?: Item[]): void;
  /** An LED burns out: it turns black and lets out a puff of smoke. */
  burn(id: string): void;
  puff(at: T.Vector3, kind: 'smoke' | 'spark'): void;
  /** Where a connection point is, or null when the name is not one. */
  anchor(name: string): T.Vector3 | null;
  /** Rings the point under the pointer and the first point of a part being placed, with a line between them. */
  markers(hover: string | null, pending: string | null): void;
  /** The middle of the bench's own breadboard in the scene, from which places on the table are measured (src/state/table.ts). */
  origin: T.Vector3;
  /** The size of the drawing in device pixels and how many of them make a screen pixel, so the ink lines keep their width. */
  resize(width: number, height: number, pixelRatio: number): void;
  /** Shadows in the colour that suits the page: warm on the light theme, black on the dark one. */
  shade(dark: boolean): void;
  dispose(): void;
}

type Vec = [number, number, number];
type Solid = T.Mesh<T.BufferGeometry, T.MeshToonMaterial>;
/** How a solid is made: `nh` leaves out its outline and ink (small details), `own` gives it ink lines of its own because it moves by itself, `plain` keeps its outline but leaves out the ink lines (fine ridges), `ry` turns it about the vertical. */
interface Opt { nh?: number; glow?: number; gi?: number; rx?: number; ry?: number; rz?: number; ax?: 'x' | 'z'; seg?: number; y?: number; own?: boolean; plain?: boolean }
interface TextOpt { up?: boolean; color?: string; bold?: boolean; align?: CanvasTextAlign }
interface Pen {
  text(s: string, x: number, z: number, size: number, o?: TextOpt): void;
  line(pts: number[][], w: number, color: string): void;
  rect(x: number, z: number, w: number, d: number, color: string, fill?: boolean): void;
  dot(x: number, z: number, r: number, color: string): void;
}
interface BuiltBoard {
  group: T.Group; parts: Record<string, T.Group>; hot: Record<string, Vec>; anchors: Record<string, Vec>;
  W: number; D: number; setLed(v: number): void; usbAt: Vec; plug: Vec;
}
/** A part as built. `more` holds the setters of a part with more than one on-screen value, by what follows its id (":y", ":sw"). */
interface Made { g: T.Group; set?: (v: number) => void; more?: Record<string, (v: number) => void>; top?: T.Vector3; burn?: () => void; lcd?: (v: LcdView) => void }

const INK = 0x1b2430, HILITE = 0xe2572b, METAL = 0xc9ced3, GOLD = 0xd9b24a, DARK = 0x23272e;
const WIRE: Record<string, number> = { red: 0xd6453d, black: 0x2f353d, orange: 0xf08a24, yellow: 0xe8c22e, green: 0x3aa655, blue: 0x3577d4, white: 0xe9ecef, purple: 0x8d5bd1 };
const HT = 0.32;
/** The potted plant's heights: its pot, the top of the soil, and the tips and the head of the soil probe standing in it. */
const POT_H = 30, SOIL_TOP = POT_H - 1.6, PROBE_TIP = SOIL_TOP - 22, PROBE_TOP = PROBE_TIP + 51.1;
/** Colours used by more than one part: the bright metal of legs and leads, the tan of a resistor, the cream of a breadboard. */
const LEAD = 0xb8c0c8, TAN = 0xe2c89a, CREAM = 0xf4f1e8;
/** How wide the ink lines along the hard edges are, in screen pixels. */
const INK_PX = 1.2;

const grad = new T.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, T.RedFormat);
grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;

/** A flat outline with the corners rounded off, and a ring of teeth (the ridges round a knob), for solids pushed up from a shape. Shapes are drawn seen from above, with y pointing away from the student. */
function gearShape(outer: number, inner: number, teeth: number): T.Shape {
  const s = new T.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2, r = i % 2 ? inner : outer;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
/** A circle of radius r with a straight side cut off at distance `flat` from its middle, on the +x side: an LED's rim, a TO-92 case. */
function dShape(r: number, flat: number): T.Shape {
  const a = Math.acos(flat / r), s = new T.Shape();
  s.absarc(0, 0, r, a, Math.PI * 2 - a, false);
  s.closePath();
  return s;
}
/** A path through the points with each corner bent round, as a metal leg or lead is. */
function bendPath(pts: T.Vector3[], round = 0.9): T.Curve<T.Vector3> {
  const path = new T.CurvePath<T.Vector3>();
  const line = (a: T.Vector3, b: T.Vector3) => { if (a.distanceTo(b) > 1e-3) path.add(new T.LineCurve3(a, b)); };
  let from = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], inDir = p.clone().sub(pts[i - 1]), outDir = pts[i + 1].clone().sub(p);
    const ra = Math.min(round, inDir.length() / 2), rb = Math.min(round, outDir.length() / 2);
    if (ra < 1e-3 || rb < 1e-3) { line(from, p.clone()); from = p.clone(); continue; }
    const s = p.clone().addScaledVector(inDir.normalize(), -ra), e = p.clone().addScaledVector(outDir.normalize(), rb);
    line(from, s); path.add(new T.QuadraticBezierCurve3(s, p.clone(), e)); from = e;
  }
  line(from, pts[pts.length - 1].clone());
  if (!path.curves.length) path.add(new T.LineCurve3(pts[0].clone(), pts[0].clone().setY(pts[0].y + 0.01)));
  return path;
}

export function buildWorld(spec: WorldSpec, anisotropy: number): World {
  const world = new T.Group();
  const devs: Record<string, (v: number) => void> = {}, groups: Record<string, T.Group> = {};
  const hots: Hot[] = [], itemAnim: ((t: number) => void)[] = [];
  let uno: BuiltBoard | null = null, bb: T.Group | null = null, padPos: T.Vector3 | null = null, lcdPos: T.Vector3 | null = null, plantAt: { x: number; z: number } | null = null, lit: T.MeshBasicMaterial[] = [];
  /** The second breadboard on the bench now, if there is one, and each size of it once built. */
  let extra: { g: T.Group; cols: number } | null = null;
  const extraBoards: Partial<Record<BreadboardSize, T.Group>> = {};
  const lcdDraws: Record<string, (v: LcdView) => void> = {};

  /* --- primitives: toon-shaded solids with an ink outline (a slightly larger back-face shell) and ink lines along their hard edges, casting soft shadows on the table --- */
  const toon = (color: number, o: Opt = {}) => { const m = new T.MeshToonMaterial({ color, gradientMap: grad }); if (o.glow) { m.emissive.setHex(o.glow); m.emissiveIntensity = o.gi == null ? 1 : o.gi; } return m; };
  const shell = (g: T.Object3D): T.MeshBasicMaterial => g.userData.hm || (g.userData.hm = new T.MeshBasicMaterial({ color: INK, side: T.BackSide }));
  function put(g: T.Object3D, geo: T.BufferGeometry, hullGeo: T.BufferGeometry | null, color: number, o: Opt, x: number, y: number, z: number): Solid {
    const m = new T.Mesh(geo, toon(color, o));
    m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = !o.nh; if (o.own) m.userData.own = true; if (o.plain) m.userData.plain = true;
    g.add(m);
    if (hullGeo) { const h = new T.Mesh(hullGeo, shell(g)); h.position.copy(m.position); h.rotation.copy(m.rotation); g.add(h); m.userData.hull = h; }
    return m;
  }
  /** A solid turned on a lathe from a profile of [radius, height] points, its axis upright through (x, y, z) unless turned by o.rx or o.rz. */
  function lathe(g: T.Object3D, x: number, y: number, z: number, pts: [number, number][], color: number, o: Opt = {}) {
    const seg = o.seg || 28, shape = (p: [number, number][]) => p.map(([r, h]) => new T.Vector2(r, h));
    const out = pts.map(([r, h], i): [number, number] => [r > 0 ? r + HT : 0, i === 0 ? h - HT : i === pts.length - 1 ? h + HT : h]);
    return put(g, new T.LatheGeometry(shape(pts), seg), o.nh ? null : new T.LatheGeometry(shape(out), seg), color, o, x, y, z);
  }
  /** A solid pushed `h` up from a flat shape (seen from above, its y pointing away), standing on (x, y, z). */
  function prism(g: T.Object3D, x: number, y: number, z: number, shape: T.Shape, h: number, color: number, o: Opt = {}) {
    const geo = new T.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: o.seg || 24 });
    geo.rotateX(-Math.PI / 2);
    let hull: T.BufferGeometry | null = null;
    if (!o.nh) {   // the outline: the same solid, a hair larger all round
      geo.computeBoundingBox();
      const b = geo.boundingBox!, c = b.getCenter(new T.Vector3()), s = b.getSize(new T.Vector3());
      hull = geo.clone().translate(-c.x, -c.y, -c.z).scale((s.x + 2 * HT) / s.x, (s.y + 2 * HT) / s.y, (s.z + 2 * HT) / s.z).translate(c.x, c.y, c.z);
    }
    return put(g, geo, hull, color, o, x, y, z);
  }
  /** A thin round wire along a path with its corners bent round: a leg or a lead. */
  function bent(g: T.Object3D, pts: T.Vector3[], r: number, color: number) {
    const m = new T.Mesh(new T.TubeGeometry(bendPath(pts), Math.max(12, pts.length * 10), r, 6), toon(color));
    m.castShadow = true; g.add(m);
    return m;
  }

  /* --- ink: the hard edges of every outlined solid, drawn as lines a pixel or so wide, the way an illustration is inked --- */
  const RES = { value: new T.Vector2(1024, 768) }, WIDTH = { value: INK_PX };
  const inkOf = new WeakMap<T.Material, LineMaterial>();   // each part's outline material has its line material beside it, so highlighting a part colours both
  const inkFor = (hm: T.Material): LineMaterial => {
    let m = inkOf.get(hm);
    if (!m) { m = new LineMaterial({ color: INK, linewidth: INK_PX }); m.uniforms.resolution = RES; m.uniforms.linewidth = WIDTH; inkOf.set(hm, m); }
    return m;
  };
  /** Draws the edges where faces meet at a corner, for every outlined solid under root. The lines of the solids that share a parent and an outline are merged into one,
      so a part costs a draw call or two. A solid that moves by itself (a button's cap, a switch's lever) has lines of its own that move with it. */
  function ink(root: T.Object3D) {
    const sets = new Map<T.Object3D, Map<LineMaterial, number[]>>(), v = new T.Vector3();
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!(o instanceof T.Mesh) || !o.userData.hull || o.userData.plain || o.geometry instanceof T.TubeGeometry || o.geometry instanceof T.SphereGeometry) return;
      const own = !!o.userData.own, at: T.Object3D = own ? o : o.parent!, mat = inkFor(o.userData.hull.material), edges = new T.EdgesGeometry(o.geometry, 28), p = edges.attributes.position;
      let byMat = sets.get(at); if (!byMat) sets.set(at, byMat = new Map());
      let list = byMat.get(mat); if (!list) byMat.set(mat, list = []);
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (!own) v.applyMatrix4(o.matrix); list.push(v.x, v.y, v.z); }
      edges.dispose();
    });
    sets.forEach((byMat, at) => byMat.forEach((list, mat) => {
      const l = new LineSegments2(new LineSegmentsGeometry().setPositions(list), mat);
      l.raycast = () => {}; at.add(l);
    }));
  }
  const box = (g: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: number, o: Opt = {}) =>
    put(g, new T.BoxGeometry(w, h, d), o.nh ? null : new T.BoxGeometry(w + 2 * HT, h + 2 * HT, d + 2 * HT), color, o, x, y + h / 2, z);
  function cyl(g: T.Object3D, x: number, y: number, z: number, r: number, h: number, color: number, o: Opt = {}) {   // with o.ax ('x' or 'z') the cylinder lies on its side and y is its centre
    const seg = o.seg || 22, rot: Opt = o.ax === 'x' ? { rz: Math.PI / 2 } : o.ax === 'z' ? { rx: Math.PI / 2 } : {};
    return put(g, new T.CylinderGeometry(r, r, h, seg), o.nh ? null : new T.CylinderGeometry(r + HT, r + HT, h + 2 * HT, seg), color, { ...o, ...rot }, x, o.ax ? y : y + h / 2, z);
  }
  const ball = (g: T.Object3D, x: number, y: number, z: number, r: number, color: number, o: Opt = {}) =>
    put(g, new T.SphereGeometry(r, 20, 14), o.nh ? null : new T.SphereGeometry(r + HT, 20, 14), color, o, x, y, z);
  /** A canvas drawn in millimetres, standing up on a surface that faces the student (+z), its middle at (x, y, z). */
  function facePrint(g: T.Object3D, W: number, H: number, S: number, x: number, y: number, z: number, draw: (c: CanvasRenderingContext2D, S: number) => void) {
    const c = document.createElement('canvas'); c.width = Math.round(W * S); c.height = Math.round(H * S);
    draw(c.getContext('2d')!, S);
    const tex = new T.CanvasTexture(c); tex.anisotropy = anisotropy;
    const m = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set(x, y, z); m.raycast = () => {}; g.add(m);
    return m;
  }
  function printed(g: T.Object3D, W: number, D: number, S: number, y: number, draw: (k: Pen) => void, cx = 0, cz = 0) {   // a canvas drawn in millimetres, laid flat on a surface
    const c = document.createElement('canvas'); c.width = Math.round(W * S); c.height = Math.round(D * S);
    const ctx = c.getContext('2d')!;
    draw({
      text(s, x, z, size, o = {}) {
        ctx.save(); ctx.translate(x * S, z * S); if (o.up) ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = o.color || '#f1f5f4'; ctx.font = `${o.bold ? 700 : 500} ${size * S}px "JetBrains Mono", monospace`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s, 0, 0); ctx.restore();
      },
      line(pts, w, color) { ctx.strokeStyle = color; ctx.lineWidth = w * S; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0] * S, p[1] * S)); ctx.stroke(); },
      rect(x, z, w, d, color, fill) { ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = 0.18 * S; ctx[fill ? 'fillRect' : 'strokeRect']((x - w / 2) * S, (z - d / 2) * S, w * S, d * S); },
      dot(x, z, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x * S, z * S, r * S, 0, 7); ctx.fill(); },
    });
    const tex = new T.CanvasTexture(c); tex.anisotropy = anisotropy;
    const m = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz); m.raycast = () => {}; g.add(m);
  }
  function kit(W: number, D: number) {   // helpers for building a board in its own millimetre grid: x left to right, z far to near, y up from the PCB top
    const root = new T.Group(), parts: Record<string, T.Group> = {}, hot: Record<string, Vec> = {}, X = (x: number) => x - W / 2, Z = (z: number) => z - D / 2;
    return {
      root, parts, hot, X, Z,
      P(id: string | null) { const g = new T.Group(); if (id) { g.userData.pick = id; parts[id] = g; } root.add(g); return g; },
      bx: (g: T.Object3D, x: number, z: number, w: number, d: number, h: number, c: number, o: Opt = {}) => box(g, X(x), o.y || 0, Z(z), w, h, d, c, o),
      cy: (g: T.Object3D, x: number, z: number, r: number, h: number, c: number, o: Opt = {}) => cyl(g, X(x), o.y || 0, Z(z), r, h, c, o),
      H(id: string, x: number, z: number, y: number) { hot[id] = [X(x), y, Z(z)]; },
    };
  }

  /* --- Arduino Uno --- */
  function buildUno(): BuiltBoard {
    const W = 68.6, D = 53.4, K = kit(W, D), { P, bx, cy, H } = K, anchors: Record<string, Vec> = {};
    let g = P(null);
    bx(g, W / 2, D / 2, W, D, 1.6, 0x0f7f8c, { y: -1.6 });
    [[14, 2.5], [15.2, 50.8], [66, 7.6], [66, 35.5]].forEach(([x, z]) => { cy(g, x, z, 2.4, 0.06, 0xd8dee2, { nh: 1, y: 0.02 }); cy(g, x, z, 1.6, 0.08, 0x16242c, { nh: 1, y: 0.03 }); });
    const dA = ['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'], dB = ['7', '~6', '~5', '4', '~3', '2', 'TX1', 'RX0'];
    const pw = ['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'], an = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
    printed(K.root, W, D, 16, 0.05, k => {
      const tr = '#3aa7b3';
      for (let i = 0; i < 12; i++) k.line([[33 + i * 2.54, 33], [33 + i * 2.54, 25 - (i % 4) * 1.6], [20.5 + i * 3.7, 9.5 + (i % 3)], [20.5 + i * 3.7, 6.5]], 0.3, tr);
      for (let i = 0; i < 9; i++) k.line([[36 + i * 2.54, 43], [36 + i * 2.54, 45.2], [29.5 + i * 4.1, 47.2], [29.5 + i * 4.1, 48.6]], 0.3, tr);
      k.line([[12, 14], [18, 14], [18, 17]], 0.3, tr); k.line([[12, 16], [16, 16], [16, 27]], 0.3, tr); k.line([[11.5, 45], [16, 45], [16, 39]], 0.45, tr);
      dA.forEach((s, i) => k.text(s, 18.8 + i * 2.54, 4.7, 1.45, { up: true, align: 'right' }));
      dB.forEach((s, i) => k.text(s, 45.2 + i * 2.54, 4.7, 1.45, { up: true, align: 'right' }));
      pw.forEach((s, i) => k.text(s, 27.9 + i * 2.54, D - 4.7, 1.45, { up: true, align: 'left' }));
      an.forEach((s, i) => k.text(s, 50.8 + i * 2.54, D - 4.7, 1.45, { up: true, align: 'left' }));
      k.text('DIGITAL (PWM~)', 42, 12.2, 1.8, { bold: true });
      k.text('POWER', 36.8, D - 12.4, 1.6, { bold: true }); k.text('ANALOG IN', 57.2, D - 12.4, 1.6, { bold: true });
      k.text('UNO', 46.5, 23.5, 6.2, { bold: true });
      k.text('L', 30.2, 13, 1.4); k.text('TX', 30.8, 17, 1.4); k.text('RX', 30.8, 20.5, 1.4); k.text('ON', 60, 14.6, 1.4);
      k.text('RESET', 6.5, 8.8, 1.3); k.text('ICSP', 59.6, 26, 1.3, { up: true });
      k.rect(47.5, 38, 38.2, 11.6, '#f1f5f4');
    });
    const header = (id: string, x0: number, z: number, names: string[]) => {
      const hg = K.parts[id] || P(id), n = names.length;
      bx(hg, x0 + (n - 1) * 1.27, z, n * 2.54, 2.54, 8.5, DARK);
      names.forEach((nm, i) => { bx(hg, x0 + i * 2.54, z, 1.15, 1.15, 0.06, 0x05070a, { y: 8.5, nh: 1 }); if (nm) anchors[nm] = [K.X(x0 + i * 2.54), 8.5, K.Z(z)]; });
    };
    UNO_HEADERS.forEach(h => header(h.id, h.x0, h.z, h.names));   // the same numbers the table layout and its tests use
    g = P('usb'); bx(g, 4, 14, 16, 12, 10.8, METAL); bx(g, -4.06, 14, 0.2, 8.6, 7.4, 0x1a1f26, { y: 1.7, nh: 1 }); bx(g, -3.9, 14, 0.6, 5.6, 2.8, 0xf2f2f2, { y: 4, nh: 1 });
    g = P('jack'); bx(g, 4.5, 45.5, 14, 9, 10.8, DARK); cy(g, -2.6, 45.5, 3.2, 0.3, 0x05070a, { ax: 'x', y: 5.6, nh: 1 }); cy(g, -2.3, 45.5, 0.9, 0.5, METAL, { ax: 'x', y: 5.6, nh: 1 });
    g = P('mcu'); bx(g, 47.5, 38, 37, 9.8, 2.4, 0x343a42); bx(g, 47.5, 38, 35.6, 7.2, 3.1, 0x1b1e23, { y: 2.4 }); cy(g, 31.2, 38, 1, 0.06, 0x4a515a, { y: 5.5, nh: 1 });
    for (let i = 0; i < 14; i++) { bx(g, 31 + i * 2.54, 33.6, 0.9, 0.5, 2.6, METAL, { y: 1.4, nh: 1 }); bx(g, 31 + i * 2.54, 42.4, 0.9, 0.5, 2.6, METAL, { y: 1.4, nh: 1 }); }
    g = P('usbchip'); bx(g, 21, 17, 6, 6, 1.1, 0x1b1e23);
    g = P('crystal'); { const m = cy(g, 15, 27, 1.9, 3.4, 0xd5d9dd); m.scale.x = m.userData.hull.scale.x = 2.8; }
    g = P('reset'); bx(g, 6.5, 3.8, 6, 6, 2.2, METAL); cy(g, 6.5, 3.8, 1.7, 1.5, 0xe2572b, { y: 2.2 });
    g = P('regulator'); bx(g, 13.5, 36, 6.5, 6.5, 1.8, 0x1b1e23); bx(g, 9.4, 36, 2.6, 5, 0.9, METAL);
    g = P('leds');
    const L = bx(g, 27.4, 13, 1.8, 1, 0.8, 0x7a5a1c, { nh: 1 });
    bx(g, 27.4, 17, 1.8, 1, 0.8, 0x8a7a2a, { nh: 1 }); bx(g, 27.4, 20.5, 1.8, 1, 0.8, 0x8a7a2a, { nh: 1 }); bx(g, 60, 17, 1.8, 1, 0.8, 0x52e07a, { nh: 1, glow: 0x18b040 });
    g = P('icsp'); bx(g, 64, 26, 5.1, 7.7, 2.5, DARK);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) bx(g, 62.73 + j * 2.54, 23.46 + i * 2.54, 0.64, 0.64, 5.8, GOLD, { y: 2.5, nh: 1 });
    g = P(null);
    [[20.5, 44], [20.5, 35.2]].forEach(([x, z]) => { cy(g, x, z, 3.2, 7, 0xcdd2d7); bx(g, x, z - 1.6, 5.2, 2, 0.06, DARK, { y: 7, nh: 1 }); });
    [[24, 9, 2, 1.2, 0xb08a52], [33, 16, 1.2, 2, 0x1b1e23], [37, 18, 2, 1.2, 0xb08a52], [40, 14.5, 3, 3, 0x1b1e23], [27, 27, 2, 1.2, 0xb08a52], [24, 30, 1.2, 2, 0x1b1e23], [54, 18, 2, 1.2, 0xb08a52], [26, 23.5, 3.4, 2.6, 0x1b1e23], [11, 21.5, 1.2, 2, 0xb08a52]].forEach(([x, z, w, d, c]) => bx(g, x, z, w, d, 0.9, c, { nh: 1 }));
    H('usb', 4, 14, 12); H('jack', 4.5, 45.5, 12); H('mcu', 47.5, 38, 6.5); H('digital', 36, 2.5, 9.5); H('analog', 57.2, D - 2.5, 9.5); H('power', 36.8, D - 2.5, 9.5);
    H('leds', 27.4, 16.5, 1.5); H('reset', 6.5, 3.8, 4.5); H('crystal', 15, 27, 4); H('usbchip', 21, 17, 1.6); H('regulator', 13.5, 36, 2.4); H('icsp', 64, 26, 9);
    const setL = (v: number) => { L.material.emissive.setHex(0xffa51a); L.material.emissiveIntensity = v * 1.4; };
    return { group: K.root, parts: K.parts, hot: K.hot, anchors, W, D, setLed: setL, usbAt: [K.X(-4), 5.5, K.Z(14)], plug: [12, 7.5, 10.5] };
  }

  /* --- ESP32 DevKit (30 pins, USB on the left) --- */
  function buildEsp(): BuiltBoard {
    const W = 52, D = 28, K = kit(W, D), { P, bx, cy, H } = K, x0 = 8.24, zF = 14 - 11.43, zN = 14 + 11.43;
    let g = P(null);
    bx(g, W / 2, D / 2, W, D, 1.6, 0x1c2026, { y: -1.6 });
    [[2.6, 2.6], [2.6, D - 2.6], [W - 2.6, 2.6], [W - 2.6, D - 2.6]].forEach(([x, z]) => { cy(g, x, z, 1.9, 0.06, 0xb9a26a, { nh: 1, y: 0.02 }); cy(g, x, z, 1.3, 0.08, 0x0a0c0f, { nh: 1, y: 0.03 }); });
    printed(K.root, W, D, 22, 0.05, k => {
      ESP_FAR.forEach((s, i) => k.text(s.replace('GNDf', 'GND'), x0 + i * 2.54, zF + 1.2, 1.1, { up: true, align: 'right', bold: true }));
      ESP_NEAR.forEach((s, i) => k.text(s, x0 + i * 2.54, zN - 1.2, 1.1, { up: true, align: 'left', bold: true }));
      k.text('BOOT', 4.3, 8.3, 1.1, { bold: true }); k.text('EN', 4.3, D - 8.3, 1.1, { bold: true });
      for (let i = 0; i < 6; i++) k.line([[26.6, 9 + i * 2], [23.5 - i * 0.8, 9 + i * 2], [20 - i * 0.8, 11 + i * 1.2]], 0.22, '#3d4650');
    });
    g = P('module'); bx(g, 36.2, 14, 19.5, 16, 0.8, 0x101317); bx(g, 35.5, 14, 16.5, 14.4, 2.4, METAL, { y: 0.8 });
    printed(g, 16.5, 14.4, 26, 3.26, k => { k.text('ESP32', 8.25, 5.6, 2.6, { bold: true, color: '#39424c' }); k.text('WROOM-32', 8.25, 9, 1.5, { color: '#39424c' }); k.rect(8.25, 7.2, 15.2, 13, '#8f989f'); }, K.X(35.5), K.Z(14));
    g = P('antenna'); bx(g, 49, 14, 6, 16, 0.8, 0x101317);
    for (let i = 0; i < 5; i++) bx(g, 49, 8 + i * 3, 4.4, 0.7, 0.14, GOLD, { y: 0.8, nh: 1 });
    for (let i = 0; i < 4; i++) bx(g, i % 2 ? 50.85 : 47.15, 9.5 + i * 3, 0.7, 3.7, 0.14, GOLD, { y: 0.8, nh: 1 });
    g = P('usb'); bx(g, 2.4, 14, 6, 7.8, 2.8, METAL); bx(g, -0.66, 14, 0.2, 6.2, 1.4, 0x1a1f26, { y: 0.7, nh: 1 });
    g = P('boot'); bx(g, 4.4, 4.6, 4, 3.2, 1.5, METAL); cy(g, 4.4, 4.6, 0.95, 0.7, DARK, { y: 1.5, nh: 1 });
    g = P('en'); bx(g, 4.4, D - 4.6, 4, 3.2, 1.5, METAL); cy(g, 4.4, D - 4.6, 0.95, 0.7, DARK, { y: 1.5, nh: 1 });
    g = P('usbchip'); bx(g, 13.5, 13.5, 4.4, 4.4, 0.9, 0x2b3038);
    g = P('regulator'); bx(g, 21, 7.6, 6.3, 3.5, 1.6, 0x2b3038); bx(g, 21, 5.2, 3.2, 1.6, 0.6, METAL, { nh: 1 });
    g = P('leds'); bx(g, 22.5, 20.5, 1.6, 0.9, 0.7, 0xff6a5c, { nh: 1, glow: 0xd8261a });
    const L = bx(g, 17.5, 20.5, 1.6, 0.9, 0.7, 0x2c4f7a, { nh: 1 });
    ([['pinsFar', zF], ['pinsNear', zN]] as [string, number][]).forEach(([id, z]) => {
      g = P(id);
      for (let i = 0; i < 15; i++) { cy(g, x0 + i * 2.54, z, 0.8, 0.45, 0xd9dde0, { nh: 1 }); bx(g, x0 + i * 2.54, z, 0.64, 0.64, 6, GOLD, { y: -10.1, nh: 1 }); }
      bx(g, x0 + 7 * 2.54, z, 38.1, 2.5, 2.5, DARK, { y: -4.1 });
    });
    g = P(null);
    [[9.5, 9, 2, 1.1, 0xb08a52], [9.5, 19, 2, 1.1, 0xb08a52], [17, 8, 1.1, 2, 0x2b3038], [25.5, 20.5, 2.6, 1.4, 0x2b3038], [14, 20, 2, 1.1, 0xb08a52], [26, 12, 1.1, 2, 0xb08a52]].forEach(([x, z, w, d, c]) => bx(g, x, z, w, d, 0.9, c, { nh: 1 }));
    H('module', 35.5, 14, 3.6); H('antenna', 49.5, 14, 1.2); H('usb', 2.4, 14, 3.2); H('pinsFar', 26, zF, 0.6); H('pinsNear', 26, zN, 0.6);
    H('boot', 4.4, 4.6, 2.4); H('en', 4.4, D - 4.6, 2.4); H('leds', 20, 20.5, 1); H('usbchip', 13.5, 13.5, 1.2); H('regulator', 21, 7.6, 1.9);
    const setL = (v: number) => { L.material.emissive.setHex(0x2a8cff); L.material.emissiveIntensity = v * 1.6; };
    return { group: K.root, parts: K.parts, hot: K.hot, anchors: {}, W, D, setLed: setL, usbAt: [K.X(-0.6), 1.4, K.Z(14)], plug: [9, 4.2, 8.5] };
  }

  /* --- breadboard: rows a to j, a power rail pair on each long side. The bench's own has columns 1 to 30, and a second one is numbered on from there. --- */
  function buildBB(cols = MAIN_COLS, first = 1) {
    const L = bbLength(cols), Wd = BB_DEPTH, g = new T.Group(), gap = 2.6, half = (Wd - gap) / 2;
    box(g, 0, 0, -(gap + half) / 2, L, BB_HEIGHT, half, CREAM);   // the two halves, with the channel between them that keeps e and f apart
    box(g, 0, 0, (gap + half) / 2, L, BB_HEIGHT, half, CREAM);
    box(g, 0, 0, 0, L, BB_HEIGHT - 1.6, gap + 0.1, 0xe4dfd1, { nh: 1 });
    printed(g, L, Wd, 14, BB_HEIGHT + 0.05, k => {
      const cx = L / 2, cz = Wd / 2;
      k.line([[2, cz + RAILZ['T+'] - 1.5], [L - 2, cz + RAILZ['T+'] - 1.5]], 0.35, '#d6453d'); k.line([[2, cz + RAILZ['T-'] + 1.5], [L - 2, cz + RAILZ['T-'] + 1.5]], 0.35, '#3577d4');
      k.line([[2, cz + RAILZ['B-'] - 1.5], [L - 2, cz + RAILZ['B-'] - 1.5]], 0.35, '#3577d4'); k.line([[2, cz + RAILZ['B+'] + 1.5], [L - 2, cz + RAILZ['B+'] + 1.5]], 0.35, '#d6453d');
      for (let c = 1; c <= cols; c++) {
        const x = cx + (c - (cols + 1) / 2) * 2.54, n = first + c - 1;
        Object.values(ROWZ).forEach(z => k.rect(x, cz + z, 1.15, 1.15, '#3b3f45', true));
        Object.values(RAILZ).forEach(z => k.rect(x, cz + z, 1.15, 1.15, '#3b3f45', true));
        if (c === 1 || n % 5 === 0) { k.text(String(n), x, cz - 17.2, 1.5, { color: '#6d737b' }); k.text(String(n), x, cz + 17.2, 1.5, { color: '#6d737b' }); }
      }
      Object.entries(ROWZ).forEach(([r, z]) => { k.text(r, 1.6, cz + z, 1.5, { color: '#6d737b' }); k.text(r, L - 1.6, cz + z, 1.5, { color: '#6d737b' }); });
      [['+', 'T+', '#d6453d'], ['−', 'T-', '#3577d4'], ['−', 'B-', '#3577d4'], ['+', 'B+', '#d6453d']].forEach(([s, r, col]) => { k.text(s, 1.6, cz + RAILZ[r], 2, { color: col, bold: true }); k.text(s, L - 1.6, cz + RAILZ[r], 2, { color: col, bold: true }); });
    });
    ink(g);
    return g;
  }

  function anchor(name: string): T.Vector3 {   // top-surface position of a named connection point, in world space
    let m;
    if ((m = /^U:(.+)$/.exec(name))) { const p = uno?.anchors[m[1]]; if (!p) throw new Error('Unknown Uno pin ' + name); return new T.Vector3(...p).add(uno!.group.position); }
    if ((m = /^E:(.+)$/.exec(name))) { if (!ESP_HOLES[m[1]]) throw new Error('Unknown ESP32 pin ' + name); return anchor(ESP_HOLES[m[1]]); }
    if (name === 'PAD') return padPos!.clone();
    if ((m = /^LCD:(\w+)$/.exec(name))) {   // the LCD backpack's header pins, standing up from the tab on its left
      const i = (LCD_PINS as readonly string[]).indexOf(m[1]);
      if (i < 0) throw new Error('Unknown LCD pin ' + name);
      return new T.Vector3(lcdPos!.x - 47.5, 3.2, lcdPos!.z + (i - 1.5) * 2.54);
    }
    if ((m = /^SOIL:(\w+)$/.exec(name))) {   // the pins on the soil probe's head, where the plugs of the wires sit
      const p = plantAt && soilPinXZ(plantAt, m[1]);
      if (!p) throw new Error('Unknown soil probe pin ' + name);
      return new T.Vector3(bb!.position.x + p.x, PROBE_TOP + 2.5, p.z);
    }
    if ((m = /^([TB][+-])(\d+)$/.exec(name))) return hole(+m[2], RAILZ[m[1]]);
    if ((m = /^([a-j])(\d+)$/.exec(name))) return hole(+m[2], ROWZ[m[1]]);
    throw new Error('Unknown connection point ' + name);
  }
  /** A hole in column c, on the bench's own breadboard or on the second one. */
  function hole(c: number, z: number): T.Vector3 {
    if (c <= MAIN_COLS) return new T.Vector3(colX(c), BB_HEIGHT, z).add(bb!.position);
    if (!extra || c > MAIN_COLS + extra.cols) throw new Error(`There is no column ${c} on this bench`);
    return new T.Vector3((c - MAIN_COLS - (extra.cols + 1) / 2) * 2.54, BB_HEIGHT, z).add(extra.g.position);
  }
  /** The second breadboard, built once for each size and kept while the bench is, since the parts are rebuilt with every change and each time it moves while dragged. */
  function extraBoard(it: Of<'breadboard'>): T.Group {
    const cols = BREADBOARD_COLS[it.size], p = placeOf(it);
    let g = extraBoards[it.size];
    if (!g) { g = extraBoards[it.size] = buildBB(cols, MAIN_COLS + 1); g.userData.keep = true; }   // keep: not thrown away with the parts
    g.position.set(bb!.position.x + p.x + bbLength(cols) / 2, 0, bb!.position.z + p.z);
    return g;
  }
  /** The second breadboard as a placed part. Its label sits off its far left corner, clear of the holes. */
  function mkBreadboard(): Made {
    const { g, cols } = extra!;
    return { g, top: new T.Vector3(-bbLength(cols) / 2 + 6, BB_HEIGHT, -BB_DEPTH / 2 - 1).add(g.position) };
  }

  /* --- components --- */
  type Of<K extends Item['t']> = Extract<Item, { t: K }>;
  const leg = (g: T.Group, p: T.Vector3, h: number, c = 0xaab2ba) => box(g, p.x, p.y, p.z, 0.55, h, 0.55, c, { nh: 1 });
  /** A thin horizontal lead from p to q at height y. */
  function lead(g: T.Group, p: T.Vector3, q: T.Vector3, y: number) {
    const dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz);
    if (len < 0.1) return;
    const m = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, len, 8), toon(0xaab2ba));
    m.position.set((p.x + q.x) / 2, y, (p.z + q.z) / 2); m.rotation.set(0, -Math.atan2(dz, dx), Math.PI / 2, 'YXZ'); g.add(m);
  }
  /** A jumper wire: a Dupont housing on each end, with a collar in the wire's colour where the wire goes in, and the wire arching between them. */
  function mkWire(it: Of<'wire'>, k: number): Made {
    const g = new T.Group(), a = anchor(it.a), b = anchor(it.b), color = WIRE[it.c];
    const p0 = a.clone(), p3 = b.clone();
    const plug = (p: T.Vector3) => { box(g, p.x, p.y, p.z, 2.5, 6.6, 2.5, DARK); box(g, p.x, p.y + 6.6, p.z, 1.9, 1.1, 1.9, color); p.y += 7.7; };
    if (it.a !== 'PAD') plug(p0);
    if (it.b !== 'PAD') plug(p3);
    const h = 9 + p0.distanceTo(p3) * 0.17 + (k % 5) * 2.4;
    const curve = new T.CubicBezierCurve3(p0, p0.clone().setY(p0.y + h), p3.clone().setY(p3.y + h), p3);
    const tube = new T.Mesh(new T.TubeGeometry(curve, 48, 0.85, 10), toon(color));
    tube.castShadow = true; g.add(tube);
    g.add(new T.Mesh(new T.TubeGeometry(curve, 48, 0.85 + HT, 10), shell(g)));
    /* beads that carry the current: conventional current, so they run from + towards -, faster when there is more of it */
    const count = Math.max(3, Math.min(14, Math.round(curve.getLength() / 9))), beads: T.Group[] = [], at = new T.Vector3();
    const coreGeo = new T.SphereGeometry(1.5, 10, 8), rimGeo = new T.SphereGeometry(1.5 + HT, 10, 8), coreMat = new T.MeshBasicMaterial({ color: 0xffd21f });
    for (let i = 0; i < count; i++) {
      const bead = new T.Group();
      bead.add(new T.Mesh(coreGeo, coreMat), new T.Mesh(rimGeo, shell(g)));
      bead.children.forEach(c => { c.raycast = () => {}; });
      bead.visible = false; g.add(bead); beads.push(bead);
    }
    let amps = 0;
    itemAnim.push(t => {
      const a = Math.abs(amps);
      if (a < 0.0002) { for (const b of beads) b.visible = false; return; }
      const speed = 0.00022 * (0.35 + Math.min(1, a / 0.02)) * Math.sign(amps);   // fractions of the wire per millisecond
      beads.forEach((b, i) => {
        curve.getPoint((((t * speed + i / count) % 1) + 1) % 1, at);
        b.position.copy(at); b.visible = true;
      });
    });
    return { g, set: v => { amps = v; } };
  }
  /** A 5 mm LED's epoxy, standing on `base`: a rim with one flat side (facing `flat`, the cathode side, as on a real LED), a straight body and a dome. */
  function lens(g: T.Group, x: number, base: number, z: number, color: number, flat: T.Vector3 | null): Solid[] {
    const dome: [number, number][] = [[0, 0], [2.5, 0], [2.5, 4.3]];
    for (let i = 1; i < 8; i++) { const t = (i / 8) * Math.PI / 2; dome.push([2.5 * Math.cos(t), 4.3 + 2.5 * Math.sin(t)]); }
    dome.push([0, 6.8]);
    return [prism(g, x, base, z, dShape(2.95, 2.55), 1, color, { ry: flat ? Math.atan2(-flat.z, flat.x) : 0 }), lathe(g, x, base + 1, z, dome, color)];
  }
  /** Legs from holes up into a body: each rises from its hole, slants in to its place under the body (`spacing` apart along `along`), and goes straight up to `top`. */
  function legsUnder(g: T.Group, holes: T.Vector3[], centre: T.Vector3, along: T.Vector3, spacing: number, top: number, colors: number[]) {
    holes.forEach((p, i) => {
      const under = centre.clone().addScaledVector(along, (i - (holes.length - 1) / 2) * spacing);
      bent(g, [p.clone(), p.clone().setY(p.y + 1.6), under.clone().setY(top - 1.8), under.clone().setY(top)], 0.28, colors[i]);
    });
  }
  /** An LED. The long leg (+) is red and the short leg (−) dark, so which way round it is can be read at a glance. */
  function mkLed(it: Of<'led'>): Made {
    const g = new T.Group(), a = anchor(it.a), k = anchor(it.k), y = a.y, mid = a.clone().add(k).multiplyScalar(0.5), base = y + 6.3;
    const toward = new T.Vector3(k.x - a.x, 0, k.z - a.z), apart = toward.length() > 0.01;
    if (apart) toward.normalize(); else toward.set(1, 0, 0);
    const dim = new T.Color(it.color).multiplyScalar(0.5).getHex();
    legsUnder(g, [a, k], mid, toward, 2.54, base, [0xd6453d, 0x39414c]);
    const ms = lens(g, mid.x, base, mid.z, dim, apart ? toward : null);
    const halo = new T.Mesh(new T.SphereGeometry(8, 20, 14), new T.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0, depthWrite: false }));
    halo.position.set(mid.x, base + 5, mid.z); halo.raycast = () => {}; g.add(halo);
    let burnt = false;
    const set = (v: number) => { if (burnt) v = 0; ms.forEach(m => { m.material.emissive.setHex(it.color); m.material.emissiveIntensity = v * 0.9; }); halo.material.opacity = v * 0.3; };
    const burn = () => { burnt = true; set(0); ms.forEach(m => m.material.color.setHex(0x2a2522)); };
    return { g, set, burn, top: new T.Vector3(mid.x, base + 8.6, mid.z) };
  }
  /** A resistor's body: fatter at the ends where the leads go in, as the real ones are, along x and centred on 0. */
  const RES_BODY: [number, number][] = [[0, -3.3], [0.85, -3.27], [1.25, -3.05], [1.42, -2.6], [1.38, -2.05], [1.12, -1.65], [1.06, -1.2], [1.06, 1.2], [1.12, 1.65], [1.38, 2.05], [1.42, 2.6], [1.25, 3.05], [0.85, 3.27], [0, 3.3]];
  const resRadius = (h: number) => {
    for (let i = 1; i < RES_BODY.length; i++) {
      const [r1, h1] = RES_BODY[i], [r0, h0] = RES_BODY[i - 1];
      if (h <= h1) return r0 + ((r1 - r0) * (h - h0)) / (h1 - h0 || 1);
    }
    return 0;
  };
  /** A resistor lying above the breadboard, its leads bent down into the two holes. The bands spell its value: the digits and the multiplier from the left, the tolerance on its own at the right. */
  function mkRes(it: Of<'res'>): Made {
    const g = new T.Group(), a = anchor(it.a), b = anchor(it.b), y = a.y + 3.4, mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = new T.Vector3(b.x - a.x, 0, b.z - a.z);
    if (dir.length() < 0.01) dir.set(1, 0, 0); else dir.normalize();
    const end = (s: number) => mid.clone().addScaledVector(dir, s * 3.2).setY(y);
    bent(g, [a.clone(), a.clone().setY(y), end(-1)], 0.28, LEAD); bent(g, [b.clone(), b.clone().setY(y), end(1)], 0.28, LEAD);
    const body = new T.Group(); body.position.set(mid.x, 0, mid.z); body.rotation.y = -Math.atan2(dir.z, dir.x); g.add(body);
    lathe(body, 0, y, 0, RES_BODY, TAN, { rz: Math.PI / 2, seg: 24 });
    const colors = bands(it.ohms ?? 220).map(c => parseInt(c.slice(1), 16)), n = colors.length;   // four bands, or five for a value with three digits
    colors.forEach((c, i) => {
      const h = i === n - 1 ? 2.45 : -2.5 + i * 0.82, r = Math.max(resRadius(h - 0.24), resRadius(h + 0.24)) + 0.04;
      cyl(body, h, y, 0, r, 0.48, c, { ax: 'x', nh: 1, seg: 24 });
    });
    return { g, top: new T.Vector3(mid.x, y + 2, mid.z) };
  }
  /** A 6 mm push button across the middle gap: a black base on four bent legs, a metal plate with a dimple in each corner, and a round cap that sinks while it is held. */
  function mkButton(it: Of<'button'>): Made {
    const g = new T.Group(), p = anchor('e' + it.col), q = anchor('f' + (it.col + 2)), cx = (p.x + q.x) / 2, cz = (p.z + q.z) / 2, y = p.y;
    [[p.x, p.z], [q.x, p.z], [p.x, q.z], [q.x, q.z]].forEach(([x, z]) => {
      const s = Math.sign(z - cz);
      bent(g, [new T.Vector3(x, y, z), new T.Vector3(x, y + 0.9, z), new T.Vector3(x, y + 0.9, cz + s * 2.6), new T.Vector3(x, y + 1.4, cz + s * 2.6)], 0.26, LEAD);
    });
    box(g, cx, y + 0.5, cz, 6.2, 3.3, 6.2, 0x2b3038); box(g, cx, y + 3.8, cz, 6.2, 0.35, 6.2, METAL);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => cyl(g, cx + sx * 2.35, y + 4.15, cz + sz * 2.35, 0.5, 0.1, 0x5b636d, { nh: 1 }));
    const cap = lathe(g, cx, y + 4.15, cz, [[0, 0], [1.95, 0], [1.95, 1.3], [1.75, 1.72], [1.2, 1.95], [0, 1.95]], 0xe2572b, { own: true }), capY = cap.position.y;
    const set = (on: number) => { cap.position.y = cap.userData.hull.position.y = capY - (on ? 1.1 : 0); };
    return { g, set, top: new T.Vector3(cx, y + 6.5, cz) };
  }
  /** A knob (potentiometer): a blue body on three legs, a metal bushing, and a ridged dark knob with a white line on top showing which way it points. */
  function mkPot(it: Of<'pot'>): Made {
    const g = new T.Group(), p = anchor(it.row + (it.col + 1)), y = p.y;
    for (let i = -1; i <= 1; i++) box(g, p.x + i * 2.54, y, p.z, 0.7, 0.9, 0.5, LEAD, { nh: 1 });
    box(g, p.x, y + 0.8, p.z, 9.6, 5.4, 9.6, 0x2f6db5);
    cyl(g, p.x, y + 6.2, p.z, 2.6, 1.2, METAL);
    const knob = new T.Group(); knob.userData.hm = shell(g); knob.position.set(p.x, y + 7.4, p.z); g.add(knob);
    prism(knob, 0, 0, 0, gearShape(3.55, 3.15, 18), 5.2, 0x353b44, { plain: true });   // the ridges are too fine to ink one by one
    cyl(knob, 0, 5.2, 0, 3.05, 0.5, 0x454c56);
    box(knob, 0, 5.7, -1.45, 0.7, 0.14, 2.7, 0xf2f2ee, { nh: 1 });
    const set = (v: number) => { knob.rotation.y = (0.5 - v) * 4.7; };
    return { g, set, top: new T.Vector3(p.x, y + 14.5, p.z) };
  }
  /** A buzzer: a black can with a rounded rim and a sound hole in its top, a red + printed on the side of its + leg. It throbs while it sounds. */
  function mkBuzzer(it: Of<'buzzer'>): Made {
    const g = new T.Group(), a = anchor(it.a), b = anchor(it.b), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, y = a.y;
    let freq = 0;
    leg(g, a, 0.8, 0xd6453d); leg(g, b, 0.8, 0x39414c); lead(g, a.clone().setY(y + 0.8), b.clone().setY(y + 0.8), y + 0.8);   // red + leg, dark − leg
    const toward = new T.Vector3(a.x - b.x, 0, a.z - b.z); toward.length() ? toward.normalize() : toward.set(1, 0, 0);
    const mx = cx + toward.x * 3.4, mz = cz + toward.z * 3.4;
    box(g, mx, y + 9.3, mz, 2.6, 0.12, 0.7, 0xd6453d, { nh: 1 }); box(g, mx, y + 9.3, mz, 0.7, 0.12, 2.6, 0xd6453d, { nh: 1 });
    const body = lathe(g, cx, y + 0.7, cz, [[0, 0], [6, 0], [6, 8.0], [5.5, 8.6], [1.4, 8.6], [1.4, 8.2], [0, 8.2]], 0x2b3038, { own: true, seg: 32 });
    itemAnim.push(t => { const s = freq ? 1 + 0.04 * Math.sin(t / 16) : 1; body.scale.set(s, 1, s); body.userData.hull.scale.set(s, 1, s); });
    return { g, set: f => { freq = f; }, top: new T.Vector3(cx, y + 11, cz) };
  }
  /** An HC-SR04: a blue board standing on its four pins, two silver transducers with dark mesh fronts, a crystal between them, and its labels printed on the front.
      In front of it stands the wall it measures the distance to. */
  function mkSonar(it: Of<'sonar'>): Made {
    const g = new T.Group(), p = anchor(it.row + it.col), cx = p.x + 3.81, z = p.z, y = p.y;
    for (let i = 0; i < 4; i++) box(g, p.x + i * 2.54, y, z, 0.6, 3.4, 0.6, GOLD, { nh: 1 });
    box(g, cx, y + 0.4, z, 10.4, 2.3, 2.5, DARK);
    box(g, cx, y + 3, z, 45, 20, 1.5, 0x2a62b8);
    facePrint(g, 45, 20, 18, cx, y + 13, z + 0.77, (c, S) => {
      c.fillStyle = '#e8eef7'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${2 * S}px "JetBrains Mono", monospace`; c.fillText('HC-SR04', 22.5 * S, 2.2 * S);
      c.font = `700 ${1.6 * S}px "JetBrains Mono", monospace`; c.fillText('T', 3 * S, 3 * S); c.fillText('R', 42 * S, 3 * S);
      c.font = `600 ${1.25 * S}px "JetBrains Mono", monospace`; ['Vcc', 'Trig', 'Echo', 'Gnd'].forEach((s, i) => c.fillText(s, (22.5 + (i - 1.5) * 2.54 * 1.2) * S, 18.4 * S));
      c.strokeStyle = '#c9d3e3'; c.lineWidth = 0.35 * S; [[2, 2], [43, 2], [2, 18], [43, 18]].forEach(([x, yy]) => { c.beginPath(); c.arc(x * S, yy * S, 1 * S, 0, 7); c.stroke(); });
    });
    [-1, 1].forEach(s => {
      cyl(g, cx + s * 13, y + 13, z + 6.75, 8, 12, 0xd3d8dd, { ax: 'z', seg: 32 });
      cyl(g, cx + s * 13, y + 13, z + 12.7, 6.6, 0.25, 0x343a42, { ax: 'z', nh: 1, seg: 32 });
      facePrint(g, 13.2, 13.2, 14, cx + s * 13, y + 13, z + 12.86, (c, S) => {   // the mesh over the front of the transducer
        c.save(); c.beginPath(); c.arc(6.6 * S, 6.6 * S, 6.5 * S, 0, 7); c.clip();
        c.fillStyle = '#2b3038'; c.fillRect(0, 0, 13.2 * S, 13.2 * S);
        c.fillStyle = '#59616b'; for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) { c.beginPath(); c.arc((0.6 + i + (j % 2) * 0.5) * S, (0.6 + j) * S, 0.3 * S, 0, 7); c.fill(); }
        c.restore();
      });
    });
    const crystal = cyl(g, cx, y + 18.6, z + 1.45, 1.2, 1.4, METAL, { ax: 'z' });
    crystal.scale.x = crystal.userData.hull.scale.x = 2.4;
    const wall = new T.Group(); g.add(wall);   // a little brick wall
    box(wall, cx, 0, 0, 48, 30, 6, 0xb5543d);
    facePrint(wall, 48, 30, 10, cx, 15, 3.02, (c, S) => {
      c.fillStyle = '#e6d6c3'; c.fillRect(0, 0, 48 * S, 30 * S);
      const tones = ['#b5543d', '#a84b36', '#bf5f45', '#ad5039'];
      for (let row = 0; row < 6; row++) for (let i = -1; i < 5; i++) {
        const x = i * 12 + (row % 2 ? 6 : 0), w = 11.2;
        c.fillStyle = tones[(row * 3 + i + 4) % tones.length]; c.fillRect((x + 0.4) * S, (row * 5 + 0.4) * S, w * S, 4.2 * S);
      }
    });
    const set = (cm: number) => { wall.position.z = wallZ(z, z - ROWZ[it.row], cm); };   // it stands on the table, so never on the breadboard
    set(30);
    return { g, set, top: new T.Vector3(cx, y + 25, z) };
  }
  /** A 9 g hobby servo. Its three-pin lead plugs into the breadboard and the motor sits on the table beyond the nearest edge, its white arm turning to the angle. */
  function mkServo(it: Of<'servo'>): Made {
    const g = new T.Group(), legs = [0, 1, 2].map(i => anchor(`${it.row}${it.col + i}`)), mid = legs[1], y = mid.y;
    const away = it.row <= 'e' ? -1 : 1, bodyZ = mid.z - ROWZ[it.row] + away * SERVO_REACH, bodyX = mid.x;   // beyond the edge of the breadboard it plugs into, wherever that lies
    legs.forEach(p => box(g, p.x, y, p.z, 0.6, 2.6, 0.6, GOLD, { nh: 1 }));
    box(g, mid.x, y + 2.6, mid.z, 7.6, 6, 2.6, DARK);   // the plug on the end of the lead
    const WIRES = [0x7a4a21, 0xd6453d, 0xf08a24];   // brown GND, red +, orange signal
    legs.forEach((p, i) => {
      const s = new T.Vector3(p.x, y + 8.6, p.z), e = new T.Vector3(bodyX - 2.6 + i * 2.6, 9, bodyZ - away * 6.2);
      const curve = new T.CubicBezierCurve3(s, s.clone().setY(s.y + 8), e.clone().add(new T.Vector3(0, 10, -away * 10)), e);
      const wire = new T.Mesh(new T.TubeGeometry(curve, 24, 0.6, 6), toon(WIRES[i])); wire.castShadow = true; g.add(wire);
      g.add(new T.Mesh(new T.TubeGeometry(curve, 24, 0.6 + HT, 6), shell(g)));
    });
    box(g, bodyX, 0, bodyZ, 23, 22.5, 12.2, 0x2f6db5);   // the case
    box(g, bodyX, 15.5, bodyZ, 32.5, 2.4, 12.2, 0x2f6db5);   // mounting tabs, with a screw hole in each
    [-1, 1].forEach(s => cyl(g, bodyX + s * 14.1, 17.9, bodyZ, 1.1, 0.08, 0x1b2430, { nh: 1 }));
    facePrint(g, 17, 7.5, 16, bodyX - 1.5, 8.5, bodyZ + 6.12, (c, S) => {   // its label
      c.fillStyle = '#e9edf2'; c.fillRect(0, 0, 17 * S, 7.5 * S);
      c.fillStyle = '#2f6db5'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `700 ${2.6 * S}px "JetBrains Mono", monospace`; c.fillText('SERVO', 8.5 * S, 2.9 * S);
      c.font = `600 ${1.6 * S}px "JetBrains Mono", monospace`; c.fillText('9 g · 180°', 8.5 * S, 5.6 * S);
    });
    const shaftX = bodyX + 5.6, topY = 22.5;
    cyl(g, shaftX, topY, bodyZ, 5.8, 1.6, 0x2a5ea0);
    cyl(g, shaftX - 7, topY, bodyZ, 3, 1, 0x2a5ea0);   // the bump over the gears
    const arm = new T.Group(); arm.userData.hm = shell(g); arm.position.set(shaftX, topY + 1.6, bodyZ); g.add(arm);
    cyl(arm, 0, 0, 0, 3.2, 2.6, 0xf2f2ee);
    box(arm, 8, 0.6, 0, 16, 1.6, 4.2, 0xf2f2ee);   // the horn, pointing along +x at 0°
    cyl(arm, 15, 0.6, 0, 2.1, 1.6, 0xf2f2ee);
    [4, 8, 12].forEach(x => cyl(arm, x, 2.2, 0, 0.45, 0.06, 0x9aa3ad, { nh: 1 }));   // its holes
    cyl(arm, 0, 2.6, 0, 1, 0.06, 0x9aa3ad, { nh: 1 });
    let target = 90, shown = 90;
    const turn = () => { arm.rotation.y = (shown * Math.PI) / 180; };   // 0° points right, 90° points away across the table, 180° points left
    turn();
    itemAnim.push(() => { if (Math.abs(target - shown) < 0.3) return; shown += (target - shown) * 0.18; turn(); });   // a real servo takes a moment to get there
    return { g, set: angle => { if (angle >= 0) target = angle; }, top: new T.Vector3(bodyX, topY + 8, bodyZ) };
  }
  /** A light-dependent resistor: a small round disc with a zigzag track, standing on two thin legs. It glows when there is light on it. */
  function mkLdr(it: Of<'ldr'>): Made {
    const g = new T.Group(), a = anchor(it.a), b = anchor(it.b), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, y = a.y;
    leg(g, a, 5); leg(g, b, 5); lead(g, a.clone().setY(y + 5), b.clone().setY(y + 5), y + 5);
    const disc = cyl(g, cx, y + 4.6, cz, 4.4, 1.3, 0xc9a35b);
    for (let i = -2; i <= 2; i++) box(g, cx, y + 5.9, cz + i * 1.4, 6.4, 0.12, 0.55, 0x5a3b1a, { nh: 1 });
    const set = (light: number) => { disc.material.emissive.setHex(0xffe08a); disc.material.emissiveIntensity = Math.min(1, Math.max(0, light)) * 0.55; };
    set(0.5);
    return { g, set, top: new T.Vector3(cx, y + 9, cz) };
  }
  /** A TMP36 in its TO-92 case: a black half-round body on three legs. It warms to red as the temperature rises. */
  function mkTemp(it: Of<'temp'>): Made {
    const g = new T.Group(), legs = [0, 1, 2].map(i => anchor(`${it.row}${it.col + i}`)), mid = legs[1], y = mid.y;
    legs.forEach((p, i) => box(g, p.x, y, p.z, 0.5, 4.6, 0.5, i === 0 ? 0xd6453d : i === 2 ? 0x39414c : LEAD, { nh: 1 }));   // red + leg, dark − leg, bare output leg
    const body = prism(g, mid.x, y + 4.4, mid.z, dShape(2.9, 1.4), 5.4, 0x2b3038, { ry: -Math.PI / 2 });   // the TO-92 case, its flat face towards the student
    facePrint(g, 4.8, 2.4, 40, mid.x, y + 7.6, mid.z + 1.42, (c, S) => {
      c.fillStyle = '#d7dce2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${0.95 * S}px "JetBrains Mono", monospace`; c.fillText('TMP36', 2.4 * S, 1.2 * S);
    });
    const set = (c: number) => { const warm = Math.min(1, Math.max(0, (c - 20) / 30)); body.material.emissive.setHex(0xff5a1f); body.material.emissiveIntensity = warm * 0.8; };
    set(25);
    return { g, set, top: new T.Vector3(mid.x, y + 12, mid.z) };
  }
  /** An RGB LED: a clear dome on four legs. It takes the colour its three LEDs mix, given as their brightnesses packed into one number (red, green, blue, 0 to 255 each). */
  function mkRgb(it: Of<'rgb'>): Made {
    const g = new T.Group(), legs = [0, 1, 2, 3].map(i => anchor(`${it.row}${it.col + i}`)), mx = (legs[0].x + legs[3].x) / 2, z = legs[0].z, y = legs[0].y;
    const LEG = [0xd6453d, 0x39414c, 0x3aa655, 0x3577d4];   // red, the shared − leg (the long one), green, blue
    const base = y + 6.3;
    legsUnder(g, legs, new T.Vector3(mx, y, z), new T.Vector3(1, 0, 0), 1.25, base, LEG);   // four legs fanning in to the case
    const ms = lens(g, mx, base, z, 0xdfe4e8, null);
    const halo = new T.Mesh(new T.SphereGeometry(8.5, 20, 14), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    halo.position.set(mx, base + 5, z); halo.raycast = () => {}; g.add(halo);
    const mix = new T.Color();
    let burnt = false;
    const set = (packed: number) => {
      if (burnt) packed = 0;
      const r = (packed >> 16 & 255) / 255, gr = (packed >> 8 & 255) / 255, b = (packed & 255) / 255, top = Math.max(r, gr, b);
      if (top > 0) mix.setRGB(r / top, gr / top, b / top);
      ms.forEach(m => { m.material.emissive.copy(mix); m.material.emissiveIntensity = top * 0.9; });
      halo.material.color.copy(mix); halo.material.opacity = top * 0.3;
    };
    const burn = () => { burnt = true; set(0); ms.forEach(m => m.material.color.setHex(0x2a2522)); };
    return { g, set, burn, top: new T.Vector3(mx, base + 9.5, z) };
  }
  /** A slide switch: a small black body on three legs, with a lever that sits to the left or to the right. */
  function mkSlide(it: Of<'slide'>): Made {
    const g = new T.Group(), legs = [0, 1, 2].map(i => anchor(`${it.row}${it.col + i}`)), mid = legs[1], y = mid.y;
    legs.forEach(p => box(g, p.x, y, p.z, 0.7, 1.2, 0.5, 0xaab2ba, { nh: 1 }));
    box(g, mid.x, y + 0.6, mid.z, 8.8, 3.6, 4.4, 0x2b3038); box(g, mid.x, y + 4.2, mid.z, 8.8, 0.3, 4.4, METAL, { nh: 1 });
    const lever = box(g, mid.x, y + 4.4, mid.z, 2.3, 2.6, 2.2, 0xe6e9ec);
    const set = (v: number) => { lever.position.x = lever.userData.hull.position.x = mid.x + (v > 0.5 ? 1.8 : -1.8); };
    set(0);
    return { g, set, top: new T.Vector3(mid.x, y + 9, mid.z) };
  }
  /** A tilt switch is a small brass can that leans over when tilted. A reed switch is a glass tube, and a magnet appears beside it when one is near. */
  function mkContact(it: Of<'contact'>): Made {
    const g = new T.Group(), a = anchor(it.a), b = anchor(it.b), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2, y = a.y;
    const body = new T.Group(); body.userData.hm = shell(g); g.add(body);
    if (it.kind === 'tilt') {
      leg(g, a, 4); leg(g, b, 4); lead(g, a.clone().setY(y + 4), b.clone().setY(y + 4), y + 4);
      body.position.set(cx, y + 4, cz);
      cyl(body, 0, 0, 0, 2.7, 8.5, 0xd9b24a); cyl(body, 0, 8.5, 0, 1.6, 0.25, 0x8a6d1f, { nh: 1 });
      return { g, set: v => { body.rotation.z = v > 0.5 ? -1.05 : 0; }, top: new T.Vector3(cx, y + 15, cz) };
    }
    const h = y + 3.2;
    leg(g, a, 3.4); leg(g, b, 3.4); lead(g, a, b, h);
    body.position.set(cx, 0, cz); body.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    cyl(body, 0, h, 0, 1.4, 8.6, 0xcfe8dc, { ax: 'x' });
    const magnet = new T.Group(); magnet.userData.hm = shell(g); body.add(magnet);
    box(magnet, -2, h + 2.4, 0, 4, 2.6, 3, 0xd6453d); box(magnet, 2, h + 2.4, 0, 4, 2.6, 3, 0x3577d4);   // a bar magnet, red for north and blue for south
    magnet.visible = false;
    return { g, set: v => { magnet.visible = v > 0.5; }, top: new T.Vector3(cx, y + 10, cz) };
  }
  /** A sensor module, built the way the one sold for it looks: its board standing on its three pins (+, OUT, GND) in a black plastic header, with what it
      senses with on the side that faces you, at the module's real size. The parts on the back of a board are there too, for anyone who turns the view. */
  function mkModule(it: RowModule): Made {
    const g = new T.Group(), legs = [0, 1, 2].map(i => anchor(`${it.row}${it.col + i}`)), mid = legs[1], x = mid.x, z = mid.z, y = mid.y, face = z + 0.75, back = z - 0.75;
    const glow = (m: Solid, color: number, v: number) => { m.material.emissive.setHex(color); m.material.emissiveIntensity = v; };
    const shown = (o: T.Object3D, on: boolean) => { o.visible = on; };
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    /** The three pins and the black plastic strip that holds them, `lift` tall. Gives the height the board starts at, on top of the strip. */
    const header = (lift = 2.5) => { legs.forEach(p => box(g, p.x, y, p.z, 0.6, lift + 1, 0.6, GOLD, { nh: 1 })); box(g, x, y, z, 7.9, lift, 2.5, DARK); return y + lift; };
    /** Small parts soldered on a board's face (or its back): a surface-mount LED, a black chip, a blue trimmer with its brass screw. */
    const smd = (lx: number, ly: number, color: number, at = face) => box(g, lx, ly, at + 0.35, 1.6, 0.9, 0.7, color, { nh: 1 });
    const chip = (cx: number, by: number, w: number, h: number, at = face) => box(g, cx, by, at + 0.6, w, h, 1.2, 0x1b1e23);
    const trimmer = (cx: number, by: number, color = 0x2f6fd6, at = face, dir = 1) => {
      box(g, cx, by, at + dir * 2, 6.5, 6.5, 4, color);
      cyl(g, cx, by + 3.25, at + dir * 4.2, 1.3, 0.5, 0xd9b24a, { ax: 'z' });
    };
    /** Plated mounting holes and the silkscreen, printed on a board's face. */
    const silk = (W: number, H: number, by: number, draw: (c: CanvasRenderingContext2D, S: number) => void) => facePrint(g, W, H, 12, x, by + H / 2, face + 0.02, draw);
    const hole = (c: CanvasRenderingContext2D, S: number, hx: number, hy: number) => {
      c.fillStyle = '#d9b24a'; c.beginPath(); c.arc(hx * S, hy * S, 1.4 * S, 0, 7); c.fill();
      c.fillStyle = '#101216'; c.beginPath(); c.arc(hx * S, hy * S, 0.75 * S, 0, 7); c.fill();
    };
    const label = (c: CanvasRenderingContext2D, S: number, text: string, lx: number, ly: number, size: number, upsideDown = false) => {
      c.save(); c.translate(lx * S, ly * S); if (upsideDown) c.rotate(Math.PI);
      c.fillStyle = '#eef0f2'; c.font = `700 ${size * S}px "JetBrains Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 0);
      c.restore();
    };
    let set: (v: number) => void, top: number;

    if (it.kind === 'pir') {
      /* An HC-SR501: a green board 32 × 24 mm with the white Fresnel lens over the sensor, a faceted dome on a square base. Its two orange trimmers
         (how long it stays on, how far it sees), the jumper that sets how it repeats, and its BISS0001 chip are on the back. */
      const b = header(5.5), W = 32, H = 24, cy = b + H / 2;
      box(g, x, b, z, W, H, 1.5, 0x2a8a4f);
      silk(W, H, b, (c, S) => { [[2.6, 2.6], [W - 2.6, 2.6], [2.6, H - 2.6], [W - 2.6, H - 2.6]].forEach(([hx, hy]) => hole(c, S, hx, hy)); });
      box(g, x, cy - 11.5, face + 1.3, 23, 23, 2.6, 0xe6e6de);   // the lens's square base
      const fresnel: [number, number][] = [[0, 0]];
      for (let i = 0; i <= 4; i++) { const t = (i / 4) * Math.PI / 2; fresnel.push([10.6 * Math.cos(t), 10.6 * Math.sin(t)]); }
      fresnel[fresnel.length - 1] = [0, 10.6];
      const dome = lathe(g, x, cy, face + 2.4, fresnel, 0xf4f4ef, { rx: Math.PI / 2, seg: 10 });   // ten facets round, four up: the lens's look
      [-9, 9].forEach(dx => trimmer(x + dx, b + 13, 0xf08a24, back, -1));
      chip(x, b + 3.5, 9, 5, back - 1.2);
      box(g, x - 9, b + 4, back - 1.4, 3.2, 5.6, 2.8, DARK);   // the jumper
      set = v => glow(dome, 0xff5a3c, v > 0.5 ? 0.6 : 0);
      top = b + H + 6;
    } else if (it.kind === 'gas') {
      /* An MQ-2 module: a blue board 22 × 32 mm. The sensor stands out from it, its heater and tin-oxide element inside a steel cap with a double mesh,
         on a brown bakelite base. Below it, the power light and the light that comes on when the gas passes the trimmer's limit. */
      const b = header(), W = 22, H = 32, sy = b + 19.5;
      box(g, x, b, z, W, H, 1.5, 0x1f63b0);
      silk(W, H, b, (c, S) => {
        [[2.6, 2.6], [W - 2.6, 2.6]].forEach(([hx, hy]) => hole(c, S, hx, hy));
        label(c, S, 'MQ-2', W / 2, 5.4, 2.2);
        label(c, S, 'VCC AO GND', W / 2, H - 2.6, 1.7);
      });
      cyl(g, x, sy, face + 1.6, 10.2, 3.2, 0xb5864f, { ax: 'z' });   // the bakelite base
      cyl(g, x, sy, face + 6.4, 9.3, 6.4, 0xc9ced3, { ax: 'z' });   // the steel cap
      const heat = cyl(g, x, sy, face + 9.5, 7.6, 0.3, 0x2b221a, { ax: 'z', nh: 1 });   // the element, seen through the mesh
      facePrint(g, 17.6, 17.6, 14, x, sy, face + 9.7, (c, S) => {   // the double mesh, with the cap's rim round it
        const r = 8.8 * S, m = 8.8 * S;
        c.save(); c.beginPath(); c.arc(m, m, r * 0.92, 0, 7); c.clip();
        c.strokeStyle = 'rgba(214, 219, 224, 0.95)'; c.lineWidth = 0.32 * S;
        for (let i = -9; i <= 9; i++) { c.beginPath(); c.moveTo(m + i * 0.95 * S, 0); c.lineTo(m + i * 0.95 * S, 2 * m); c.stroke(); c.beginPath(); c.moveTo(0, m + i * 0.95 * S); c.lineTo(2 * m, m + i * 0.95 * S); c.stroke(); }
        c.restore();
        c.strokeStyle = '#8e969e'; c.lineWidth = 1.1 * S; c.beginPath(); c.arc(m, m, r * 0.94, 0, 7); c.stroke();
      });
      smd(x - 5, b + 5.5, 0xff4a3d); const alarm = smd(x + 5, b + 5.5, 0x3ddc6a);
      chip(x, b + 23, 5, 4, back - 1.2); trimmer(x, b + 12, 0x2f6fd6, back, -1);   // the comparator and its trimmer, on the back
      set = v => { glow(heat, 0xff7a2a, clamp(v) * 0.9); glow(alarm, 0x3ddc6a, v > 0.5 ? 0.9 : 0); };
      top = b + H + 5;
    } else if (it.kind === 'flame') {
      /* An infrared flame module: a red board 14 × 30 mm. Its receiver, a 5 mm photodiode in black epoxy that lets in only infrared, stands on its legs
         at the top, bent towards where the flame will be. On its face, the blue trimmer that sets how bright a flame must be, the LM393 comparator, and its lights. */
      const b = header(), W = 14, H = 30, tip = b + H;
      box(g, x, b, z, W, H, 1.5, 0xb8322b);
      silk(W, H, b, (c, S) => { hole(c, S, W / 2, 3); label(c, S, 'FLAME', W / 2, H - 2.4, 1.6); });
      trimmer(x, b + 17.5);
      chip(x, b + 9, 5.2, 4.2);
      smd(x - 4.4, b + 3.6, 0xff4a3d); const alarm = smd(x + 4.4, b + 3.6, 0x3ddc6a);
      const ry = tip + 5, rz = face + 2.2;   // where the receiver's body is
      [-1.27, 1.27].forEach(dx => bent(g, [new T.Vector3(x + dx, tip, z), new T.Vector3(x + dx, ry, z), new T.Vector3(x + dx, ry, rz)], 0.28, LEAD));
      cyl(g, x, ry, rz + 0.5, 2.9, 1, 0x1b1e23, { ax: 'z' });   // its rim
      cyl(g, x, ry, rz + 3.5, 2.5, 5, 0x1b1e23, { ax: 'z' });
      ball(g, x, ry, rz + 6, 2.5, 0x1b1e23);   // and its dome
      /* In front of it, a candle for it to watch: unlit while there is no flame, lit with a flame as big as the slider says. The flame is a teardrop in
         three layers, as a real one is: a blue base where the gas meets the air, a bright yellow middle, an orange tongue outside, with a soft glow round it.
         It flickers, unless the viewer has asked for less motion. */
      const cz = z - ROWZ[it.row] + CANDLE_REACH, floor = 0, wickTop = ry - 2;   // on the table just in front of the breadboard (src/state/table.ts keeps others clear of it)
      const candle = new T.Group(); candle.userData.hm = shell(g); g.add(candle);
      cyl(candle, x, floor, cz, 4.6, wickTop - 2.2 - floor, 0xf1e6cf);   // the wax
      cyl(candle, x, wickTop - 2.2, cz, 4.6, 0.25, 0xe2d5b8, { nh: 1 });   // its top, a little melted
      cyl(candle, x, wickTop - 2.2, cz, 0.35, 2.2, 0x2a2420, { nh: 1 });   // the wick
      const tear = (h: number, r: number): [number, number][] => [[0, 0], [r * 0.55, h * 0.07], [r * 0.92, h * 0.22], [r, h * 0.38], [r * 0.85, h * 0.58], [r * 0.55, h * 0.78], [r * 0.22, h * 0.93], [0, h]];
      const flame = new T.Group(); flame.position.set(x, wickTop - 0.6, cz); candle.add(flame);
      const outer = lathe(flame, 0, 0, 0, tear(12.5, 2.7), 0xff6f1a, { glow: 0xff4a00, gi: 0.9, seg: 24 });
      const inner = lathe(flame, 0, 1.9, 0, tear(7, 1.6), 0xffe27a, { nh: 1, glow: 0xffc040, gi: 1, seg: 20 });
      const base = lathe(flame, 0, -0.1, 0, tear(3.8, 1.75), 0x3d8bff, { nh: 1, glow: 0x2a6bff, gi: 0.9, seg: 16 });
      [outer, inner, base].forEach((m, i) => { m.material.transparent = true; m.material.opacity = [0.78, 0.96, 0.92][i]; m.raycast = () => {}; });
      const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 64;
      const hc = haloCanvas.getContext('2d')!, warmth = hc.createRadialGradient(32, 32, 2, 32, 32, 32);
      warmth.addColorStop(0, 'rgba(255, 196, 90, 0.75)'); warmth.addColorStop(0.45, 'rgba(255, 140, 40, 0.28)'); warmth.addColorStop(1, 'rgba(255, 120, 20, 0)');
      hc.fillStyle = warmth; hc.fillRect(0, 0, 64, 64);
      const halo = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(haloCanvas), transparent: true, depthWrite: false }));
      halo.position.set(0, 4.5, 0); halo.scale.set(20, 22, 1); halo.raycast = () => {}; flame.add(halo);
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      let size = 0;
      itemAnim.push(t => {
        if (!flame.visible) return;
        const flick = calm ? 0 : Math.sin(t / 83) * 0.06 + Math.sin(t / 31 + 1.7) * 0.04, sway = calm ? 0 : Math.sin(t / 67) * 0.07 + Math.sin(t / 23) * 0.03;
        flame.scale.set(size * (1 - flick * 0.5), size * (1 + flick), size * (1 - flick * 0.5));
        flame.rotation.z = sway; flame.rotation.x = calm ? 0 : Math.sin(t / 59 + 0.6) * 0.04;
        halo.material.opacity = 0.75 + flick * 1.5;
      });
      set = v => {
        const f = clamp(v);
        shown(flame, f > 0.02); size = 0.55 + 0.75 * f; flame.scale.setScalar(size);
        glow(alarm, 0x3ddc6a, f > 0.5 ? 0.9 : 0);
      };
      top = tip + 13;
    } else if (it.kind === 'water') {
      /* The usual water-level sensor: a red board 20 × 62 mm with ten bare traces side by side, every other one joined, so water bridging them lets current
         through. In a breadboard it stands upside down, so the part that would dip into the water is at the top: the blue shows how much of it is wet. */
      const b = header(), W = 20, H = 62, wetTop = b + H - 1.5, LEN = 42;
      box(g, x, b, z, W, H, 1.5, 0xb8322b);
      silk(W, H, b, (c, S) => {
        const xs = Array.from({ length: 10 }, (_, i) => 2.4 + i * 1.7);
        c.strokeStyle = '#d6d8d4'; c.lineWidth = 0.9 * S; c.lineCap = 'round';
        xs.forEach((tx, i) => { c.beginPath(); c.moveTo(tx * S, (i % 2 ? 2.2 : 1.2) * S); c.lineTo(tx * S, (i % 2 ? LEN + 1.5 : LEN + 0.5) * S); c.stroke(); });
        c.beginPath(); c.moveTo(xs[1] * S, (LEN + 1.5) * S); c.lineTo(xs[9] * S, (LEN + 1.5) * S); c.moveTo(xs[0] * S, 1.2 * S); c.lineTo(xs[8] * S, 1.2 * S); c.stroke();   // each comb joined at its end
        label(c, S, 'S  +  -', W / 2, H - 2.2, 1.9, true);
        hole(c, S, 3, H - 6); hole(c, S, W - 3, H - 6);
      });
      chip(x - 4.5, b + 7, 2.8, 2.2); [0, 2.5].forEach(dy => box(g, x + 3.5, b + 6 + dy, face + 0.4, 2.2, 1, 0.8, 0x23272e, { nh: 1 }));   // its transistor and resistors
      smd(x + 6.8, b + 11, 0xff4a3d);
      const water = box(g, x, wetTop - LEN, face + 0.35, 18.4, LEN, 0.5, 0x3a8fe0, { nh: 1, glow: 0x1c5fb8, gi: 0.5 });
      water.material.transparent = true; water.material.opacity = 0.62;
      set = v => { const lv = clamp(v); shown(water, lv > 0.01); water.scale.y = Math.max(0.01, lv); water.position.y = wetTop - (LEN * lv) / 2; };   // wet from the tip down
      top = b + H + 5;
    } else {
      /* An infrared obstacle sensor: a small blue board with a clear emitter and a dark receiver side by side. */
      legs.forEach(p => box(g, p.x, y, p.z, 0.6, 3.4, 0.6, GOLD, { nh: 1 }));
      box(g, x, y + 3, z, 13, 17, 1.5, 0x2a62b8);
      cyl(g, x - 3.2, y + 18, face + 2.6, 1.5, 5.2, 0xe9ecef, { ax: 'z' }); cyl(g, x + 3.2, y + 18, face + 2.6, 1.5, 5.2, 0x1b1e23, { ax: 'z' });
      box(g, x, y + 6, face, 4, 4, 1.4, 0x3aa7b3);
      const wall = new T.Group(); wall.userData.hm = shell(g); g.add(wall);
      box(wall, x, y, face + 11, 13, 15, 2, 0xe2572b);   // something in the way
      set = v => shown(wall, v > 0.5);
      top = y + 25;
    }
    set(0);
    return { g, set, top: new T.Vector3(x, top, z) };
  }
  /** The soil moisture sensor where it is used: a resistive probe stuck in the soil of a potted plant, which stands on the table wherever it is put.
      The probe is a black board cut like a fork, 20 × 51 mm, prongs down, with a gold strip bare down each prong so the soil between them carries the
      current. It stands on the side of the pot towards the bench, with its three pins (VCC, SIG, GND) standing up from its head for the wires.
      The plant grows on the other side and is bigger than the probe. The soil darkens as it gets wetter. The plant stands up green in damp soil, and
      as the soil dries it droops away from the probe and yellows, until it hangs over the rim; watered, it stands up again. */
  function mkPlant(it: SoilItem): Made {
    const g = new T.Group(), p = plantPlace(it), x = bb!.position.x + p.x, pz = p.z, clamp = (v: number) => Math.min(1, Math.max(0, v));
    const pot = new T.Group(); pot.userData.hm = shell(g); g.add(pot);
    lathe(pot, x, 0, pz, [[0, 0], [14, 0], [18.6, POT_H - 2], [0, POT_H - 2]], 0xc8673a);   // the pot, wider at the top
    lathe(pot, x, 0, pz, [[17.4, POT_H - 4], [20.4, POT_H - 4], [20.4, POT_H + 1], [17.4, POT_H + 1], [17.4, POT_H - 4]], 0xb5582d);   // its rim, a ring round the top
    const earth = cyl(pot, x, POT_H - 2, pz, 17.3, 0.4, 0x7a5a3a, { nh: 1 });   // the soil, a little below the rim

    const q = probeAt(p), px = bb!.position.x + q.x, qz = q.z, pf = qz + 0.75, head = PROBE_TIP + 33.3;
    const fork = new T.Shape();
    [[10, 51.1], [10, 4.4], [6.7, 0], [3.3, 4.4], [3.3, 33.3], [-3.3, 33.3], [-3.3, 4.4], [-6.7, 0], [-10, 4.4], [-10, 51.1]].forEach(([fx, fy], i) => (i ? fork.lineTo(fx, fy) : fork.moveTo(fx, fy)));
    fork.closePath();
    prism(g, px, PROBE_TIP, qz - 0.75, fork, 1.5, 0x24282e, { rx: Math.PI / 2 });   // 22 mm of its prongs are in the soil
    const strips = [-6.7, 6.7].map(dx => box(g, px + dx, PROBE_TIP + 4.6, pf + 0.02, 2.8, 27, 0.12, GOLD, { nh: 1 }));
    const plated = (c: CanvasRenderingContext2D, S: number, hx: number, hy: number) => {   // a mounting hole
      c.fillStyle = '#d9b24a'; c.beginPath(); c.arc(hx * S, hy * S, 1.4 * S, 0, 7); c.fill();
      c.fillStyle = '#101216'; c.beginPath(); c.arc(hx * S, hy * S, 0.75 * S, 0, 7); c.fill();
    };
    const printed = (c: CanvasRenderingContext2D, S: number, text: string, lx: number, ly: number, size: number) => {
      c.fillStyle = '#eef0f2'; c.font = `700 ${size * S}px "JetBrains Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, lx * S, ly * S);
    };
    facePrint(g, 20, 17.8, 12, px, head + 8.9, pf + 0.02, (c, S) => { printed(c, S, 'VCC SIG GND', 10, 3.4, 1.5); printed(c, S, 'SOIL', 10, 7.4, 2.2); plated(c, S, 3.2, 14.4); plated(c, S, 16.8, 14.4); });
    box(g, px + 3, head + 3.4, pf + 0.6, 3, 2.4, 1.2, 0x1b1e23);   // its transistor
    box(g, px - 4.5, head + 7, pf + 0.35, 1.6, 0.9, 0.7, 0xff4a3d, { nh: 1 });   // and its power light
    box(g, px, PROBE_TOP, qz, 7.9, 2.5, 2.5, DARK);   // the strip that holds its pins
    SOIL_PINS.forEach((_, i) => box(g, px + (i - 1) * 2.54, PROBE_TOP, qz, 0.64, 8.5, 0.64, GOLD, { nh: 1 }));

    /* The plant: a stem in four pieces, each bending a little more as it droops, a pair of leaves at the top of each piece, turned a quarter round from
       the pair below, and a bud at the very top. */
    const away = qz < pz ? 1 : -1, leafy: Solid[] = [], pivots: { g: T.Group; side: number; up: number }[] = [], joints: T.Group[] = [];   // away: which way along z is away from the probe
    let at: T.Group = pot, stemY = SOIL_TOP;
    [[16, 3.4, 1.3], [15, 3, 1.1], [13, 2.6, 0.9], [10, 2, 0.75]].forEach(([len, s, r], i) => {
      const joint = new T.Group(); joint.position.set(i ? 0 : x + 5.5, stemY, i ? 0 : pz + away * 4.5); at.add(joint); joints.push(joint);
      cyl(joint, 0, 0, 0, r, len, 0x4f9a3a);
      [-1, 1].forEach(side => {
        const pivot = new T.Group(); pivot.position.set(0, len - 0.4, 0); pivot.rotation.y = i % 2 ? Math.PI / 2 : 0; joint.add(pivot);
        const tilt = new T.Group(); pivot.add(tilt);
        const leaf = new T.Group(); leaf.position.set(side * 2.6 * s, 0, 0); leaf.scale.set(2.8 * s, 0.6, 1.45 * s); tilt.add(leaf);
        leafy.push(ball(leaf, 0, 0, 0, 1, 0x3aa655));
        pivots.push({ g: tilt, side, up: 0.5 - i * 0.12 });
      });
      at = joint; stemY = len;
    });
    leafy.push(ball(at, 0, stemY + 1.2, 0, 2, 0x5cbf4a));
    const green = new T.Color(0x3aa655), parched = new T.Color(0xb39a3a), wet = new T.Color(0x3e2a1c), dry = new T.Color(0xb0916a);
    const set = (v: number) => {
      const m = clamp(v), wilt = 1 - clamp((m - 0.12) / 0.38);   // fine above half, fully wilted below about a tenth
      strips.forEach(st => { st.material.emissive.setHex(0x2a8cff); st.material.emissiveIntensity = m * 0.9; });
      earth.material.color.copy(dry).lerp(wet, m);
      joints.forEach((j, i) => { j.rotation.x = away * wilt * (0.15 + i * 0.08); });   // bowed over away from the probe, the top furthest
      pivots.forEach(pv => { pv.g.rotation.z = pv.side * (pv.up - wilt * 1.15); });
      leafy.forEach(l => l.material.color.copy(green).lerp(parched, wilt));
    };
    set(0.5);
    return { g, set, top: new T.Vector3(x, POT_H + 62, pz) };   // its name goes over the pot
  }
  /** A thumb joystick: a board standing on its five pins with the stick facing you. The stick leans the way it is pushed and sinks when it is pressed. */
  function mkJoy(it: Of<'joy'>): Made {
    const g = new T.Group(), legs = [0, 1, 2, 3, 4].map(i => anchor(`${it.row}${it.col + i}`)), mid = legs[2], x = mid.x, z = mid.z, y = mid.y, face = z + 0.75;
    legs.forEach(p => box(g, p.x, y, p.z, 0.6, 3.4, 0.6, GOLD, { nh: 1 }));
    box(g, x, y + 3, z, 18, 20, 1.5, 0x23272e);
    cyl(g, x, y + 13, face + 1.6, 6.4, 3.2, 0x3b424c, { ax: 'z' });
    const stick = new T.Group(); stick.userData.hm = shell(g); stick.position.set(x, y + 13, face + 3); g.add(stick);
    cyl(stick, 0, 0, 3, 1.7, 6, 0x23272e, { ax: 'z' }); cyl(stick, 0, 0, 7, 4.8, 2.4, 0x4a515a, { ax: 'z' });
    const rest = stick.position.z;
    return {
      g, top: new T.Vector3(x, y + 28, z),
      set: v => { stick.rotation.y = (v - 0.5) * 0.9; },            // left and right
      more: { ':y': v => { stick.rotation.x = -(v - 0.5) * 0.9; }, ':sw': v => { stick.position.z = rest - (v > 0.5 ? 1.2 : 0); } },   // down and up, and the press
    };
  }
  function mkPad(): Made {
    const at = padPos!, g = new T.Group(), m = box(g, at.x, 0, at.z, 18, 0.8, 18, 0xc98a4b);
    const set = (on: number) => { m.material.emissive.setHex(0xffc27a); m.material.emissiveIntensity = on ? 0.7 : 0; };
    return { g, set, top: new T.Vector3(at.x, 3, at.z) };
  }
  /** The 16×2 LCD lying on the table: a green board with the display on top, and the backpack's tab on its left holding the four pins.
      What it shows is drawn on a canvas: the lit (or unlit) glass, a faint box for each character, and the characters. */
  function mkLcd(): Made {
    const at = lcdPos!, g = new T.Group(), x = at.x, z = at.z;
    box(g, x, 0, z, 80, 1.6, 36, 0x1f7a4a);
    box(g, x, 1.6, z, 71, 7, 25, 0x262b31);
    box(g, x - 44, 0, z, 12, 1.6, 15, 0x2a62b8);
    LCD_PINS.forEach((_, i) => box(g, x - 47.5, 1.6, z + (i - 1.5) * 2.54, 0.64, 1.6, 0.64, GOLD, { nh: 1 }));
    printed(g, 7, 13, 24, 1.62, k => LCD_PINS.forEach((name, i) => k.text(name, 0.4, 6.5 + (i - 1.5) * 2.54, 1.7, { bold: true, align: 'left' })), x - 41.5, z);
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 160;
    const ctx = cv.getContext('2d')!, tex = new T.CanvasTexture(cv); tex.anisotropy = anisotropy;
    const glass = new T.Mesh(new T.PlaneGeometry(64, 16), new T.MeshBasicMaterial({ map: tex }));
    glass.rotation.x = -Math.PI / 2; glass.position.set(x, 8.65, z); g.add(glass);
    let drawn = '', blinkOn = true, last: LcdView = DARK_LCD;
    const paint = (v: LcdView) => {
      const key = JSON.stringify(v) + (v.cursor?.blink ? String(blinkOn) : '');
      if (key === drawn) return;
      drawn = key;
      const W = cv.width, H = cv.height, padX = 18, padY = 14, cw = (W - padX * 2) / LCD_COLS, ch = (H - padY * 2) / 2;
      const ink = v.light ? '#18240c' : '#1b260e';
      ctx.fillStyle = !v.powered ? '#2c3424' : v.light ? '#a6d13f' : '#56702f';
      ctx.fillRect(0, 0, W, H);
      ctx.font = `700 ${Math.round(ch * 0.74)}px "JetBrains Mono", ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let r = 0; r < 2; r++) for (let c = 0; c < LCD_COLS; c++) {
        const cx = padX + c * cw, cy = padY + r * ch, glyph = v.lines[r][c];
        if (v.powered) { ctx.fillStyle = 'rgba(20, 40, 8, 0.1)'; ctx.fillRect(cx + 2, cy + 3, cw - 4, ch - 6); }
        ctx.fillStyle = ink;
        if (glyph === '█') ctx.fillRect(cx + 2, cy + 3, cw - 4, ch - 6);
        else if (glyph !== ' ') ctx.fillText(glyph, cx + cw / 2, cy + ch / 2 + 1);
      }
      if (v.cursor) {
        const cx = padX + v.cursor.col * cw, cy = padY + v.cursor.row * ch;
        ctx.fillStyle = ink;
        if (v.cursor.blink && blinkOn) ctx.fillRect(cx + 2, cy + 3, cw - 4, ch - 6); else ctx.fillRect(cx + 3, cy + ch - 8, cw - 6, 3);
      }
      tex.needsUpdate = true;
    };
    itemAnim.push(t => { const on = Math.floor(t / 530) % 2 === 0; if (on !== blinkOn) { blinkOn = on; if (last.cursor?.blink) paint(last); } });   // a blinking cursor, about twice a second
    paint(DARK_LCD);
    return { g, lcd: v => { last = v; paint(v); }, top: new T.Vector3(x, 16, z) };
  }
  function make(it: Item, k: number): Made {
    switch (it.t) {
      case 'lcd': return mkLcd();
      case 'wire': return mkWire(it, k);
      case 'led': return mkLed(it);
      case 'res': return mkRes(it);
      case 'button': return mkButton(it);
      case 'pot': return mkPot(it);
      case 'buzzer': return mkBuzzer(it);
      case 'sonar': return mkSonar(it);
      case 'pad': return mkPad();
      case 'servo': return mkServo(it);
      case 'ldr': return mkLdr(it);
      case 'temp': return mkTemp(it);
      case 'rgb': return mkRgb(it);
      case 'slide': return mkSlide(it);
      case 'contact': return mkContact(it);
      case 'module': return it.kind === 'soil' ? mkPlant(it) : mkModule(it);
      case 'joy': return mkJoy(it);
      case 'breadboard': return mkBreadboard();
    }
  }

  function cable(b: BuiltBoard) {   // a USB cable leaving the board to the left
    const g = new T.Group(), p = new T.Vector3(...b.usbAt).add(b.group.position), [w, h, d] = b.plug;
    g.userData.nofit = true;
    box(g, p.x - w / 2 - 0.5, p.y - h / 2, p.z, w, h, d, 0x3a4048);
    const s = new T.Vector3(p.x - w - 0.5, p.y, p.z);
    const curve = new T.CubicBezierCurve3(s, s.clone().setX(s.x - 14), new T.Vector3(s.x - 20, 2, s.z + 8), new T.Vector3(s.x - 70, 2, s.z + 22));
    g.add(new T.Mesh(new T.TubeGeometry(curve, 24, 1.7, 8), toon(0x3a4048))); g.add(new T.Mesh(new T.TubeGeometry(curve, 24, 1.7 + HT, 8), shell(g)));
    world.add(g);
  }

  /* --- smoke and sparks --- */
  const fx: { m: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>; v: T.Vector3; born: number; life: number }[] = [];
  function puff(at: T.Vector3, kind: 'smoke' | 'spark') {
    const now = performance.now(), n = kind === 'smoke' ? 9 : 14;
    for (let i = 0; i < n; i++) {
      const r = kind === 'smoke' ? 1.6 + Math.random() * 1.6 : 0.5 + Math.random() * 0.5;
      const m = new T.Mesh(new T.SphereGeometry(r, 10, 8), new T.MeshBasicMaterial({ color: kind === 'smoke' ? (i % 2 ? 0x8d949b : 0x5b6168) : (i % 2 ? 0xffc23a : 0xff7a2a), transparent: true, opacity: 0.85, depthWrite: false }));
      m.position.copy(at); m.raycast = () => {}; world.add(m);
      const sp = kind === 'smoke' ? 0.006 : 0.03;
      fx.push({ m, born: now, life: kind === 'smoke' ? 1700 : 650, v: new T.Vector3((Math.random() - 0.5) * sp * 2, (kind === 'smoke' ? 0.012 : 0.02) + Math.random() * sp, (Math.random() - 0.5) * sp * 2) });
    }
  }
  function stepFx(t: number) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], p = (t - f.born) / f.life;
      if (p >= 1) { world.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); continue; }
      f.m.position.addScaledVector(f.v, 16); f.m.scale.setScalar(1 + p * 1.8); f.m.material.opacity = 0.85 * (1 - p);
    }
  }

  /* --- assembly --- */
  const addHot = (id: string, title: string, pos: T.Vector3, sign?: '+' | '-') => hots.push({ id, title, pos, ...(sign ? { sign } : {}) });
  const isUno = spec.board === 'uno';
  bb = buildBB(); bb.position.set(isUno ? 50 : 0, 0, 0); world.add(bb);
  const b = isUno ? (uno = buildUno()) : buildEsp();
  if (isUno) b.group.position.set(bb.position.x + UNO_AT.x, 1.6, UNO_AT.z);
  else b.group.position.set(colX(4) + b.W / 2 - 8.24, BB_HEIGHT + 4.1, 0);
  world.add(b.group); cable(b); ink(b.group);
  // the table: it shows nothing itself, only the soft shadows everything casts on it, warm brown on paper and black on the chalkboard
  const tableShade = new T.ShadowMaterial({ color: 0x3a2c1c, opacity: 0.3 }), table = new T.Mesh(new T.PlaneGeometry(6000, 6000), tableShade);
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; table.raycast = () => {}; table.userData.nofit = true; world.add(table);

  Object.assign(groups, b.parts); devs.builtin = b.setLed;
  if (spec.parts) for (const id of Object.keys(spec.parts)) { const h = b.hot[id]; if (h) addHot(id, spec.parts[id][0], new T.Vector3(...h).add(b.group.position)); }
  padPos = new T.Vector3(bb.position.x + PAD_AT.x, 0.8, PAD_AT.z);
  lcdPos = new T.Vector3(bb.position.x + LCD_AT.x, 0, LCD_AT.z);   // their usual places, until a circuit says where there is room
  const boardHots = hots.length;

  /* --- the parts the student placed --- */
  let placed: T.Group[] = [], placedIds: string[] = [], burntSet = new Set<string>();
  const burners: Record<string, () => void> = {}, tops: Record<string, T.Vector3> = {};
  const free = (o: T.Object3D) => o.traverse(c => { if (c instanceof T.Mesh) { c.geometry.dispose(); c.material.map?.dispose(); c.material.dispose(); } });
  function setCircuit(items: Item[], burnt: string[], settled: Item[] = items) {
    placed.forEach(g => { world.remove(g); if (!g.userData.keep) free(g); });
    placedIds.forEach(id => { delete devs[id]; delete groups[id]; delete burners[id]; delete tops[id]; delete lcdDraws[id]; });
    placed = []; placedIds = []; itemAnim.length = 0; hots.length = boardHots; burntSet = new Set(burnt); lit.forEach(m => { m.color.setHex(INK); inkOf.get(m)?.color.setHex(INK); }); lit = [];
    const second = items.find(it => it.t === 'breadboard');   // first, so the parts plugged into it know where its holes are
    extra = second?.t === 'breadboard' ? { g: extraBoard(second), cols: BREADBOARD_COLS[second.size] } : null;
    const lay = tableLayout(spec.board, settled), bx = bb!.position.x;   // the touch pad and the LCD lie where nothing else does
    padPos = new T.Vector3(bx + (lay.pad ?? PAD_AT).x, 0.8, (lay.pad ?? PAD_AT).z);
    lcdPos = new T.Vector3(bx + (lay.lcd ?? LCD_AT).x, 0, (lay.lcd ?? LCD_AT).z);
    const soil = items.find(it => it.t === 'module' && it.kind === 'soil');
    plantAt = soil ? plantPlace(soil as SoilItem) : null;   // where the pot is, while it is dragged too, so the wires to its probe follow it
    items.forEach((it, k) => {
      let made: Made;
      try { made = make(it, k); } catch { return; }   // a point that is not on this bench is skipped
      const id = itemId(it, k);
      if (!made.g.userData.keep) ink(made.g);   // a kept second breadboard was inked when it was built
      made.g.userData.pick = id;
      world.add(made.g); groups[id] = made.g; placed.push(made.g); placedIds.push(id);
      if (made.set) devs[id] = made.set;
      if (made.lcd) lcdDraws[id] = made.lcd;
      if (made.more) for (const [tail, f] of Object.entries(made.more)) { devs[id + tail] = f; placedIds.push(id + tail); }
      if (made.top) tops[id] = made.top;
      if (made.burn) { burners[id] = made.burn; if (burntSet.has(id)) made.burn(); }
      if (made.top && spec.info[kindOf(it)]) addHot(id, it.t === 'res' ? `${ohmsLabel(it.ohms ?? 220)} resistor` : it.t === 'breadboard' ? breadboardName(it.size) : spec.info[kindOf(it)][0], made.top);   // a resistor's label says its value, a breadboard's its size
      /* Which leg is which, readable from any angle: every part with a + and a − gets a badge just outside each of them. */
      const flat = (from: T.Vector3, to: T.Vector3) => { const u = new T.Vector3(to.x - from.x, 0, to.z - from.z); return u.length() ? u.normalize() : u.set(1, 0, 0); };
      const pole = (title: string, sign: '+' | '-', at: T.Vector3, u: T.Vector3, out: number, lift = 13) => addHot(id, title, at.clone().addScaledVector(u, out).setY(at.y + lift), sign);
      if (it.t === 'led') { const p = anchor(it.a), n = anchor(it.k), u = flat(p, n); pole('LED long leg (+)', '+', p, u, -4.5); pole('LED short leg (−)', '-', n, u, 4.5); }
      else if (it.t === 'buzzer') { const p = anchor(it.a), n = anchor(it.b), u = flat(p, n); pole('Buzzer positive leg (+)', '+', p, u, -4.5); pole('Buzzer negative leg (−)', '-', n, u, 4.5); }
      else if (it.t === 'temp') { const p = anchor(`${it.row}${it.col}`), n = anchor(`${it.row}${it.col + 2}`), u = flat(p, n); pole('Sensor power leg (+)', '+', p, u, -4.5, 9); pole('Sensor ground leg (−)', '-', n, u, 4.5, 9); }
      else if (it.t === 'module' && it.kind === 'soil') { const p = anchor(soilPoint('VCC')), n = anchor(soilPoint('GND')), u = flat(p, n); pole('Probe power pin VCC (+)', '+', p, u, -4, 12); pole('Probe ground pin GND (−)', '-', n, u, 4, 12); }
      else if (it.t === 'module') { const p = anchor(`${it.row}${it.col}`), n = anchor(`${it.row}${it.col + 2}`), u = flat(p, n); pole('Sensor power pin (+)', '+', p, u, -6.5, 6); pole('Sensor ground pin (−)', '-', n, u, 6.5, 6); }
      else if (it.t === 'joy') { const n = anchor(`${it.row}${it.col}`), p = anchor(`${it.row}${it.col + 1}`), u = flat(n, p); pole('Joystick ground pin (−)', '-', n, u, -6.5, 6); pole('Joystick power pin (+)', '+', p, u, -4, 28); }
      else if (it.t === 'rgb') { const n = anchor(`${it.row}${it.col + 1}`), u = flat(anchor(`${it.row}${it.col}`), n); pole('RGB LED long leg (−)', '-', n, u, 0, 20); }
      else if (it.t === 'sonar') { const p = anchor(`${it.row}${it.col}`), n = anchor(`${it.row}${it.col + 3}`), u = flat(p, n); pole('Sensor power pin VCC (+)', '+', p, u, -4.5, 9); pole('Sensor ground pin GND (−)', '-', n, u, 4.5, 9); }
      else if (it.t === 'servo') { const n = anchor(`${it.row}${it.col}`), p = anchor(`${it.row}${it.col + 1}`), u = flat(n, anchor(`${it.row}${it.col + 2}`)); pole('Servo ground wire (−)', '-', n, u, -4.5, 12); pole('Servo power wire (+)', '+', p, u, 0, 20); }
    });
  }
  const safeAnchor = (name: string): T.Vector3 | null => { try { return anchor(name); } catch { return null; } };

  /* --- rings that show where a part is about to go --- */
  const ring = (color: number) => {
    const m = new T.Mesh(new T.RingGeometry(1.5, 2.7, 24), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, side: T.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 999; m.visible = false; m.raycast = () => {}; m.userData.nofit = true; world.add(m); return m;
  };
  const hoverRing = ring(0x14b8c4), pendRing = ring(0xe2572b);
  const preview = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0xe2572b, depthTest: false }));
  preview.renderOrder = 998; preview.visible = false; preview.raycast = () => {}; preview.userData.nofit = true; world.add(preview);

  return {
    group: world, hots,
    set(id, value) { devs[id]?.(value); },
    lcd(id, view) { lcdDraws[id]?.(view); },
    highlight(id) {
      const paint = (hex: number) => lit.forEach(m => { m.color.setHex(hex); inkOf.get(m)?.color.setHex(hex); });   // the outline and the ink lines together
      paint(INK);
      lit = [];
      const g = id ? groups[id] : null; if (!g) return;
      g.traverse(o => { const hm: T.MeshBasicMaterial | undefined = o.userData.hm; if (hm && !lit.includes(hm)) lit.push(hm); });
      paint(HILITE);
    },
    animate(t) { itemAnim.forEach(f => f(t)); stepFx(t); },
    setCircuit,
    burn(id) {
      if (burntSet.has(id)) return;
      burntSet.add(id); burners[id]?.();
      const at = tops[id]; if (at) puff(at.clone().setY(at.y - 4), 'smoke');
    },
    puff,
    anchor: safeAnchor,
    origin: bb.position.clone(),
    resize(width, height, pixelRatio) { RES.value.set(width, height); WIDTH.value = INK_PX * pixelRatio; },
    shade(dark) { tableShade.color.setHex(dark ? 0x000000 : 0x3a2c1c); tableShade.opacity = dark ? 0.42 : 0.3; },
    markers(hover, pending) {
      const place = (r: T.Mesh, name: string | null) => { const p = name ? safeAnchor(name) : null; r.visible = !!p; if (p) r.position.set(p.x, p.y + 0.4, p.z); return p; };
      const h = place(hoverRing, hover), q = place(pendRing, pending);
      preview.visible = !!(h && q && hover !== pending);
      if (preview.visible) preview.geometry.setFromPoints([q!.clone().setY(q!.y + 2), h!.clone().setY(h!.y + 2)]);
    },
    dispose() {
      world.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose();
      });
      Object.values(extraBoards).forEach(g => { if (g && !g.parent) free(g); });   // a size built earlier and not on the bench now
    },
  };
}
