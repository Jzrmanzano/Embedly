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
  | { t: 'module'; kind: ModuleKind; id: string; row: string; col: number; ctl: string }
  /** A thumb joystick, five pins in a row: GND in `row``col`, then +, VRx, VRy and SW. Its on-screen controls are kept under its id (left to right), id + ":y" (down to up) and id + ":sw" (pressed). */
  | { t: 'joy'; id: string; row: string; col: number; ctl: string };

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
