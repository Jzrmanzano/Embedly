import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Boundary, PanelCrash } from './components/Boundary';
import { CampusMap } from './components/CampusMap';
import { CodePanel } from './components/CodePanel';
import { DocPanel } from './components/DocPanel';
import { GuidePanel } from './components/GuidePanel';
import { HelpDialog } from './components/HelpDialog';
import { Home } from './components/Home';
import { Icon, type IconName } from './components/Icons';
import { PredictDialog } from './components/PredictDialog';
import { Stage } from './components/Stage';
import { BOARDS } from './data/boards';
import { MISSIONS, missionKey } from './data/missions';
import { closePanel, goTo, panelRoom, resizePanel, togglePanel } from './state/actions';
import { isOpen, MIN_WIDTH, type Panel, type Side } from './state/panels';
import { boardOf, keyOf, missionOf, useLab } from './state/store';

const ALL_BOARDS = Object.values(BOARDS);
const GRADED = Object.entries(MISSIONS).flatMap(([board, list]) => list.filter(m => !m.sandbox).map(m => `${board}-${m.id}`));

const PANELS: [Panel, string, IconName, string][] = [['map', 'Map', 'map', 'M'], ['brief', 'Brief', 'brief', 'B'], ['guide', 'Guide', 'book', 'G'], ['code', 'Code', 'code', 'C']];

/** The buttons that open the panels: in the top bar on a wide screen, along the bottom on a phone. */
function PanelToggles({ nav = false }: { nav?: boolean }) {
  const panels = useLab(s => s.panels);
  return (
    <div className={nav ? 'toggles nav' : 'toggles'} role="group" aria-label="Panels">
      {PANELS.map(([name, label, icon, key]) => (
        <button key={name} type="button" className="toggle" data-toggle={name} aria-pressed={isOpen(panels, name)} aria-keyshortcuts={key} title={`${label} (${key})`} onClick={() => togglePanel(name)}>
          <Icon name={icon} /><span>{label}</span>{!nav && <kbd aria-hidden="true">{key}</kbd>}
        </button>
      ))}
    </div>
  );
}

function TopBar() {
  const board = useLab(boardOf), mission = useLab(missionOf), passed = useLab(s => s.passed);
  const count = useMemo(() => GRADED.filter(k => passed[k]).length, [passed]);
  const done = !!passed[missionKey(board.id, mission.id)];
  return (
    <header className="bar">
      <a className="brand" href="#" aria-label="Board Lab 3D. Back to the home page"><Icon name="chip" className="mark" /><h1>Board Lab <span>3D</span></h1></a>
      <div className="crumb"><span>{mission.place}</span><Icon name="chevron" /><b>{mission.title}</b>{done && <><Icon name="check" className="tick" /><span className="sr-only">passed</span></>}</div>
      <div className="seg" role="tablist" aria-label="Choose a board">
        {ALL_BOARDS.map(b => (
          <button key={b.id} type="button" role="tab" aria-selected={b.id === board.id} onClick={() => goTo(b.id, MISSIONS[b.id][0].id)}>{b.name}</button>
        ))}
      </div>
      <div className="progress" title={`${count} of ${GRADED.length} missions passed`}>
        <span>{count} of {GRADED.length} missions passed</span>
        <div className="meter" role="progressbar" aria-label="Missions passed" aria-valuemin={0} aria-valuemax={GRADED.length} aria-valuenow={count}><i style={{ width: `${(100 * count) / GRADED.length}%` }} /></div>
      </div>
      <PanelToggles />
    </header>
  );
}

/** The inner edge of a side panel: drag it, or focus it and use the arrow keys, to make the panel wider or narrower. A double click puts the usual width back. */
function Grip({ side, title }: { side: Side; title: string }) {
  const from = useRef<{ x: number; w: number } | null>(null), [now, setNow] = useState<number | null>(null), [dragging, setDragging] = useState(false);
  const panel = (el: Element) => (el.parentElement as HTMLElement).offsetWidth, out = side === 'left' ? 1 : -1;   // dragging away from the screen edge widens
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();   // no text selection while dragging
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { x: e.clientX, w: panel(e.currentTarget) };
    setDragging(true);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (from.current) resizePanel(side, from.current.w + out * (e.clientX - from.current.x)); };
  const up = () => { from.current = null; setDragging(false); };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const w = panel(e.currentTarget), step = e.shiftKey ? 96 : 24;
    const to = e.key === 'ArrowRight' ? w + out * step : e.key === 'ArrowLeft' ? w - out * step : e.key === 'Home' ? MIN_WIDTH : e.key === 'End' ? panelRoom(side) : null;
    if (to == null && e.key !== 'Enter') return;
    e.preventDefault(); e.stopPropagation();   // the arrow keys slide the view everywhere else
    resizePanel(side, to);
    setNow(panel(e.currentTarget));
  };
  return (
    <div
      className={dragging ? 'grip on' : 'grip'} role="separator" aria-orientation="vertical" tabIndex={0} aria-label={`Width of the ${title.toLowerCase()} panel`}
      aria-valuemin={MIN_WIDTH} aria-valuenow={now ?? undefined} title="Drag to resize. Double-click for the usual width."
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
      onDoubleClick={() => resizePanel(side, null)} onKeyDown={key} onFocus={e => setNow(panel(e.currentTarget))}
    />
  );
}

/** A panel that opens over the bench. Asking for it with a button or a key moves the keyboard focus into it, and closing it puts the focus back on its button. */
function Drawer({ name, title, icon, className = '', children }: { name: Panel; title: string; icon: IconName; className?: string; children: ReactNode }) {
  const open = useLab(s => isOpen(s.panels, name)), asked = useLab(s => s.focusPanel), mission = useLab(keyOf);
  const ref = useRef<HTMLElement>(null), seen = useRef(asked?.n ?? 0);
  useEffect(() => {
    if (open && asked && asked.name === name && asked.n !== seen.current) { seen.current = asked.n; ref.current?.focus(); }
  }, [open, asked, name]);
  if (!open) return null;
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closePanel(name); } };
  return (
    <aside ref={ref} className={`drawer ${name === 'code' ? 'right' : 'left'}`} aria-label={title} tabIndex={-1} onKeyDown={key}>
      <div className="drawer-head">
        <h2><Icon name={icon} />{title}</h2>
        <button type="button" aria-label={`Close ${title}`} title="Close (Esc)" onClick={() => closePanel(name)}><Icon name="close" /></button>
      </div>
      <div className={`drawer-body ${className}`}>
        <Boundary resetKey={mission} fallback={(_e, retry) => <PanelCrash what={title.toLowerCase()} retry={retry} />}>{children}</Boundary>
      </div>
      <Grip side={name === 'code' ? 'right' : 'left'} title={title} />
    </aside>
  );
}

export function App() {
  const board = useLab(boardOf), mission = useLab(missionOf), home = useLab(s => s.home), panels = useLab(s => s.panels), widths = useLab(s => s.widths);
  const chosen = { '--wl': widths.left ? `${widths.left}px` : undefined, '--wr': widths.right ? `${widths.right}px` : undefined } as CSSProperties;
  useEffect(() => { document.title = home ? 'Board Lab 3D · Campus missions for Arduino and ESP32' : `${mission.title} · ${mission.place} · Board Lab`; }, [home, board, mission]);
  if (home) return <Home />;
  return (
    <div className="app">
      <a className="skip" href="#bench" onClick={e => { e.preventDefault(); document.getElementById('bench')?.focus(); }}>Skip to the bench</a>
      <TopBar />
      <main id="bench" className="bench" tabIndex={-1} aria-label="The bench" data-left={panels.left ?? undefined} data-right={panels.right ?? undefined} style={chosen}>
        <Stage />
        <Drawer name="map" title="Campus map" icon="map" className="mapbody"><CampusMap /></Drawer>
        <Drawer name="brief" title="Mission brief" icon="brief"><DocPanel /></Drawer>
        <Drawer name="guide" title="Guide" icon="book"><GuidePanel /></Drawer>
        <Drawer name="code" title="Code" icon="code"><CodePanel /></Drawer>
      </main>
      <PanelToggles nav />
      <PredictDialog />
      <HelpDialog />
    </div>
  );
}
