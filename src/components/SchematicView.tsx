/* The Schematic tab: the circuit on the bench drawn as a schematic, redrawn whenever the bench changes, with its LEDs lit and its
   buzzers sounding while the sketch runs. The layout comes from sim/schematic.ts; this only draws it. */
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { BUZZ_BODY, BUZZ_WAVES, isRay, LED_BODY, SYMBOLS, type SymbolName } from '../data/symbols';
import { layoutSchematic, tagWidth, UNIT, type BoxAt, type Mark, type PartAt, type Schematic } from '../sim/schematic';
import { currentReadout } from '../state/actions';
import { benchOf, useLab } from '../state/store';

/** A symbol with one of its legs at (x, y). `mirror` turns it left to right and `upside` top to bottom. `under` is drawn first, in the symbol's own units. */
function Sym({ name, x, y, leg = 0, mirror = false, upside = false, className = '', unit = UNIT, under, classOf }: {
  name: SymbolName; x: number; y: number; leg?: number; mirror?: boolean; upside?: boolean; className?: string; unit?: number;
  under?: ReactNode; classOf?: (points: [number, number][]) => string | undefined;
}) {
  const s = SYMBOLS[name], p = s.ports[leg];
  return (
    <g className={`sch-sym ${className}`} transform={`translate(${x} ${y}) scale(${mirror ? -unit : unit} ${upside ? unit : -unit}) translate(${-p.x} ${-p.y})`}>
      {under}
      {s.paths.map((q, i) => <polyline key={i} points={q.points.map(pt => pt.join(',')).join(' ')} className={[classOf?.(q.points), q.fill ? 'fill' : ''].filter(Boolean).join(' ') || undefined} />)}
      {s.circles.map((c, i) => <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r} className={c.fill ? 'fill' : undefined} />)}
    </g>
  );
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const LED_HALF = Math.abs(SYMBOLS.led.ports[1].x - SYMBOLS.led.ports[0].x) / 2;

/** An LED that lights up in its own colour. How bright it is comes in as --glow (0 to 1), set by useLive. */
function Led({ p }: { p: PartAt }) {
  const color = hex(p.color ?? 0xff3b30);
  return (
    <g className="sch-led" data-led={p.id} style={{ '--led': color } as CSSProperties}>
      <circle className="halo" cx={p.x + LED_HALF * UNIT} cy={p.y} r={24} fill={`url(#sch-halo-${color.slice(1)})`} />
      <Sym name="led" x={p.x} y={p.y} leg={p.flip ? 1 : 0} mirror={p.flip}
        under={<polygon className="body" points={LED_BODY.map(pt => pt.join(',')).join(' ')} />} classOf={pts => (isRay(pts) ? 'ray' : undefined)} />
    </g>
  );
}

const pts = (points: [number, number][]) => points.map(pt => pt.join(',')).join(' ');

/** A buzzer that fills in and sends out sound waves while it sounds, with its pitch underneath. Set by useLive. */
function Buzzer({ p }: { p: PartAt }) {
  const mid = p.x + (spanPx('buzzer') / 2);
  return (
    <g className="sch-buzz" data-buzz={p.id}>
      <Sym name="buzzer" x={p.x} y={p.y} leg={p.flip ? 1 : 0} mirror={p.flip}
        under={<><polygon className="body" points={pts(BUZZ_BODY)} />{BUZZ_WAVES.map((w, i) => <polyline key={i} className={`wave w${i % 2}`} points={pts(w)} />)}</>} />
      <text className="freq" x={mid} y={p.y + 20} textAnchor="middle" />
    </g>
  );
}

/** While the drawing is on screen, copies what the running sketch (or the moment picked on the Timeline) is doing onto it: how bright
    each LED is, the pitch of each buzzer, and the angle of each servo. Only those few elements change, so the drawing is not redrawn. */
function useLive(svg: RefObject<SVGSVGElement | null>, any: boolean) {
  useEffect(() => {
    if (!any) return;
    let frame = 0;
    const shown = new Map<Element, number>();
    /** Where each servo has been told to go and where its needle is on the way there, kept by servo so a redraw does not lose them. */
    const arms = new Map<string, { target: number; at: number }>();
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const now = currentReadout();
      svg.current?.querySelectorAll<SVGGElement>('[data-led]').forEach(el => {
        const glow = now ? Math.round(now.ledGlow(el.dataset.led!) * 50) / 50 : 0;
        if (shown.get(el) === glow) return;
        shown.set(el, glow);
        el.style.setProperty('--glow', String(glow));
        el.classList.toggle('on', glow > 0.02);
      });
      svg.current?.querySelectorAll<SVGGElement>('[data-buzz]').forEach(el => {
        const hz = now ? Math.round(now.buzzFreq(el.dataset.buzz!)) : 0;
        if (shown.get(el) === hz) return;
        shown.set(el, hz);
        el.classList.toggle('on', hz > 0);
        el.querySelector('.freq')!.textContent = hz > 0 ? `${hz} Hz` : '';
      });
      svg.current?.querySelectorAll<SVGGElement>('[data-servo]').forEach(el => {
        const id = el.dataset.servo!, told = now ? now.servoAngle(id) : -1;   // -1: no signal or no power, so it holds where it was, as on the bench
        const arm = arms.get(id) ?? { target: 90, at: 90 };
        if (told >= 0) arm.target = told;
        arm.at = calm || Math.abs(arm.target - arm.at) < 0.3 ? arm.target : arm.at + (arm.target - arm.at) * 0.18;   // a real servo takes a moment to get there
        arms.set(id, arm);
        if (el.classList.contains('on') !== told >= 0) el.classList.toggle('on', told >= 0);
        const needle = el.querySelector<SVGGElement>('.needle')!, turn = `rotate(${(-arm.at).toFixed(1)} ${needle.dataset.c})`;
        if (needle.getAttribute('transform') !== turn) needle.setAttribute('transform', turn);
        const deg = el.querySelector('.deg')!, text = `${Math.round(arm.target)}°`;
        if (deg.textContent !== text) deg.textContent = text;
      });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [svg, any]);
}

const spanPx = (name: SymbolName) => Math.abs(SYMBOLS[name].ports[1].x - SYMBOLS[name].ports[0].x) * UNIT;
/** How far a symbol reaches above its legs, in pixels, so its label clears it (and a buzzer's sound waves). */
const above = (name: SymbolName) => {
  const s = SYMBOLS[name], drawn = s.paths.flatMap(q => q.points);
  const top = Math.max(...drawn.map(pt => pt[1]), ...(name === 'buzzer' ? BUZZ_WAVES.flat().map(pt => pt[1]) : []));
  return (top - s.ports[0].y) * UNIT;
};

function MarkView({ m }: { m: Mark }) {
  const [x, y] = m.at;
  switch (m.kind) {
    case 'ground': return <Sym name="ground" x={x} y={y} upside={m.dir === 'up'} />;
    case 'supply': return (
      <g className="sch-pwr">
        <Sym name="supply" x={x} y={y} upside={m.dir === 'down'} />
        <text x={x} y={m.dir === 'down' ? y + 24 : y - 16} textAnchor="middle">{m.text}</text>
      </g>
    );
    case 'open': return <circle className="sch-open" cx={x} cy={y} r={3.5} />;
    case 'dot': return <circle className="sch-dot" cx={x} cy={y} r={3} />;
    case 'tag': {
      const w = tagWidth(m.text ?? ''), h = 16;
      const [bx, by, stem] = m.dir === 'left' ? [x - 6 - w, y - h / 2, [x - 6, y]] : m.dir === 'up' ? [x - w / 2, y - 10 - h, [x, y - 10]] : m.dir === 'down' ? [x - w / 2, y + 10, [x, y + 10]] : [x + 6, y - h / 2, [x + 6, y]];
      return (
        <g className="sch-tag">
          <line x1={x} y1={y} x2={stem[0]} y2={stem[1]} />
          {m.dir === 'up' && <circle cx={x} cy={y} r={3} />}
          <rect x={bx} y={by} width={w} height={h} rx={h / 2} />
          <text x={bx + w / 2} y={by + h / 2 + 3.5} textAnchor="middle">{m.text}</text>
        </g>
      );
    }
  }
}

/** A protractor in the servo's box: 0° points right, 90° up and 180° left, as the arm turns on the bench. useLive turns the needle. */
function Dial({ b }: { b: BoxAt }) {
  const r = 24, cx = b.x + b.w - 38, cy = b.pins[1].y + 10;
  const at = (deg: number, rr: number) => [cx + rr * Math.cos((deg * Math.PI) / 180), cy - rr * Math.sin((deg * Math.PI) / 180)];
  return (
    <g className="sch-servo" data-servo={b.id}>
      <path className="dial" d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`} />
      {[0, 45, 90, 135, 180].map(d => { const [x1, y1] = at(d, r - 5), [x2, y2] = at(d, r); return <line key={d} className="tick" x1={x1} y1={y1} x2={x2} y2={y2} />; })}
      <g className="needle" data-c={`${cx} ${cy}`} transform={`rotate(-90 ${cx} ${cy})`}><line x1={cx} y1={cy} x2={cx + r - 3} y2={cy} /></g>
      <circle className="hub" cx={cx} cy={cy} r={3.5} />
      <text className="deg" x={cx} y={cy + 18} textAnchor="middle">90°</text>
    </g>
  );
}

function Drawing({ s }: { s: Schematic }) {
  const svg = useRef<SVGSVGElement>(null), leds = s.parts.filter(p => p.symbol === 'led');
  useLive(svg, s.parts.some(p => p.symbol === 'led' || p.symbol === 'buzzer') || s.boxes.some(b => b.kind === 'servo'));
  return (
    <svg ref={svg} className="sch" viewBox={`0 0 ${s.width} ${s.height}`} style={{ maxWidth: s.width, minWidth: Math.round(s.width * 0.8) }} role="img" aria-labelledby="sch-desc">
      <desc id="sch-desc">{s.text.join(' ')}</desc>
      <defs>
        {[...new Set(leds.map(p => hex(p.color ?? 0xff3b30)))].map(c => (
          <radialGradient key={c} id={`sch-halo-${c.slice(1)}`}>
            <stop offset="0" stopColor={c} stopOpacity={0.55} />
            <stop offset="1" stopColor={c} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {s.boxes.map(b => (
        <g key={b.id} className={b.side === 'right' ? 'sch-box board' : 'sch-box'}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} />
          <text className="sch-title" x={b.side === 'right' ? b.x + 8 : b.x} y={b.side === 'right' ? b.y + 18 : b.y - 8}>{b.title}</text>
          {b.pins.map(p => <text key={p.name} className="sch-pin" x={b.side === 'right' ? b.x + b.w - 8 : b.x + 8} y={p.y + 4} textAnchor={b.side === 'right' ? 'end' : 'start'}>{p.name}</text>)}
          {b.kind === 'servo' && <Dial b={b} />}
        </g>
      ))}
      {s.lines.map((l, i) => <polyline key={i} className="sch-w" points={l.map(p => p.join(',')).join(' ')} />)}
      {s.parts.map(p => (
        <g key={p.id}>
          {p.symbol === 'led' ? <Led p={p} /> : p.symbol === 'buzzer' ? <Buzzer p={p} /> : <Sym name={p.symbol} x={p.x} y={p.y} leg={p.flip ? 1 : 0} mirror={p.flip} />}
          <text className="sch-t" x={p.x + (Math.abs(SYMBOLS[p.symbol].ports[1].x - SYMBOLS[p.symbol].ports[0].x) * UNIT) / 2} y={p.y - above(p.symbol) - 6} textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {s.knobs.map(k => (
        <g key={k.id}>
          <Sym name="knob" x={k.x} y={k.y} leg={2} />
          <text className="sch-t" x={k.x + 0.4 * UNIT + 16} y={k.y + 4}>{k.label}</text>
        </g>
      ))}
      {s.pads.map(p => (
        <g key={p.id} className="sch-pad">
          <rect x={p.at[0]} y={p.at[1] - 11} width={22} height={22} rx={3} />
          <path d={`M${p.at[0] + 6} ${p.at[1] + 6}l10-10M${p.at[0] + 6} ${p.at[1] - 2}l4-4M${p.at[0] + 12} ${p.at[1] + 6}l4-4`} />
          <text className="sch-t" x={p.at[0] + 11} y={p.at[1] - 18} textAnchor="middle">touch pad</text>
        </g>
      ))}
      {s.marks.map((m, i) => <MarkView key={i} m={m} />)}
    </svg>
  );
}

/** What the symbols mean, for the ones in this drawing. */
function Key({ s }: { s: Schematic }) {
  const has = (k: Mark['kind']) => s.marks.some(m => m.kind === k);
  const supplies = [...new Set(s.marks.filter(m => m.kind === 'supply').map(m => m.text))].join(', ');
  const rows: [string, ReactNode, string][] = [];
  if (has('ground')) rows.push(['ground', <Sym name="ground" x={14} y={3} unit={36} />, 'Ground (GND): the way back to the board.']);
  if (has('supply')) rows.push(['supply', <g className="sch-pwr"><Sym name="supply" x={14} y={19} unit={48} /></g>, `Power from the board: ${supplies}.`]);
  if (has('open')) rows.push(['open', <circle className="sch-open" cx={14} cy={12} r={3.5} />, 'A leg or wire with nothing on the other end.']);
  if (has('tag')) rows.push(['tag', <g className="sch-tag"><rect x={4} y={4} width={20} height={16} rx={8} /><text x={14} y={15.5} textAnchor="middle">A</text></g>, 'Points with the same name are joined.']);
  if (has('dot')) rows.push(['dot', <><line className="sch-w" x1={2} y1={12} x2={26} y2={12} /><line className="sch-w" x1={14} y1={12} x2={14} y2={24} /><circle className="sch-dot" cx={14} cy={12} r={3} /></>, 'A dot joins the lines that meet there.']);
  if (!rows.length) return null;
  return (
    <ul className="sch-key">
      {rows.map(([k, icon, words]) => <li key={k}><svg viewBox="0 0 28 24" aria-hidden="true">{icon}</svg>{words}</li>)}
    </ul>
  );
}

/** What on the drawing comes alive while the sketch runs, said in words: ", and its LED lights up while the sketch runs". */
function lively(s: Schematic) {
  const count = (k: PartAt['symbol']) => s.parts.filter(p => p.symbol === k).length, leds = count('led'), buzzers = count('buzzer');
  const servos = s.boxes.filter(b => b.kind === 'servo').length;
  const what = [
    leds && (leds === 1 ? 'its LED lights up' : 'its LEDs light up'),
    buzzers && (buzzers === 1 ? 'its buzzer sounds' : 'its buzzers sound'),
    servos && (servos === 1 ? 'its servo turns' : 'its servos turn'),
  ].filter(Boolean) as string[];
  if (!what.length) return '';
  return `, and ${what.length > 1 ? `${what.slice(0, -1).join(', ')} and ${what[what.length - 1]}` : what[0]} while the sketch runs`;
}

export function SchematicView() {
  const board = useLab(s => s.board), items = useLab(benchOf);
  const s = useMemo(() => layoutSchematic(board, items), [board, items]);
  return (
    <>
      <h2>Schematic</h2>
      {s.empty ? (
        <p className="muted">Nothing is on the bench yet. Place a part from the tray and its schematic appears here, redrawn as you build.</p>
      ) : (
        <>
          <p className="muted">Your circuit as an electronics drawing. It is redrawn every time you change the bench{lively(s)}.</p>
          {s.shorted && <p className="sch-warn">Power is joined straight to ground, so this circuit is a short. Find the wire from a + row to a − row and remove it.</p>}
          <div className="sch-wrap"><Drawing s={s} /></div>
          <Key s={s} />
        </>
      )}
    </>
  );
}
