/* The guide: a page of its own at #guide, with the chapters listed down the side and one chapter at a time to read. */
import { useEffect, useRef, type ReactNode } from 'react';
import { chapterOf, GUIDE, GUIDE_GROUPS, type Block, type Chapter, type Figure, type GuideGroup } from '../data/guide';
import { backToBench } from '../state/actions';
import { guideHash } from '../state/route';
import { missionOf, useLab } from '../state/store';
import { Icon } from './Icons';
import { html } from './MissionPanel';
import { ThemeToggle } from './ThemeToggle';

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

/* --- circuit symbols for the parts, drawn on a 48 × 32 grid with the same round stroke as the icons --- */
const SYMBOLS: Record<string, ReactNode> = {
  circuit: <><path d="M6 13V5h36v22H6v-10" /><path d="M1 13h10M3 17h6" /><path d="m23 2 3 3-3 3" /></>,
  breadboard: <><rect x="3" y="3" width="42" height="26" rx="3" /><rect x="20.5" y="6" width="7" height="10" rx="3.5" />{[10, 17, 24, 31, 38].flatMap(x => [9, 13, 19, 23].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" className="dot" />))}</>,
  led: <><path d="M2 18h14M30 18h16" /><path d="M16 10v16l14-8z" /><path d="M30 10v16" /><path d="m31 7 5-5m-3.5 0H36v3.5M37 9l5-5m-3.5 0H42v3.5" /></>,
  resistor: <path d="M2 16h9l2.5-6 5 12 5-12 5 12 5-12 2.5 6h9" />,
  button: <><path d="M2 24h10M36 24h10M10 16h28M24 16V6M19 6h10" /><circle cx="13.5" cy="24" r="1.5" /><circle cx="34.5" cy="24" r="1.5" /></>,
  knob: <><path d="M2 24h9l2.5-5 5 10 5-10 5 10 5-10 2.5 5h9" /><path d="M24 2v13m-4-4 4 4 4-4" /></>,
  buzzer: <><path d="M10 20a14 14 0 0 1 28 0z" /><path d="M18 20v10M30 20v10" /><path d="M40 6a9 9 0 0 1 3 6M37 9a5 5 0 0 1 2 4" /></>,
  sonar: <><rect x="3" y="9" width="42" height="18" rx="2" /><circle cx="14" cy="18" r="6" /><circle cx="34" cy="18" r="6" /><path d="M17 5a11 11 0 0 1 14 0" /></>,
  servo: <><rect x="3" y="11" width="30" height="16" rx="2" /><circle cx="25" cy="19" r="3" /><path d="m25 19 17-13" /><circle cx="42" cy="6" r="2" /></>,
  touch: <><rect x="18" y="9" width="12" height="12" rx="2" /><path d="M13 7a12 12 0 0 0 0 16M35 7a12 12 0 0 1 0 16M8 3a18 18 0 0 0 0 24M40 3a18 18 0 0 1 0 24M24 21v9" /></>,
};
function PartSymbol({ id }: { id: string }) {
  return SYMBOLS[id] ? <svg className="sym" viewBox="0 0 48 32" aria-hidden="true">{SYMBOLS[id]}</svg> : null;
}

/* --- the contents --- */
const chaptersIn = (group: GuideGroup) => GUIDE.filter(c => c.group === group);
const CODE = chaptersIn('code'), PARTS = chaptersIn('parts');
const groupName = (group: GuideGroup) => GUIDE_GROUPS.find(g => g[0] === group)![1];
const groupAbout = (group: GuideGroup) => GUIDE_GROUPS.find(g => g[0] === group)![2];
/** "pinMode: giving a pin its job" is listed down the side as just "pinMode". */
const shortTitle = (c: Chapter) => c.title.split(':')[0];
const here = (on: boolean) => (on ? ('page' as const) : undefined);

/** The coding walkthrough is read in order, so it is drawn as one wire with a numbered pad for each step. */
function Path({ current, compact = false }: { current?: string | null; compact?: boolean }) {
  return (
    <ol className={compact ? 'g-path compact' : 'g-path'}>
      {CODE.map((c, i) => (
        <li key={c.id}>
          <a href={guideHash(c.id)} aria-current={here(c.id === current)}>
            <span className="pad" aria-hidden="true">{i + 1}</span>
            {compact ? <span>{shortTitle(c)}</span> : <><b>{c.title}</b><small>{c.lede}</small></>}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** The parts are looked up, not read in order, so they sit in a parts drawer: one bin each, marked with the part's circuit symbol. */
function Drawer({ current, compact = false }: { current?: string | null; compact?: boolean }) {
  return (
    <ul className={compact ? 'g-drawer compact' : 'g-drawer'}>
      {PARTS.map(c => (
        <li key={c.id}>
          <a href={guideHash(c.id)} aria-current={here(c.id === current)}>
            <PartSymbol id={c.id} />
            {compact ? <span>{shortTitle(c)}</span> : <><b>{c.title}</b><small>{c.lede}</small></>}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Every chapter, down the side of a chapter page on a wide screen. */
function ChapterList({ current }: { current: string }) {
  return (
    <nav className="guide-nav" aria-label="Chapters">
      <a className="gn-home" href={guideHash(null)}><Icon name="book" />All topics</a>
      <h2 className="gn-group">{groupName('code')}</h2>
      <Path current={current} compact />
      <h2 className="gn-group">{groupName('parts')}</h2>
      <Drawer current={current} compact />
    </nav>
  );
}

function Contents() {
  return (
    <>
      <h2>How it all works</h2>
      <p className="g-lede">Short explanations of the code and the parts, with examples you can type into the editor.</p>
      {/* side by side, or one above the other when there is not room */}
      <div className="g-groups">
        <section aria-labelledby="g-code">
          <h3 id="g-code">{groupName('code')}</h3>
          <p className="g-about">{groupAbout('code')} Start at the top: each step uses the ones before it.</p>
          <Path />
        </section>
        <section aria-labelledby="g-parts">
          <h3 id="g-parts">{groupName('parts')}</h3>
          <p className="g-about">{groupAbout('parts')} Look one up when it turns up in a mission.</p>
          <Drawer />
        </section>
      </div>
    </>
  );
}

/** Where a chapter sits: a step along the walkthrough's wire, or a part with its symbol. */
function ChapterHead({ chapter }: { chapter: Chapter }) {
  if (chapter.group === 'code') {
    const at = CODE.indexOf(chapter);
    return (
      <div className="g-head">
        <p className="g-step">
          <span className="g-wire" aria-hidden="true">{CODE.map((c, i) => <i key={c.id} className={i < at ? 'done' : i === at ? 'now' : undefined} />)}</span>
          Step {at + 1} of {CODE.length}
        </p>
        <h2>{chapter.title}</h2>
        <p className="g-lede">{chapter.lede}</p>
      </div>
    );
  }
  return (
    <div className="g-head part">
      <div className="g-plate"><PartSymbol id={chapter.id} /></div>
      <div>
        <h2>{chapter.title}</h2>
        <p className="g-lede">{chapter.lede}</p>
      </div>
    </div>
  );
}

/** What the link to the previous or next chapter says: a step, a part, or the move from one half of the guide to the other. */
function turnLabel(from: Chapter, to: Chapter, forward: boolean) {
  if (from.group !== to.group) return forward ? 'On to the parts' : 'Back to the code';
  if (to.group === 'code') return `Step ${CODE.indexOf(to) + 1}`;
  return forward ? 'Next part' : 'Previous part';
}

function ChapterView({ chapter }: { chapter: Chapter }) {
  const at = GUIDE.indexOf(chapter), prev = GUIDE[at - 1], next = GUIDE[at + 1];
  return (
    <article>
      <p className="g-back"><a href={guideHash(null)}><Icon name="chevron" className="flip" />All topics</a></p>
      <ChapterHead chapter={chapter} />
      {chapter.blocks.map((b, i) => <BlockView key={i} b={b} />)}
      <nav className="g-next" aria-label="More topics">
        {prev && <a className="prev" href={guideHash(prev.id)}><Icon name="chevron" className="flip" /><small>{turnLabel(chapter, prev, false)}</small><b>{prev.title}</b></a>}
        {next && <a className="fwd" href={guideHash(next.id)}><Icon name="chevron" /><small>{turnLabel(chapter, next, true)}</small><b>{next.title}</b></a>}
      </nav>
    </article>
  );
}

/* --- the page --- */
function GuideBar({ chapter }: { chapter: Chapter | null }) {
  const board = useLab(s => s.board), mission = useLab(missionOf), seen = useLab(s => s.labSeen);
  return (
    <header className="bar guide-bar">
      <a className="brand" href="#" aria-label="Embedly. Back to the home page"><Icon name="chip" className="mark" /><h1>Embed<span>ly</span></h1></a>
      <div className="crumb">
        {chapter ? <><a href={guideHash(null)}>Guide</a><Icon name="chevron" /><b>{chapter.title}</b></> : <b>Guide</b>}
      </div>
      <div className="guide-bar-end">
        <ThemeToggle />
        <a className="cta small" href={`#${board}-${mission.id}`} aria-keyshortcuts="G" title={seen ? `Back to ${mission.title} (G)` : 'Open the lab (G)'}>
          {seen ? <><span className="wide">Back to {mission.title}</span><span className="narrow">Back to the bench</span></> : 'Open the lab'}
        </a>
      </div>
    </header>
  );
}

/** The guide: its contents page, or one chapter. G goes back to the bench, as it came. */
export function GuidePage() {
  const id = useLab(s => s.guide), chapter = chapterOf(id), main = useRef<HTMLElement>(null);
  useEffect(() => {   // each page opens at the top. The focus moves to it too, unless the student is going down the list of chapters.
    const el = main.current, now = document.activeElement;
    if (!el) return;
    el.scrollTop = 0;
    if (!(now instanceof HTMLElement && now.isConnected && now.closest('.guide-nav'))) el.focus({ preventScroll: true });
    document.querySelector('.guide-nav [aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key.toLowerCase() === 'g') { e.preventDefault(); backToBench(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="guide-page">
      <a className="skip" href="#guide-main" onClick={e => { e.preventDefault(); main.current?.focus(); }}>Skip to the text</a>
      <GuideBar chapter={chapter} />
      {/* the contents page is the list of chapters itself, so only a chapter has the list down the side */}
      <div className={chapter ? 'guide-body' : 'guide-body solo'}>
        {chapter && <ChapterList current={chapter.id} />}
        <main id="guide-main" className="guide-main" ref={main} tabIndex={-1}>
          <div className={chapter ? 'guide-doc' : 'guide-doc wide'} key={id ?? 'contents'}>{chapter ? <ChapterView chapter={chapter} /> : <Contents />}</div>
        </main>
      </div>
    </div>
  );
}
