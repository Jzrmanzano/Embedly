import { useEffect, useState } from 'react';
import { applyTheme, currentTheme, savedTheme, type Theme } from '../state/theme';
import { Icon } from './Icons';

/** Switches between the light and dark look. The button names the look it will switch to. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {   // until a choice is made, follow the system setting if it changes
    const media = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => { if (!savedTheme()) setTheme(currentTheme()); };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="toggle theme-toggle" title={`Switch to ${next} mode`} onClick={() => { applyTheme(next); setTheme(next); }}>
      <Icon name={next === 'light' ? 'sun' : 'moon'} /><span>{next === 'light' ? 'Light' : 'Dark'}</span><span className="sr-only"> mode</span>
    </button>
  );
}
