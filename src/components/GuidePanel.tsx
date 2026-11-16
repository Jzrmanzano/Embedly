import { useEffect, useRef, type ReactNode } from 'react';
import { chapterOf, GUIDE, GUIDE_GROUPS, type Block, type Chapter, type Figure } from '../data/guide';
import { openGuide } from '../state/actions';
import { useLab } from '../state/store';
import { html } from './MissionPanel';

/* --- the drawings --- */
const COLS = Array.from({ length: 14 }, (_, i) => 30 + i * 20);
const TOP = [52, 66, 80, 94, 108], BOTTOM = [132, 146, 160, 174, 188], RAILS: [number, string, string][] = [[14, '+', 'f-pwr'], [28, '−', 'f-ink'], [212, '+', 'f-pwr'], [226, '−', 'f-ink']];

function Breadboard() {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="A breadboard seen from above. In each column the holes a to e are joined, and f to j are joined separately. The rails along the top and bottom are joined along their length.">
      <rect x="1" y="1" width="318" height="238" rx="8" className="f-board" />
      {RAILS.map(([y, sign, cls]) => (
        <g key={y}>
          <line x1={COLS[0]} y1={y} x2={COLS[13]} y2={y} className={`f-line ${cls}`} />
          <text x="306" y={y + 4} className="f-t" textAnchor="middle">{sign}</text>
        </g>
      ))}
      <rect x={COLS[3] - 8} y={TOP[0] - 8} width="16" height={TOP[4] - TOP[0] + 16} rx="8" className="f-line f-acc" />
      <rect x={COLS[3] - 8} y={BOTTOM[0] - 8} width="16" height={BOTTOM[4] - BOTTOM[0] + 16} rx="8" className="f-line f-blue" />
      {[...RAILS.map(r => r[0]), ...TOP, ...BOTTOM].map(y => COLS.map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" className="f-hole" />))}
      {[...TOP, ...BOTTOM].map((y, i) => <text key={y} x="12" y={y + 4} className="f-t f-mut" textAnchor="middle">{'abcdefghij'[i]}</text>)}
      <text x="190" y="124" className="f-t f-mut" textAnchor="middle">the gap: not joined across</text>
    </svg>
  );
}

function LedLoop() {
  return (
    <svg viewBox="0 0 320 120" role="img" aria-label="A loop: pin 13, then a 220 ohm resistor, then an LED with its long leg towards the pin and its short leg towards ground, then GND.">
      <path d="M52 50H92M148 50H186M214 50H262" className="f-line f-ink" />
      <rect x="6" y="36" width="46" height="28" rx="6" className="f-line f-acc" /><text x="29" y="54" className="f-t" textAnchor="middle">Pin 13</text>
      <rect x="92" y="40" width="56" height="20" rx="4" className="f-line f-ink" /><text x="120" y="30" className="f-t" textAnchor="middle">220 Ω</text>
      <path d="M186 36v28l28-14zM214 36v28" className="f-line f-pwr" />
      <path d="M204 30l8-10m-1 5 1-5-5 1M214 34l8-10m-1 5 1-5-5 1" className="f-line f-pwr f-thin" />
      <rect x="262" y="36" width="52" height="28" rx="6" className="f-fill" /><text x="288" y="54" className="f-t f-on" textAnchor="middle">GND</text>
      <text x="195" y="84" className="f-t" textAnchor="end">long leg +</text><text x="207" y="84" className="f-t">− short leg</text>
      <path d="M64 106h190m-8-5 8 5-8 5" className="f-line f-acc f-thin" /><text x="6" y="110" className="f-t f-mut">current</text>
    </svg>
  );
}

/** Four cycles of a square wave that is high for `duty` of each cycle. */
function wave(y: number, duty: number) {
  const x0 = 118, w = 46, h = 22;
  let d = `M${x0} ${y + h}`;
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * w;
    d += duty >= 1 ? `V${y}H${x + w}` : `V${y}H${x + w * duty}V${y + h}H${x + w}`;
  }
  return d;
}
const DUTIES: [string, string, number][] = [['analogWrite(pin, 64)', '25% on: dim', 0.25], ['analogWrite(pin, 127)', '50% on: half', 0.5], ['analogWrite(pin, 255)', '100% on: full', 1]];

function Pwm() {
  return (
    <svg viewBox="0 0 320 132" role="img" aria-label="Three square waves. With 64 the pin is on for a quarter of each cycle, with 127 for half, and with 255 all the time.">
      {DUTIES.map(([code, label, duty], i) => (
        <g key={code}>
          <text x="4" y={20 + i * 42} className="f-t">{code.replace('analogWrite(pin, ', '').replace(')', '')}</text>
          <text x="4" y={34 + i * 42} className="f-t f-mut">{label}</text>
          <path d={wave(10 + i * 42, duty)} className="f-line f-acc" />
        </g>
      ))}
    </svg>
  );
}

const FIGURES: Record<Figure, () => ReactNode> = { breadboard: Breadboard, led: LedLoop, pwm: Pwm };

/* --- a chapter --- */
function BlockView({ b }: { b: Block }) {
  if ('p' in b) return <p {...html(b.p)} />;
  if ('list' in b) return <ul>{b.list.map((x, i) => <li key={i} {...html(x)} />)}</ul>;
  if ('tip' in b) return <p className="g-tip" {...html(b.tip)} />;
  if ('code' in b) return (
    <div className="g-code">
      <pre tabIndex={0} aria-label="Example code">{b.code}</pre>
      {b.prints && <pre className="g-out" tabIndex={0} aria-label="What it prints"><b>Serial monitor</b>{'\n' + b.prints.trimEnd()}</pre>}
    </div>
  );
  if ('table' in b) return (
    <table className="g-table">
      <thead><tr><th>{b.head[0]}</th><th>{b.head[1]}</th></tr></thead>
      <tbody>{b.table.map(([k, v], i) => <tr key={i}><td {...html(k)} /><td {...html(v)} /></tr>)}</tbody>
    </table>
  );
  const Fig = FIGURES[b.fig];
  return <figure className="g-fig"><Fig /><figcaption>{b.caption}</figcaption></figure>;
}

function Contents() {
  return (
    <>
      <p className="place">Guide</p>
      <h2>How it all works</h2>
      <p>Short explanations of the code and the parts, with examples you can type into the editor. Read them in order, or jump to the one you need.</p>
      {GUIDE_GROUPS.map(([group, label, about]) => (
        <section key={group} aria-label={label}>
          <h3>{label}</h3>
          <p className="muted">{about}</p>
          <ol className="g-toc">
            {GUIDE.filter(c => c.group === group).map(c => (
              <li key={c.id}><button type="button" onClick={() => openGuide(c.id)}><b>{c.title}</b><small>{c.lede}</small></button></li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}

function ChapterView({ chapter }: { chapter: Chapter }) {
  const at = GUIDE.indexOf(chapter), prev = GUIDE[at - 1], next = GUIDE[at + 1];
  const group = GUIDE_GROUPS.find(g => g[0] === chapter.group)![1], inGroup = GUIDE.filter(c => c.group === chapter.group);
  return (
    <article>
      <p className="actions g-back"><button type="button" onClick={() => openGuide(null)}>← All topics</button></p>
      <p className="place">{group} · {inGroup.indexOf(chapter) + 1} of {inGroup.length}</p>
      <h2>{chapter.title}</h2>
      <p className="g-lede">{chapter.lede}</p>
      {chapter.blocks.map((b, i) => <BlockView key={i} b={b} />)}
      <nav className="actions g-next" aria-label="More topics">
        {prev && <button type="button" onClick={() => openGuide(prev.id)}>← {prev.title}</button>}
        {next && <button type="button" className="fwd" onClick={() => openGuide(next.id)}>{next.title} →</button>}
      </nav>
    </article>
  );
}

/** The guide: a contents page, and one chapter at a time. */
export function GuidePanel() {
  const id = useLab(s => s.guide), chapter = chapterOf(id);
  const body = useRef<HTMLDivElement>(null), shown = useRef(id);
  useEffect(() => {   // turning the page removes the button that was pressed, so the keyboard focus moves to the new page
    if (shown.current !== id) { shown.current = id; body.current?.focus(); }
  }, [id]);
  return (
    <section className="doc guide">
      {/* the key makes each page open scrolled to the top */}
      <div className="tabbody" key={id ?? 'contents'} ref={body} tabIndex={-1}>
        {chapter ? <ChapterView chapter={chapter} /> : <Contents />}
      </div>
    </section>
  );
}
