import type { ReactNode } from 'react';
import { bands } from '../data/resistor';
import type { BreadboardSize, PartKind } from '../types';

/* --- the parts tray's pictures: each part drawn as it really looks, shaded like a product shot, so a student knows it when they hold one.
   Shading, metal, gold pins, mesh and holes are shared gradients and textures (PictureDefs), laid over each part's own flat colours,
   so an LED of any colour and a resistor of any value are shaded the same way. --- */

/** A metal lead or leg: grey, with a gleam down its middle. */
const lead = (d: string, w = 1.8) => (
  <g key={d}>
    <path d={d} className="pp-lead" strokeWidth={w} />
    <path d={d} className="pp-gleam" strokeWidth={w * 0.36} />
  </g>
);
/** A row of header pins on the edge of a module: a black plastic strip with gold pins standing out of it, down from `y` (or up, with `up`). */
const header = (xs: number[], y: number, len = 10, up = false) => (
  <g>
    {xs.map(x => <rect key={x} x={x - 0.85} y={up ? y - len : y} width="1.7" height={len} fill="url(#pp-gold)" />)}
    <rect x={xs[0] - 2.8} y={up ? y - 1.2 : y - 2.2} width={xs[xs.length - 1] - xs[0] + 5.6} height="3.4" rx="0.6" fill="#1b1d21" />
  </g>
);
/** A circuit board with its sheen, and a plated hole in any corners asked for. */
const board = (x: number, y: number, w: number, h: number, color: string, holes: [number, number][] = []) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="2.5" fill={color} />
    <rect x={x} y={y} width={w} height={h} rx="2.5" fill="url(#pp-sheen)" />
    {holes.map(([cx, cy]) => (
      <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r="2.5" fill="url(#pp-gold)" /><circle cx={cx} cy={cy} r="1.3" fill="#121418" /></g>
    ))}
  </g>
);
/** An LED's dome with its rim, standing on `base`: the body colour, then the shading over it, then a gleam. */
const dome = (cx: number, r: number, top: number, base: number, color: string, opacity = 0.93) => {
  const body = `M${cx - r} ${base} V${top + r} a${r} ${r} 0 0 1 ${2 * r} 0 V${base} z`;
  return (
    <g>
      <rect x={cx - r - 2.2} y={base - 0.6} width={2 * r + 4.4} height="5" rx="1.4" fill={color} />
      <rect x={cx - r - 2.2} y={base - 0.6} width={2 * r + 4.4} height="5" rx="1.4" fill="url(#pp-shade-v)" />
      <path d={body} fill={color} opacity={opacity} />
      <path d={body} fill="url(#pp-shade-v)" />
      <path d={`M${cx - r * 0.62} ${base - 6} V${top + r} a${r * 0.62} ${r * 0.62} 0 0 1 ${r * 0.42} ${-r * 0.56}`} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth={Math.max(1.4, r * 0.17)} strokeLinecap="round" />
    </g>
  );
};
/** A small blue trimmer with its white screw. */
const trimmer = (x: number, y: number, s = 14) => (
  <g>
    <rect x={x} y={y} width={s} height={s} rx="1.6" fill="#2f74d6" />
    <rect x={x} y={y} width={s} height={s} rx="1.6" fill="url(#pp-sheen)" />
    <circle cx={x + s / 2} cy={y + s / 2} r={s * 0.32} fill="#f1f1ec" />
    <path d={`M${x + s / 2 - s * 0.2} ${y + s / 2} h${s * 0.4} M${x + s / 2} ${y + s / 2 - s * 0.2} v${s * 0.4}`} stroke="#8d969f" strokeWidth="1.1" strokeLinecap="round" />
  </g>
);
const chip = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx="0.8" fill="#17191d" />;
const smd = (x: number, y: number, color: string) => <rect x={x} y={y} width="4.6" height="2.8" rx="0.6" fill={color} />;

/** The outline of a resistor's body: a bulge at each end where the caps are, narrower in the middle. */
const RES_BODY = 'M34 11 C28 11 27 14 27 20 C27 26 28 29 34 29 C38 29 40 27 43 27 H77 C80 27 82 29 86 29 C92 29 93 26 93 20 C93 14 92 11 86 11 C82 11 80 13 77 13 H43 C40 13 38 11 34 11 Z';
const BB_W: Record<BreadboardSize, number> = { short: 66, long: 126 };

interface Opts { tint: string; ohms: number; size: BreadboardSize }
interface Picture { vb: string | ((o: Opts) => string); draw: (o: Opts) => ReactNode }

const PICTURES: Record<PartKind, Picture> = {
  led: { vb: '8 4 44 96', draw: ({ tint }) => (<>
    {lead('M25.5 62 V78 L21.5 84 V97')}   {/* the + leg is the longer one, with a kink */}
    {lead('M34.5 62 V92')}
    {dome(30, 12.5, 17.5, 57, tint)}
    <path d="M26.5 56 v-9 l-3 -3 h4.5 v12 M33.5 56 v-12 h-2.5 l2 -3" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1.3" />
  </>) },
  rgb: { vb: '6 4 58 96', draw: () => (<>
    {lead('M27 61 V72 L19 82 V96')}{lead('M32 61 V98')}{lead('M38 61 V95')}{lead('M43 61 V72 L51 82 V96')}
    {dome(35, 14.5, 14.5, 56.5, '#eef2f5', 0.96)}
    <circle cx="29" cy="40" r="2.6" fill="#ff4d4d" opacity=".6" /><circle cx="35" cy="34" r="2.6" fill="#3ccf5a" opacity=".6" /><circle cx="41" cy="40" r="2.6" fill="#3f86ff" opacity=".6" />
  </>) },
  res: { vb: '0 6 120 28', draw: ({ ohms }) => {
    const c = bands(ohms), digits = c.length - 1, step = digits === 4 ? 7 : 8.5;
    return (<>
      {lead('M2 20 H118', 1.8)}
      <path d={RES_BODY} fill="#e2c48f" />
      <g clipPath="url(#pp-res-clip)">{c.map((fill, i) => <rect key={i} x={(i === digits ? 84 : 37 + i * step) - 2.2} y="8" width="4.4" height="24" fill={fill} />)}</g>
      <path d={RES_BODY} fill="url(#pp-shade-h)" />
    </>);
  } },
  wire: { vb: '4 4 92 60', draw: () => (<>
    <path d="M16 44 C16 6 84 6 84 44" fill="none" stroke="#f08a24" strokeWidth="5.5" />
    <path d="M16 44 C16 6 84 6 84 44" fill="none" stroke="#ffd09a" strokeWidth="1.3" strokeOpacity=".8" transform="translate(-0.8 -0.8)" />
    {[16, 84].map(x => (
      <g key={x}>
        <rect x={x - 1} y="53" width="2" height="9" fill="url(#pp-metal)" />
        <rect x={x - 4.5} y="41" width="9" height="13" rx="1" fill="#25282d" />
        <rect x={x - 3.4} y="42.2" width="1.8" height="10.6" rx="0.6" fill="#fff" opacity=".14" />
      </g>
    ))}
  </>) },
  breadboard: { vb: ({ size }) => `0 0 ${BB_W[size] + 4} 50.4`, draw: ({ size }) => {
    const w = BB_W[size], holes = (y: number, h: number) => <rect x="3.6" y={y} width={w - 3.2} height={h} fill="url(#pp-holes)" />;
    return (<>
      <rect x="2" y="2" width={w} height="46.4" rx="1.6" fill="#f4f3ef" />
      <rect x="2" y="2" width={w} height="46.4" rx="1.6" fill="url(#pp-sheen)" opacity=".6" />
      <path d={`M4 3.9 H${w}`} stroke="#d6453d" strokeWidth=".7" /><path d={`M4 10.5 H${w}`} stroke="#3577d4" strokeWidth=".7" />
      <path d={`M4 39.9 H${w}`} stroke="#3577d4" strokeWidth=".7" /><path d={`M4 46.5 H${w}`} stroke="#d6453d" strokeWidth=".7" />
      {holes(4.8, 4.8)}{holes(12, 12)}{holes(26.4, 12)}{holes(40.8, 4.8)}
      <rect x="2" y="24.2" width={w} height="2" fill="#dedbd2" />
    </>);
  } },
  button: { vb: '2 2 76 76', draw: () => (<>
    {[[4, 19], [4, 55], [66, 19], [66, 55]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="10" height="6" rx="1" fill="url(#pp-metal)" />)}
    <rect x="12" y="12" width="56" height="56" rx="3" fill="#2a2c30" />
    <rect x="15.5" y="15.5" width="49" height="49" rx="2" fill="url(#pp-metal)" />
    {[[20, 20], [60, 20], [20, 60], [60, 60]].map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="2.3" fill="#8d949b" /><circle cx={x} cy={y} r="1" fill="#5d646b" /></g>)}
    <circle cx="40" cy="40" r="15.5" fill="#1d1f23" />
    <circle cx="40" cy="40" r="13.5" fill="#e2572b" />
    <circle cx="40" cy="40" r="13.5" fill="url(#pp-dome)" />
  </>) },
  slide: { vb: '6 2 78 60', draw: () => (<>
    {lead('M30 44 V60')}{lead('M45 44 V60')}{lead('M60 44 V60')}
    <rect x="9" y="38" width="4" height="12" rx="1" fill="url(#pp-metal)" /><rect x="77" y="38" width="4" height="12" rx="1" fill="url(#pp-metal)" />
    <rect x="12" y="24" width="66" height="20" rx="2" fill="#2b2f36" />
    <rect x="12" y="24" width="66" height="20" rx="2" fill="url(#pp-shade-h)" />
    <rect x="28" y="6" width="12" height="17" rx="2" fill="#e9ebee" />
    <rect x="28" y="6" width="12" height="17" rx="2" fill="url(#pp-shade-v)" />
    <path d="M30 10.5h8M30 13.5h8M30 16.5h8" stroke="#b5bbc1" strokeWidth=".9" />
    <rect x="10" y="20" width="70" height="7" rx="1.5" fill="url(#pp-metal)" />
    <rect x="24" y="22" width="42" height="3" rx="1.5" fill="#3a3f46" />
    <rect x="29.5" y="21.5" width="9" height="4" rx="1" fill="#d9dce0" />
  </>) },
  pot: { vb: '8 8 64 82', draw: () => (<>
    {lead('M28 64 V88')}{lead('M40 64 V88')}{lead('M52 64 V88')}
    <rect x="14" y="30" width="52" height="36" rx="4" fill="#2f6db5" />
    <rect x="14" y="30" width="52" height="36" rx="4" fill="url(#pp-sheen)" />
    <circle cx="40" cy="34" r="20.5" fill="#c9ced4" />
    <circle cx="40" cy="34" r="20" fill="none" stroke="#9aa2aa" strokeWidth="2.4" strokeDasharray="1.1 1.5" />
    <circle cx="40" cy="34" r="15" fill="#eef0f2" />
    <circle cx="40" cy="34" r="20.5" fill="url(#pp-dome)" />
    <path d="M40 34 L49 24.5" stroke="#55606c" strokeWidth="2.6" strokeLinecap="round" />
  </>) },
  joy: { vb: '2 4 88 78', draw: () => (<>
    {header([30, 37, 44, 51, 58], 70, 10)}
    {board(4, 6, 84, 64, '#262b33', [[10, 12], [82, 12], [10, 64], [82, 64]])}
    <rect x="24" y="14" width="44" height="44" rx="3" fill="#121417" />
    <rect x="28" y="18" width="36" height="36" rx="2" fill="#1d2025" />
    <circle cx="46" cy="36" r="17" fill="#3a3f47" />
    <circle cx="46" cy="36" r="12" fill="none" stroke="#2a2e34" strokeWidth="1.3" />
    <circle cx="46" cy="36" r="6.5" fill="none" stroke="#2a2e34" strokeWidth="1.3" />
    <circle cx="46" cy="36" r="17" fill="url(#pp-dome)" />
  </>) },
  tilt: { vb: '6 4 38 86', draw: () => (<>
    {lead('M20 58 V88')}{lead('M30 58 V88')}
    <rect x="13" y="10" width="24" height="48" rx="5" fill="#b4bbc2" />
    <rect x="13" y="10" width="24" height="48" rx="5" fill="url(#pp-shade-v)" />
    <rect x="15" y="12" width="20" height="5" rx="2.5" fill="#fff" opacity=".35" />
    <rect x="12" y="53" width="26" height="7" rx="1.5" fill="#2b2f35" />
  </>) },
  reed: { vb: '0 6 120 28', draw: () => (<>
    {lead('M3 20 H36')}{lead('M84 20 H117')}
    <path d="M30 19 H63" stroke="#7d858e" strokeWidth="2" /><path d="M57 21.2 H90" stroke="#7d858e" strokeWidth="2" />
    <rect x="30" y="12" width="60" height="16" rx="8" fill="#d6efe6" opacity=".55" />
    <rect x="30" y="12" width="60" height="16" rx="8" fill="url(#pp-shade-h)" />
    <rect x="30" y="12" width="60" height="16" rx="8" fill="none" stroke="#97c4b4" strokeWidth=".8" />
    <path d="M37 15.6 H83" stroke="#fff" strokeOpacity=".75" strokeWidth="1.4" strokeLinecap="round" />
  </>) },
  pad: { vb: '8 2 64 90', draw: () => (<>
    {lead('M40 60 V90', 2.2)}
    <rect x="12" y="6" width="56" height="56" rx="7" fill="url(#pp-copper)" />
    {[22, 15, 8].map(r => <circle key={r} cx="40" cy="34" r={r} fill="none" stroke="#7a3f14" strokeOpacity=".22" strokeWidth="1.2" />)}
    <rect x="15" y="9" width="50" height="50" rx="5" fill="none" stroke="#fff" strokeOpacity=".3" />
    <circle cx="40" cy="59" r="3.2" fill="#c9ced3" />
  </>) },
  ldr: { vb: '6 6 48 84', draw: () => (<>
    {lead('M24 48 V88')}{lead('M36 48 V88')}
    <circle cx="30" cy="30" r="21" fill="#ead3a4" />
    <g clipPath="url(#pp-ldr-clip)">
      <rect x="9" y="9" width="6.5" height="42" fill="#cfd3d6" /><rect x="44.5" y="9" width="6.5" height="42" fill="#cfd3d6" />
      <path d="M15 15.5 H45 v4.5 H15 v4.5 H45 v4.5 H15 v4.5 H45 v4.5 H15 v4.5 H45 v4.5 H15" fill="none" stroke="#b4532a" strokeWidth="2.2" />
    </g>
    <circle cx="30" cy="30" r="21" fill="none" stroke="#c7a466" strokeWidth="1.4" />
    <circle cx="30" cy="30" r="21" fill="url(#pp-dome)" opacity=".7" />
  </>) },
  temp: { vb: '8 8 44 82', draw: () => (<>
    {lead('M22 54 V64 L18 70 V88')}{lead('M30 54 V88')}{lead('M38 54 V64 L42 70 V88')}
    <path d="M12 56 V30 a18 18 0 0 1 36 0 V56 z" fill="#2a2d32" />
    <path d="M12 56 V30 a18 18 0 0 1 36 0 V56 z" fill="url(#pp-shade-v)" />
    <text x="30" y="37" textAnchor="middle" className="pp-print">TMP</text>
    <text x="30" y="44.5" textAnchor="middle" className="pp-print">36</text>
  </>) },
  buzzer: { vb: '6 10 58 72', draw: () => (<>
    {lead('M29 52 V80')}{lead('M41 52 V75')}
    <rect x="10" y="24" width="50" height="28" rx="3" fill="#22252a" />
    <rect x="10" y="24" width="50" height="28" rx="3" fill="url(#pp-shade-v)" />
    <ellipse cx="35" cy="24" rx="25" ry="8" fill="#383c43" />
    <ellipse cx="35" cy="24.4" rx="21.5" ry="6.4" fill="#2a2e34" />
    <ellipse cx="35" cy="24.4" rx="3.6" ry="1.4" fill="#0b0c0e" />
    <path d="M16 36.5 h5.5 M18.75 33.75 v5.5" stroke="#ff5a4f" strokeWidth="1.5" strokeLinecap="round" />
  </>) },
  servo: { vb: '2 2 96 80', draw: () => (<>
    {[['#6b4226', 0], ['#d6332b', 2.3], ['#f28c28', 4.6]].map(([c, o]) => (
      <path key={c} d={`M17 ${40 + +o} C${6 + +o} ${40 + +o} ${6 + +o} ${58} ${12 + +o} ${66}`} fill="none" stroke={c as string} strokeWidth="2.3" />
    ))}
    <rect x="7" y="65" width="14" height="10" rx="1.2" fill="#1d1f23" transform="rotate(-38 14 70)" />
    <rect x="8" y="28" width="84" height="12" rx="2" fill="#2c64ad" />
    <circle cx="12.5" cy="34" r="1.9" fill="#163d6e" /><circle cx="87.5" cy="34" r="1.9" fill="#163d6e" />
    <rect x="16" y="16" width="68" height="36" rx="3" fill="#3a7bd0" />
    <rect x="16" y="16" width="68" height="36" rx="3" fill="url(#pp-sheen)" />
    <rect x="21" y="23" width="26" height="22" rx="1.2" fill="#2659a0" />
    <text x="34" y="36.5" textAnchor="middle" className="pp-print light">SG90</text>
    <circle cx="64" cy="34" r="11" fill="#2f6cc0" />
    <circle cx="64" cy="34" r="7.5" fill="#3d7dd6" />
    <g transform="rotate(-28 64 34)">
      <path d="M64 29.3 L92 31.4 a2.6 2.6 0 0 1 0 5.2 L64 38.7 a4.7 4.7 0 0 1 0 -9.4 z" fill="#f6f7f8" stroke="#ccd1d6" strokeWidth=".6" />
      {[72, 78, 84, 89.5].map(x => <circle key={x} cx={x} cy="34" r=".95" fill="#b3b9bf" />)}
    </g>
    <circle cx="64" cy="34" r="5.6" fill="#fafafa" stroke="#ccd1d6" strokeWidth=".6" />
    <circle cx="64" cy="34" r="1.9" fill="#9aa1a8" />
  </>) },
  sonar: { vb: '2 6 116 64', draw: () => (<>
    {header([54.2, 58.1, 62, 65.9], 56, 12)}
    {board(4, 8, 112, 48, '#1f63b0', [[9, 13], [111, 13], [9, 51], [111, 51]])}
    {[31, 89].map(cx => (
      <g key={cx}>
        <circle cx={cx} cy="32" r="21" fill="url(#pp-metal-r)" />
        <circle cx={cx} cy="32" r="16.5" fill="url(#pp-mesh)" />
        <circle cx={cx} cy="32" r="16.5" fill="url(#pp-dome)" opacity=".55" />
        <circle cx={cx} cy="32" r="21" fill="none" stroke="#6f777f" strokeWidth=".8" />
      </g>
    ))}
    <rect x="53" y="13" width="14" height="6" rx="3" fill="url(#pp-metal)" />
    {chip(54, 30, 12, 10)}
  </>) },
  pir: { vb: '4 2 82 82', draw: () => (<>
    {header([37, 45, 53], 70, 11)}
    {board(6, 4, 78, 66, '#2a8a4f', [[11, 9], [79, 9], [11, 65], [79, 65]])}
    <circle cx="45" cy="37" r="30" fill="#e2e2da" />
    <circle cx="45" cy="37" r="27" fill="#f5f5f0" />
    <circle cx="45" cy="37" r="27" fill="url(#pp-fresnel)" />
    {[20, 13, 6].map(r => <circle key={r} cx="45" cy="37" r={r} fill="none" stroke="#000" strokeOpacity=".06" strokeWidth="1" />)}
    <circle cx="45" cy="37" r="27" fill="url(#pp-dome)" opacity=".8" />
  </>) },
  ir: { vb: '6 0 58 100', draw: () => (<>
    {header([27, 35, 43], 84, 12)}
    {lead('M23.5 22 V30')}{lead('M27.5 22 V30')}{lead('M42.5 22 V30')}{lead('M46.5 22 V30')}
    {dome(25.5, 5, 4, 23, '#e8f1f6', 0.85)}
    {dome(44.5, 5, 4, 23, '#24272c', 1)}
    {board(8, 28, 54, 56, '#1f63b0')}
    {trimmer(28, 38)}
    {chip(14, 60, 12, 9)}
    {smd(46, 62, '#ff4a3d')}{smd(46, 68, '#3ddc6a')}
  </>) },
  soil: { vb: '8 0 44 110', draw: () => (<>
    {header([24, 30, 36], 13, 11, true)}
    <path d="M12 14 H48 V98 L42 106 L36 98 V46 H24 V98 L18 106 L12 98 Z" fill="#24282e" />
    <path d="M12 14 H48 V98 L42 106 L36 98 V46 H24 V98 L18 106 L12 98 Z" fill="url(#pp-sheen)" />
    <rect x="15.5" y="48" width="5" height="50" rx="2.5" fill="url(#pp-gold)" /><rect x="39.5" y="48" width="5" height="50" rx="2.5" fill="url(#pp-gold)" />
    {chip(25, 20, 10, 7)}
    {smd(16, 32, '#ff4a3d')}
    <circle cx="18" cy="42" r="2" fill="url(#pp-gold)" /><circle cx="42" cy="42" r="2" fill="url(#pp-gold)" />
  </>) },
  water: { vb: '8 0 44 102', draw: () => (<>
    {header([24, 30, 36], 13, 11, true)}
    {board(12, 14, 36, 86, '#b8322b')}
    {chip(16, 19, 8, 6)}{chip(29, 20, 11, 3.5)}{smd(42, 20, '#ff6b5e')}
    {[16, 20, 24, 28, 32, 36, 40, 44].map((x, i) => <path key={x} d={`M${x} ${i % 2 ? 34 : 31} V${i % 2 ? 96 : 93}`} stroke="#dcdcd6" strokeWidth="1.6" strokeLinecap="round" />)}
  </>) },
  gas: { vb: '2 4 76 78', draw: () => (<>
    {header([32, 40, 48], 70, 11)}
    {board(4, 6, 72, 64, '#1f63b0', [[9, 11], [71, 11], [9, 65], [71, 65]])}
    <circle cx="40" cy="38" r="23.5" fill="#b5864f" />
    <circle cx="40" cy="38" r="21.5" fill="url(#pp-metal-r)" />
    <circle cx="40" cy="38" r="17" fill="url(#pp-mesh)" />
    <circle cx="40" cy="38" r="17" fill="url(#pp-dome)" opacity=".6" />
    <circle cx="40" cy="38" r="17" fill="none" stroke="#7b838b" strokeWidth=".8" />
    {smd(64, 50, '#ff4a3d')}
  </>) },
  flame: { vb: '6 0 58 100', draw: () => (<>
    {header([27, 35, 43], 84, 12)}
    {lead('M33 22 V30')}{lead('M37 22 V30')}
    {dome(35, 5.5, 3, 23, '#1f2226', 1)}
    {board(8, 28, 54, 56, '#b8322b')}
    {trimmer(28, 38)}
    {chip(14, 60, 12, 9)}
    {smd(46, 62, '#ff4a3d')}{smd(46, 68, '#3ddc6a')}
  </>) },
  lcd: { vb: '0 2 132 60', draw: () => (<>
    {board(2, 4, 128, 56, '#2e8b57', [[7, 9], [125, 9], [7, 55], [125, 55]])}
    {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={22 + i * 2.6} cy="8.2" r=".85" fill="url(#pp-gold)" />)}
    <rect x="12" y="13" width="108" height="38" rx="1.5" fill="#1a1c1f" />
    <rect x="17" y="18" width="98" height="28" rx="1" fill="#a9d36c" />
    <rect x="17" y="18" width="98" height="28" rx="1" fill="url(#pp-shade-h)" opacity=".5" />
    <rect x="19" y="20" width="94" height="24" fill="url(#pp-cells)" />
    <text x="19.6" y="29.6" className="pp-lcd">Hello!</text>
  </>) },
};

/** The gradients and textures every picture shares. Drawn once, in the tray, as a picture's own colours are laid under them. */
export function PictureDefs() {
  return (
    <svg className="pp-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pp-shade-h" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" /><stop offset=".3" stopColor="#fff" stopOpacity=".1" /><stop offset=".62" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id="pp-shade-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".28" /><stop offset=".24" stopColor="#fff" stopOpacity=".32" /><stop offset=".48" stopColor="#fff" stopOpacity=".04" /><stop offset=".82" stopColor="#000" stopOpacity=".12" /><stop offset="1" stopColor="#000" stopOpacity=".36" />
        </linearGradient>
        <linearGradient id="pp-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset=".55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".2" />
        </linearGradient>
        <radialGradient id="pp-dome" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset=".35" stopColor="#fff" stopOpacity=".12" /><stop offset=".75" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" />
        </radialGradient>
        <linearGradient id="pp-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" /><stop offset=".45" stopColor="#c3c9cf" /><stop offset=".55" stopColor="#a6adb4" /><stop offset="1" stopColor="#dde1e5" />
        </linearGradient>
        <radialGradient id="pp-metal-r" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#9aa1a8" /><stop offset=".78" stopColor="#d9dde1" /><stop offset=".9" stopColor="#f4f6f8" /><stop offset="1" stopColor="#8f979f" />
        </radialGradient>
        <linearGradient id="pp-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b88a2a" /><stop offset=".45" stopColor="#f5d77f" /><stop offset="1" stopColor="#c4952f" />
        </linearGradient>
        <linearGradient id="pp-copper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eab07a" /><stop offset=".5" stopColor="#c27838" /><stop offset="1" stopColor="#e0a066" />
        </linearGradient>
        <pattern id="pp-holes" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><rect x=".7" y=".7" width="1" height="1" fill="#5a5e64" /></pattern>
        <pattern id="pp-mesh" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#9aa1a8" /><circle cx="1" cy="1" r=".62" fill="#3c4148" /></pattern>
        <pattern id="pp-fresnel" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .25H5M.25 0V5" stroke="#000" strokeOpacity=".08" strokeWidth=".5" /></pattern>
        <pattern id="pp-cells" x="19" y="20" width="5.875" height="12" patternUnits="userSpaceOnUse"><rect x=".45" y=".7" width="4.95" height="10.6" fill="#000" fillOpacity=".07" /></pattern>
        <clipPath id="pp-res-clip"><path d={RES_BODY} /></clipPath>
        <clipPath id="pp-ldr-clip"><circle cx="30" cy="30" r="19.6" /></clipPath>
      </defs>
    </svg>
  );
}

/** A part as the tray shows it. `tint` is an LED's colour, `ohms` a resistor's value (its bands), `size` a breadboard's length. */
export function PartPicture({ kind, tint = '#ff3b30', ohms = 220, size = 'short' }: { kind: PartKind; tint?: string; ohms?: number; size?: BreadboardSize }) {
  const p = PICTURES[kind], o = { tint, ohms, size };
  return <svg className={`pic pic-${kind}`} viewBox={typeof p.vb === 'string' ? p.vb : p.vb(o)} aria-hidden="true">{p.draw(o)}</svg>;
}
