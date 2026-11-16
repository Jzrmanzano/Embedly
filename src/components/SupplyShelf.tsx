/* The supply shelf: where a mission that asks for a board is answered, in place of the bench. Five boards side by side, drawn to the same scale
   and standing on the same line, each with what decides a choice. Choosing one marks every need as met or not, and says why. */
import { useEffect, type ReactNode } from 'react';
import { answersOf, CARDS, cardOf, fitsAll, meets, why, type BoardCard, type CardId, type Choice } from '../data/boardchoice';
import { escapePanel, pickBoard, setHelp, showGuide, togglePanel } from '../state/actions';
import { BOARDS_HASH } from '../state/route';
import { keyOf, missionOf, useLab } from '../state/store';
import { Notice } from './Stage';

/** Pixels per millimetre: every board is drawn at this one scale, so their sizes can be compared by eye. */
const MM = 2;

/** A header pin every 2.54 mm, as on the real boards. */
const pins = (n: number, x0: number, y: number) => Array.from({ length: n }, (_, i) => <rect key={`${y}-${i}`} className="pin" x={x0 + i * 2.54 - 0.5} y={y - 0.5} width={1} height={1} />);

/** What sits on each board, in millimetres from its top-left corner: the headers, the USB socket, and the chip or its metal shield. */
const PARTS_ON: Record<CardId, (l: number, w: number) => ReactNode> = {
  uno: (_l, w) => <>
    {pins(10, 18, 2)}{pins(8, 45, 2)}{pins(8, 27, w - 2)}{pins(6, 50, w - 2)}
    <rect className="metal" x={-2} y={8} width={16} height={12} rx={0.6} />
    <rect className="plastic" x={-2} y={37} width={13} height={9} rx={0.8} />
    <rect className="chip" x={30} y={30} width={35} height={9} rx={0.6} />
  </>,
  nano: (_l, w) => <>
    {pins(15, 4.4, 1.5)}{pins(15, 4.4, w - 1.5)}
    <rect className="metal" x={-1.5} y={5.5} width={6} height={7} rx={0.5} />
    <rect className="chip" x={20} y={5.5} width={7} height={7} rx={0.4} transform="rotate(45 23.5 9)" />
  </>,
  esp32: (l, w) => <>
    {pins(15, 7.5, 1.5)}{pins(15, 7.5, w - 1.5)}
    <rect className="metal" x={-1.5} y={10} width={6} height={8} rx={0.5} />
    <rect className="metal" x={27} y={6} width={17} height={16} rx={0.6} />
    <rect className="ant" x={44} y={6} width={l - 45.5} height={16} rx={0.6} />
  </>,
  d1mini: (_l, w) => <>
    {pins(8, 8, 1.5)}{pins(8, 8, w - 1.5)}
    <rect className="metal" x={-1} y={9} width={5} height={8} rx={0.5} />
    <rect className="metal" x={11} y={4.5} width={16} height={17} rx={0.6} />
    <rect className="ant" x={27} y={4.5} width={5.5} height={17} rx={0.6} />
  </>,
  c3: (l, w) => <>
    {pins(8, 2.6, 1.4)}{pins(8, 2.6, w - 1.4)}
    <rect className="metal" x={-1.5} y={6} width={6} height={6} rx={1} />
    <rect className="chip" x={9} y={6.5} width={5} height={5} rx={0.4} />
    <rect className="ant" x={l - 5.5} y={4} width={4.5} height={w - 8} rx={0.6} />
  </>,
};

/** A board in millimetres from its top-left corner, so it can be drawn at any scale. The board comparison lines all five up with it. */
export function BoardShape({ c }: { c: BoardCard }) {
  const [l, w] = c.size;
  return <g className={`bart ${c.id}`}><rect className="pcb" x={0} y={0} width={l} height={w} rx={1.5} />{PARTS_ON[c.id](l, w)}</g>;
}

function BoardArt({ c }: { c: BoardCard }) {
  const [l, w] = c.size;
  return (
    <svg className="bart-art" viewBox={`-2.5 -1 ${l + 3.5} ${w + 2}`} width={(l + 3.5) * MM} height={(w + 2) * MM} role="img" aria-label={`Drawn to scale: ${l} by ${w} millimetres`}>
      <BoardShape c={c} />
    </svg>
  );
}

function Card({ c, picked }: { c: BoardCard; picked: boolean }) {
  const [l, w] = c.size;
  return (
    <article className={picked ? 'bcard picked' : 'bcard'} aria-labelledby={`bcard-${c.id}`}>
      <div className="bcard-art"><BoardArt c={c} /></div>
      <h3 id={`bcard-${c.id}`}>{c.name}</h3>
      <p className="bcard-chip">{c.chip}</p>
      <p className="bcard-about">{c.about}{c.onBench && <> <b>It is on your bench.</b></>}</p>
      <dl className="bcard-facts">
        <div><dt>Runs at</dt><dd>{c.volts} V</dd></div>
        <div><dt>Wi-Fi</dt><dd>{c.wifi ? 'Yes' : 'No'}</dd></div>
        <div><dt>Bluetooth</dt><dd>{c.bluetooth ?? 'No'}</dd></div>
        <div><dt>Analog inputs</dt><dd>{c.analog}{c.analogNote && <small>{c.analogNote}</small>}</dd></div>
        <div><dt>Touch pins</dt><dd>{c.touch || 'None'}</dd></div>
        <div><dt>Size</dt><dd>{l} × {w} mm</dd></div>
        <div><dt>Uno shields</dt><dd>{c.shield ? 'Plug straight on' : 'Do not fit'}</dd></div>
      </dl>
      <button type="button" className="bcard-pick" aria-pressed={picked} onClick={() => pickBoard(c.id)}>{picked ? `${c.short} chosen` : `Choose the ${c.short}`}</button>
    </article>
  );
}

const count = (n: number) => ['no', 'one', 'two', 'three', 'four'][n] ?? String(n);
const names = (cards: BoardCard[]) => cards.map(c => `the ${c.short}`).join(' and ');

/** The needs, marked against the chosen board once there is one. */
export function NeedList({ choice, pick, className = 'checklist' }: { choice: Choice; pick: CardId | undefined; className?: string }) {
  const card = pick ? cardOf(pick) : null;
  return (
    <ul className={className}>
      {choice.needs.map(({ need, text }) => {
        const state = card ? (meets(card, need) ? 'pass' : 'fail') : 'todo';
        return (
          <li key={text} data-state={state}>
            <span className="mark" role="img" aria-label={state === 'todo' ? 'Not chosen yet' : state === 'pass' ? 'Met' : 'Not met'}>{state === 'todo' ? '○' : state === 'pass' ? '✓' : '✗'}</span>
            <span><b>{text}</b>{card && <small>{why(card, need)}</small>}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** What the choice comes to, in a sentence or two. */
export function verdict(choice: Choice, pick: CardId): { ok: boolean; text: string } {
  const card = cardOf(pick), ok = fitsAll(card, choice), others = answersOf(choice).filter(c => c.id !== pick);
  if (ok) return { ok, text: `The ${card.short} meets every need. ${others.length ? `${names(others).charAt(0).toUpperCase() + names(others).slice(1)} would work too.` : 'No other board here does.'}` };
  const missed = choice.needs.filter(x => !meets(card, x.need)).length;
  return { ok, text: `The ${card.short} misses ${count(missed)} of the needs. Choose another board.` };
}

/** The keys that make sense here: the panels, the guide, the help and Esc. The bench's own keys belong to the bench. */
function useShelfKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select') || document.querySelector('[aria-modal="true"]')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') escapePanel();
      else if (e.key === '?') setHelp(true);
      else if (e.shiftKey) return;
      else if (k === 'm') togglePanel('map');
      else if (k === 'b') togglePanel('brief');
      else if (k === 'g') showGuide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function SupplyShelf() {
  const m = useLab(missionOf), pick = useLab(s => s.picks[keyOf(s)]);
  useShelfKeys();
  if (!m.choice) return null;
  const v = pick ? verdict(m.choice, pick) : null;
  return (
    <section className="shelf" aria-labelledby="shelf-title">
      <div className="shelf-in">
        <header className="shelf-head">
          <p className="shelf-for">For the {m.place}</p>
          <h2 id="shelf-title">Which board for the {m.title.toLowerCase()}?</h2>
        </header>
        <div className="shelf-ask">
          <NeedList choice={m.choice} pick={pick} />
          <p className={v ? (v.ok ? 'shelf-verdict ok' : 'shelf-verdict no') : 'shelf-verdict'} aria-live="polite">
            {v ? v.text : 'Compare the boards below, then choose the one that meets every need.'}
          </p>
        </div>
        <p className="shelf-note">All five are drawn to the same scale. Only the Uno and the ESP32 are on this workshop’s bench; the other three are here to compare. <a href={BOARDS_HASH}>See them side by side in one table</a>.</p>
        <div className="shelf-cards">
          {CARDS.map(c => <Card key={c.id} c={c} picked={pick === c.id} />)}
        </div>
        <div className="shelf-notice"><Notice /></div>
      </div>
    </section>
  );
}
