/* Compare the boards: the five boards a school might buy, side by side, at #boards. First all five standing on one line at the same scale,
   each with its length marked under it as on a technical drawing. Then every line of their datasheets in one table, with a picker that fades
   out the boards a project could not use. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CARDS, meets, why, type BoardCard, type Need } from '../data/boardchoice';
import { guideHash } from '../state/route';
import { PageBar } from './PageBar';
import { BoardShape } from './SupplyShelf';

/* --- the line-up --- */
const GAP = 14, PAD = 3;

/** Every board standing on one line at the same scale, with its length marked under it. */
function Lineup() {
  const tallest = Math.max(...CARDS.map(c => c.size[1])), base = tallest + 2;
  let x = PAD;
  const placed = CARDS.map(c => { const at = x; x += c.size[0] + GAP; return { c, at }; });
  const width = x - GAP + 12, height = base + 21;   // room at the end for the last name, which is wider than its board
  return (
    <figure className="lineup">
      <div className="lineup-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `calc(${width} * var(--mm))` }} role="img"
          aria-label={`The five boards drawn to the same scale: ${CARDS.map(c => `${c.name}, ${c.size[0]} by ${c.size[1]} mm`).join('; ')}.`}>
          <line className="lineup-floor" x1={0} y1={base} x2={width} y2={base} />
          {placed.map(({ c, at }) => {
            const [l, w] = c.size, y = base + 5;
            return (
              <g key={c.id}>
                <g transform={`translate(${at} ${base - w})`}><BoardShape c={c} /></g>
                <g className="lineup-dim">
                  <line x1={at} y1={y} x2={at + l} y2={y} />
                  <line x1={at} y1={y - 2} x2={at} y2={y + 2} />
                  <line x1={at + l} y1={y - 2} x2={at + l} y2={y + 2} />
                  <text x={at + l / 2} y={y + 6} textAnchor="middle">{l} mm</text>
                </g>
                <text className="lineup-name" x={at + l / 2} y={y + 14} textAnchor="middle">{c.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption>All five drawn at the same scale, standing on the same line. The width of each is in the table.</figcaption>
    </figure>
  );
}

/* --- what a project needs --- */
type Want = { wifi: boolean; bluetooth: boolean; volts5: boolean; touch: boolean; shield: boolean; analog: number };
const NONE: Want = { wifi: false, bluetooth: false, volts5: false, touch: false, shield: false, analog: 0 };
const CHIPS: [keyof Omit<Want, 'analog'>, string][] = [['wifi', 'Wi-Fi'], ['bluetooth', 'Bluetooth'], ['volts5', '5 V parts'], ['touch', 'Touch pins'], ['shield', 'Uno shields']];
const needsOf = (w: Want): Need[] => [
  ...(w.wifi ? [{ k: 'wifi' } as const] : []),
  ...(w.bluetooth ? [{ k: 'bluetooth' } as const] : []),
  ...(w.volts5 ? [{ k: 'volts5' } as const] : []),
  ...(w.touch ? [{ k: 'touch', n: 1 } as const] : []),
  ...(w.shield ? [{ k: 'shield' } as const] : []),
  ...(w.analog ? [{ k: 'analog', n: w.analog } as const] : []),
];
const names = (cards: BoardCard[]) => cards.length === 1 ? `the ${cards[0].name}` : `${cards.slice(0, -1).map(c => `the ${c.name}`).join(', ')} and the ${cards[cards.length - 1].name}`;

/* --- the table --- */
const ROWS: [label: string, about: string, cell: (c: BoardCard) => ReactNode][] = [
  ['Chip', 'The processor, and how fast it runs.', c => c.chip],
  ['Runs at', 'A 5 V part needs a 5 V board, or a level converter in between.', c => `${c.volts} V`],
  ['Wi-Fi', 'For talking to a phone or the internet over your Wi-Fi network.', c => (c.wifi ? 'Yes' : 'No')],
  ['Bluetooth', 'Lets a phone nearby find it without a network. LE uses little power.', c => c.bluetooth ?? 'No'],
  ['Analog inputs', 'One for each sensor read with analogRead().', c => <>{c.analog}{c.analogNote && <small>{c.analogNote}</small>}</>],
  ['Touch pins', 'Feel a finger on a bare pad with touchRead().', c => c.touch || 'None'],
  ['Size', 'Length by width. Measure the space it has to fit first.', c => `${c.size[0]} × ${c.size[1]} mm`],
  ['Uno shields', 'Add-on boards made for the Uno’s header layout.', c => (c.shield ? 'Plug straight on' : 'Do not fit')],
  ['In this workshop', 'Only these two can be built with on the bench.', c => (c.onBench ? <a href={`#${c.id}-tour`}>On the bench</a> : 'To compare')],
];

export function BoardsPage() {
  const [want, setWant] = useState<Want>(NONE), main = useRef<HTMLElement>(null);
  const needs = useMemo(() => needsOf(want), [want]);
  const ok = useMemo(() => new Set(CARDS.filter(c => needs.every(n => meets(c, n))).map(c => c.id)), [needs]);
  useEffect(() => { main.current?.focus({ preventScroll: true }); }, []);
  const out = (c: BoardCard) => (needs.length && !ok.has(c.id) ? 'out' : undefined);
  const fits = CARDS.filter(c => ok.has(c.id));
  return (
    <div className="guide-page boards-page">
      <a className="skip" href="#boards-main" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to the comparison</a>
      <PageBar here="boards" crumb={<b>Compare boards</b>} />
      <main id="boards-main" className="guide-main" ref={main} tabIndex={-1}>
        <div className="guide-doc wide cmp">
          <h2>Compare the boards</h2>
          <p className="g-lede">Five popular boards, side by side. Every one runs a sketch the same way; what changes is what each can connect to, and how much room it takes.</p>
          <Lineup />

          <section className="want" aria-labelledby="want-title">
            <h3 id="want-title">What does your project need?</h3>
            <div className="want-chips" role="group" aria-label="Needs">
              {CHIPS.map(([key, label]) => (
                <button key={key} type="button" className="want-chip" aria-pressed={want[key]} onClick={() => setWant(w => ({ ...w, [key]: !w[key] }))}>{label}</button>
              ))}
              <label className="want-analog">Analog inputs
                <select value={want.analog} onChange={e => setWant(w => ({ ...w, analog: +e.target.value }))}>
                  {[0, 2, 5, 8].map(n => <option key={n} value={n}>{n ? `at least ${n}` : 'any number'}</option>)}
                </select>
              </label>
              {needs.length > 0 && <button type="button" className="want-clear" onClick={() => setWant(NONE)}>Clear</button>}
            </div>
            <p className="want-result" aria-live="polite">
              {!needs.length ? 'Choose what your project needs, and the boards that cannot do it fade out of the table.'
                : fits.length ? `${fits.length === 1 ? 'One board meets' : `${fits.length} boards meet`} every need: ${names(fits)}.`
                : 'No board here meets all of these. Drop a need, or look further than these five.'}
            </p>
          </section>

          <div className="cmp-scroll" role="region" aria-label="The five boards compared" tabIndex={0}>
            <table className="cmp-table">
              <thead>
                <tr><td />{CARDS.map(c => <th key={c.id} scope="col" className={out(c)}>{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {ROWS.map(([label, about, cell]) => (
                  <tr key={label}>
                    <th scope="row"><b>{label}</b><small>{about}</small></th>
                    {CARDS.map(c => <td key={c.id} className={out(c)}>{cell(c)}</td>)}
                  </tr>
                ))}
                {needs.length > 0 && (
                  <tr className="cmp-verdict">
                    <th scope="row"><b>Your project</b><small>Every need you chose above.</small></th>
                    {CARDS.map(c => {
                      const miss = needs.find(n => !meets(c, n));
                      return <td key={c.id} className={out(c)}>{miss ? <><span className="no">Misses</span><small>{why(c, miss)}</small></> : <span className="yes">Meets every need</span>}</td>;
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="cmp-more">What each line means, with examples: <a href={guideHash('boards')}>Choosing a board</a>, in the guide.</p>
        </div>
      </main>
    </div>
  );
}
