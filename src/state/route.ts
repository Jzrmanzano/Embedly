/* The address bar hash says which page is showing: nothing for the home page, #guide or #guide/led for the guide, #boards for the board
   comparison, and #uno-beacon for a mission. */
import { chapterOf } from '../data/guide';

export type Page = 'home' | 'lab' | 'guide' | 'boards';
export type Route =
  | { page: 'home' }
  /** A chapter of the guide, or null for its contents page (also for a chapter that does not exist). */
  | { page: 'guide'; chapter: string | null }
  /** The five boards compared side by side. */
  | { page: 'boards' }
  /** The board and mission named in the hash, unchecked. Anything else that is not the home page or the guide opens the lab too. */
  | { page: 'lab'; board: string | null; mission: string | null };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === '') return { page: 'home' };
  const g = /^guide(?:\/([a-z0-9-]*))?$/.exec(h);
  if (g) return { page: 'guide', chapter: chapterOf(g[1] ?? null)?.id ?? null };
  if (h === 'boards') return { page: 'boards' };
  const m = /^([a-z0-9]+)-([a-z0-9]+)$/.exec(h);
  return { page: 'lab', board: m?.[1] ?? null, mission: m?.[2] ?? null };
}

/** The board comparison. */
export const BOARDS_HASH = '#boards';

/** The hash of the guide's contents page, or of one chapter. */
export const guideHash = (chapter: string | null) => (chapter ? `#guide/${chapter}` : '#guide');
