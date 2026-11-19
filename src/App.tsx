import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Boundary, PanelCrash } from './components/Boundary';
import { CampusMap } from './components/CampusMap';
import { CodePanel } from './components/CodePanel';
import { DocPanel } from './components/DocPanel';
import { BoardsPage } from './components/BoardsPage';
import { GuidePage } from './components/GuidePage';
import { HelpDialog } from './components/HelpDialog';
import { Home } from './components/Home';
import { BrandMark, Icon, type IconName } from './components/Icons';
import { PartsPanel } from './components/PartsPanel';
import { PredictDialog } from './components/PredictDialog';
import { RunBar, Stage } from './components/Stage';
import { SupplyShelf } from './components/SupplyShelf';
import { ThemeToggle } from './components/ThemeToggle';
import { BOARDS } from './data/boards';
import { chapterOf } from './data/guide';
import { MISSIONS, missionKey } from './data/missions';
import { closePanel, goTo, panelRoom, resizePanel, togglePanel } from './state/actions';
import { isOpen, MIN_WIDTH, sideOf, type Panel, type Side } from './state/panels';
import { guideHash } from './state/route';
import { boardOf, keyOf, missionOf, useLab } from './state/store';

const ALL_BOARDS = Object.values(BOARDS);
const GRADED = Object.entries(MISSIONS).flatMap(([board, list]) => list.filter(m => !m.sandbox && !m.repair).map(m => `${board}-${m.id}`));   // the main quest; side quests are extra

const PANELS: [Panel, string, IconName, string][] = [['map', 'Map', 'map', 'M'], ['brief', 'Brief', 'brief', 'B'], ['parts', 'Parts', 'parts', 'P'], ['code', 'Code', 'code', 'C']];
const HOME_TITLE = 'Embedly · Learn to build IoT devices, machines and robots';

/** The buttons that open the panels, and the link to the guide (a page of its own): in the top bar on a wide screen, along the bottom on a phone. */
function PanelToggles({ nav = false }: { nav?: boolean }) {
  const panels = useLab(s => s.panels), guide = useLab(s => s.guide), choosing = useLab(s => !!missionOf(s).choice);
  return (
    <div className={nav ? 'toggles nav' : 'toggles'} role="group" aria-label="Panels">
      {PANELS.filter(([name]) => !(choosing && (name === 'code' || name === 'parts'))).map(([name, label, icon, key]) => (
        <button key={name} type="button" className="toggle" data-toggle={name} aria-pressed={isOpen(panels, name)} aria-keyshortcuts={key} title={`${label} (${key})`} onClick={() => togglePanel(name)}>
          <Icon name={icon} /><span>{label}</span>{!nav && <kbd aria-hidden="true">{key}</kbd>}
        </button>
      ))}
      <a className="toggle" data-toggle="guide" href={guideHash(guide)} aria-keyshortcuts="G" title="Guide, on its own page (G)">
        <Icon name="book" /><span>Guide</span>{!nav && <kbd aria-hidden="true">G</kbd>}
      </a>
    </div>
  );
}

function TopBar() {
  const board = useLab(boardOf), mission = useLab(missionOf), passed = useLab(s => s.passed);
  const count = useMemo(() => GRADED.filter(k => passed[k]).length, [passed]);
  const done = !!passed[missionKey(board.id, mission.id)];
  return (
    <header className="bar">
      <a className="brand" href="#" aria-label="Embedly. Back to the home page"><BrandMark /><h1>Embed<span>ly</span></h1></a>
      <div className="crumb"><span>{mission.place}</span><Icon name="chevron" /><b>{mission.title}</b>{done && <><Icon name="check" className="tick" /><span className="sr-only">passed</span></>}</div>
      {!mission.choice && <RunBar />}
      <div className="seg" role="tablist" aria-label="Choose a board">
        {ALL_BOARDS.map(b => (
          <button key={b.id} type="button" role="tab" aria-selected={b.id === board.id} onClick={() => goTo(b.id, MISSIONS[b.id][0].id)}>{b.name}</button>
        ))}
      </div>
      <div className="progress" title={`${count} of ${GRADED.length} missions passed`}>
        <span>{count} / {GRADED.length}<span className="sr-only"> missions passed</span></span>
        <div className="meter" role="progressbar" aria-label="Missions passed" aria-valuemin={0} aria-valuemax={GRADED.length} aria-valuenow={count}><i style={{ width: `${(100 * count) / GRADED.length}%` }} /></div>
      </div>
      <ThemeToggle />
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

const RAILS: Record<Side, [Panel, string, IconName, string][]> = {
  left: [['map', 'Map', 'map', 'M'], ['brief', 'Brief', 'brief', 'B']],
  right: [['parts', 'Parts', 'parts', 'P'], ['code', 'Code', 'code', 'C']],
};
/** A rail of panel buttons down one edge of the bench. The left one is for reading (map, brief, guide) and the right one for building (parts, code). */
function Rail({ side }: { side: Side }) {
  const panels = useLab(s => s.panels), guide = useLab(s => s.guide);
  return (
    <nav className={`rail ${side}`} aria-label={side === 'left' ? 'Read: map, brief and guide' : 'Build: parts and code'}>
      {RAILS[side].map(([name, label, icon, key]) => (
        <button key={name} type="button" className="rail-btn" data-toggle={name} aria-pressed={isOpen(panels, name)} aria-keyshortcuts={key} title={`${label} (${key})`} onClick={() => togglePanel(name)}>
          <Icon name={icon} /><span>{label}</span>
        </button>
      ))}
      {side === 'left' && <a className="rail-btn rail-end" data-toggle="guide" href={guideHash(guide)} aria-keyshortcuts="G" title="Guide, on its own page (G)"><Icon name="book" /><span>Guide</span></a>}
    </nav>
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
    <aside ref={ref} className={`drawer ${sideOf(name)} panel-${name}`} aria-label={title} tabIndex={-1} onKeyDown={key}>
      <div className="drawer-head">
        <h2><Icon name={icon} />{title}</h2>
        <button type="button" aria-label={`Close ${title}`} title="Close (Esc)" onClick={() => closePanel(name)}><Icon name="close" /></button>
      </div>
      <div className={`drawer-body ${className}`}>
        <Boundary resetKey={mission} fallback={(_e, retry) => <PanelCrash what={title.toLowerCase()} retry={retry} />}>{children}</Boundary>
      </div>
      <Grip side={sideOf(name)} title={title} />
    </aside>
  );
}

export function App() {
  const board = useLab(boardOf), mission = useLab(missionOf), page = useLab(s => s.page), chapter = useLab(s => s.guide), panels = useLab(s => s.panels), widths = useLab(s => s.widths);
  const chosen = { '--wl': widths.left ? `${widths.left}px` : undefined, '--wr': widths.right ? `${widths.right}px` : undefined } as CSSProperties;
  useEffect(() => {
    const c = chapterOf(chapter);
    document.title = page === 'home' ? HOME_TITLE : page === 'boards' ? 'Compare boards · Embedly' : page === 'guide' ? `${c ? `${c.title} · ` : ''}Guide · Embedly` : `${mission.title} · ${mission.place} · Embedly`;
  }, [page, chapter, board, mission]);
  if (page === 'home') return <Home />;
  if (page === 'guide') return <GuidePage />;
  if (page === 'boards') return <BoardsPage />;
  return (
    <div className="app">
      <a className="skip" href="#bench" onClick={e => { e.preventDefault(); document.getElementById('bench')?.focus(); }}>Skip to the bench</a>
      <TopBar />
      <main id="bench" className="bench" tabIndex={-1} aria-label="The bench" data-left={panels.left ?? undefined} data-right={panels.right ?? undefined} data-rails={mission.choice ? 'left' : undefined} style={chosen}>
        {mission.choice ? <SupplyShelf /> : <Stage />}
        <Drawer name="map" title="Mission map" icon="map" className="mapbody"><CampusMap /></Drawer>
        <Drawer name="brief" title="Mission brief" icon="brief"><DocPanel /></Drawer>
        {!mission.choice && <Drawer name="parts" title="Parts" icon="parts"><PartsPanel /></Drawer>}
        {!mission.choice && <Drawer name="code" title="Code" icon="code"><CodePanel /></Drawer>}
        <Rail side="left" />
        {!mission.choice && <Rail side="right" />}
      </main>
      <PanelToggles nav />
      <PredictDialog />
      <HelpDialog />
    </div>
  );
}
