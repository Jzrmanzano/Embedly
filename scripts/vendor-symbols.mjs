// Copies the schematic symbols the app draws from tscircuit's "schematic-symbols" package (MIT) into src/data/tscircuit-symbols.ts.
// The package is not a dependency: it asks for TypeScript 5 as a peer and this project uses a newer one, so npm refuses to install it,
// and the app only needs six of its 400-odd symbols. To refresh them from a newer version:
//   npm pack schematic-symbols@<version>        (in an empty folder)
//   tar -xzf schematic-symbols-<version>.tgz
//   node scripts/vendor-symbols.mjs <that folder>/package
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const dir = process.argv[2];
if (!dir) { console.error('Usage: node scripts/vendor-symbols.mjs <unpacked package folder>'); process.exit(1); }
const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
const license = readFileSync(`${dir}/LICENSE`, 'utf8').trim();
const { symbols } = await import(pathToFileURL(`${dir}/dist/index.js`).href);

/** Our name for each symbol, and its name in the package. */
const WANTED = {
  resistor: 'resistor_right',
  led: 'led_right',
  button: 'push_button_normally_open_momentary_horz',
  knob: 'potentiometer3_down',
  ground: 'ground_down',
  supply: 'vcc_up',
};

const r = n => Math.round(n * 1000) / 1000 || 0;   // three decimals, and no -0
const list = (xs, f) => `[${xs.map(f).join(', ')}]`;
const entries = Object.entries(WANTED).map(([ours, theirs]) => {
  const s = symbols[theirs];
  if (!s) throw new Error(`${theirs} is not in schematic-symbols ${pkg.version}`);
  const paths = s.primitives.filter(p => p.type === 'path')
    .map(p => `      { points: ${list(p.points, q => `[${r(q.x)}, ${r(q.y)}]`)}${p.fill && p.points.length > 2 ? ', fill: true' : ''} },`);
  const circles = s.primitives.filter(p => p.type === 'circle').map(c => `{ x: ${r(c.x)}, y: ${r(c.y)}, r: ${r(c.radius)}${c.fill ? ', fill: true' : ''} }`);
  const ports = s.ports.map(p => `{ x: ${r(p.x)}, y: ${r(p.y)}, labels: ${list(p.labels, l => `'${l}'`)} }`);
  return `  ${ours}: {
    from: '${theirs}',
    paths: [
${paths.join('\n')}
    ],
    circles: [${circles.join(', ')}],
    ports: [${ports.join(', ')}],
  },`;
});

const out = `/* Schematic symbols from tscircuit's "schematic-symbols" package, version ${pkg.version} (https://github.com/tscircuit/schematic-symbols).
   Written by scripts/vendor-symbols.mjs: run it again to refresh them rather than editing this file. Coordinates are in the package's
   units with y pointing up, and the text placeholders for part names and values are left out.

${license.split('\n').map(l => `   ${l}`.trimEnd()).join('\n')}
*/
import type { SchSymbol } from './symbols';

export const TSCIRCUIT = {
${entries.join('\n')}
} satisfies Record<string, SchSymbol>;
`;
writeFileSync(new URL('../src/data/tscircuit-symbols.ts', import.meta.url), out);
console.log(`Wrote ${Object.keys(WANTED).length} symbols from schematic-symbols ${pkg.version}.`);
