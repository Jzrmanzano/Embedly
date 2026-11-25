import { useEffect, useId, useState, type FormEvent } from 'react';
import { nearestStop, ohmsLabel, parseOhms, RESISTOR_STOPS, useFor } from '../data/resistor';
import { ledDrop } from '../sim/circuit';
import { BREADBOARD_COLS, LED_COLORS, ledColorName, MAIN_COLS, type BoardId, type BreadboardSize } from '../types';

/* --- what a placed part lets the student change, on its card on the bench: an LED's colour, a resistor's value, the second breadboard's size.
   The part on the bench changes at once, and the next one placed takes the same. --- */

type LedName = keyof typeof LED_COLORS;
const LED_NAMES = Object.keys(LED_COLORS) as LedName[];
export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
export const named = (name: string) => name[0].toUpperCase() + name.slice(1);
const SIZES: BreadboardSize[] = ['short', 'long'];

/** What a colour means on this board: the voltage it lights at, and whether a 3.3 V pin lights it well through the usual resistor. */
function ledNote(color: number, board: BoardId): string {
  const v = ledDrop(color);
  if (v < 3) return `Lights from about ${v} V. The usual 220 Ω resistor makes it bright on either board.`;
  return board === 'esp32'
    ? `Lights from about ${v} V, so from the ESP32's 3.3 V pins it only glows faintly through 220 Ω. With 100 Ω it lights properly.`
    : `Lights from about ${v} V, more than a red one needs. The Uno's 5 V pins light it well through 220 Ω.`;
}

/** An LED's colour. Every colour is the same part, so changing it changes only how it looks and the voltage it lights at. */
export function LedColours({ color, board, onPick }: { color: number; board: BoardId; onPick: (color: number) => void }) {
  const name = ledColorName(color), group = useId();
  return (
    <div className="options">
      <fieldset>
        <legend>Colour</legend>
        <div className="swatches">
          {LED_NAMES.map(c => (
            <label key={c} className="swatch">
              <input type="radio" name={group} value={c} checked={c === name} onChange={() => onPick(LED_COLORS[c])} />
              <i style={{ background: hex(LED_COLORS[c]) }} aria-hidden="true" />
              <span>{named(c)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p>{ledNote(color, board)}</p>
    </div>
  );
}

/** A resistor's value: the slider for the common values, or any value typed. The bands on the bench follow it. */
export function ResistorValue({ ohms, onPick }: { ohms: number; onPick: (ohms: number) => void }) {
  const [text, setText] = useState(ohmsLabel(ohms)), [bad, setBad] = useState(false), help = useId();
  useEffect(() => { setText(ohmsLabel(ohms)); setBad(false); }, [ohms]);
  const type = (e: FormEvent) => {
    e.preventDefault();
    const v = parseOhms(text);
    if (v == null) { setBad(true); return; }
    if (v !== ohms) onPick(v);
  };
  return (
    <div className="options">
      <label className="slide">
        <span className="options-label">Value</span>
        <input type="range" min={0} max={RESISTOR_STOPS.length - 1} step={1} value={nearestStop(ohms)} aria-valuetext={ohmsLabel(ohms)} onChange={e => onPick(RESISTOR_STOPS[+e.target.value])} />
        <span className="ends" aria-hidden="true"><span>{ohmsLabel(RESISTOR_STOPS[0])}</span><span>{ohmsLabel(RESISTOR_STOPS[RESISTOR_STOPS.length - 1])}</span></span>
      </label>
      <form onSubmit={type} className="exact">
        <label>or type a value <input value={text} onChange={e => { setText(e.target.value); setBad(false); }} onBlur={type} inputMode="decimal" spellCheck={false} autoComplete="off" aria-invalid={bad || undefined} aria-describedby={help} placeholder="4.7k" /></label>
      </form>
      <p id={help} className={bad ? 'bad' : undefined} role={bad ? 'alert' : undefined}>{bad ? 'Type a value from 1 Ω to 10 MΩ, such as 330, 4.7k or 1M.' : useFor(ohms)}</p>
    </div>
  );
}

/** The second breadboard's size. Making it shorter is refused while something is plugged in past the new end. */
export function BreadboardSizes({ size, onPick }: { size: BreadboardSize; onPick: (size: BreadboardSize) => void }) {
  const group = useId();
  return (
    <div className="options">
      <fieldset>
        <legend>Size</legend>
        <div className="sizes">
          {SIZES.map(s => (
            <label key={s} className="size">
              <input type="radio" name={group} value={s} checked={s === size} onChange={() => onPick(s)} />
              <span>{named(s)}<small>{BREADBOARD_COLS[s]} columns</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <p>Columns {MAIN_COLS + 1} to {MAIN_COLS + BREADBOARD_COLS[size]}.</p>
    </div>
  );
}
