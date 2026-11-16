import { chapterOf } from '../data/guide';
import { setTab } from '../state/actions';
import { guideHash } from '../state/route';
import { boardOf, missionOf, useLab, type Tab } from '../state/store';
import type { Board } from '../types';
import { html, MissionPanel } from './MissionPanel';
import { SchematicView } from './SchematicView';

const TABS: [Tab, string][] = [['mission', 'Mission'], ['schematic', 'Schematic'], ['notes', 'Code notes'], ['board', 'Board']];

function Notes() {
  const m = useLab(missionOf);
  return (
    <>
      <h2>How the code works</h2>
      <ul>{m.how.map((x, i) => <li key={i} {...html(x)} />)}</ul>
      <h3>Explained in the guide</h3>
      <ul className="g-links">
        {m.guide.map(id => <li key={id}><a className="link" href={guideHash(id)}>{chapterOf(id)?.title ?? id}</a></li>)}
      </ul>
      <p className="actions"><a className="btn" href={guideHash(null)}>All topics</a><small>Every instruction and part, explained from the start.</small></p>
    </>
  );
}

function Reference({ board }: { board: Board }) {
  return (
    <>
      <h2>{board.name} reference</h2>
      <dl className="facts">{board.facts.map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
      {board.pinout.map(g => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          <div className="pins">
            {g.pins.map(([name, note, kind], i) => <span key={i} className={`pin ${kind ?? ''}`}><b>{name}</b>{note && <> <i>{note}</i></>}</span>)}
          </div>
        </div>
      ))}
    </>
  );
}

export function DocPanel() {
  const tab = useLab(s => s.tab), board = useLab(boardOf), mission = useLab(missionOf);
  return (
    <section className="doc">
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {/* the key makes each tab and mission open scrolled to the top */}
      <div className="tabbody" key={`${board.id}-${mission.id}-${tab}`}>
        {tab === 'mission' ? <MissionPanel /> : tab === 'schematic' ? <SchematicView /> : tab === 'notes' ? <Notes /> : <Reference board={board} />}
      </div>
    </section>
  );
}
