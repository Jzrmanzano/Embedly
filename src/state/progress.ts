/* Progress: how far along each board a student is, which mission to offer next, and a backup they can save to a file and restore later.
   No React and no storage in here: store.ts keeps the data in the browser, and this file only reads and checks it. */
import { isAvailable, missionKey, MISSIONS, type Mission } from '../data/missions';
import { CARDS, type CardId } from '../data/boardchoice';
import { BREADBOARD_COLS, CONTACT_KINDS, MODULE_KINDS, type BoardId, type Item } from '../types';
import type { PassRecord, PredictionRecord } from './store';
import { REACH } from './table';

/** What a backup file holds: everything the browser remembers about the student's work. */
export interface Progress {
  passed: Record<string, PassRecord>;
  hintsUsed: Record<string, number>;
  predictions: Record<string, PredictionRecord>;
  picks: Record<string, CardId>;
  benches: Record<string, Item[]>;
  burnt: Record<string, string[]>;
  /** Sketches the student has changed. */
  edits: Record<string, string>;
}
export interface Backup extends Progress { app: 'embedly'; version: 1; savedAt: string }

export const emptyProgress = (): Progress => ({ passed: {}, hintsUsed: {}, predictions: {}, picks: {}, benches: {}, burnt: {}, edits: {} });

/** The main quest: the missions that count towards progress, in the order they open along the road. A mission comes after every mission it needs, and missions that open at the same moment keep the order they are written in. The studio is free build, and repair jobs are side quests, so neither is on the road. */
export function graded(board: BoardId): Mission[] {
  const list = MISSIONS[board].filter(m => !m.sandbox && !m.repair), level = new Map<string, number>();
  for (const m of list) level.set(m.id, 1 + Math.max(-1, ...m.after.map(a => level.get(a) ?? 0)));   // every mission is written after the ones it needs
  return list.map((m, i) => [m, i] as const).sort((a, b) => level.get(a[0].id)! - level.get(b[0].id)! || a[1] - b[1]).map(([m]) => m);
}

/** The side quests: optional repair jobs. Each one opens when the mission it follows is passed. */
export const sideQuests = (board: BoardId): Mission[] => MISSIONS[board].filter(m => m.repair);
/** The side quests that branch off a mission. */
export const sidesOf = (board: BoardId, id: string): Mission[] => sideQuests(board).filter(m => m.after.includes(id));
/** How many side quests have been passed, out of how many. */
export function sideProgress(board: BoardId, passed: Record<string, unknown>): { done: number; total: number } {
  const list = sideQuests(board);
  return { done: list.filter(m => passed[missionKey(board, m.id)]).length, total: list.length };
}

/** How many of a board's main missions have been passed, out of how many. */
export function boardProgress(board: BoardId, passed: Record<string, unknown>): { done: number; total: number } {
  const list = graded(board);
  return { done: list.filter(m => passed[missionKey(board, m.id)]).length, total: list.length };
}

/** The main mission to go to next on a board: the first one that is open and not passed yet, or null when every one is passed. Side quests are never offered here. */
export function nextMission(board: BoardId, passed: Record<string, unknown>): Mission | null {
  const done = new Set(Object.keys(passed));
  return graded(board).find(m => !done.has(missionKey(board, m.id)) && isAvailable(board, m, done)) ?? null;
}

/* --- reading a backup. Nothing from the file is trusted: it is a text anybody could have edited. --- */
const MAX_ITEMS = 300, MAX_CODE = 40_000;
const known = new Set((Object.keys(MISSIONS) as BoardId[]).flatMap(b => MISSIONS[b].map(m => missionKey(b, m.id))));
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length < 40;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The text and number fields each kind of part must have, so that a part from a backup cannot break the bench. */
const FIELDS: Record<Item['t'], { s: string[]; n: string[] }> = {
  wire: { s: ['a', 'b', 'c'], n: [] }, led: { s: ['id', 'a', 'k'], n: ['color'] }, res: { s: ['a', 'b'], n: [] }, button: { s: ['id', 'ctl'], n: ['col'] },
  pot: { s: ['id', 'row', 'ctl'], n: ['col'] }, buzzer: { s: ['id', 'a', 'b'], n: [] }, sonar: { s: ['id', 'row', 'ctl'], n: ['col'] }, pad: { s: ['id', 'ctl'], n: [] },
  servo: { s: ['id', 'row'], n: ['col'] }, ldr: { s: ['id', 'a', 'b', 'ctl'], n: [] }, temp: { s: ['id', 'row', 'ctl'], n: ['col'] },
  rgb: { s: ['id', 'row'], n: ['col'] }, slide: { s: ['id', 'row', 'ctl'], n: ['col'] }, joy: { s: ['id', 'row', 'ctl'], n: ['col'] },
  contact: { s: ['id', 'kind', 'a', 'b', 'ctl'], n: [] }, module: { s: ['id', 'kind', 'row', 'ctl'], n: ['col'] }, lcd: { s: ['id'], n: [] },
  breadboard: { s: ['id', 'size'], n: [] },
};
/** The soil moisture sensor has no row and column: it stands in its pot on the table. */
const SOIL_FIELDS = { s: ['id', 'kind', 'ctl'], n: [] };
/** The kinds a part with a `kind` may be. */
const KINDS: Partial<Record<Item['t'], readonly string[]>> = { contact: CONTACT_KINDS, module: MODULE_KINDS };
const SIZES = Object.keys(BREADBOARD_COLS);
export function isItem(v: unknown): v is Item {
  if (!isObject(v) || typeof v.t !== 'string' || !Object.hasOwn(FIELDS, v.t)) return false;
  const soil = v.t === 'module' && v.kind === 'soil', f = soil ? SOIL_FIELDS : FIELDS[v.t as Item['t']], onTable = soil || v.t === 'breadboard';   // things put down on the table by x and z
  return f.s.every(k => str(v[k])) && f.n.every(k => num(v[k])) && (v.ohms === undefined || num(v.ohms)) && (KINDS[v.t as Item['t']]?.includes(v.kind as string) ?? true)
    && (v.t !== 'breadboard' || SIZES.includes(v.size as string)) && (!onTable || [v.x, v.z].every(n => n === undefined || (num(n) && Math.abs(n) <= REACH)));
}

function pick<T>(from: unknown, ok: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObject(from)) return out;
  for (const [key, v] of Object.entries(from)) {
    if (!known.has(key)) continue;   // a mission that does not exist (a newer or a different version)
    const clean = ok(v);
    if (clean !== null) out[key] = clean;
  }
  return out;
}

/** Cleans a saved record of progress, keeping only what makes sense. Used for the browser's own storage as well as for a backup file. */
export function cleanProgress(raw: unknown): Progress {
  const v = isObject(raw) ? raw : {};
  return {
    passed: pick(v.passed, r => (isObject(r) && num(r.at) && num(r.hints) && ['right', 'wrong', 'skipped'].includes(r.predicted as string) ? { at: r.at, hints: Math.max(0, Math.min(3, Math.round(r.hints))), predicted: r.predicted as PassRecord['predicted'] } : null)),
    hintsUsed: pick(v.hintsUsed, r => (num(r) ? Math.max(0, Math.min(3, Math.round(r))) : null)),
    predictions: pick(v.predictions, r => (isObject(r) && str(r.picked) && str(r.actual) && typeof r.right === 'boolean' ? { picked: r.picked, actual: r.actual, right: r.right } : null)),
    picks: pick(v.picks, r => (CARDS.some(c => c.id === r) ? (r as CardId) : null)),
    benches: pick(v.benches, r => (Array.isArray(r) && r.length <= MAX_ITEMS && r.every(isItem) ? (r as Item[]) : null)),
    burnt: pick(v.burnt, r => (Array.isArray(r) && r.length <= MAX_ITEMS && r.every(str) ? (r as string[]) : null)),
    edits: pick(v.edits, r => (typeof r === 'string' && r.length <= MAX_CODE ? r : null)),
  };
}

export function makeBackup(p: Progress, now = new Date()): string {
  const backup: Backup = { app: 'embedly', version: 1, savedAt: now.toISOString(), ...p };
  return JSON.stringify(backup, null, 1);
}

/** Reads the text of a backup file. */
export function parseBackup(text: string): { ok: true; progress: Progress } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That file could not be read. Choose a backup file that was saved from Embedly.' }; }
  if (!isObject(raw) || raw.app !== 'embedly') return { ok: false, error: 'That file is not an Embedly backup.' };
  if (raw.version !== 1) return { ok: false, error: 'That backup is from a different version of Embedly, so it cannot be read.' };
  return { ok: true, progress: cleanProgress(raw) };
}

/** A short summary of a backup, to say what was restored. */
export const describe = (p: Progress) => {
  const n = Object.keys(p.passed).length;
  return `${n} passed mission${n === 1 ? '' : 's'}, ${Object.keys(p.edits).length} saved sketch${Object.keys(p.edits).length === 1 ? '' : 'es'}`;
};
