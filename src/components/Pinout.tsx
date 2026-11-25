import type { ReactNode } from 'react';
import { PINOUTS, type Tone } from '../data/pinouts';
import { bands } from '../data/resistor';
import type { ModuleKind, PartKind } from '../types';

/** Where the legs sit, side by side, for each part, and how far the body reaches either side of the middle. */
const MODULES: Record<ModuleKind, number> = { pir: 42, ir: 42, soil: 42, water: 42, gas: 42, flame: 42 };
const SPACING: Record<PartKind, number> = { led: 34, res: 112, wire: 44, button: 30, pot: 34, buzzer: 40, sonar: 46, pad: 0, servo: 36, ldr: 34, temp: 42, rgb: 30, slide: 34, tilt: 30, reed: 112, joy: 40, lcd: 34, breadboard: 44, ...MODULES };
const HALF: Record<PartKind, number> = { led: 20, res: 32, wire: 22, button: 62, pot: 38, buzzer: 28, sonar: 88, pad: 24, servo: 48, ldr: 26, temp: 34, rgb: 22, slide: 46, tilt: 17, reed: 32, joy: 92, lcd: 98, breadboard: 92, pir: 52, ir: 52, soil: 52, water: 52, gas: 52, flame: 52 };
const TOP = 64;   // where the body ends and the legs begin
/** Parts that lie down, with a lead out of each end. */
const LYING: PartKind[] = ['res', 'reed'];
/** The small board every sensor module is built on, with whatever is on its front. */
const board = (cx: number, color: string, front: ReactNode) => (<>
  <rect x={cx - 52} y="12" width="104" height={TOP - 12} rx="4" className={color} />
  {front}
</>);

/** The body of each part, drawn from the front and standing on its legs. `cx` is the middle. */
const BODY: Record<PartKind, (cx: number, ohms?: number) => ReactNode> = {
  led: cx => (<>
    <path d={`M${cx - 17} ${TOP} V38 a17 17 0 0 1 34 0 V${TOP}z`} className="pv-red" />
    <rect x={cx - 21} y={TOP - 4} width="42" height="6" rx="2" className="pv-metal" />
    <path d={`M${cx + 17} 40 V${TOP - 4}`} className="pv-flat" />
    <text x={cx + 24} y="44" className="pv-note">flat side</text>
  </>),
  res: (cx, ohms = 220) => (<>   {/* lying down, with a lead out of each end, as a resistor really is. The bands spell the value. */}
    <rect x={cx - 32} y="40" width="64" height="24" rx="12" className="pv-tan" />
    {bands(ohms).map((fill, i, all) => <rect key={i} x={cx + (i === all.length - 1 ? 22 : -24 + i * 8.5) - 2} y="41" width="4" height="22" fill={fill} stroke="none" />)}
  </>),
  wire: cx => <path d={`M${cx - 22} ${TOP + 22} V${TOP - 8} C${cx - 22} 4 ${cx + 22} 4 ${cx + 22} ${TOP - 8} V${TOP + 22}`} className="pv-wire" />,
  button: cx => (<>
    <rect x={cx - 62} y="30" width="124" height={TOP - 30} rx="6" className="pv-dark" />
    <rect x={cx - 62} y="30" width="124" height="6" rx="3" className="pv-metal" />
    <circle cx={cx} cy="26" r="13" className="pv-orange" />
  </>),
  pot: cx => (<>
    <rect x={cx - 38} y="26" width="76" height={TOP - 26} rx="5" className="pv-blue" />
    <circle cx={cx} cy="22" r="14" className="pv-light" />
    <path d={`M${cx} 22 L${cx + 8} 14`} className="pv-flat" />
  </>),
  buzzer: cx => (<>
    <rect x={cx - 28} y="22" width="56" height={TOP - 22} rx="6" className="pv-dark" />
    <ellipse cx={cx} cy="22" rx="28" ry="6" className="pv-dark2" />
    <path d={`M${cx - 18} 36 h10 M${cx - 13} 31 v10`} className="pv-plus" />
  </>),
  sonar: cx => (<>
    <rect x={cx - 88} y="14" width="176" height={TOP - 14} rx="4" className="pv-blue" />
    <circle cx={cx - 46} cy="36" r="17" className="pv-light" /><circle cx={cx + 46} cy="36" r="17" className="pv-light" />
    <circle cx={cx - 46} cy="36" r="8" className="pv-dark" /><circle cx={cx + 46} cy="36" r="8" className="pv-dark" />
  </>),
  pad: cx => <rect x={cx - 24} y="22" width="48" height={TOP - 22} rx="4" className="pv-copper" />,
  lcd: cx => (<>   {/* the display seen from the front, with its backpack's four pins along the bottom */}
    <rect x={cx - 98} y="6" width="196" height={TOP - 6} rx="4" className="pv-green" />
    <rect x={cx - 82} y="14" width="164" height="36" rx="2" className="pv-dark" />
    <rect x={cx - 76} y="19" width="152" height="26" rx="1" className="pv-glass" />
  </>),
  breadboard: cx => {   // seen from above: the + and − rails, then a to e, the gap and f to j. One column's two strips are ringed, as the guide draws them, over the legs that name them.
    const cols = Array.from({ length: 33 }, (_, i) => cx - 88 + i * 5.5), dot = (x: number, y: number) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#3b3f45" />;
    return (<>
      <rect x={cx - 92} y="2" width="184" height={TOP + 2} rx="4" className="pv-cream" />
      <path d={`M${cx - 88} 6.5 H${cx + 88}`} stroke="#d6453d" strokeWidth="1.2" />
      <path d={`M${cx - 88} 17.5 H${cx + 88}`} stroke="#3577d4" strokeWidth="1.2" />
      <rect x={cx - 92} y="40.5" width="184" height="3" fill="#d9d4c6" />
      {cols.flatMap(x => [10, 14, 21, 25, 29, 33, 37, 47, 51, 55, 59, 63].map(y => dot(x, y)))}
      <rect x={cx - 69} y="18" width="6" height="22.5" rx="3" fill="none" stroke="#e2572b" strokeWidth="1.6" />
      <rect x={cx - 25} y="43.5" width="6" height="22.5" rx="3" fill="none" stroke="#3577d4" strokeWidth="1.6" />
    </>);
  },
  servo: cx => (<>
    <rect x={cx - 48} y="20" width="96" height={TOP - 20} rx="4" className="pv-blue" />
    <rect x={cx - 58} y="26" width="116" height="6" className="pv-blue" />
    <circle cx={cx + 20} cy="18" r="9" className="pv-light" />
    <rect x={cx + 20} y="13" width="32" height="10" rx="5" className="pv-light" />
  </>),
  ldr: cx => (<>
    <circle cx={cx} cy="40" r="24" className="pv-tan" />
    <path d={`M${cx - 15} 33 h30 M${cx - 15} 40 h30 M${cx - 15} 47 h30`} className="pv-track" />
  </>),
  temp: cx => (<>
    <path d={`M${cx - 30} ${TOP} V38 a30 26 0 0 1 60 0 V${TOP}z`} className="pv-dark" />
    <path d={`M${cx - 22} 46 h44`} className="pv-flat light" />
    <text x={cx} y="40" className="pv-note light" textAnchor="middle">flat face</text>
  </>),
  rgb: cx => (<>
    <path d={`M${cx - 19} ${TOP} V36 a19 19 0 0 1 38 0 V${TOP}z`} className="pv-light" />
    <rect x={cx - 23} y={TOP - 4} width="46" height="6" rx="2" className="pv-metal" />
    <circle cx={cx - 8} cy="42" r="4" fill="#d6453d" /><circle cx={cx} cy="34" r="4" fill="#3aa655" /><circle cx={cx + 8} cy="42" r="4" fill="#3577d4" />
  </>),
  slide: cx => (<>
    <rect x={cx - 46} y="38" width="92" height={TOP - 38} rx="3" className="pv-dark" />
    <rect x={cx - 46} y="38" width="92" height="6" rx="3" className="pv-metal" />
    <rect x={cx - 26} y="24" width="20" height="14" rx="2" className="pv-light" />
  </>),
  tilt: cx => (<>
    <rect x={cx - 17} y="20" width="34" height={TOP - 20} rx="8" className="pv-metal" />
    <circle cx={cx} cy={TOP - 12} r="7" className="pv-dark2" />
  </>),
  reed: cx => (<>   {/* lying down like a resistor: a glass tube with two reeds that nearly touch */}
    <rect x={cx - 32} y="42" width="64" height="20" rx="10" className="pv-glass" />
    <path d={`M${cx - 30} 52 H${cx + 3} M${cx - 3} 55 H${cx + 30}`} className="pv-flat" />
  </>),
  joy: cx => (<>
    <rect x={cx - 92} y="30" width="184" height={TOP - 30} rx="4" className="pv-dark" />
    <rect x={cx - 26} y="22" width="52" height="14" rx="4" className="pv-dark2" />
    <ellipse cx={cx} cy="16" rx="24" ry="11" className="pv-dark2" />
    <ellipse cx={cx} cy="13" rx="15" ry="6" className="pv-light" />
  </>),
  pir: cx => board(cx, 'pv-green', <path d={`M${cx - 26} 46 a26 24 0 0 1 52 0z`} className="pv-light" />),
  ir: cx => board(cx, 'pv-blue', <><rect x={cx - 24} y="2" width="12" height="20" rx="6" className="pv-light" /><rect x={cx + 12} y="2" width="12" height="20" rx="6" className="pv-dark" /><rect x={cx - 9} y="34" width="18" height="18" rx="2" className="pv-dark2" /></>),
  soil: cx => board(cx, 'pv-dark', <><rect x={cx - 34} y="18" width="14" height="38" rx="3" className="pv-gold" /><rect x={cx + 20} y="18" width="14" height="38" rx="3" className="pv-gold" /></>),
  water: cx => board(cx, 'pv-pcbred', <path d={[-36, -24, -12, 0, 12, 24, 36].map(dx => `M${cx + dx} 18 V50`).join(' ')} className="pv-flat light" />),
  gas: cx => board(cx, 'pv-blue', <><circle cx={cx} cy="36" r="20" className="pv-metal" /><path d={`M${cx - 14} 30 h28 M${cx - 18} 36 h36 M${cx - 14} 42 h28`} className="pv-flat" /></>),
  flame: cx => board(cx, 'pv-pcbred', <><rect x={cx - 7} y="0" width="14" height="24" rx="7" className="pv-dark" /><rect x={cx - 9} y="34" width="18" height="18" rx="2" className="pv-dark2" /></>),
};

const TONE: Record<Tone, string> = { plus: 'pv-plus-leg', minus: 'pv-minus-leg', signal: 'pv-signal-leg', free: 'pv-free-leg' };

/** The pinout of a part: a drawing of it with each leg coloured and named, and a list saying where each leg goes. */
export function Pinout({ kind, ohms }: { kind: PartKind; ohms?: number }) {
  const p = PINOUTS[kind], n = p.legs.length, gap = SPACING[kind], half = HALF[kind];
  const W = Math.max(2 * half + 56, (n - 1) * gap + 90, kind === 'led' ? 170 : 0), cx = W / 2, H = 142;   // an LED has a note beside it, so it gets room
  const x = (i: number) => cx + (i - (n - 1) / 2) * gap;
  const lying = LYING.includes(kind);
  const end = (i: number) => (kind === 'led' ? (i === 0 ? 112 : 94) : kind === 'rgb' ? (i === 1 ? 112 : 96) : lying ? 92 : 104);   // an LED's + leg is the longer one, and so is an RGB LED's shared − leg
  /** A resistor's leads leave the ends of its body and turn down; every other leg stands straight under its part. */
  const leg = (i: number) => (lying ? `M${cx + (i ? 32 : -32)} 52 H${x(i)} V${end(i)}` : `M${x(i)} ${TOP} V${end(i)}`);
  return (
    <figure className="pinout">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.title}: ${p.legs.map(l => `${l.name} ${l.note}`).join(' ')}`}>
        {BODY[kind](cx, ohms)}
        {p.legs.map((l, i) => <path key={i} d={leg(i)} className={`pv-leg ${TONE[l.tone]}`} style={l.color ? { stroke: l.color } : undefined} />)}
        {p.legs.map((l, i) => {
          const w = Math.max(22, 10 + l.name.length * 8);
          return (
            <g key={i} className={`pv-chip ${TONE[l.tone]}`}>
              <rect x={x(i) - w / 2} y={end(i) + 6} width={w} height="22" rx="11" />
              <text x={x(i)} y={end(i) + 21} textAnchor="middle">{l.name}</text>
            </g>
          );
        })}
      </svg>
      <ol className="pv-legs">
        {p.legs.map((l, i) => <li key={i}><span className={`pv-name ${TONE[l.tone]}`}>{l.name}</span><span>{l.note}</span></li>)}
      </ol>
      <figcaption>{p.tip}</figcaption>
    </figure>
  );
}
