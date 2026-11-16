/* Which panels are open over the bench. The map and the mission brief take turns on the left, the code editor has the right side,
   and on a narrow screen only one of them is open at a time so the bench is never completely covered. (The guide is a page of its own.) */
export type Panel = 'map' | 'brief' | 'code';
export interface Panels {
  left: 'map' | 'brief' | null;
  right: 'code' | null;
  /** The panel opened most recently, which Escape closes first. */
  last: Panel | null;
}
export const NONE: Panels = { left: null, right: null, last: null };

export const isOpen = (p: Panels, name: Panel) => p.left === name || p.right === name;

export function openPanel(p: Panels, name: Panel, narrow: boolean): Panels {
  const next: Panels = narrow ? { left: null, right: null, last: name } : { ...p, last: name };
  if (name === 'code') next.right = 'code'; else next.left = name;
  return next;
}

export function closePanel(p: Panels, name: Panel): Panels {
  if (!isOpen(p, name)) return p;
  const next: Panels = { left: p.left === name ? null : p.left, right: p.right === name ? null : p.right, last: p.last };
  if (p.last === name) next.last = next.right ?? next.left;
  return next;
}

export const togglePanel = (p: Panels, name: Panel, narrow: boolean): Panels => (isOpen(p, name) ? closePanel(p, name) : openPanel(p, name, narrow));

/** What Escape does: closes the panel opened last, or whichever is open. */
export function closeTop(p: Panels): Panels {
  const top = p.last && isOpen(p, p.last) ? p.last : p.right ?? p.left;
  return top ? closePanel(p, top) : p;
}

/* --- how wide the side panels are --- */
export type Side = 'left' | 'right';
/** A width in pixels the student chose by dragging a panel's edge, or null for the usual width. */
export interface Widths { left: number | null; right: number | null }
export const USUAL_WIDTHS: Widths = { left: null, right: null };
/** A panel is never narrower than this, and it always leaves at least MIN_BENCH of the bench showing. */
export const MIN_WIDTH = 280, MIN_BENCH = 240;
/** With a panel open on each side, neither takes more than this share of the screen. The stylesheet holds them to the same share. */
export const SHARE = 0.46;

/** The widest a panel may be when the bench is `across` wide and the panel on the other side takes `other`. */
export const widestPanel = (across: number, other: number) => Math.max(MIN_WIDTH, Math.min(across - other - MIN_BENCH, other > 0 ? Math.floor(across * SHARE) : Infinity));
/** The width a panel gets when the student asks for `want`. */
export const clampWidth = (want: number, across: number, other: number) => Math.round(Math.min(Math.max(want, MIN_WIDTH), widestPanel(across, other)));
