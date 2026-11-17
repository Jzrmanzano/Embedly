/* Resistor values: how they are written, how they are typed, and the coloured bands that spell them out on a real resistor.
   Two digits, then how many zeros, then gold for a resistor that is right to 5%: four bands. A value that needs three digits has one more band
   and a brown last band for 1%. */

/** The stops on the value slider: the common values from 100 Ω to 100 kΩ. Any other value can be typed. */
export const RESISTOR_STOPS = [100, 220, 330, 470, 680, 1000, 2200, 4700, 10000, 22000, 47000, 100000];
export const MIN_OHMS = 1, MAX_OHMS = 10_000_000;

/** The colour of each digit, 0 to 9. */
export const DIGIT_COLORS = ['#1b1e23', '#7a4a21', '#c0392b', '#e8821e', '#e8c22e', '#3aa655', '#3577d4', '#8d5bd1', '#888f96', '#eeeeee'];
export const GOLD = '#c9a227', SILVER = '#b8bec6', BROWN = DIGIT_COLORS[1];

const trim = (n: number) => String(+n.toFixed(2));
/** "220 Ω", "4.7 kΩ", "1 MΩ". */
export const ohmsLabel = (ohms: number) => (ohms >= 1e6 ? `${trim(ohms / 1e6)} MΩ` : ohms >= 1000 ? `${trim(ohms / 1000)} kΩ` : `${trim(ohms)} Ω`);

/** Reads what a student typed: "220", "4.7k", "4k7", "1 M", "470 ohm". Gives back null for anything that is not a value between 1 Ω and 10 MΩ. */
export function parseOhms(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/ω|ohms?|\s/g, '').replace(',', '.');
  const m = /^(\d+)([km])(\d+)$/.exec(t) ?? /^(\d*\.?\d+)([km]?)$/.exec(t);   // 4k7 means 4.7 k
  if (!m) return null;
  const unit = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1;
  const v = m[3] != null ? +`${m[1]}.${m[3]}` * unit : +m[1] * unit;
  return Number.isFinite(v) && v >= MIN_OHMS && v <= MAX_OHMS ? Math.round(v * 100) / 100 : null;
}

/** The index of the slider stop closest to a value. */
export const nearestStop = (ohms: number) => RESISTOR_STOPS.reduce((best, s, i) => (Math.abs(Math.log(s / ohms)) < Math.abs(Math.log(RESISTOR_STOPS[best] / ohms)) ? i : best), 0);

/** The colours of the bands, from the left: the digits, the multiplier, and the tolerance. Four bands, or five when the value needs three digits. */
export function bands(ohms: number): string[] {
  const [mant, exp] = Math.max(MIN_OHMS, ohms).toExponential(2).split('e'), digits = mant.replace('.', ''), e = +exp;
  const five = digits[2] !== '0', count = five ? 3 : 2, power = e - (count - 1);   // the multiplier: 10 to the power
  const multiplier = power === -1 ? GOLD : power === -2 ? SILVER : DIGIT_COLORS[Math.min(9, Math.max(0, power))];
  return [...[...digits.slice(0, count)].map(d => DIGIT_COLORS[+d]), multiplier, five ? BROWN : GOLD];
}

/** What a value is good for, in a few words. */
export function useFor(ohms: number): string {
  if (ohms < 150) return 'Too small to protect an LED on its own.';
  if (ohms <= 1000) return 'A good size to protect an LED.';
  if (ohms < 5000) return 'Dims an LED a lot. Fine for light loads.';
  if (ohms <= 47000) return 'Common with a sensor, in a divider or a pull-up.';
  return 'Very large: only a trickle of current gets through.';
}
