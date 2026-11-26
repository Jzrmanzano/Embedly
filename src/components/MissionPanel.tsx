import { useEffect, useMemo, useRef, useState } from 'react';
import { chapterOf } from '../data/guide';
import { MISSIONS, missionKey, partIdOf, PARTS } from '../data/missions';
import { TEMPLATES, type Template } from '../data/templates';
import { WIRE_CSS, wiringRows } from '../data/wiring';
import { checkMission, fillAnswerCode, goTo, loadTemplate, revealHint, showAnswer, templateShown } from '../state/actions';
import { guideHash } from '../state/route';
import { benchOf, codeOf, missionOf, useLab } from '../state/store';
import { NeedList, verdict } from './SupplyShelf';

/** Mission text is trusted HTML from src/data, so inline <code> tags can be used in it. */
export const html = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });

/** "LED × 3 · Resistor × 3": the parts a template is built from, without its wires. */
const partsOf = (t: Template) => {
  const count = new Map<string, number>();
  for (const it of t.circuit) if (it.t !== 'wire') { const label = PARTS[partIdOf(it)].label; count.set(label, (count.get(label) ?? 0) + 1); }
  return [...count].map(([label, n]) => (n > 1 ? `${label} × ${n}` : label)).join(' · ');
};

/** The Open Studio's finished projects. Loading one replaces the bench and the sketch, so when there is work of the student's own there, it asks first. */
function Templates() {
  const board = useLab(s => s.board), ownWork = useLab(s => benchOf(s).length > 0 || codeOf(s) !== missionOf(s).starter), focus = useLab(s => s.templateFocus);
  const [asking, setAsking] = useState<string | null>(null), [lit, setLit] = useState<string | null>(null);
  const cards = useRef<Record<string, HTMLLIElement | null>>({});
  const load = (id: string) => { setAsking(null); loadTemplate(id); };
  useEffect(() => {   // the home page asked for this template: bring it into view, mark it for a moment, and put the keyboard on its Load button
    if (!focus) return;
    const card = cards.current[focus];
    if (card) {
      card.scrollIntoView({ block: 'center' });
      card.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
      setLit(focus);
    }
    templateShown();
  }, [focus]);
  useEffect(() => { if (!lit) return; const t = setTimeout(() => setLit(null), 2400); return () => clearTimeout(t); }, [lit]);
  return (
    <>
      <h3>Start from a template</h3>
      <p className="muted">Finished projects to try, take apart and change. Loading one puts its parts on the bench and its sketch in the editor.</p>
      <ul className="templates">
        {TEMPLATES[board].map(t => (
          <li key={t.id} ref={el => { cards.current[t.id] = el; }} className={lit === t.id ? 'lit' : undefined}>
            <b>{t.title}</b>
            <p>{t.about}</p>
            <p className="tpl-parts">{partsOf(t)}</p>
            <p className="tpl-try"><b>Then try</b> {t.tryIt}</p>
            <p className="tpl-guide">In the guide: {t.guide.map((id, i) => <span key={id}>{i > 0 && ', '}<a className="link" href={guideHash(id)}>{chapterOf(id)?.title.split(':')[0] ?? id}</a></span>)}</p>
            {asking === t.id ? (
              <div className="tpl-confirm" role="alert">
                <span>This replaces what is on your bench and in your sketch. Undo brings the bench back, but not the sketch.</span>
                <span className="actions">
                  <button type="button" className="go" onClick={() => load(t.id)}>Replace them</button>
                  <button type="button" autoFocus onClick={() => setAsking(null)}>Keep mine</button>
                </span>
              </div>
            ) : (
              <p className="actions"><button type="button" onClick={() => (ownWork ? setAsking(t.id) : load(t.id))} aria-label={`Load the ${t.title} template`}>Load</button></p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const HINT_NAMES = ['Nudge', 'Idea', 'Answer'], HINT_BUTTONS = ['Give me a nudge', 'Show me the idea', 'Show me the answer'];

/** The goal, the checklist, the prediction and the three hints for the open mission. */
export function MissionPanel() {
  const board = useLab(s => s.board), m = useLab(missionOf), key = missionKey(board, m.id);
  const pass = useLab(s => s.passed[key]), hints = useLab(s => s.hintsUsed[key] ?? 0), guess = useLab(s => s.predictions[key]), pick = useLab(s => s.picks[key]);
  const results = useLab(s => s.results), checking = useLab(s => s.checking), passed = useLab(s => s.passed);
  const rows = useMemo(
    () => results ?? ['The wiring has no mistakes', ...m.checks.map(c => c.label)].map(label => ({ label, pass: null as boolean | null, detail: '' })),
    [results, m],
  );
  const next = useMemo(() => MISSIONS[board].filter(x => !x.sandbox && !x.repair && x.after.includes(m.id) && !passed[missionKey(board, x.id)]), [board, m, passed]);
  const sides = useMemo(() => MISSIONS[board].filter(x => x.repair && x.after.includes(m.id) && !passed[missionKey(board, x.id)]), [board, m, passed]);

  return (
    <>
      <p className="place">{m.place}{m.repair && <span className="repair-chip">Side quest</span>}{pass && <span className="done-chip">Passed</span>}</p>
      <h2>{m.title}</h2>
      <p {...html(m.story)} />
      <div className="goal"><b>Goal</b><span>{m.goal}</span></div>
      {m.showParts && <p className="g-tip">New to all this? The guide explains every instruction and every part from the very start. <a className="link" href={guideHash(null)}>Open the guide</a> (or press <kbd>G</kbd>). It opens on its own page, and <kbd>G</kbd> there brings you back.</p>}

      {m.sandbox ? (
        <>
          <p className="free">This is free build, so there is nothing to check. Every part is in the tray, and what you build here is kept in this browser.</p>
          <Templates />
        </>
      ) : (
        <>
          {m.choice ? (
            <>
              <h3>What it needs</h3>
              <NeedList choice={m.choice} pick={pick} className="checklist" />
              <p className="actions"><small>{pick ? verdict(m.choice, pick).text : 'Compare the boards on the supply shelf, then choose one.'}</small></p>
            </>
          ) : <>
          <h3>Checks</h3>
          <ul className="checklist">
            {rows.map(r => (
              <li key={r.label} data-state={r.pass === null ? 'todo' : r.pass ? 'pass' : 'fail'}>
                <span className="mark" role="img" aria-label={r.pass === null ? 'Not checked yet' : r.pass ? 'Passed' : 'Not passing'}>{r.pass === null ? '○' : r.pass ? '✓' : '✗'}</span>
                <span><b>{r.label}</b>{r.detail && <small>{r.detail}</small>}</span>
              </li>
            ))}
          </ul>
          <p className="actions">
            <button type="button" className="check" disabled={checking} onClick={checkMission}>{checking ? 'Checking…' : 'Check my build'}</button>
            <small>{results ? (results.every(r => r.pass) ? 'Every check passes.' : 'Fix what is marked, then check again.') : 'Runs your sketch on your build against every check.'}</small>
          </p>

          {m.repair ? <p className="repair-note"><b>Side quest: a repair job.</b> This one is optional and does not count towards the main quest. The bench and the sketch start with faults in them. Press Run and watch what goes wrong first, then find out why. There is no prediction to make, because you are looking for the cause. <a className="link" href={guideHash('debugging')}>How to debug</a></p> : <>
          <h3>Your prediction</h3>
          {guess && m.predict ? (
            <p className={guess.right ? 'guess right' : 'guess wrong'}>
              You predicted “{m.predict.options.find(o => o.id === guess.picked)?.label}”. It did: “{m.predict.options.find(o => o.id === guess.actual)?.label}”. {guess.right ? 'Right.' : 'Not this time.'}
              {' '}{m.predict.explain[guess.actual]}
            </p>
          ) : <p className="muted">The first time you press Run, you will be asked what you expect to happen. Then you can compare.</p>}
          </>}
          </>}

          <h3>Hints <small>{hints} of 3 used</small></h3>
          <ol className="hints">
            {m.hints.slice(0, hints).map((h, i) => (
              <li key={i}>
                <b>{HINT_NAMES[i]}</b>
                <span {...html(h)} />
                {i === 2 && !m.choice && (
                  <div className="answer">
                    <table className="wiring"><tbody>
                      {wiringRows(m.circuit).map((r, n) => (
                        <tr key={n}><th>{r.wire && <i className="sw" style={{ background: WIRE_CSS[r.wire] }} />}{r.part}</th><td>{r.where}</td></tr>
                      ))}
                    </tbody></table>
                    <p className="actions">
                      <button type="button" onClick={showAnswer}>Build the circuit for me</button>
                      <button type="button" onClick={fillAnswerCode}>Put the sketch in the editor</button>
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {hints < 3 && <p className="actions"><button type="button" onClick={revealHint}>{HINT_BUTTONS[hints]}</button><small>Hints are counted. Try first.</small></p>}
        </>
      )}

      {pass && (
        <div className="reward">
          <b>Passed with {pass.hints === 0 ? 'no hints' : pass.hints === 1 ? '1 hint' : `${pass.hints} hints`}.</b>
          {m.unlocks.length > 0 && <span>Unlocked: {m.unlocks.map(p => PARTS[p].label).join(', ')}.</span>}
          {sides.length > 0 && <span>Side quest: {sides.map((x, i) => <button key={x.id} type="button" className="link" onClick={() => goTo(board, x.id)}>{x.title}{i < sides.length - 1 ? ',' : ''}</button>)}</span>}
          {next.length > 0 && <span>Next: {next.map((x, i) => <button key={x.id} type="button" className="link" onClick={() => goTo(board, x.id)}>{x.place}{i < next.length - 1 ? ',' : ''}</button>)}</span>}
        </div>
      )}
    </>
  );
}
