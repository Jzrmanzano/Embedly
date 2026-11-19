/* A 16×2 character LCD (an HD44780) on an I2C backpack (a PCF8574), as the LiquidCrystal_I2C library drives it.
   The display keeps 40 characters a line, of which 16 are on show. It does what the real one does in the cases a student meets:
   - powered but never initialised (no init(), a wrong address, SDA and SCL not reaching it) it shows its top row as solid blocks, backlight on;
   - init() switches the backlight off until backlight() is called, so a sketch that forgets it gets a dark screen;
   - characters outside its built-in set show as junk, so lcd.println() leaves two odd marks and a "°" typed in the sketch does not appear.
   No React here: tests/lcd.test.ts runs it. */

/** The address most backpacks answer at (a PCF8574T). Some answer at 0x3F instead (a PCF8574AT). */
export const LCD_ADDRESS = 0x27;
/** The backpack and the display need about 5 V. */
export const LCD_MIN_VOLTS = 4.5;
/** Its four pins in order along the header, and their connection-point names. */
export const LCD_PINS = ['GND', 'VCC', 'SDA', 'SCL'] as const;
export const lcdPoint = (pin: (typeof LCD_PINS)[number]) => `LCD:${pin}`;
export const COLS = 16, ROWS = 2, LINE = 40;

export interface LcdState {
  /** init() or begin() has been sent. Until then the display shows a row of blocks. */
  ready: boolean;
  light: boolean;
  /** display() and noDisplay(): the text is kept either way. */
  shown: boolean;
  cursor: boolean;
  blink: boolean;
  row: number;
  col: number;
  /** What each line holds, 40 character codes each. */
  ram: number[][];
  /** How far scrollDisplayLeft() has moved the window, 0 to 39. */
  shift: number;
}

/** A display just powered up: the backpack's outputs start high, so the backlight is on, and nothing has initialised it. */
export const freshLcd = (): LcdState => ({ ready: false, light: true, shown: true, cursor: false, blink: false, row: 0, col: 0, ram: [new Array(LINE).fill(32), new Array(LINE).fill(32)], shift: 0 });

/** One command from LiquidCrystal_I2C, applied to the display. `args` are numbers: a column and row, character codes, or 1/0 for the backlight. */
export function applyLcd(s: LcdState, op: string, args: number[] = []): void {
  if (op === 'init') {   // init() and begin(): cleared, cursor home, and the backlight as the sketch last set it (off unless backlight() came first)
    Object.assign(s, freshLcd(), { ready: true, light: !!args[0] });
    return;
  }
  if (op === 'light') { s.light = !!args[0]; return; }
  if (!s.ready) return;   // anything else before init() goes nowhere useful
  switch (op) {
    case 'clear': s.ram = [new Array(LINE).fill(32), new Array(LINE).fill(32)]; s.row = 0; s.col = 0; s.shift = 0; break;
    case 'home': s.row = 0; s.col = 0; s.shift = 0; break;
    case 'cursor': s.col = Math.max(0, Math.min(LINE - 1, Math.trunc(args[0] ?? 0))); s.row = Math.max(0, Math.min(ROWS - 1, Math.trunc(args[1] ?? 0))); break;
    case 'write':
      for (const c of args) {
        s.ram[s.row][s.col] = c & 255;
        if (++s.col === LINE) { s.col = 0; s.row = (s.row + 1) % ROWS; }   // past the end of a line, the next character lands at the start of the other line
      }
      break;
    case 'display': s.shown = true; break;
    case 'noDisplay': s.shown = false; break;
    case 'showCursor': s.cursor = true; break;
    case 'noCursor': s.cursor = false; break;
    case 'blink': s.blink = true; break;
    case 'noBlink': s.blink = false; break;
    case 'scrollLeft': s.shift = (s.shift + 1) % LINE; break;
    case 'scrollRight': s.shift = (s.shift + LINE - 1) % LINE; break;
  }
}

/** The character the display's built-in set (ROM A00) shows for a code: plain ASCII, except that 92 is a yen sign and 126 and 127 are arrows,
    223 is the degree sign, and the codes it has no character for show as a junk block. */
export function glyph(code: number): string {
  if (code === 92) return '¥';
  if (code === 126) return '→';
  if (code === 127) return '←';
  if (code === 223) return '°';
  if (code >= 32 && code < 126) return String.fromCharCode(code);
  return '▒';
}

/** What the display shows: whether it has power and light, its two lines of 16 characters as they appear, and where a cursor is. */
export interface LcdView {
  powered: boolean;
  light: boolean;
  /** Powered but never initialised: the top row is solid blocks. */
  blocks: boolean;
  lines: string[];
  /** The cursor's place on screen when it is shown and in view. */
  cursor: { row: number; col: number; blink: boolean } | null;
}
export const DARK_LCD: LcdView = { powered: false, light: false, blocks: false, lines: [' '.repeat(COLS), ' '.repeat(COLS)], cursor: null };

export function lcdView(s: LcdState | null, powered: boolean): LcdView {
  if (!powered || !s) return DARK_LCD;
  if (!s.ready) return { powered, light: s.light, blocks: true, lines: ['█'.repeat(COLS), ' '.repeat(COLS)], cursor: null };
  const lines = s.ram.map(line => (s.shown ? Array.from({ length: COLS }, (_, i) => glyph(line[(s.shift + i) % LINE])).join('') : ' '.repeat(COLS)));
  const at = (s.col - s.shift + LINE) % LINE;
  return { powered, light: s.light, blocks: false, lines, cursor: s.shown && (s.cursor || s.blink) && at < COLS ? { row: s.row, col: at, blink: s.blink } : null };
}
