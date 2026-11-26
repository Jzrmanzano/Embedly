/* The Templates panel: finished projects to start from, a panel of their own beside the map and the brief. In the Open Studio each one loads onto
   the bench; anywhere else it opens in the studio, so a mission's bench is never replaced. */
import { useEffect, useRef, useState } from 'react';
import { BOARDS } from '../data/boards';
import { chapterOf } from '../data/guide';
import { partIdOf, PARTS } from '../data/missions';
import { TEMPLATES, type Template } from '../data/templates';
import { loadTemplate, showTemplate, templateShown } from '../state/actions';
import { guideHash } from '../state/route';
import { benchOf, codeOf, missionOf, useLab } from '../state/store';
import type { BoardId } from '../types';

/** "LED × 3 · Resistor × 3": the parts a template is built from, without its wires. */
const partsOf = (t: Template) => {
  const count = new Map<string, number>();
  for (const it of t.circuit) if (it.t !== 'wire') { const label = PARTS[partIdOf(it)].label; count.set(label, (count.get(label) ?? 0) + 1); }
  return [...count].map(([label, n]) => (n > 1 ? `${label} × ${n}` : label)).join(' · ');
};

export function TemplatesPanel() {
  const board = useLab(s => s.board), studio = useLab(s => !!missionOf(s).sandbox), focus = useLab(s => s.templateFocus);
  const ownWork = useLab(s => benchOf(s).length > 0 || codeOf(s) !== missionOf(s).starter);
  const [asking, setAsking] = useState<string | null>(null), [lit, setLit] = useState<string | null>(null);
  const cards = useRef<Record<string, HTMLLIElement | null>>({});
  const other: BoardId = board === 'uno' ? 'esp32' : 'uno';
  const load = (id: string) => { setAsking(null); loadTemplate(id); };
  useEffect(() => {   // a template was asked for from elsewhere: once the studio is open, bring it into view, mark it for a moment, and put the keyboard on its Load button
    if (focus === null || !studio) return;
    const card = focus ? cards.current[focus] : null;
    if (card) {
      card.scrollIntoView({ block: 'center' });
      card.querySelector<HTMLButtonElement>('.tpl-load')?.focus({ preventScroll: true });
      setLit(focus);
    }
    templateShown();
  }, [focus, studio]);
  useEffect(() => { if (!lit) return; const t = setTimeout(() => setLit(null), 2400); return () => clearTimeout(t); }, [lit]);

  return (
    <div className="tpl-panel">
      <p className="tpl-intro">
        Finished {BOARDS[board].name} projects to try, take apart and change.{' '}
        {studio ? 'Load one to put its parts on the bench and its sketch in the editor.' : 'Each one opens in the Open Studio, so this mission\'s bench stays as it is.'}
      </p>
      <ul className="templates">
        {TEMPLATES[board].map(t => (
          <li key={t.id} ref={el => { cards.current[t.id] = el; }} className={lit === t.id ? 'lit' : undefined}>
            <b>{t.title}</b>
            <p>{t.about}</p>
            <p className="tpl-parts">{partsOf(t)}</p>
            <p className="tpl-try"><b>Then try</b> {t.tryIt}</p>
            <p className="tpl-guide">In the guide: {t.guide.map((id, i) => <span key={id}>{i > 0 && ', '}<a className="link" href={guideHash(id)}>{chapterOf(id)?.title.split(':')[0] ?? id}</a></span>)}</p>
            {!studio ? (
              <p className="actions"><a className="btn tpl-load" href={`#${board}-workshop`} onClick={() => showTemplate(t.id)}>Open in the studio</a></p>
            ) : asking === t.id ? (
              <div className="tpl-confirm" role="alert">
                <span>This replaces what is on your bench and in your sketch. Undo brings the bench back, but not the sketch.</span>
                <span className="actions">
                  <button type="button" className="go" onClick={() => load(t.id)}>Replace them</button>
                  <button type="button" autoFocus onClick={() => setAsking(null)}>Keep mine</button>
                </span>
              </div>
            ) : (
              <p className="actions"><button type="button" className="tpl-load" onClick={() => (ownWork ? setAsking(t.id) : load(t.id))} aria-label={`Load the ${t.title} template`}>Load</button></p>
            )}
          </li>
        ))}
      </ul>
      <p className="tpl-other">
        The {BOARDS[other].name} has templates of its own: <a className="link" href={`#${other}-workshop`} onClick={() => showTemplate()}>{TEMPLATES[other].map(t => t.title).join(', ')}</a>.
      </p>
    </div>
  );
}
