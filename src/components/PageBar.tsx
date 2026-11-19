/* The top bar of the pages away from the bench (the guide and the board comparison): the brand, where you are, the theme switch, and the way
   back to the mission that was open, or into the lab if none has been opened yet. */
import type { ReactNode } from 'react';
import { missionOf, useLab } from '../state/store';
import { BrandMark } from './Icons';
import { ThemeToggle } from './ThemeToggle';

export function PageBar({ crumb, backKey, here }: { crumb: ReactNode; backKey?: string; here: 'boards' | 'guide' }) {
  const board = useLab(s => s.board), mission = useLab(missionOf), seen = useLab(s => s.labSeen);
  const label = seen ? `Back to ${mission.title}` : 'Open the lab';
  return (
    <header className="bar guide-bar">
      <a className="brand" href="#" aria-label="Embedly. Back to the home page"><BrandMark /><h1>Embed<span>ly</span></h1></a>
      <div className="crumb">{crumb}</div>
      <nav className="site-nav" aria-label="Pages">
        <a href="#boards" aria-current={here === 'boards' ? 'page' : undefined}>Compare boards</a>
        <a href="#guide" aria-current={here === 'guide' ? 'page' : undefined}>Guide</a>
      </nav>
      <div className="guide-bar-end">
        <ThemeToggle />
        <a className="cta small" href={`#${board}-${mission.id}`} aria-keyshortcuts={backKey} title={backKey ? `${label} (${backKey})` : label}>
          {seen ? <><span className="wide">Back to {mission.title}</span><span className="narrow">Back to the bench</span></> : 'Open the lab'}
        </a>
      </div>
    </header>
  );
}
