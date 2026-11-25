import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { lockedBy, PARTS, STUDIO_PARTS, trayParts, type PartId } from '../data/missions';
import { PINOUTS } from '../data/pinouts';
import { ohmsLabel } from '../data/resistor';
import { pickTool, redo, resetBench, undo } from '../state/actions';
import { sameTool, toolKind, type Tool } from '../state/bench';
import { benchOf, keyOf, missionOf, useLab } from '../state/store';
import { ledColorName } from '../types';
import { Icon } from './Icons';
import { hex, named } from './PartOptions';
import { PartPicture, PictureDefs } from './PartPictures';
import { Pinout } from './Pinout';

/** The parts, sorted by what they do on the bench rather than by when they were unlocked. */
const GROUPS: { name: string; ids: PartId[] }[] = [
  { name: 'Wiring', ids: ['wire', 'resistor', 'breadboard'] },
  { name: 'Lights, sound and motion', ids: ['led', 'rgb', 'lcd', 'buzzer', 'servo'] },
  { name: 'Switches and controls', ids: ['button', 'slide', 'knob', 'joystick', 'tilt', 'reed', 'pad'] },
  { name: 'Sensors', ids: ['ldr', 'temp', 'sonar', 'pir', 'ir', 'soil', 'water', 'gas', 'flame'] },
];

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

/** The parts drawer: every part as a tile you pick and then place on the bench. A part that is still locked says which mission opens it. In the studio nothing is locked. */
export function PartsPanel() {
  const board = useLab(s => s.board), tool = useLab(s => s.tool), passed = useLab(s => s.passed), mission = useLab(missionOf);
  const canUndo = useLab(s => !!s.undo[keyOf(s)]?.length), canRedo = useLab(s => !!s.redo[keyOf(s)]?.length), hasParts = useLab(s => benchOf(s).length > 0);
  const have = useMemo(() => trayParts(mission, Object.keys(passed)), [mission, passed]);
  const ohms = useLab(s => s.ohms), ledColor = useLab(s => s.ledColor), bbSize = useLab(s => s.bbSize);
  const [info, setInfo] = useState<PartId | null>(null);
  /** What a tile picks up. An LED, a resistor and the second breadboard come as the last one was set on its card on the bench. */
  const toolOf = (id: PartId): Tool =>
    id === 'led' ? { ...PARTS.led.tool, color: ledColor } : id === 'resistor' ? { ...PARTS.resistor.tool, ohms } : id === 'breadboard' ? { ...PARTS.breadboard.tool, size: bbSize } : PARTS[id].tool;
  /** The colour, value or size it comes in, under its name. */
  const noteOf = (id: PartId) => (id === 'led' ? named(ledColorName(ledColor) ?? 'red') : id === 'resistor' ? ohmsLabel(ohms) : id === 'breadboard' ? named(bbSize) : null);
  const fits = (id: PartId) => (!PARTS[id].only || PARTS[id].only === board) && (!PARTS[id].studio || !!mission.sandbox);   // a part made for the other board is left out, and so is one only the studio has
  const groups = GROUPS.map(g => ({ ...g, ids: g.ids.filter(fits) })).filter(g => g.ids.length);
  const extra = STUDIO_PARTS.filter(id => !PARTS[id].only || PARTS[id].only === board).length;
  const all = groups.flatMap(g => g.ids), open = all.filter(id => have.has(id)).length;
  return (
    <>
      <div className="parts-scroll" onKeyDown={e => { if (info && e.key === 'Escape') { e.stopPropagation(); setInfo(null); } }}>   {/* Esc shuts an open pinout before the drawer */}
        <PictureDefs />
        <p className="parts-lede">Pick a part, then click the holes on the bench where it goes. Press <kbd>Esc</kbd> to put it down. Select a placed LED, resistor or breadboard to change its colour, value or size.</p>
        {groups.map(g => (
          <section key={g.name} className="bin-group" aria-label={g.name}>
            <h3>{g.name}</h3>
            <div className="bins">
              {g.ids.map(id => {
                const p = PARTS[id], t = toolOf(id), locked = !have.has(id), by = lockedBy(id), note = noteOf(id);
                return (
                  <div key={id} className="bin-wrap">
                    <button
                      type="button" className={locked ? 'bin locked' : 'bin'} aria-pressed={locked || id === 'breadboard' ? undefined : sameTool(tool, t)} aria-disabled={locked || undefined}
                      title={locked && by ? `Locked. Pass “${by.mission.title}” to unlock it.` : undefined} onClick={() => pickTool(t)}
                    >
                      <span className="bin-art"><PartPicture kind={toolKind(t)} tint={hex(ledColor)} ohms={ohms} size={bbSize} /></span>
                      <b>{p.label}</b>
                      {locked ? <small><Icon name="lock" />{by ? `Pass “${by.mission.title}”` : 'Locked'}</small> : note && <small className={id === 'resistor' ? 'ohms' : undefined}>{note}</small>}
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
