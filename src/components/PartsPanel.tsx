import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { lockedBy, PARTS, STUDIO_PARTS, trayParts, type PartId } from '../data/missions';
import { PINOUTS } from '../data/pinouts';
import { bands, nearestStop, ohmsLabel, parseOhms, RESISTOR_STOPS, useFor } from '../data/resistor';
import { pickTool, redo, resetBench, setOhms, undo } from '../state/actions';
import { sameTool, toolKind } from '../state/bench';
import { benchOf, keyOf, missionOf, useLab } from '../state/store';
import { Icon } from './Icons';
import { Pinout } from './Pinout';
import { PartSymbol } from './Symbols';

/** The parts, sorted by what they do on the bench rather than by when they were unlocked. */
const GROUPS: { name: string; ids: PartId[] }[] = [
  { name: 'Wiring', ids: ['wire', 'resistor'] },
  { name: 'Lights, sound and motion', ids: ['led-red', 'led-green', 'led-yellow', 'led-blue', 'led-white', 'rgb', 'buzzer', 'servo'] },
  { name: 'Switches and controls', ids: ['button', 'slide', 'knob', 'joystick', 'tilt', 'reed', 'pad'] },
  { name: 'Sensors', ids: ['ldr', 'temp', 'sonar', 'pir', 'ir', 'soil', 'water', 'gas', 'flame'] },
];
/** The drawing each part is shown with (the ones the guide draws). A resistor draws itself, with the bands of its value. */
const DRAWING: Record<PartId, string> = {
  wire: 'wire', resistor: 'resistor', 'led-red': 'led', 'led-green': 'led', buzzer: 'buzzer', servo: 'servo',
  button: 'button', knob: 'knob', ldr: 'ldr', temp: 'temp', sonar: 'sonar', pad: 'touch',
  'led-yellow': 'led', 'led-blue': 'led', 'led-white': 'led', rgb: 'rgb', slide: 'slide', tilt: 'tilt', reed: 'reed', joystick: 'joystick',
  pir: 'pir', ir: 'ir', soil: 'soil', water: 'water', gas: 'gas', flame: 'flame',
};

/** A resistor lying down, with the bands of its value. */
function ResistorArt({ ohms }: { ohms: number }) {
  const colors = bands(ohms);
  return (
    <svg className="sym res-art" viewBox="0 0 48 32" aria-hidden="true">
      <path d="M2 16h8M38 16h8" className="lead" />
      <rect x="10" y="9" width="28" height="14" rx="7" className="body" />
      {colors.map((c, i) => <rect key={i} x={(i === colors.length - 1 ? 31 : 14 + i * 5) - 1.5} y="9.5" width="3" height="13" fill={c} stroke="none" />)}
    </svg>
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
      <div className="resistor-tile">
        <button type="button" className="bin" aria-pressed={locked ? undefined : sameTool(tool, pick)} onClick={() => pickTool(pick)}>
          <span className="bin-art"><ResistorArt ohms={ohms} /></span>
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
      <button type="button" className={infoOpen ? 'bin-i on' : 'bin-i'} aria-label="Pinout of the resistor" aria-expanded={infoOpen} title="Pinout" onClick={onInfo}>i</button>
    </div>
  );
}

/** The parts drawer: every part as a tile you pick and then place on the bench. A part that is still locked says which mission opens it. In the studio nothing is locked. */
export function PartsPanel() {
  const board = useLab(s => s.board), tool = useLab(s => s.tool), passed = useLab(s => s.passed), ohms = useLab(s => s.ohms), mission = useLab(missionOf);
  const canUndo = useLab(s => !!s.undo[keyOf(s)]?.length), canRedo = useLab(s => !!s.redo[keyOf(s)]?.length), hasParts = useLab(s => benchOf(s).length > 0);
  const have = useMemo(() => trayParts(mission, Object.keys(passed)), [mission, passed]);
  const [info, setInfo] = useState<PartId | null>(null), scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (info) scroller.current?.scrollTo({ top: 0 }); }, [info]);   // the pinout opens at the top of the drawer
  const fits = (id: PartId) => (!PARTS[id].only || PARTS[id].only === board) && (!PARTS[id].studio || !!mission.sandbox);   // a part made for the other board is left out, and so is one only the studio has
  const groups = GROUPS.map(g => ({ ...g, ids: g.ids.filter(fits) })).filter(g => g.ids.length);
  const extra = STUDIO_PARTS.filter(id => !PARTS[id].only || PARTS[id].only === board).length;
  const all = groups.flatMap(g => g.ids), open = all.filter(id => have.has(id)).length;
  return (
    <>
      <div className="parts-scroll" ref={scroller}>
        {info && (
          <section className="pinout-card" aria-label={`Pinout of the ${PARTS[info].label}`}>
            <header><h3>{PINOUTS[toolKind(PARTS[info].tool)].title}{info === 'resistor' && <span className="ohms"> · {ohmsLabel(ohms)}</span>}</h3><button type="button" aria-label="Close the pinout" onClick={() => setInfo(null)}><Icon name="close" /></button></header>
            <Pinout kind={toolKind(PARTS[info].tool)} ohms={info === 'resistor' ? ohms : undefined} />
          </section>
        )}
        <p className="parts-lede">Pick a part, then click the holes on the bench where it goes. Press <kbd>Esc</kbd> to put it down.</p>
        {groups.map(g => (
          <section key={g.name} className="bin-group" aria-label={g.name}>
            <h3>{g.name}</h3>
            <div className="bins">
              {g.ids.map(id => {
                if (id === 'resistor') return <ResistorTile key={id} locked={!have.has(id)} infoOpen={info === id} onInfo={() => setInfo(info === id ? null : id)} />;
                const p = PARTS[id], locked = !have.has(id), by = lockedBy(id);
                return (
                  <div key={id} className="bin-wrap">
                    <button
                      type="button" className={locked ? 'bin locked' : 'bin'} aria-pressed={locked ? undefined : sameTool(tool, p.tool)} aria-disabled={locked || undefined}
                      title={locked && by ? `Locked. Pass “${by.mission.title}” to unlock it.` : undefined} onClick={() => pickTool(p.tool)}
                    >
                      <span className="bin-art" style={p.swatch ? { color: p.swatch } : undefined}><PartSymbol id={DRAWING[id]} /></span>
                      <b>{p.label}</b>
                      {locked && <small><Icon name="lock" />{by ? `Pass “${by.mission.title}”` : 'Locked'}</small>}
                    </button>
                    <button type="button" className={info === id ? 'bin-i on' : 'bin-i'} aria-label={`Pinout of the ${p.label}`} aria-expanded={info === id} title="Pinout" onClick={() => setInfo(info === id ? null : id)}>i</button>
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
