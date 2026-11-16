/* Choosing the right board. Five boards a school can buy, with what their datasheets say about the things that decide a choice, and the needs a
   device can have. Only the Uno and the ESP32 are on the workshop's bench; the other three are cards to compare. Sizes are the boards' own
   outlines in millimetres; the 30-pin ESP32 DevKit is the one on the bench. */

export type CardId = 'uno' | 'nano' | 'esp32' | 'd1mini' | 'c3';
export interface BoardCard {
  id: CardId;
  name: string;
  /** What to call it in a sentence: "the Nano". */
  short: string;
  chip: string;
  about: string;
  volts: 5 | 3.3;
  wifi: boolean;
  bluetooth: 'Classic and LE' | 'LE only' | null;
  analog: number;
  /** A catch on the analog inputs, if there is one. */
  analogNote?: string;
  touch: number;
  /** Length and width in millimetres. */
  size: [number, number];
  /** Has the Uno's header layout, so Uno shields plug straight on. */
  shield: boolean;
  /** On this workshop's bench, so its missions can be built here. */
  onBench: boolean;
}

export const CARDS: BoardCard[] = [
  { id: 'uno', name: 'Arduino Uno', short: 'Uno', chip: 'ATmega328P, 16 MHz', about: 'The classic classroom board: big, sturdy, and every Uno-shaped shield plugs straight on.',
    volts: 5, wifi: false, bluetooth: null, analog: 6, touch: 0, size: [69, 53], shield: true, onBench: true },
  { id: 'nano', name: 'Arduino Nano', short: 'Nano', chip: 'ATmega328P, 16 MHz', about: 'The Uno\'s chip and the same code, on a narrow board that plugs into a breadboard.',
    volts: 5, wifi: false, bluetooth: null, analog: 8, touch: 0, size: [45, 18], shield: false, onBench: false },
  { id: 'esp32', name: 'ESP32 DevKit', short: 'ESP32 DevKit', chip: 'ESP32, two cores, 240 MHz', about: 'A fast board with Wi-Fi, Bluetooth and pins that sense touch.',
    volts: 3.3, wifi: true, bluetooth: 'Classic and LE', analog: 15, analogNote: '6 while Wi-Fi is on', touch: 9, size: [52, 28], shield: false, onBench: true },
  { id: 'd1mini', name: 'Wemos D1 mini', short: 'D1 mini', chip: 'ESP8266, 80 MHz', about: 'A small Wi-Fi board built on the ESP8266, the chip that came before the ESP32.',
    volts: 3.3, wifi: true, bluetooth: null, analog: 1, touch: 0, size: [34, 26], shield: false, onBench: false },
  { id: 'c3', name: 'ESP32-C3 SuperMini', short: 'ESP32-C3', chip: 'ESP32-C3, one core, 160 MHz', about: 'One of the smallest boards with Wi-Fi and Bluetooth, about the size of a thumbnail.',
    volts: 3.3, wifi: true, bluetooth: 'LE only', analog: 6, analogNote: '5 while Wi-Fi is on', touch: 0, size: [23, 18], shield: false, onBench: false },
];
export const cardOf = (id: CardId) => CARDS.find(c => c.id === id)!;

/** Something a device needs from its board. */
export type Need =
  | { k: 'volts5' }                        // its parts are 5 V parts, wired straight to the pins
  | { k: 'wifi' }
  | { k: 'bluetooth' }
  | { k: 'analog'; n: number }             // this many analog inputs
  | { k: 'touch'; n: number }              // this many touch pins
  | { k: 'fits'; l: number; w: number }    // fits a space this big in millimetres, either way round
  | { k: 'shield' };                       // takes the Uno-shaped shields the school already owns
/** A choice mission: the needs, each said the way the person asking would say it. */
export interface Choice { needs: { need: Need; text: string }[] }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function meets(c: BoardCard, need: Need): boolean {
  switch (need.k) {
    case 'volts5': return c.volts === 5;
    case 'wifi': return c.wifi;
    case 'bluetooth': return c.bluetooth !== null;
    case 'analog': return c.analog >= need.n;
    case 'touch': return c.touch >= need.n;
    case 'fits': { const [l, w] = c.size; return (l <= need.l && w <= need.w) || (l <= need.w && w <= need.l); }
    case 'shield': return c.shield;
  }
}

/** Why a board does or does not meet a need, in one sentence about that board. */
export function why(c: BoardCard, need: Need): string {
  const ok = meets(c, need), [l, w] = c.size;
  switch (need.k) {
    case 'volts5': return ok ? 'It runs at 5 V, the same as the parts.' : 'It runs at 3.3 V. A 5 V part would need a level converter in between, and 5 V straight into a pin can damage it.';
    case 'wifi': return ok ? 'It has Wi-Fi.' : 'It has no Wi-Fi.';
    case 'bluetooth': return ok ? `It has Bluetooth (${c.bluetooth}).` : 'It has no Bluetooth.';
    case 'analog': return ok ? `It has ${plural(c.analog, 'analog input')}.` : `It has only ${plural(c.analog, 'analog input')}, and this needs ${need.n}.`;
    case 'touch': return ok ? `It has ${plural(c.touch, 'touch pin')}.` : c.touch ? `It has only ${plural(c.touch, 'touch pin')}, and this needs ${need.n}.` : 'It has no touch pins.';
    case 'fits': return ok ? `At ${l} × ${w} mm it fits the ${need.l} × ${need.w} mm space.` : `At ${l} × ${w} mm it is too big for the ${need.l} × ${need.w} mm space.`;
    case 'shield': return ok ? 'It has the Uno\'s header layout, so the shields plug straight on.' : 'It does not have the Uno\'s header layout, so the shields do not fit.';
  }
}

/** The board meets every need. */
export const fitsAll = (c: BoardCard, choice: Choice) => choice.needs.every(x => meets(c, x.need));
/** Every board that would do. */
export const answersOf = (choice: Choice) => CARDS.filter(c => fitsAll(c, choice));
