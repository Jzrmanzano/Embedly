/* The symbols the schematic is drawn with. Most are tscircuit's (copied into tscircuit-symbols.ts). tscircuit has no buzzer, so ours is
   drawn here in the same form. The boards, the distance sensor, the servo and the touch pad have no standard symbol anywhere: schematics
   show modules like these as a labelled box with their pin names, and the schematic draws them that way itself. */
import { TSCIRCUIT } from './tscircuit-symbols';

/** A symbol in tscircuit's form: lines and dots in units of about a tenth of an inch, with y pointing up, and where its legs end. */
export interface SchSymbol {
  from?: string;
  paths: { points: [number, number][]; fill?: boolean }[];
  circles: { x: number; y: number; r: number; fill?: boolean }[];
  ports: { x: number; y: number; labels: string[] }[];
}

/** Points along an arc, for drawing curves out of straight lines. */
const arc = (cx: number, cy: number, radius: number, from: number, to: number, steps = 12): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return [Math.round((cx + radius * Math.cos(a)) * 1000) / 1000, Math.round((cy + radius * Math.sin(a)) * 1000) / 1000];
  });

/** The buzzer's dome, which fills in while it sounds. */
export const BUZZ_BODY = arc(0, 0, 0.22, 180, 0);
/** Sound waves either side of the dome, shown only while the buzzer sounds. */
export const BUZZ_WAVES = [arc(0, 0, 0.31, 12, 42, 4), arc(0, 0, 0.4, 12, 42, 4), arc(0, 0, 0.31, 138, 168, 4), arc(0, 0, 0.4, 138, 168, 4)];

/** A piezo buzzer: a dome standing on the line between its two legs. */
const buzzer: SchSymbol = {
  paths: [
    { points: [[-0.47, 0], [-0.22, 0]] },
    { points: [[0.22, 0], [0.47, 0]] },
    { points: [...BUZZ_BODY, [-0.22, 0]] },
  ],
  circles: [],
  ports: [{ x: -0.47, y: 0, labels: ['1'] }, { x: 0.47, y: 0, labels: ['2'] }],
};

export type SymbolName = keyof typeof TSCIRCUIT | 'buzzer';
export const SYMBOLS: Record<SymbolName, SchSymbol> = { ...TSCIRCUIT, buzzer };

/** The triangle of tscircuit's LED, filled in the LED's colour while it is lit. Its corners are ends of the LED's own lines (a test checks). */
export const LED_BODY: [number, number][] = [[-0.13, -0.14], [-0.13, 0.13], [0.14, 0]];
/** The two arrows of the LED, which take its colour while it is lit: the lines drawn wholly above its body. */
export const isRay = (points: [number, number][]) => points.every(([, y]) => y > 0.15);

/** How far apart the two legs of a two-legged symbol are, in units. */
export const spanOf = (name: SymbolName) => Math.abs(SYMBOLS[name].ports[1].x - SYMBOLS[name].ports[0].x);
