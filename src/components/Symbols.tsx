import type { ReactNode } from 'react';

/* --- circuit symbols for the parts, drawn on a 48 × 32 grid with the same round stroke as the icons --- */
export const SYMBOLS: Record<string, ReactNode> = {
  circuit: <><path d="M6 13V5h36v22H6v-10" /><path d="M1 13h10M3 17h6" /><path d="m23 2 3 3-3 3" /></>,
  breadboard: <><rect x="3" y="3" width="42" height="26" rx="3" /><rect x="20.5" y="6" width="7" height="10" rx="3.5" />{[10, 17, 24, 31, 38].flatMap(x => [9, 13, 19, 23].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" className="dot" />))}</>,
  led: <><path d="M2 18h14M30 18h16" /><path d="M16 10v16l14-8z" /><path d="M30 10v16" /><path d="m31 7 5-5m-3.5 0H36v3.5M37 9l5-5m-3.5 0H42v3.5" /></>,
  resistor: <path d="M2 16h9l2.5-6 5 12 5-12 5 12 5-12 2.5 6h9" />,
  button: <><path d="M2 24h10M36 24h10M10 16h28M24 16V6M19 6h10" /><circle cx="13.5" cy="24" r="1.5" /><circle cx="34.5" cy="24" r="1.5" /></>,
  knob: <><path d="M2 24h9l2.5-5 5 10 5-10 5 10 5-10 2.5 5h9" /><path d="M24 2v13m-4-4 4 4 4-4" /></>,
  buzzer: <><path d="M10 20a14 14 0 0 1 28 0z" /><path d="M18 20v10M30 20v10" /><path d="M40 6a9 9 0 0 1 3 6M37 9a5 5 0 0 1 2 4" /></>,
  sonar: <><rect x="3" y="9" width="42" height="18" rx="2" /><circle cx="14" cy="18" r="6" /><circle cx="34" cy="18" r="6" /><path d="M17 5a11 11 0 0 1 14 0" /></>,
  servo: <><rect x="3" y="11" width="30" height="16" rx="2" /><circle cx="25" cy="19" r="3" /><path d="m25 19 17-13" /><circle cx="42" cy="6" r="2" /></>,
  ldr: <><path d="M2 22h9l2.5-6 5 12 5-12 5 12 5-12 2.5 6h9" /><path d="M8 3l6 6m-4.5 0H14V4.5M17 1l6 6m-4.5 0H23V2.5" /></>,
  temp: <><rect x="20" y="2" width="8" height="18" rx="4" /><circle cx="24" cy="24" r="5" /><path d="M24 9v14" /></>,
  wire: <><path d="M5 24C8 6 22 4 24 16S38 28 43 8" /><circle cx="5" cy="24" r="2" className="dot" /><circle cx="43" cy="8" r="2" className="dot" /></>,
  boards: <><rect x="7" y="6" width="36" height="20" rx="2" /><rect x="20" y="11" width="10" height="10" rx="1" /><path d="M3 13h4M3 19h4" /><path d="M12 9.5h26M12 22.5h26" strokeDasharray="1.4 3.2" /></>,
  rgb: <><path d="M13 22v-8a11 11 0 0 1 22 0v8z" /><path d="M16 22v8M21.5 22v9M26.5 22v8M32 22v8" /><circle cx="19" cy="16" r="1.6" className="dot" /><circle cx="24" cy="11" r="1.6" className="dot" /><circle cx="29" cy="16" r="1.6" className="dot" /></>,
  slide: <><rect x="8" y="14" width="32" height="11" rx="2" /><rect x="12" y="7" width="10" height="7" rx="1.5" /><path d="M14 25v5M24 25v5M34 25v5" /></>,
  tilt: <><path d="M2 18h11M35 18h11" /><rect x="13" y="11" width="22" height="14" rx="7" /><circle cx="28.5" cy="18" r="3.2" className="dot" /></>,
  reed: <><path d="M2 16h8M38 16h8" /><rect x="10" y="9" width="28" height="14" rx="7" /><path d="M13 14.5h13M22 17.5h13" /></>,
  joystick: <><rect x="8" y="22" width="32" height="7" rx="2" /><path d="M24 22V13" /><circle cx="24" cy="8" r="5" /><path d="m5 9-3 3 3 3M43 9l3 3-3 3" /></>,
  pir: <><path d="M12 26a12 12 0 0 1 24 0z" /><path d="M7 26h34" /><path d="M5 6c3 3 3 8 0 11M43 6c-3 3-3 8 0 11" /></>,
  ir: <><rect x="3" y="9" width="12" height="14" rx="2" /><path d="M15 13h17m-4-3 4 3-4 3M32 21H15m4-3-4 3 4 3" /><path d="M39 4v24" /></>,
  soil: <><path d="M13 3h7v18l-3.5 7L13 21zM28 3h7v18l-3.5 7L28 21z" /><path d="M3 17h6M39 17h6M22 17h4" /></>,
  water: <><path d="M24 2c5 7 8 10 8 14a8 8 0 0 1-16 0c0-4 3-7 8-14z" /><path d="M4 29c4-3 8 3 12 0s8 3 12 0 8 3 12 0" /></>,
  gas: <><path d="M14 26a6.5 6.5 0 0 1 .5-13 8.5 8.5 0 0 1 16-2.5A7.5 7.5 0 0 1 35 26z" /><path d="M19 19h10M21 15h6" /></>,
  flame: <path d="M24 2c2 6 9 9 9 18a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 3 5 0-5 0-9 2-15z" />,
  touch: <><rect x="18" y="9" width="12" height="12" rx="2" /><path d="M13 7a12 12 0 0 0 0 16M35 7a12 12 0 0 1 0 16M8 3a18 18 0 0 0 0 24M40 3a18 18 0 0 1 0 24M24 21v9" /></>,
};
export function PartSymbol({ id }: { id: string }) {
  return SYMBOLS[id] ? <svg className="sym" viewBox="0 0 48 32" aria-hidden="true">{SYMBOLS[id]}</svg> : null;
}

