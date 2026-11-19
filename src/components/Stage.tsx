import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { ITEM_INFO } from '../data/boards';
import { ohmsLabel } from '../data/resistor';
import { view } from '../scene/view';
import { analyze } from '../sim/circuit';
import { cancelTool, currentReadout, dismissNotice, escapePanel, flipItem, moveWireTyped, placeTyped, removeItem, requestRun, resumeRun, selectHot, setHelp, setInput, setNav, showGuide, stepOnce, stopRun, toggleLabels, togglePanel, toggleSound, redo, undo } from '../state/actions';
import { TWO_POINT, type ToolKind } from '../state/bench';
import { benchOf, boardOf, missionOf, useLab } from '../state/store';
import { itemId, kindOf, type Item, type PartKind } from '../types';
import { Boundary, isLoadError } from './Boundary';
import { Icon } from './Icons';
import { Pinout } from './Pinout';

/** The 3D view and three.js come in their own file, fetched when the bench first shows. */
const loadScene = () => import('../scene/Scene');

/** The 3D view, loaded on demand. If it crashes or cannot load, a message takes its place and everything else on the bench keeps working. */
function Scene3D({ labelLayer }: { labelLayer: RefObject<HTMLDivElement | null> }) {
  const board = useLab(s => s.board), [attempt, setAttempt] = useState(0);
  const Scene = useMemo(() => lazy(loadScene), [attempt]);   // a fresh lazy() on retry, since a failed one remembers its failure
  return (
    <Boundary
      resetKey={`${board}-${attempt}`}
      fallback={(error, retry) => (
        <div className="fail" role="alert">
          <div>
            <p>{isLoadError(error)
              ? 'The 3D view could not be downloaded. Check the internet connection and try again.'
              : 'The 3D view stopped working. On some devices it cannot start at all. The missions, code editor and Serial Monitor still work.'}</p>
            <button type="button" onClick={() => { setAttempt(a => a + 1); retry(); }}>Try again</button>
          </div>
        </div>
      )}
    >
      <Suspense fallback={<p className="fail" role="status">Setting up the bench…</p>}>
        <Scene labelLayer={labelLayer} />
      </Suspense>
    </Boundary>
  );
}

/* --- placing a part: what to click next --- */

const STEPS: Record<ToolKind, [string, string?]> = {
  led: ['Click the hole for the LED\'s long leg (+).', 'Now click the hole for its short leg (−).'],
  res: ['Click the hole for one end of the resistor.', 'Now click the hole for its other end.'],
  buzzer: ['Click the hole for one buzzer leg.', 'Now click the hole for the other leg.'],
  wire: ['Click or drag from one hole or board pin…', '…to the point it should connect to.'],
  button: ['Click a hole. The button sits across the middle gap, covering that column and the one two to the right.'],
  pot: ['Click the hole for the knob\'s left leg. It uses three columns in a row.'],
  sonar: ['Click the hole for the sensor\'s VCC leg. It uses four columns in a row.'],
  pad: ['The touch pad sits on the table. Connect it with a wire to PAD.'],
  servo: ['Click the hole for the servo\'s brown GND leg. Its lead uses three columns in a row: GND, + and signal.'],
  ldr: ['Click the hole for one leg of the light sensor.', 'Now click the hole for its other leg. It has no front or back.'],
  temp: ['Click the hole for the sensor\'s left leg (+). It uses three columns in a row: + , OUT and GND.'],
  rgb: ['Click the hole for the RGB LED\'s left leg (red). It uses four columns in a row: red, the long − leg, green and blue.'],
  slide: ['Click the hole for the switch\'s left leg. It uses three columns in a row, with the shared leg in the middle.'],
  contact: ['Click the hole for one leg of the switch.', 'Now click the hole for its other leg. It has no front or back.'],
  module: ['Click the hole for the sensor\'s left pin (+). It uses three columns in a row: +, OUT and GND.'],
  joy: ['Click the hole for the joystick\'s left pin (GND). It uses five columns in a row: GND, +, VRx, VRy and SW.'],
};

/** What to do next with the chosen part. It floats over the 3D view, so showing it never moves the bench under the pointer. */
function Help() {
  const board = useLab(s => s.board), tool = useLab(s => s.tool), pending = useLab(s => s.pending), point = useLab(s => s.point);
  const [typed, setTyped] = useState(''), [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { setTyped(''); setProblem(null); }, [tool, board]);
  if (!tool) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = placeTyped(typed);
    setProblem(err);
    if (!err) setTyped('');
  };
  const step = STEPS[tool.kind][TWO_POINT.includes(tool.kind) && pending ? 1 : 0];
  return (
    <div className="tray-help">
      <p aria-live="polite">{step}<span className="at"> {point ? <>Pointing at <code>{point.replace(/^[UE]:/, '')}</code></> : ''}</span></p>
      {tool.kind !== 'pad' && (
        <form onSubmit={submit}>
          <label>or type it: <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={TWO_POINT.includes(tool.kind) ? 'e10 e11' : 'd24'} autoComplete="off" spellCheck={false} /></label>
          <button type="submit">Place</button>
        </form>
      )}
      <button type="button" onClick={cancelTool}>Done</button>
      {problem && <p className="problem" role="alert">{problem}</p>}
    </div>
  );
}

/* --- notices, the part card and the circuit check --- */
/** The latest message about what happened, such as a mission passed. The supply shelf shows it too. */
export function Notice() {
  const n = useLab(s => s.notice);
  if (!n) return null;
  return (
    <div className={`notice ${n.tone}`} role={n.tone === 'info' ? 'status' : 'alert'}>
      <p>{n.text}</p>
      <button type="button" aria-label="Dismiss" onClick={dismissNotice}>×</button>
    </div>
  );
}

/** Where each end of a wire is plugged in, as text the student can change. The same as dragging an end, for keyboards and small screens. */
function WireEnds({ id, a, b }: { id: string; a: string; b: string }) {
  const [from, setFrom] = useState(a), [to, setTo] = useState(b), [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { setFrom(a); setTo(b); setProblem(null); }, [a, b, id]);
  return (
    <form className="ends" onSubmit={(e: FormEvent) => { e.preventDefault(); setProblem(moveWireTyped(id, from, to)); }}>
      <label>From <input value={from} onChange={e => setFrom(e.target.value)} autoComplete="off" spellCheck={false} /></label>
      <label>To <input value={to} onChange={e => setTo(e.target.value)} autoComplete="off" spellCheck={false} /></label>
      <button type="submit">Move ends</button>
      {problem && <p className="problem" role="alert">{problem}</p>}
    </form>
  );
}

function PartCard() {
  const hot = useLab(s => s.hot), board = useLab(boardOf), bench = useLab(benchOf);
  if (!hot) return null;
  const at = bench.findIndex((it, k) => itemId(it, k) === hot), item = at >= 0 ? bench[at] : null;
  const info = board.parts[hot] ?? (item && ITEM_INFO[kindOf(item)]);
  if (!info) return null;
  return (
    <div className="card">
      <button type="button" className="x" aria-label="Close" onClick={() => selectHot(null)}>×</button>
      <b>{item?.t === 'res' ? `${ohmsLabel(item.ohms ?? 220)} resistor` : info[0]}</b>
      <p>{info[1]}</p>
      {item && <details className="pinout-more"><summary><span className="i-badge" aria-hidden="true">i</span>Pinout</summary><Pinout kind={kindOf(item)} ohms={item.t === 'res' ? item.ohms ?? 220 : undefined} /></details>}
      {item?.t === 'wire' && <WireEnds id={hot} a={item.a} b={item.b} />}
      {item && (
        <div className="card-actions">
          {item.t === 'led' && <button type="button" onClick={() => flipItem(hot)}>Flip</button>}
          <button type="button" onClick={() => removeItem(hot)}>Remove</button>
        </div>
      )}
    </div>
  );
}

function Checks() {
  const board = useLab(s => s.board), bench = useLab(benchOf);
  const issues = useMemo(() => analyze(board, bench).issues, [board, bench]);
  if (!bench.length) return null;
  return (
    <details className={issues.length ? 'checks bad' : 'checks ok'} open={issues.length > 0 && issues.length < 3}>
      <summary>{issues.length ? `Circuit check: ${issues.length} thing${issues.length > 1 ? 's' : ''} to fix` : 'Circuit check: no problems found'}</summary>
      <ul>
        {issues.map((i, n) => (
          <li key={n} className={i.severity}>
            <b>{i.title}</b>
            <span>{i.plain}</span>
            {i.part && <button type="button" onClick={() => selectHot(i.part!)}>Show part</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* --- the voltage under the pointer --- */
const LOGIC: Record<string, number> = { uno: 5, esp32: 3.3 };
/** In plain words: "Hole e10", "Pin 13", "Plus rail". */
function nameOf(point: string): string {
  let m;
  if ((m = /^U:(\d+)$/.exec(point))) return `Pin ${m[1]}`;
  if ((m = /^[UE]:(.+)$/.exec(point))) return `Pin ${m[1].replace('GNDf', 'GND').replace(/GND[2b]/, 'GND')}`;
  if ((m = /^([TB])([+-])/.exec(point))) return `${m[2] === '+' ? 'Plus' : 'Minus'} rail, ${m[1] === 'T' ? 'far' : 'near'} side`;
  return point === 'PAD' ? 'Touch pad' : `Hole ${point}`;
}

/** Point at a hole or pin to read its voltage. It follows the sketch while it runs and the recorded frame while the student looks back. */
function Probe() {
  const probe = useLab(s => s.probe), board = useLab(s => s.board), bench = useLab(benchOf), inputs = useLab(s => s.inputs);
  const analysis = useMemo(() => analyze(board, bench), [board, bench]);
  const [, redraw] = useState(0), name = probe?.name;
  useEffect(() => {
    if (!name) return;
    const id = setInterval(() => redraw(n => n + 1), 100);
    return () => clearInterval(id);
  }, [name]);
  if (!probe) return null;
  const live = currentReadout(), sol = live ? live.circuit : analysis.solve({}, inputs), v = sol.volt(probe.name), logic = LOGIC[board];
  const level = v > logic * 0.6 ? 'high' : v < logic * 0.3 ? 'low' : 'in between', pin = analysis.pinAt(probe.name), amps = pin != null ? sol.pinAmps(pin) : 0;
  return (
    <div className="probe" role="status" style={{ left: probe.x + 14, top: probe.y + 14 }}>
      <b>{nameOf(probe.name)}</b>
      <span className="volts">{v.toFixed(2)} V</span>
      <small>{level}{live ? '' : ' · no sketch running'}</small>
      {Math.abs(amps) >= 0.0005 && <small>{amps > 0 ? 'supplying' : 'taking in'} {Math.abs(amps * 1000).toFixed(1)} mA</small>}
    </div>
  );
}

/* --- on-screen inputs --- */
type Control = Extract<Item, { ctl: string }>;

function Hold({ id, label }: { id: string; label: string }) {
  const down = useLab(s => !!s.inputs[id]);
  const press = (on: boolean) => () => setInput(id, on ? 1 : 0);
  const key = (on: boolean) => (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') setInput(id, on ? 1 : 0); };
  return (
    <button type="button" className={down ? 'hold down' : 'hold'}
      onPointerDown={press(true)} onPointerUp={press(false)} onPointerLeave={press(false)} onPointerCancel={press(false)}
      onKeyDown={key(true)} onKeyUp={key(false)} onBlur={press(false)}>
      {label}
    </button>
  );
}

/** A switch that stays where it is put: each press turns it over, and it says which way it is now. */
function Flip({ id, label, states }: { id: string; label: string; states: [off: string, on: string] }) {
  const on = useLab(s => !!s.inputs[id]);
  return <button type="button" className={on ? 'flip on' : 'flip'} aria-pressed={on} onClick={() => setInput(id, on ? 0 : 1)}>{label}: <b>{states[on ? 1 : 0]}</b></button>;
}
/** What the two positions of each part with a Flip are called. */
const STATES: Partial<Record<PartKind, [off: string, on: string]>> = { slide: ['left', 'right'], tilt: ['upright', 'tilted'], reed: ['away', 'near'], pir: ['all still', 'someone moving'], ir: ['clear', 'blocked'] };

/** A slider. Most parts keep a value from 0 to 1 and show it as a percentage; with `unit` the value is kept as it is shown (the wall in cm, the temperature in °C). */
function Slider({ id, label, range = [0, 100], unit }: { id: string; label: string; range?: [number, number]; unit?: string }) {
  const value = useLab(s => s.inputs[id] ?? 0), raw = unit != null;
  const shown = raw ? value : Math.round(value * 100);
  const [lo, hi] = range;
  return (
    <label>
      {label}
      <input type="range" min={lo} max={hi} value={shown} onChange={e => setInput(id, raw ? +e.target.value : +e.target.value / 100)} />
      <output>{`${shown}${unit ?? '%'}`}</output>
    </label>
  );
}

function Controls() {
  const bench = useLab(benchOf), names = useLab(missionOf).controls;
  const items = bench.map((it, k) => [it, itemId(it, k)] as const).filter((x): x is readonly [Control, string] => 'ctl' in x[0]);
  if (!items.length) return null;
  return (
    <div className="controls">
      {items.map(([it, id]) => {
        const label = (names as Record<string, string | undefined> | undefined)?.[kindOf(it)] ?? it.ctl, states = STATES[kindOf(it)];
        if (it.t === 'button' || it.t === 'pad') return <Hold key={id} id={id} label={label} />;
        if (it.t === 'joy') return (   // a joystick is two knobs and a button under one stick
          <span key={id} className="stick" role="group" aria-label={label}>
            <Slider id={id} label="Stick left–right" /><Slider id={`${id}:y`} label="down–up" /><Hold id={`${id}:sw`} label="Press the stick" />
          </span>
        );
        if (states) return <Flip key={id} id={id} label={label} states={states} />;
        if (it.t === 'sonar') return <Slider key={id} id={id} label={label} range={[2, 100]} unit=" cm" />;
        if (it.t === 'temp') return <Slider key={id} id={id} label={label} range={[-10, 50]} unit=" °C" />;
        return <Slider key={id} id={id} label={label} />;
      })}
    </div>
  );
}

/** Everything the keyboard can do without a mouse. The help dialog lists these. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (useLab.getState().running) stopRun(); else requestRun(); return; }   // works inside the editor too
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || e.altKey || document.querySelector('[aria-modal="true"]')) return;   // typing, or a dialog has the keyboard
      const s = useLab.getState(), k = e.key;
      if (e.ctrlKey || e.metaKey) {
        if (k.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (k.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        return;
      }
      if (k === 'Escape') { if (s.tool) cancelTool(); else if (s.hot) selectHot(null); else escapePanel(); }
      else if ((k === 'Delete' || k === 'Backspace') && s.hot && benchOf(s).some((it, i) => itemId(it, i) === s.hot)) { e.preventDefault(); removeItem(s.hot); }
      else if (k === '?') setHelp(true);
      else if (k === '+' || k === '=') view.zoom(1.25);
      else if (k === '-' || k === '_') view.zoom(0.8);
      else if (!e.shiftKey) {
        const letter = k.toLowerCase();
        if (letter === 'm') togglePanel('map');
        else if (letter === 'b') togglePanel('brief');
        else if (letter === 'g') showGuide();
        else if (letter === 'p') togglePanel('parts');
        else if (letter === 'c') togglePanel('code');
        else if (letter === 't') view.top();
        else if (k === '0') view.fit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Run, step and stop live in the top bar, so the sketch can be run without opening the code. */
export function RunBar() {
  const running = useLab(s => s.running), paused = useLab(s => s.paused), line = useLab(s => s.line), looking = useLab(s => s.cursor != null);
  const status = looking ? 'Looking back' : paused && line ? `Held · line ${line}` : running ? 'Running' : 'Stopped';
  return (
    <div className="runbar" role="group" aria-label="Run the sketch">
      <button type="button" className={running ? 'run on' : 'run'} onClick={running ? stopRun : () => requestRun()} aria-keyshortcuts="Control+Enter" title={running ? 'Stop the sketch (Ctrl+Enter)' : 'Run the sketch (Ctrl+Enter)'}>
        <Icon name={running ? 'stop' : 'play'} /><span className="lbl">{running ? 'Stop' : 'Run'}</span>
      </button>
      <button type="button" onClick={stepOnce} aria-label="Step one line" title="Run one line, then wait. While running freely this pauses at the next line."><Icon name="step" /><span className="lbl">Step</span></button>
      {paused && <button type="button" onClick={resumeRun} aria-label="Continue at full speed" title="Run at full speed again"><Icon name="forward" /><span className="lbl">Continue</span></button>}
      <span className={running ? 'state on' : 'state'} role="status">{status}</span>
    </div>
  );
}

/** Moving around the bench: zoom, how a drag moves the view, the flat top view, and what to show. */
function Tools() {
  const labels = useLab(s => s.labels), nav = useLab(s => s.nav), sound = useLab(s => s.sound);
  return (
    <div className="tools" role="toolbar" aria-label="View">
      <div className="group">
        <button type="button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => view.zoom(1.25)}><Icon name="zoomIn" /></button>
        <button type="button" aria-label="Zoom out" title="Zoom out (−)" onClick={() => view.zoom(0.8)}><Icon name="zoomOut" /></button>
        <button type="button" aria-label="Look straight down" title="Top view (T)" onClick={() => view.top()}><Icon name="top" /></button>
        <button type="button" aria-label="Reset the view" title="Reset the view (0)" onClick={() => view.fit()}><Icon name="fit" /></button>
      </div>
      <div className="group">
        <button type="button" aria-label="Drag to move the view" aria-pressed={nav === 'pan'} title="Dragging slides the view. Right-drag turns it. Arrow keys slide it." onClick={() => setNav('pan')}><Icon name="move" /></button>
        <button type="button" aria-label="Drag to turn the view" aria-pressed={nav === 'rotate'} title="Dragging turns the view. Right-drag slides it." onClick={() => setNav('rotate')}><Icon name="rotate" /></button>
      </div>
      <div className="group">
        <button type="button" aria-label="Part labels" aria-pressed={labels} title="Show or hide the part labels" onClick={toggleLabels}><Icon name="tag" /></button>
        <button type="button" aria-label="Sound" aria-pressed={sound} title={sound ? 'Sound is on' : 'Sound is off'} onClick={toggleSound}><Icon name={sound ? 'volume' : 'mute'} /></button>
        <button type="button" aria-label="Keyboard help" title="Keyboard help (?)" onClick={() => setHelp(true)}><Icon name="help" /></button>
      </div>
    </div>
  );
}

/** The 3D bench with everything that sits on it. The panels (map, brief, code) open over it from the side. */
export function Stage() {
  const labels = useLab(s => s.labels);
  const labelLayer = useRef<HTMLDivElement>(null);
  useHotkeys();
  return (
    <div className="stage">
      <Scene3D labelLayer={labelLayer} />
      <div className="hotlayer" ref={labelLayer} hidden={!labels} />
      <Probe />
      <Tools />
      <div className="base">
        <div className="dock">
          <div className="stack">
            <Notice />
            <PartCard />
            <Checks />
          </div>
          <Controls />
          <Help />
        </div>
      </div>
    </div>
  );
}
