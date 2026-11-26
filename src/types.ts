export type BoardId = 'uno' | 'esp32';
export type WireColor = 'red' | 'black' | 'orange' | 'yellow' | 'green' | 'blue' | 'white' | 'purple';

/** A sensor module on a small board with three pins. `pir` and `ir` give a digital signal (high or low), the others a voltage that follows what they measure. */
export type ModuleKind = 'pir' | 'ir' | 'soil' | 'water' | 'gas' | 'flame';
export const MODULE_KINDS: ModuleKind[] = ['pir', 'ir', 'soil', 'water', 'gas', 'flame'];
/** A switch that works by itself: a tilt switch is closed while it stands upright, a reed switch while a magnet is near. */
export type ContactKind = 'tilt' | 'reed';
export const CONTACT_KINDS: ContactKind[] = ['tilt', 'reed'];

/** One thing on the bench. Connection points are named like "U:13" (Uno pin), "E:D5" (ESP32 pin), "a10" (breadboard hole) or "T-15" (power rail). */
export type Item =
  | { t: 'wire'; id?: string; a: string; b: string; c: WireColor }
  | { t: 'led'; id: string; a: string; k: string; color: number; pin?: number }
  | { t: 'res'; id?: string; a: string; b: string; ohms?: number }
  | { t: 'button'; id: string; col: number; pin?: number; ctl: string }
  | { t: 'pot'; id: string; row: string; col: number; pin?: number; ctl: string }
  | { t: 'buzzer'; id: string; a: string; b: string; pin?: number }
  | { t: 'sonar'; id: string; row: string; col: number; trig?: number; echo?: number; ctl: string }
  | { t: 'pad'; id: string; pin?: number; ctl: string }
  /** A light-dependent resistor: two legs, and the less light it gets the more it resists. */
  | { t: 'ldr'; id: string; a: string; b: string; ctl: string }
  /** A TMP36 temperature sensor in its three-pin case: + in `row``col`, OUT one column right, GND two columns right. */
  | { t: 'temp'; id: string; row: string; col: number; ctl: string }
  /** A hobby servo plugged in by its three-pin lead: GND (brown) in `row``col`, + (red) one column right, signal (orange) two columns right. */
  | { t: 'servo'; id: string; row: string; col: number }
  /** An RGB LED with a common cathode, four legs in a row: red in `row``col`, then − (the long leg), green and blue. */
  | { t: 'rgb'; id: string; row: string; col: number }
  /** A slide switch, three legs in a row. The middle leg is joined to the left leg or to the right one, and it stays where it is put. */
  | { t: 'slide'; id: string; row: string; col: number; ctl: string }
  /** A tilt switch or a reed switch: two legs, with no front and back. */
  | { t: 'contact'; kind: ContactKind; id: string; a: string; b: string; ctl: string }
  /** A sensor module with three pins in a row: + in `row``col`, OUT one column right, GND two columns right. */
  | { t: 'module'; kind: Exclude<ModuleKind, 'soil'>; id: string; row: string; col: number; ctl: string }
  /** A soil moisture sensor: its probe stands in the soil of a potted plant on the table, and the three pins on the probe's head are wired by name:
      "SOIL:VCC", "SOIL:SIG" and "SOIL:GND". The pot can be dragged anywhere on the table. `x` and `z` are where its middle is, in millimetres from the
      middle of the bench's own breadboard (src/state/table.ts); without them it stands at its usual place in front of the breadboard. */
  | { t: 'module'; kind: 'soil'; id: string; ctl: string; x?: number; z?: number }
  /** A thumb joystick, five pins in a row: GND in `row``col`, then +, VRx, VRy and SW. Its on-screen controls are kept under its id (left to right), id + ":y" (down to up) and id + ":sw" (pressed). */
  | { t: 'joy'; id: string; row: string; col: number; ctl: string }
  /** A 16×2 character LCD with an I2C backpack. It is too wide for the breadboard, so it lies on the table at a place of its own, and its four pins are wired by name: "LCD:GND", "LCD:VCC", "LCD:SDA", "LCD:SCL". */
  | { t: 'lcd'; id: string }
  /** A second breadboard on the table. Its holes and rails are named on from the first one's: "a31", "T+31" and up.
      It starts just to the right of the first. Once moved, `x` is where its left end lies and `z` where its middle lies, in millimetres from the middle of the first (src/state/table.ts). */
  | { t: 'breadboard'; id: string; size: BreadboardSize; x?: number; z?: number };

/** The soil moisture sensor in its pot, and the other sensor modules, which stand in a row of breadboard holes. */
export type SoilItem = Extract<Item, { t: 'module'; kind: 'soil' }>;
export type RowModule = Extract<Item, { t: 'module'; kind: Exclude<ModuleKind, 'soil'> }>;
/** The pins on the soil probe's head, left to right, and the names they are wired by. */
export const SOIL_PINS = ['VCC', 'SIG', 'GND'] as const;
export const soilPoint = (pin: (typeof SOIL_PINS)[number]) => `SOIL:${pin}`;
/** A sensor module's +, OUT and GND: the soil probe's pins, or three breadboard holes side by side. */
export const moduleLegs = (it: Extract<Item, { t: 'module' }>): [plus: string, out: string, gnd: string] =>
  it.kind === 'soil' ? [soilPoint('VCC'), soilPoint('SIG'), soilPoint('GND')] : [`${it.row}${it.col}`, `${it.row}${it.col + 1}`, `${it.row}${it.col + 2}`];

/** The bench's own breadboard has columns 1 to 30. */
export const MAIN_COLS = 30;
/** A second breadboard is short (half size, 30 columns, like the bench's own) or long (full size, 63 columns). */
export type BreadboardSize = 'short' | 'long';
export const BREADBOARD_COLS: Record<BreadboardSize, number> = { short: 30, long: 63 };
/** The first and last column of the second breadboard on this bench, or null when there is none. Its columns carry on from the first one's. */
export function extraColumns(items: Item[]): [first: number, last: number] | null {
  const bb = items.find(it => it.t === 'breadboard');
  return bb ? [MAIN_COLS + 1, MAIN_COLS + BREADBOARD_COLS[bb.size]] : null;
}
/** True for a hole or rail point on the second breadboard, such as "a31" or "B-45". */
export const onExtraBoard = (point: string) => /^([a-j]|[TB][+-])\d+$/.test(point) && +point.replace(/^\D+/, '') > MAIN_COLS;
/** "Short breadboard", "Long breadboard". */
export const breadboardName = (size: BreadboardSize) => `${size === 'long' ? 'Long' : 'Short'} breadboard`;

/** The colours an LED comes in. */
export const LED_COLORS = { red: 0xff3b30, green: 0x2ecc40, yellow: 0xffc800, blue: 0x2f7bff, white: 0xf2f6ff } as const;
/** "red", "blue", or null for a colour that is not one of the tray's. */
export const ledColorName = (color: number): keyof typeof LED_COLORS | null => (Object.keys(LED_COLORS) as (keyof typeof LED_COLORS)[]).find(name => LED_COLORS[name] === color) ?? null;

export const itemId = (it: Item, index: number): string => (('id' in it && it.id) || it.t + index);

/** Which kind of part an item is, for everything that is said or drawn about it: a module or a contact goes by its own kind ("pir", "reed"), every other part by its type. */
export type PartKind = Exclude<Item['t'], 'module' | 'contact'> | ModuleKind | ContactKind;
export const kindOf = (it: Item): PartKind => (it.t === 'module' || it.t === 'contact' ? it.kind : it.t);

export type Info = [title: string, text: string];
export type Pin = [name: string, note: string, kind?: 'pwr' | 'gnd' | 'bus'];

export interface Board {
  id: BoardId;
  name: string;
  adcMax: number;
  builtin: number;
  consts: Record<string, number>;
  parts: Record<string, Info>;
  pinout: { title: string; pins: Pin[] }[];
  facts: [string, string][];
}
