import { create } from 'zustand';
import { BOARDS } from '../data/boards';
import { MISSIONS, missionKey } from '../data/missions';
import type { CheckResult } from '../sim/check';
import { LED_COLORS, type BoardId, type BreadboardSize, type Item } from '../types';
import { NONE as NO_PANELS, USUAL_WIDTHS, type Panel, type Panels, type Widths } from './panels';
import type { Tool } from './bench';
import type { Place } from './table';
import type { Page } from './route';
import type { CardId } from '../data/boardchoice';

export type Tab = 'mission' | 'schematic' | 'notes' | 'board';

/** A mission that has been passed. */
export interface PassRecord { at: number; hints: number; predicted: 'right' | 'wrong' | 'skipped' }
/** What the student said would happen, and what did. */
export interface PredictionRecord { picked: string; actual: string; right: boolean }

/** What the bench held at one moment, for undo. */
export interface Snap { items: Item[]; burnt: string[] }
export interface Notice { id: number; tone: 'error' | 'warn' | 'info'; text: string }

export interface LabState {
  /** The page showing: the home page (empty address bar hash), the lab, or the guide (#guide). */
  page: Page;
  /** True once a mission has been open in this visit, so the guide offers the way back to it. */
  labSeen: boolean;
  board: BoardId;
  /** Index into the board's missions. */
  mission: number;
  tab: Tab;
  /** The highlighted part, if any. */
  hot: string | null;
  /** Sketches the student has changed, by lesson key. */
  edits: Record<string, string>;
  /** The circuit the student has built, by lesson key. */
  benches: Record<string, Item[]>;
  /** LEDs that burnt out, by lesson key. */
  burnt: Record<string, string[]>;
  undo: Record<string, Snap[]>;
  redo: Record<string, Snap[]>;
  /** The part being placed, the first point already chosen for a two-point part, and the point under the pointer. */
  tool: Tool | null;
  pending: string | null;
  point: string | null;
  /** A wire end being dragged to a new place, and the point it is over right now. */
  drag: { id: string; end: 'a' | 'b'; to: string | null } | null;
  /** Where the second breadboard is while it is being dragged around the table. It is put down there when the pointer comes up. */
  bbDrag: Place | null;
  /** A placed part being dragged to other holes: how many rows and columns it has moved, and the hole under the pointer. */
  partDrag: { id: string; rows: number; cols: number; to: string } | null;
  /** A message about the last thing that happened on the bench. */
  notice: Notice | null;
  /** Which panels are open over the bench, and the panel the student just asked for, which should take the keyboard focus. */
  panels: Panels;
  focusPanel: { name: Panel; n: number } | null;
  /** How wide the student has dragged the left and right panels. */
  widths: Widths;
  /** The keyboard help is open. */
  help: boolean;
  /** The chapter of the guide that is open (or was last, while another page shows), or null for its contents page. */
  guide: string | null;
  /** Step mode: the sketch is held before the line shown, waiting for Step. */
  paused: boolean;
  line: number | null;
  /** Which recorded frame the student is looking at, or null for the present. */
  cursor: number | null;
  /** Changes whenever the recording does, so panels know to redraw. */
  frameTick: number;
  /** The connection point under the pointer and where on the 3D view it is, for the voltage readout. */
  probe: { name: string; x: number; y: number } | null;
  /** Counts short circuits, so the 3D view can flash each one. */
  sparks: number;
  /** On-screen inputs by part id: 1 or 0 for a held button or pad, 0 to 1 for a knob, centimetres for the wall. */
  inputs: Record<string, number>;
  /** Missions passed, by key (board and mission id). */
  passed: Record<string, PassRecord>;
  /** How many of the three hints the student has opened, by mission key. */
  hintsUsed: Record<string, number>;
  predictions: Record<string, PredictionRecord>;
  /** The board last chosen on the supply shelf, by mission key, for the missions that ask for a choice. */
  picks: Record<string, CardId>;
  /** The latest run of the mission's checks, cleared when the bench or sketch changes. */
  results: CheckResult[] | null;
  checking: boolean;
  /** The prediction question is open, and whether the run that follows is a step run. */
  asking: { step: boolean } | null;
  sound: boolean;
  /** The resistor value picked in the Parts drawer, which the next resistor placed will have. */
  ohms: number;
  /** The LED colour picked in the Parts drawer, which the next LED placed will have. */
  ledColor: number;
  /** The breadboard size picked in the Parts drawer, for the second breadboard. */
  bbSize: BreadboardSize;
  /** What a left-button drag on the bench does: slide the view sideways and up or down, or turn it. */
  nav: 'pan' | 'rotate';
  labels: boolean;
  running: boolean;
  errLine: number | null;
  serial: string;
}

const MISSION_KEY = 'boardlab-missions', BENCH_KEY = 'boardlab-benches';
const record = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, never>;
function loadProgress(): Pick<LabState, 'passed' | 'hintsUsed' | 'predictions' | 'picks'> {
  try {
    const v = JSON.parse(localStorage.getItem(MISSION_KEY) || '{}');
    return { passed: record(v.passed), hintsUsed: record(v.hintsUsed), predictions: record(v.predictions), picks: record(v.picks) };
  } catch { return { passed: {}, hintsUsed: {}, predictions: {}, picks: {} }; }   // progress just starts empty
}
export function saveProgress(s: Pick<LabState, 'passed' | 'hintsUsed' | 'predictions' | 'picks'>) {
  try { localStorage.setItem(MISSION_KEY, JSON.stringify({ passed: s.passed, hintsUsed: s.hintsUsed, predictions: s.predictions, picks: s.picks })); } catch { /* not saved, still counted for this visit */ }
}
function loadBenches(): { benches: Record<string, Item[]>; burnt: Record<string, string[]> } {
  try {
    const v = JSON.parse(localStorage.getItem(BENCH_KEY) || '{}');
    return { benches: v.benches && typeof v.benches === 'object' ? v.benches : {}, burnt: v.burnt && typeof v.burnt === 'object' ? v.burnt : {} };
  } catch { return { benches: {}, burnt: {} }; }
}
export function saveBenches(benches: Record<string, Item[]>, burnt: Record<string, string[]>) {
  try { localStorage.setItem(BENCH_KEY, JSON.stringify({ benches, burnt })); } catch { /* the bench just is not remembered */ }
}

const SKETCH_KEY = 'boardlab-sketches';
/** The sketches the student has changed, by mission key. */
function loadSketches(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SKETCH_KEY) || '{}');
    return Object.fromEntries(Object.entries(record(v)).filter(([, code]) => typeof code === 'string')) as Record<string, string>;
  } catch { return {}; }
}
let sketchTimer: ReturnType<typeof setTimeout> | undefined;
/** Saves the changed sketches a moment after the last keystroke, so typing does not write to storage on every key. */
export function saveSketches(edits: Record<string, string>, at = 400) {
  clearTimeout(sketchTimer);
  const write = () => { try { localStorage.setItem(SKETCH_KEY, JSON.stringify(edits)); } catch { /* the sketch is just not remembered */ } };
  if (at > 0) sketchTimer = setTimeout(write, at); else write();
}

const WIDTH_KEY = 'boardlab-panel-widths';
function loadWidths(): Widths {
  const px = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  try { const v = JSON.parse(localStorage.getItem(WIDTH_KEY) || '{}'); return { left: px(v?.left), right: px(v?.right) }; } catch { return USUAL_WIDTHS; }
}
export function saveWidths(widths: Widths) {
  try { localStorage.setItem(WIDTH_KEY, JSON.stringify(widths)); } catch { /* the widths just are not remembered */ }
}

const saved = loadBenches();
export const useLab = create<LabState>(() => ({
  page: 'home', labSeen: false, board: 'uno', mission: 0, tab: 'mission', panels: NO_PANELS, focusPanel: null, widths: loadWidths(), help: false, guide: null, hot: null, edits: loadSketches(), ...saved, undo: {}, redo: {},
  tool: null, pending: null, point: null, notice: null, drag: null, bbDrag: null, partDrag: null, sparks: 0, paused: false, line: null, cursor: null, frameTick: 0, probe: null,
  inputs: {}, ...loadProgress(), results: null, checking: false, asking: null,
  sound: false, ohms: 220, ledColor: LED_COLORS.red, bbSize: 'short', nav: 'pan', labels: true, running: false, errLine: null, serial: '',
}));

const NONE: Item[] = [], NONE_IDS: string[] = [];
export const boardOf = (s: LabState) => BOARDS[s.board];
export const missionOf = (s: LabState) => MISSIONS[s.board][s.mission];
export const keyOf = (s: LabState) => missionKey(s.board, missionOf(s).id);
export const codeOf = (s: LabState) => s.edits[keyOf(s)] ?? missionOf(s).starter;
/** The parts and wires the student has placed for the open lesson. */
export const benchOf = (s: LabState) => s.benches[keyOf(s)] ?? missionOf(s).start ?? NONE;
export const burntOf = (s: LabState) => s.burnt[keyOf(s)] ?? NONE_IDS;
