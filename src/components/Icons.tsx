import type { ReactNode } from 'react';

/** The icons of the workshop: drawn on a 24 pixel grid with one round stroke, so they take the colour of the text around them. They are always decoration; the button carries the name. */
const PATHS = {
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  brief: <><path d="M9 4h6v3H9z" /><path d="M8 5.5H6.5A1.5 1.5 0 0 0 5 7v13a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7a1.5 1.5 0 0 0-1.5-1.5H16" /><path d="M8.5 12h7M8.5 16h4" /></>,
  parts: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><circle cx="16.5" cy="16.5" r="3.5" /></>,
  code: <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  book: <><path d="M12 7C10.4 5.6 7.8 5 4 5v13c3.8 0 6.4.6 8 2 1.6-1.4 4.2-2 8-2V5c-3.8 0-6.4.6-8 2z" /><path d="M12 7v13" /></>,
  play: <path d="M7 5v14l12-7z" fill="currentColor" />,
  step: <><path d="M5.5 5v14" /><path d="M10 5l9 7-9 7z" fill="currentColor" /></>,
  forward: <path d="m5 5 7 7-7 7M12 5l7 7-7 7" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-4" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h4" /></>,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  zoomIn: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5M11 8.5v5M8.5 11h5" /></>,
  zoomOut: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5M8.5 11h5" /></>,
  move: <path d="M12 3v18M3 12h18M12 3 9 6m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" />,
  rotate: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  top: <><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  fit: <><path d="M4 12a8 8 0 1 1 2.4 5.7" /><path d="M4 19v-5h5" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" fill="currentColor" /></>,
  volume: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" /></>,
  mute: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="m17 9 5 6M22 9l-5 6" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 17h.01" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  chip: <><path d="M9 3.5h1.5a1.5 1.5 0 0 0 3 0H15a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 9 3.5z" /><path d="M4 7.5h3.5M4 12h3.5M4 16.5h3.5M16.5 7.5H20M16.5 12H20M16.5 16.5H20" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  chevron:<path d="m9 6 6 6-6 6" />,
  wrench: <path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L10 20.8a2.1 2.1 0 0 1-3-3l9.4-9.4a4 4 0 0 0-1.9-1.9z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  wifi: <><path d="M2.5 9.5a13.5 13.5 0 0 1 19 0M5.6 12.8a9 9 0 0 1 12.8 0M8.8 16a4.5 4.5 0 0 1 6.4 0" /><circle cx="12" cy="19.2" r="1.1" fill="currentColor" /></>,
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  template: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M3.5 9h17M9 9v11" /><path d="M12.5 13h5M12.5 16.5h3" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}

/** The brand mark beside the name: a microcontroller on a rounded tile, the same drawing as the site's favicon.
    scripts/make-icons.mjs draws that one from the same shapes, so change both together. The chip is white on a --mark tile,
    which is a brighter orange in the dark theme, as the favicon is in a dark browser. */
export function BrandMark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="7" fill="currentColor" />
      <path className="mark-chip" d="M11.5 6h9a1.5 1.5 0 0 1 1.5 1.5v17a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-17a1.5 1.5 0 0 1 1.5-1.5zM6.5 8.7h3.5v2.6h-3.5zM22 8.7h3.5v2.6h-3.5zM6.5 14.7h3.5v2.6h-3.5zM22 14.7h3.5v2.6h-3.5zM6.5 20.7h3.5v2.6h-3.5zM22 20.7h3.5v2.6h-3.5z" />
      <circle cx="16" cy="6" r="2.1" fill="currentColor" />
    </svg>
  );
}
