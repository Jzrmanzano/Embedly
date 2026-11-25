import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { lockedBy, PARTS, STUDIO_PARTS, trayParts, type PartId } from '../data/missions';
import { PINOUTS } from '../data/pinouts';
import { nearestStop, ohmsLabel, parseOhms, RESISTOR_STOPS, useFor } from '../data/resistor';
import { ledDrop } from '../sim/circuit';
import { pickTool, redo, resetBench, setBreadboardSize, setLedColor, setOhms, undo } from '../state/actions';
import { sameTool, toolKind } from '../state/bench';
import { benchOf, keyOf, missionOf, useLab } from '../state/store';
import { BREADBOARD_COLS, breadboardName, LED_COLORS, ledColorName, MAIN_COLS, type BoardId, type BreadboardSize } from '../types';
import { Icon } from './Icons';
import { PartPicture, PictureDefs } from './PartPictures';
import { Pinout } from './Pinout';

/** The parts, sorted by what they do on the bench rather than by when they were unlocked. */
const GROUPS: { name: string; ids: PartId[] }[] = [
  { name: 'Wiring', ids: ['wire', 'resistor', 'breadboard'] },
  { name: 'Lights, sound and motion', ids: ['led', 'rgb', 'lcd', 'buzzer', 'servo'] },
  { name: 'Switches and controls', ids: ['button', 'slide', 'knob', 'joystick', 'tilt', 'reed', 'pad'] },
  { name: 'Sensors', ids: ['ldr', 'temp', 'sonar', 'pir', 'ir', 'soil', 'water', 'gas', 'flame'] },
];

type LedName = keyof typeof LED_COLORS;
const LED_NAMES = Object.keys(LED_COLORS) as LedName[];
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const named = (name: string) => name[0].toUpperCase() + name.slice(1);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A part's pinout, flown out of the tray: a card held over the bench beside the drawer, level with its tile and pointing back at its i,
    so the list stays where it was. On a phone, where the drawer is a sheet along the bottom, it sits above the sheet. */
function PinoutFlyout({ id, cardId, anchor, onClose }: { id: PartId; cardId: string; anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const card = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), ohms = useLab(s => s.ohms), kind = toolKind(PARTS[id].tool);
  useLayoutEffect(() => {
    const el = card.current, inner = body.current, i = anchor.current, drawer = i?.closest('.drawer'), list = i?.closest('.parts-scroll'), bench = document.getElementById('bench');
    if (!el || !inner || !i || !drawer || !list || !bench) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const d = drawer.getBoundingClientRect(), b = bench.getBoundingClientRect(), a = i.getBoundingClientRect(), l = list.getBoundingClientRect();
      const top = b.top + 10, bottom = b.bottom - 10, x = a.left + a.width / 2, y = a.top + a.height / 2;
      el.toggleAttribute('data-lost', y < l.top || y > l.bottom);   // its tile has scrolled out of sight, so there is nothing to point at
      if (d.top > b.top + 24) {   // the drawer is a sheet along the bottom
        const w = Math.min(440, window.innerWidth - 20), left = clamp(x - w / 2, 10, window.innerWidth - 10 - w);
        el.dataset.side = 'above';
        el.style.width = `${w}px`;
        inner.style.maxHeight = `${Math.max(140, d.top - 14 - top - 4)}px`;
        el.style.left = `${left}px`;
        el.style.top = `${Math.max(top, d.top - 14 - el.offsetHeight)}px`;
        el.style.setProperty('--notch', `${clamp(x - left, 24, w - 24)}px`);
      } else {   // beside the drawer, over the bench, clear of the rail on the far side
        const edge = (document.querySelector('.rail.left')?.getBoundingClientRect().right ?? b.left) + 10;
        const w = clamp(d.left - 16 - edge, 260, 340), left = Math.max(edge, d.left - 16 - w);
        el.dataset.side = 'left';
        el.style.width = `${w}px`;
        inner.style.maxHeight = `${bottom - top - 4}px`;
        const h = el.offsetHeight, at = clamp(y - 30, top, bottom - h);
        el.style.left = `${left}px`;
        el.style.top = `${at}px`;
        el.style.setProperty('--notch', `${clamp(y - at, 22, h - 22)}px`);
      }
    };
    const ask = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    const watch = new ResizeObserver(ask);
    watch.observe(drawer); watch.observe(inner);
    list.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    return () => { cancelAnimationFrame(frame); watch.disconnect(); list.removeEventListener('scroll', ask); window.removeEventListener('resize', ask); };
  }, [anchor]);
  return (
    <section ref={card} id={cardId} className="flyout" aria-labelledby={`${cardId}-title`} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div ref={body} className="flyout-body">
        <header>
          <h3 id={`${cardId}-title`}>{PINOUTS[kind].title}{id === 'resistor' && <span className="ohms"> · {ohmsLabel(ohms)}</span>}</h3>
          <button type="button" aria-label="Close the pinout" title="Close (Esc)" onClick={onClose}><Icon name="close" /></button>
        </header>
        <Pinout kind={kind} ohms={id === 'resistor' ? ohms : undefined} />
      </div>
    </section>
  );
}

/** The i on a tile, and the pinout it opens. The card comes right after the i, so the keyboard reaches it next; closing it puts the focus back on the i. */
function PartInfo({ id, open, onToggle }: { id: PartId; open: boolean; onToggle: () => void }) {
  const button = useRef<HTMLButtonElement>(null), cardId = `pinout-${id}`;
  return (
    <>
      <button ref={button} type="button" className={open ? 'bin-i on' : 'bin-i'} aria-label={`Pinout of the ${PARTS[id].label}`} aria-expanded={open} aria-controls={open ? cardId : undefined} title="Pinout" onClick={onToggle}>i</button>
      {open && <PinoutFlyout id={id} cardId={cardId} anchor={button} onClose={() => { onToggle(); button.current?.focus(); }} />}
    </>
  );
}

/** What a colour means on this board: the voltage it lights at, and whether a 3.3 V pin lights it well through the usual resistor. */
function ledNote(color: number, board: BoardId): string {
  const v = ledDrop(color);
  if (v < 3) return `Lights from about ${v} V. The usual 220 Ω resistor makes it bright on either board.`;
  return board === 'esp32'
    ? `Lights from about ${v} V, so from the ESP32's 3.3 V pins it only glows faintly through 220 Ω. With 100 Ω it lights properly.`
    : `Lights from about ${v} V, more than a red one needs. The Uno's 5 V pins light it well through 220 Ω.`;
}

/** The LED tile: pick it up, and choose its colour. Every colour is the same part, so the tile shows the one the next LED placed will be. */
function LedTile({ locked, board, onInfo, infoOpen }: { locked: boolean; board: BoardId; onInfo: () => void; infoOpen: boolean }) {
  const tool = useLab(s => s.tool), color = useLab(s => s.ledColor), name = ledColorName(color) ?? 'red';
  const pick = { ...PARTS.led.tool, color };
  return (
    <div className="bin-wrap wide">
      <div className="choice-tile">
        <button type="button" className="bin" aria-pressed={locked ? undefined : sameTool(tool, pick)} onClick={() => pickTool(pick)}>
          <span className="bin-art"><PartPicture kind="led" tint={hex(color)} /></span>
          <b>{named(name)} LED</b>
        </button>
        <fieldset className="picker led-colors">
          <legend className="sr-only">LED colour</legend>
          <div className="swatches">
            {LED_NAMES.map(c => (
              <label key={c} className="swatch">
                <input type="radio" name="led-color" value={c} checked={c === name} onChange={() => setLedColor(LED_COLORS[c])} />
                <i style={{ background: hex(LED_COLORS[c]) }} aria-hidden="true" />
                <span>{named(c)}</span>
              </label>
            ))}
          </div>
          <p>{ledNote(color, board)}</p>
        </fieldset>
      </div>
      <PartInfo id="led" open={infoOpen} onToggle={onInfo} />
    </div>
  );
}

const SIZES: BreadboardSize[] = ['short', 'long'];

/** What each size is, and what pressing the tile does with the breadboard already on the bench. */
function breadboardNote(size: BreadboardSize, there: BreadboardSize | null): string {
  const span = `${BREADBOARD_COLS[size]} columns, numbered ${MAIN_COLS + 1} to ${MAIN_COLS + BREADBOARD_COLS[size]}`;
  if (there === size) return `The ${size} one is on the bench: ${span}. To take it off, select it and press Remove.`;
  if (there) return `${span}. Pressing the tile swaps the ${there} one on the bench for this one.`;
  return `${span}, to the right of the first breadboard. Its + and − rails are its own: wire them across.`;
}

/** The breadboard tile: choose short or long, then press it to put a second breadboard beside the first. It goes on the bench at once, as there is only one place for it. */
function BreadboardTile({ onInfo, infoOpen }: { onInfo: () => void; infoOpen: boolean }) {
  const size = useLab(s => s.bbSize), on = useLab(s => { const bb = benchOf(s).find(it => it.t === 'breadboard'); return bb?.t === 'breadboard' ? bb.size : null; });
  return (
    <div className="bin-wrap wide">
      <div className="choice-tile">
        <button type="button" className="bin" onClick={() => pickTool({ ...PARTS.breadboard.tool, size })}>
          <span className="bin-art"><PartPicture kind="breadboard" size={size} /></span>
          <b>{breadboardName(size)}</b>
        </button>
        <fieldset className="picker bb-sizes">
          <legend className="sr-only">Breadboard size</legend>
          <div className="sizes">
            {SIZES.map(s => (
              <label key={s} className="size">
                <input type="radio" name="bb-size" value={s} checked={s === size} onChange={() => setBreadboardSize(s)} />
                <span>{named(s)}<small>{BREADBOARD_COLS[s]} columns</small></span>
              </label>
            ))}
          </div>
          <p>{breadboardNote(size, on)}</p>
        </fieldset>
      </div>
      <PartInfo id="breadboard" open={infoOpen} onToggle={onInfo} />
    </div>
  );
}

/** The resistor tile: pick it up, and choose its value with the slider or by typing it. The bands change with the value, as on a real resistor. */
function ResistorTile({ locked, onInfo, infoOpen }: { locked: boolean; onInfo: () => void; infoOpen: boolean }) {
  const tool = useLab(s => s.tool), ohms = useLab(s => s.ohms), [text, setText] = useState(ohmsLabel(ohms)), [bad, setBad] = useState(false);
  useEffect(() => { setText(ohmsLabel(ohms)); setBad(false); }, [ohms]);
  const type = (e: FormEvent) => {
    e.preventDefault();
    const v = parseOhms(text);
    if (v == null) { setBad(true); return; }
    setOhms(v);
  };
  const pick = { ...PARTS.resistor.tool, ohms };
  return (
    <div className="bin-wrap wide">
      <div className="choice-tile">
        <button type="button" className="bin" aria-pressed={locked ? undefined : sameTool(tool, pick)} onClick={() => pickTool(pick)}>
          <span className="bin-art"><PartPicture kind="res" ohms={ohms} /></span>
          <b>Resistor <span className="ohms">{ohmsLabel(ohms)}</span></b>
        </button>
        <div className="picker">
          <label className="slide">
            <span className="sr-only">Resistor value</span>
            <input type="range" min={0} max={RESISTOR_STOPS.length - 1} step={1} value={nearestStop(ohms)} aria-valuetext={ohmsLabel(ohms)} onChange={e => setOhms(RESISTOR_STOPS[+e.target.value])} />
            <span className="ends" aria-hidden="true"><span>{ohmsLabel(RESISTOR_STOPS[0])}</span><span>{ohmsLabel(RESISTOR_STOPS[RESISTOR_STOPS.length - 1])}</span></span>
          </label>
          <form onSubmit={type} className="exact">
            <label>or type a value <input value={text} onChange={e => { setText(e.target.value); setBad(false); }} onBlur={type} inputMode="decimal" spellCheck={false} autoComplete="off" aria-invalid={bad || undefined} aria-describedby="ohm-help" placeholder="4.7k" /></label>
          </form>
          <p id="ohm-help" className={bad ? 'bad' : undefined} role={bad ? 'alert' : undefined}>{bad ? 'Type a value from 1 Ω to 10 MΩ, such as 330, 4.7k or 1M.' : useFor(ohms)}</p>
        </div>
      </div>
      <PartInfo id="resistor" open={infoOpen} onToggle={onInfo} />
    </div>
  );
}

/** The parts drawer: every part as a tile you pick and then place on the bench. A part that is still locked says which mission opens it. In the studio nothing is locked. */
export function PartsPanel() {
  const board = useLab(s => s.board), tool = useLab(s => s.tool), passed = useLab(s => s.passed), mission = useLab(missionOf);
  const canUndo = useLab(s => !!s.undo[keyOf(s)]?.length), canRedo = useLab(s => !!s.redo[keyOf(s)]?.length), hasParts = useLab(s => benchOf(s).length > 0);
  const have = useMemo(() => trayParts(mission, Object.keys(passed)), [mission, passed]);
  const [info, setInfo] = useState<PartId | null>(null);
  const fits = (id: PartId) => (!PARTS[id].only || PARTS[id].only === board) && (!PARTS[id].studio || !!mission.sandbox);   // a part made for the other board is left out, and so is one only the studio has
  const groups = GROUPS.map(g => ({ ...g, ids: g.ids.filter(fits) })).filter(g => g.ids.length);
  const extra = STUDIO_PARTS.filter(id => !PARTS[id].only || PARTS[id].only === board).length;
  const all = groups.flatMap(g => g.ids), open = all.filter(id => have.has(id)).length;
  return (
    <>
      <div className="parts-scroll" onKeyDown={e => { if (info && e.key === 'Escape') { e.stopPropagation(); setInfo(null); } }}>   {/* Esc shuts an open pinout before the drawer */}
        <PictureDefs />
        <p className="parts-lede">Pick a part, then click the holes on the bench where it goes. Press <kbd>Esc</kbd> to put it down.</p>
        {groups.map(g => (
          <section key={g.name} className="bin-group" aria-label={g.name}>
            <h3>{g.name}</h3>
            <div className="bins">
              {g.ids.map(id => {
                if (id === 'resistor') return <ResistorTile key={id} locked={!have.has(id)} infoOpen={info === id} onInfo={() => setInfo(info === id ? null : id)} />;
                if (id === 'led') return <LedTile key={id} locked={!have.has(id)} board={board} infoOpen={info === id} onInfo={() => setInfo(info === id ? null : id)} />;
                if (id === 'breadboard') return <BreadboardTile key={id} infoOpen={info === id} onInfo={() => setInfo(info === id ? null : id)} />;
                const p = PARTS[id], locked = !have.has(id), by = lockedBy(id);
                return (
                  <div key={id} className="bin-wrap">
                    <button
                      type="button" className={locked ? 'bin locked' : 'bin'} aria-pressed={locked ? undefined : sameTool(tool, p.tool)} aria-disabled={locked || undefined}
                      title={locked && by ? `Locked. Pass “${by.mission.title}” to unlock it.` : undefined} onClick={() => pickTool(p.tool)}
                    >
                      <span className="bin-art"><PartPicture kind={toolKind(p.tool)} /></span>
                      <b>{p.label}</b>
                      {locked && <small><Icon name="lock" />{by ? `Pass “${by.mission.title}”` : 'Locked'}</small>}
                    </button>
                    <PartInfo id={id} open={info === id} onToggle={() => setInfo(info === id ? null : id)} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <p className="parts-count">{mission.sandbox ? `All ${all.length} parts are open in the studio.` : open === all.length ? `All ${all.length} parts unlocked.` : `${open} of ${all.length} parts unlocked. Passing missions unlocks the rest.`}{!mission.sandbox && ` The Open Studio has them all, and ${extra} more that no mission uses yet.`}</p>
      </div>
      <div className="parts-foot" role="group" aria-label="Edit the bench">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Icon name="undo" />Undo</button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Icon name="redo" />Redo</button>
        <button type="button" onClick={resetBench} disabled={!hasParts} title="Clear the bench. Undo brings it back." aria-label="Clear the bench"><Icon name="trash" />Clear</button>
      </div>
    </>
  );
}
