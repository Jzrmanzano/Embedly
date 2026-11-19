/* The Serial Plotter: draws the numbers a sketch prints, one line per reading, the way the Arduino IDE's plotter reads them.
   The numbers on a line are split by commas, tabs or spaces, and a number can be named "name:value" (or "Name: value").
   A line with no numbers, such as "Light on", is not a reading, so messages and readings can share the monitor.
   No React here: tests/plotter.test.ts runs it. */

/** How many readings the plot shows, newest at the right, and how many series it draws in a fixed colour each. */
export const PLOT_POINTS = 100, PLOT_SERIES = 8;

export interface Plot {
  /** The series drawn, in the order they first appear among the readings shown. */
  names: string[];
  /** One row per reading, oldest first: each series' value, or null when that line did not give one. */
  rows: (number | null)[][];
  /** Series past the first PLOT_SERIES, which are not drawn. */
  hidden: string[];
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const NAMED = /^\s*([^:]*[^\s:])\s*:\s*(\S+)\s*$/;

/** The numbers on one printed line, each with its name, or null when it has none. Words that are not numbers are left out. */
export function readLine(line: string): { name: string | null; value: number }[] {
  const out: { name: string | null; value: number }[] = [];
  for (const chunk of line.split(/[,\t]/)) {
    const m = NAMED.exec(chunk);
    if (m && NUMBER.test(m[2])) { out.push({ name: m[1], value: Number(m[2]) }); continue; }
    for (const word of chunk.trim().split(/\s+/)) if (NUMBER.test(word)) out.push({ name: null, value: Number(word) });
  }
  return out;
}

/** The last `points` readings in what the sketch has printed. The line still being printed, after the last newline, waits until it ends. Numbers with no name are "Value 1", "Value 2" and so on, by their place on the line. */
export function plotOf(text: string, points = PLOT_POINTS): Plot {
  const lines = text.split('\n');
  lines.pop();
  const readings: Map<string, number>[] = [];
  for (let k = lines.length - 1; k >= 0 && readings.length < points; k--) {   // from the newest back
    const found = readLine(lines[k].replace(/\r$/, ''));
    if (!found.length) continue;
    const row = new Map<string, number>();
    let unnamed = 0;
    for (const f of found) row.set(f.name ?? `Value ${++unnamed}`, f.value);
    readings.unshift(row);
  }
  const all: string[] = [];
  for (const row of readings) for (const name of row.keys()) if (!all.includes(name)) all.push(name);
  const names = all.slice(0, PLOT_SERIES);
  return { names, hidden: all.slice(PLOT_SERIES), rows: readings.map(row => names.map(n => row.get(n) ?? null)) };
}

/** The y axis for values from min to max: the range the lines use (the values with a little room above and below, so the lines fill the height),
    and round ticks inside it, steps of 1, 2 or 5 times a power of ten, about `count` of them. A flat line gets room either side. */
export function ticks(min: number, max: number, count = 4): { lo: number; hi: number; step: number; values: number[] } {
  const pad = max > min ? (max - min) * 0.05 : Math.abs(min) >= 10 ? Math.abs(min) * 0.1 : 1;
  const lo = min - pad, hi = max + pad, raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw - 1e-12)!, values: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) values.push(Number(v.toFixed(10)) || 0);   // || 0: no "-0"
  return { lo, hi, step, values };
}

/** A tick value as the axis shows it: in full under 10,000, as thousands ("20K") on an axis that reaches it, with only the decimals the step needs. */
export function tickLabel(v: number, step: number, axisMax: number): string {
  if (v === 0) return '0';
  if (axisMax >= 10000) { const d = Math.max(0, -Math.floor(Math.log10(step / 1000))); return `${(v / 1000).toFixed(d)}K`; }
  return v.toFixed(Math.max(0, -Math.floor(Math.log10(step))));
}

/** A reading as the legend and the tooltip show it: as printed, to at most two decimals. */
export const showValue = (v: number) => String(Number(v.toFixed(2)));
