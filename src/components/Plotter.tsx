import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { PLOT_POINTS, plotOf, showValue, tickLabel, ticks } from '../sim/plotter';
import { useLab } from '../state/store';

/** The plot's height and the room around the lines, in pixels. The left margin grows with the longest tick label. */
const H = 116, TOP = 10, BOTTOM = 8, RIGHT = 14, CHAR = 6.6;
const colorOf = (s: number) => `var(--plot-${s + 1})`;

/** The Serial Plotter: the numbers the sketch prints, one line per reading, drawn as lines with the newest reading at the right.
    The Monitor view shows the same numbers as text. Point at the plot, or focus it and use the arrow keys, to read every series at one reading. */
export function Plotter() {
  const serial = useLab(s => s.serial);
  const plot = useMemo(() => plotOf(serial), [serial]);
  const box = useRef<HTMLDivElement>(null), [width, setWidth] = useState(320);
  /** The reading the crosshair is on, counted back from the newest, so it stays put on screen while new readings scroll past. */
  const [back, setBack] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current!, measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = plot.rows.length;
  const latest = plot.names.map((_, s) => { for (let i = n - 1; i >= 0; i--) if (plot.rows[i][s] != null) return { i, v: plot.rows[i][s]! }; return null; });
  if (!n) {
    return (
      <div className="plot" ref={box}>
        <p className="plot-empty">Numbers the sketch prints are drawn here, one line per reading. Name them to tell several apart: <code>Serial.print("light:");</code></p>
      </div>
    );
  }

  const values = plot.rows.flat().filter((v): v is number => v != null);
  const t = ticks(Math.min(...values), Math.max(...values)), axisMax = Math.max(Math.abs(t.lo), Math.abs(t.hi));
  const labels = t.values.map(v => tickLabel(v, t.step, axisMax));
  const left = 10 + CHAR * Math.max(...labels.map(l => l.length)), plotW = Math.max(40, width - left - RIGHT), step = plotW / (PLOT_POINTS - 1);
  const x = (i: number) => left + plotW - (n - 1 - i) * step;
  const y = (v: number) => TOP + (H - TOP - BOTTOM) * (1 - (v - t.lo) / (t.hi - t.lo));
  const path = (s: number) => {   // a gap where a reading has no value for this series
    let d = '', pen = false;
    plot.rows.forEach((row, i) => { const v = row[s]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const at = back == null ? null : Math.max(0, n - 1 - back);
  const hoverAt = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    setBack(Math.min(n - 1, Math.max(0, Math.round((left + plotW - px) / step))));
  };
  const keys = (e: KeyboardEvent) => {
    const cur = back ?? 0, move: Record<string, number> = { ArrowLeft: cur + 1, ArrowRight: cur - 1, Home: n - 1, End: 0 };
    if (e.key in move) { e.preventDefault(); e.stopPropagation(); setBack(Math.min(n - 1, Math.max(0, move[e.key]))); }   // the arrows would otherwise also slide the bench
    else if (e.key === 'Escape' && back != null) { e.stopPropagation(); setBack(null); }
  };
  const summary = `Plot of the last ${n} reading${n === 1 ? '' : 's'}. Latest: ${plot.names.map((name, s) => `${name} ${latest[s] ? showValue(latest[s]!.v) : 'none'}`).join(', ')}.`;
  const tipLeft = at == null ? 0 : x(at) > width * 0.6 ? undefined : x(at) + 10, tipRight = at == null || tipLeft !== undefined ? undefined : width - x(at) + 10;

  return (
    <div className="plot" ref={box}>
      <ul className="plot-legend" aria-label="Series">
        {plot.names.map((name, s) => (
          <li key={name}><i style={{ background: colorOf(s) }} aria-hidden="true" />{name} <b>{latest[s] ? showValue(latest[s]!.v) : '–'}</b></li>
        ))}
        {plot.hidden.length > 0 && <li className="plot-more">and {plot.hidden.length} more, not drawn</li>}
      </ul>
      <div
        className="plot-area" tabIndex={0} role="group" aria-label="Serial plot. Left and right arrows step through the readings." aria-describedby={at != null ? 'plot-tip' : undefined}
        onKeyDown={keys} onFocus={() => setBack(b => b ?? 0)} onBlur={() => setBack(null)}
      >
        <svg width={width} height={H} role="img" aria-label={summary} onPointerMove={hoverAt} onPointerLeave={() => setBack(null)}>
          {t.values.map((v, k) => (
            <g key={v}>
              <line className="plot-grid" x1={left} x2={left + plotW} y1={y(v)} y2={y(v)} />
              <text className="plot-tick" x={left - 6} y={y(v)} dy="0.32em" textAnchor="end">{labels[k]}</text>
            </g>
          ))}
          {at != null && <line className="plot-cross" x1={x(at)} x2={x(at)} y1={TOP - 4} y2={H - BOTTOM + 2} />}
          {plot.names.map((name, s) => <path key={name} d={path(s)} stroke={colorOf(s)} className="plot-line" />)}
          {plot.names.map((name, s) => {
            const p = at != null ? (plot.rows[at][s] != null ? { i: at, v: plot.rows[at][s]! } : null) : latest[s];
            return p && <circle key={name} cx={x(p.i)} cy={y(p.v)} r={4} fill={colorOf(s)} className="plot-dot" />;
          })}
        </svg>
        {at != null && (
          <div id="plot-tip" className="plot-tip" role="status" style={{ left: tipLeft, right: tipRight }}>
            <span className="plot-when">{back === 0 || at === n - 1 ? 'Latest reading' : `${n - 1 - at} reading${n - 1 - at === 1 ? '' : 's'} ago`}</span>
            {plot.names.map((name, s) => (
              <span key={name} className="plot-row"><i style={{ background: colorOf(s) }} aria-hidden="true" /><b>{plot.rows[at][s] != null ? showValue(plot.rows[at][s]!) : '–'}</b> {name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
