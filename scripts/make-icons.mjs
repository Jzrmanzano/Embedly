/* Makes the site's icons in public/: the favicon as an SVG, a 32 px PNG for browsers that cannot use an SVG one, and the 180 px icon
   iPhones and iPads use on the home screen. All three are the brand mark: a microcontroller seen from above, legs on two sides and the
   notch at one end, on a rounded tile. The header draws the same mark (BrandMark in src/components/Icons.tsx), so change both together.
   The chip is always white. Its tile is the light theme's orange, and in a dark browser the brighter orange of the bench's highlights,
   which keeps the white chip readable (3.7:1) and the tile clear of a dark tab bar.
   The shape is defined once, below, on a 32-unit grid. Run with: node scripts/make-icons.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const LIGHT = { tile: '#b83c06', glyph: '#ffffff' }, DARK = { tile: '#e2572b', glyph: '#ffffff' };   // --mark and --mark-ink in each theme: the chip is always white

/* --- the mark, on a 32-unit grid --- */
const TILE = { x: 1, y: 1, w: 30, h: 30, r: 7 };
const BODY = { x: 10, y: 6, w: 12, h: 20, r: 1.5 }, NOTCH = { cx: 16, cy: 6, r: 2.1 };
const LEG_W = 3.5, LEG_H = 2.6, LEG_AT = [10, 16, 22];
const LEGS = LEG_AT.flatMap(c => [{ x: BODY.x - LEG_W, y: c - LEG_H / 2, w: LEG_W, h: LEG_H }, { x: BODY.x + BODY.w, y: c - LEG_H / 2, w: LEG_W, h: LEG_H }]);
const inRect = (u, v, { x, y, w, h, r = 0 }) => {
  if (u < x || u > x + w || v < y || v > y + h) return false;
  const dx = Math.max(x + r - u, 0, u - (x + w - r)), dy = Math.max(y + r - v, 0, v - (y + h - r));
  return dx * dx + dy * dy <= r * r;
};
const inGlyph = (u, v) => ((inRect(u, v, BODY) && (u - NOTCH.cx) ** 2 + (v - NOTCH.cy) ** 2 > NOTCH.r ** 2) || LEGS.some(l => inRect(u, v, l)));

/* --- the SVG: the same shapes as paths, its colours following the browser's light or dark setting --- */
const n = x => +x.toFixed(2);
const rounded = ({ x, y, w, h, r }) => `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${n(h - 2 * r)}a${r} ${r} 0 0 1-${r} ${r}h-${n(w - 2 * r)}a${r} ${r} 0 0 1-${r}-${r}v-${n(h - 2 * r)}a${r} ${r} 0 0 1 ${r}-${r}z`;
const glyph = rounded(BODY) + LEGS.map(l => `M${n(l.x)} ${n(l.y)}h${n(l.w)}v${n(l.h)}h-${n(l.w)}z`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.t{fill:${LIGHT.tile}}.g{fill:${LIGHT.glyph}}@media (prefers-color-scheme:dark){.t{fill:${DARK.tile}}}</style>`
  + `<path class="t" d="${rounded(TILE)}"/><path class="g" d="${glyph}"/><circle class="t" cx="${NOTCH.cx}" cy="${NOTCH.cy}" r="${NOTCH.r}"/></svg>\n`;

/* --- the PNGs: each pixel sampled 5 × 5 times, so the edges are smooth --- */
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
/** `bleed`: the tile fills the whole square, for a home-screen icon the phone rounds itself. */
function raster(size, colours, { bleed = false } = {}) {
  const out = Buffer.alloc(size * size * 4), tile = rgb(colours.tile), mark = rgb(colours.glyph), S = 5;
  const scale = bleed ? TILE.w / size : 32 / size, off = bleed ? TILE.x : 0;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const sum = [0, 0, 0];
    let opaque = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const u = (px + (i + 0.5) / S) * scale + off, v = (py + (j + 0.5) / S) * scale + off;
      const c = inGlyph(u, v) ? mark : bleed || inRect(u, v, TILE) ? tile : null;
      if (c) { opaque++; c.forEach((x, k) => { sum[k] += x; }); }
    }
    const k = (py * size + px) * 4;
    if (opaque) for (let c = 0; c < 3; c++) out[k + c] = Math.round(sum[c] / opaque);
    out[k + 3] = Math.round((opaque / (S * S)) * 255);
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
writeFileSync('public/favicon-32.png', raster(32, LIGHT));
writeFileSync('public/apple-touch-icon.png', raster(180, LIGHT, { bleed: true }));
console.log('public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png');
