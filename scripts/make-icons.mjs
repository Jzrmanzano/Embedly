/* Makes the site's icons in public/: the favicon as an SVG, a 32 px PNG for browsers that cannot use an SVG one, and the 180 px icon
   iPhones and iPads use on the home screen. All three are the brand mark from the header (the "chip" in src/components/Icons.tsx),
   filled in so it stays clear at 16 px: a microcontroller with three pins on each side and a dot in the middle.
   The shape is defined once, below, on the same 24-unit grid as the header's icon. Run with: node scripts/make-icons.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ORANGE = '#b83c06', ORANGE_DARK = '#ff8f55', PAPER = '#f4eee2';   // --accent in the light and dark themes, and --bg

/* --- the mark, on a 24-unit grid: a big body with three short pins on each side, which reads as a chip even at 16 px --- */
const BODY = { x: 4.5, y: 4.5, w: 15, h: 15, r: 1.6 }, DOT = { cx: 12, cy: 12, r: 2 };
const PIN_W = 2, PIN_L = 2.5, PIN_AT = [8.25, 12, 15.75];
const PINS = PIN_AT.flatMap(c => [
  { x: c - PIN_W / 2, y: BODY.y - PIN_L, w: PIN_W, h: PIN_L }, { x: c - PIN_W / 2, y: BODY.y + BODY.h, w: PIN_W, h: PIN_L },   // top and bottom
  { x: BODY.x - PIN_L, y: c - PIN_W / 2, w: PIN_L, h: PIN_W }, { x: BODY.x + BODY.w, y: c - PIN_W / 2, w: PIN_L, h: PIN_W },   // left and right
]);
const inRoundRect = (u, v, { x, y, w, h, r }) => {
  if (u < x || u > x + w || v < y || v > y + h) return false;
  const dx = Math.max(x + r - u, 0, u - (x + w - r)), dy = Math.max(y + r - v, 0, v - (y + h - r));
  return dx * dx + dy * dy <= r * r;
};
const inMark = (u, v) =>
  (inRoundRect(u, v, BODY) && (u - DOT.cx) ** 2 + (v - DOT.cy) ** 2 > DOT.r ** 2) || PINS.some(p => u >= p.x && u <= p.x + p.w && v >= p.y && v <= p.y + p.h);

/* --- the SVG: the same shapes as paths, its colour following the browser's light or dark setting --- */
const n = x => +x.toFixed(2);
const { x, y, w, h, r } = BODY;
const body = `M${n(x + r)} ${y}h${n(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}a${r} ${r} 0 0 1-${r} ${r}h-${n(w - 2 * r)}a${r} ${r} 0 0 1-${r}-${r}v-${n(h - 2 * r)}a${r} ${r} 0 0 1 ${r}-${r}z`
  + `M${DOT.cx} ${n(DOT.cy - DOT.r)}a${DOT.r} ${DOT.r} 0 1 0 0 ${n(2 * DOT.r)}a${DOT.r} ${DOT.r} 0 1 0 0-${n(2 * DOT.r)}z`;
const pins = PINS.map(p => `M${n(p.x)} ${n(p.y)}h${n(p.w)}v${n(p.h)}h-${n(p.w)}z`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>path{fill:${ORANGE}}@media (prefers-color-scheme:dark){path{fill:${ORANGE_DARK}}}</style><path fill-rule="evenodd" d="${body}"/><path d="${pins}"/></svg>\n`;

/* --- the PNGs: each pixel sampled 5 × 5 times, so the edges are smooth --- */
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function raster(size, { color, background, inset = 0 }) {
  const out = Buffer.alloc(size * size * 4), [r0, g0, b0] = rgb(color), back = background ? rgb(background) : null, S = 5;
  const scale = 24 / (size * (1 - 2 * inset)), off = size * inset;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let hits = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) if (inMark((px + (i + 0.5) / S - off) * scale, (py + (j + 0.5) / S - off) * scale)) hits++;
    const a = hits / (S * S), k = (py * size + px) * 4;
    if (back) [0, 1, 2].forEach(c => { out[k + c] = Math.round([r0, g0, b0][c] * a + back[c] * (1 - a)); }), (out[k + 3] = 255);
    else { out[k] = r0; out[k + 1] = g0; out[k + 2] = b0; out[k + 3] = Math.round(a * 255); }
  }
  return png(size, out);
}
const CRC = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;   // 8 bits a channel, RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);   // filter type 0 on each row
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', svg);
writeFileSync('public/favicon-32.png', raster(32, { color: ORANGE }));
writeFileSync('public/apple-touch-icon.png', raster(180, { color: ORANGE, background: PAPER, inset: 0.12 }));   // iOS fills see-through corners with black, so it gets the paper behind it
console.log('public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png');
