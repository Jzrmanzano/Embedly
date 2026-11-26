import { useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react';
import { BOARDS } from '../data/boards';
import { GUIDE } from '../data/guide';
import { MISSIONS } from '../data/missions';
import { TEMPLATES } from '../data/templates';
import { progressBackup, resetProgress, restoreProgress, showTemplate } from '../state/actions';
import { boardProgress, graded, nextMission, sideProgress, sideQuests } from '../state/progress';
import { useLab } from '../state/store';
import { BrandMark, Icon } from './Icons';
import { ThemeToggle } from './ThemeToggle';

const ALL_BOARDS = Object.values(BOARDS);
const TAGLINES: Record<string, string> = {
  uno: 'The classic first board. Simple, forgiving and loved by beginners everywhere.',
  esp32: 'A faster board with a 12-bit analog input, touch sensing and Wi-Fi hardware.',
};
const STEPS = [
  ['Pick a mission', 'Open the mission map and choose a small device to build, like a night light or a door chime.'],
  ['Build and predict', 'Place the parts and wires on the 3D bench yourself, write the sketch, and say what you expect before you run it. Stuck? The built-in guide explains every instruction and part.'],
  ['Prove it', 'Run the checks on your own build. Every one has to pass, and passing unlocks new parts and the next places on the map.'],
] as const;

/** A flat top-down drawing of a board, used as the hero picture. */
function BoardArt() {
  return (
    <svg className="art" viewBox="0 0 360 230" role="img" aria-label="Drawing of a development board wired to an LED on a breadboard">
      <rect x="6" y="116" width="348" height="108" rx="8" className="a-bread" />
      {Array.from({ length: 24 }, (_, i) => [0, 1, 2, 3, 4].map(j => <circle key={`${i}-${j}`} cx={24 + i * 13.5} cy={134 + j * 12} r="2.2" className="a-hole" />))}
      <rect x="40" y="14" width="190" height="92" rx="6" className="a-pcb" />
      <rect x="22" y="30" width="34" height="34" rx="3" className="a-metal" />
      <rect x="92" y="34" width="84" height="26" rx="3" className="a-chip" />
      <rect x="64" y="22" width="150" height="7" className="a-pins" /><rect x="64" y="91" width="150" height="7" className="a-pins" />
      <circle cx="198" cy="72" r="5" className="a-led-on" />
      <path d="M96 98 C 96 118 70 120 70 140" className="a-wire a-w1" />
      <path d="M150 98 C 150 120 190 112 190 140" className="a-wire a-w2" />
      <g className="a-led"><circle cx="190" cy="168" r="14" /><circle cx="190" cy="168" r="26" className="a-glow" /></g>
      <rect x="62" y="150" width="12" height="40" rx="3" className="a-res" />
      <rect x="260" y="132" width="86" height="64" rx="6" className="a-code" />
      {[50, 62, 38, 56].map((w, i) => <rect key={i} x="270" y={144 + i * 12} width={w} height="4" rx="2" className="a-line" />)}
    </svg>
  );
}

/** A link to a section further down the home page. The address bar hash says which page shows (#uno-beacon opens a mission), so following
    "#templates" would leave the home page: the link scrolls to the section instead, and the keyboard goes with it. */
function JumpLink({ to, children }: { to: string; children: ReactNode }) {
  const jump = (e: MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(to);
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };
  return <a href={`#${to}`} onClick={jump}>{children}</a>;
}

/** The Open Studio's templates, both boards together. Each opens its board's studio with the brief scrolled to it. */
function TemplateList() {
  return (
    <section id="templates" className="tpl-home" aria-labelledby="tpl-title" tabIndex={-1}>
      <h2 id="tpl-title" className="sec-title">Start from a template</h2>
      <p className="sec-note">Finished projects to open in the Open Studio: load one, run it, then take it apart and change it. Every part is there, so no missions are needed first.</p>
      <ul className="tpl-grid">
        {ALL_BOARDS.flatMap(b => TEMPLATES[b.id].map(t => (
          <li key={`${b.id}-${t.id}`}>
            <a href={`#${b.id}-workshop`} onClick={() => showTemplate(t.id)}>
              <span className="tpl-board">{b.name}</span>
              <b>{t.title}</b>
              <small>{t.about}</small>
              <span className="tpl-go">Open it in the studio <Icon name="chevron" /></span>
            </a>
          </li>
        )))}
      </ul>
    </section>
  );
}

/** Saving the work to a file, putting it back, and starting again. The browser keeps the work on its own: this is for keeping a copy or moving to another computer. */
function ProgressTools() {
  const has = useLab(s => Object.keys(s.passed).length + Object.keys(s.edits).length + Object.keys(s.benches).length > 0);
  const [armed, setArmed] = useState<'reset' | 'restore' | null>(null), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const save = () => {
    const url = URL.createObjectURL(new Blob([progressBackup()], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = `embedly-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setArmed(null); setMsg({ ok: true, text: 'Backup saved. Keep the file somewhere safe.' });
  };
  const choose = () => {
    if (has && armed !== 'restore') { setArmed('restore'); setMsg({ ok: false, text: 'Restoring replaces the progress in this browser. Press the button again to choose a backup file.' }); return; }
    setArmed(null); setMsg(null); file.current?.click();
  };
  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 3_000_000) { setMsg({ ok: false, text: 'That file is too big to be a backup.' }); return; }
    const r = restoreProgress(await f.text());
    setMsg(r.ok ? { ok: true, text: `Restored: ${r.summary}.` } : { ok: false, text: r.error });
  };
  const reset = () => {
    if (armed !== 'reset') { setArmed('reset'); setMsg({ ok: false, text: 'This forgets every passed mission, circuit and sketch in this browser. Save a backup first if you may want them. Press the button again to go ahead.' }); return; }
    resetProgress(); setArmed(null); setMsg({ ok: true, text: 'Progress reset. You are back at the start.' });
  };
  return (
    <section className="backup" aria-labelledby="backup-title">
      <h2 id="backup-title" className="sec-title">Your progress</h2>
      <p className="sec-note">Embedly remembers your passed missions, the circuits you built and the sketches you wrote, in this browser. Save a backup file to keep a copy, or to carry your work to another computer.</p>
      <div className="backup-actions">
        <button type="button" className="ghost" onClick={save} disabled={!has}>Save a backup</button>
        <button type="button" className="ghost" onClick={choose}>Restore from a backup</button>
        <button type="button" className={armed === 'reset' ? 'ghost danger armed' : 'ghost danger'} onClick={reset} disabled={!has && armed !== 'reset'}>{armed === 'reset' ? 'Yes, reset everything' : 'Reset progress'}</button>
        {armed && <button type="button" className="ghost" onClick={() => { setArmed(null); setMsg(null); }}>Cancel</button>}
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={load} aria-label="Backup file" />
      </div>
      <p className={msg ? (msg.ok ? 'backup-msg ok' : 'backup-msg') : 'backup-msg'} role="status">{msg?.text}</p>
    </section>
  );
}

export function Home() {
  const passed = useLab(s => s.passed);
  const total = ALL_BOARDS.reduce((n, b) => n + MISSIONS[b.id].filter(m => !m.sandbox).length, 0);
  return (
    <div className="home">
      <header className="home-bar">
        <a className="brand" href="#" aria-label="Embedly home"><BrandMark /><h1>Embed<span>ly</span></h1></a>
        <nav aria-label="Sections">
          <JumpLink to="boards-section">Missions</JumpLink>
          <JumpLink to="templates">Templates</JumpLink>
          <a href="#boards">Compare boards</a>
          <a href="#guide">Guide</a>
          <ThemeToggle />
          <a className="cta small" href="#uno-tour">Open the lab</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-text">
            <ul className="plate" aria-label="What you need"><li>Free</li><li>Runs in the browser</li><li>No hardware needed</li></ul>
            <h2>Learn Arduino and ESP32 by building real devices.</h2>
            <p className="lede">Build the device yourself, guess what it will do, then prove it with checks that run your own sketch. {total} hands-on missions for anyone who wants to learn, all in your browser.</p>
            <div className="hero-actions">
              <a className="cta" href="#uno-tour">Start with the Arduino Uno</a>
              <a className="ghost" href="#esp32-tour">Try the ESP32</a>
            </div>
          </div>
          <BoardArt />
        </section>

        <section id="boards-section" className="boards" aria-labelledby="pick" tabIndex={-1}>
          <h2 id="pick" className="sec-title">Pick a board</h2>
          <p className="sec-note">Two boards are on the bench here. <a href="#boards">Compare them with three others</a>, side by side and drawn to scale.</p>
          <div className="board-grid">
            {ALL_BOARDS.map(b => {
              const { done, total: count } = boardProgress(b.id, passed), next = nextMission(b.id, passed), side = sideProgress(b.id, passed);
              return (
                <article key={b.id} className="board-card">
                  <h3>{b.name}</h3>
                  <p>{TAGLINES[b.id]}</p>
                  {done > 0 && (
                    <div className="prog">
                      <div className="meter" role="progressbar" aria-label={`${b.name} missions passed`} aria-valuemin={0} aria-valuemax={count} aria-valuenow={done}><i style={{ width: `${(100 * done) / count}%` }} /></div>
                      <span>{done} of {count} passed</span>
                    </div>
                  )}
                  <ol>
                    {graded(b.id).map((m, i) => {
                      const ok = !!passed[`${b.id}-${m.id}`];
                      return (
                        <li key={m.id} className={ok ? 'ok' : undefined}>
                          <a href={`#${b.id}-${m.id}`}>
                            <span className="n" aria-hidden="true">{ok ? '✓' : String(i + 1).padStart(2, '0')}</span>
                            <span><b>{m.place}: {m.title}</b>{ok && <span className="sr-only"> (passed)</span>}<small>{m.hook}</small></span>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                  {side.total > 0 && (
                    <div className="side-list">
                      <h4>Side quests <small>optional repair jobs, {side.done} of {side.total} done</small></h4>
                      <ul>
                        {sideQuests(b.id).map(m => {
                          const ok = !!passed[`${b.id}-${m.id}`], opens = m.after.every(a => passed[`${b.id}-${a}`]);
                          return <li key={m.id} className={ok ? 'ok' : undefined}><a href={`#${b.id}-${m.id}`}>{ok ? '✓ ' : ''}{m.title}<small>{opens ? m.hook : `Opens after “${MISSIONS[b.id].find(x => x.id === m.after[0])?.title}”`}</small></a></li>;
                        })}
                      </ul>
                    </div>
                  )}
                  {next
                    ? (
                      <div className="card-actions">
                        <a className="cta" href={`#${b.id}-${next.id}`}>{done === 0 ? `Start ${b.name}` : `Continue: ${next.title}`}</a>
                        <a className="ghost" href={`#${b.id}-workshop`} title="Free build with every part. No missions needed first.">Build your own in the studio</a>
                      </div>
                    )
                    : <a className="cta" href={`#${b.id}-workshop`}>Every mission passed. Open the studio</a>}
                </article>
              );
            })}
          </div>
        </section>
        <TemplateList />
        <section className="steps" aria-labelledby="how">
          <h2 id="how" className="sec-title">How it works</h2>
          <ol>
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="n">{String(i + 1).padStart(2, '0')}</span><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ol>
        </section>

        <ProgressTools />

        <section className="next" aria-label="More to explore">
          <a href="#guide"><Icon name="book" /><span><b>Read the guide</b><small>{GUIDE.length} short chapters on the code, the breadboard and the parts.</small></span></a>
          <a href="#boards"><Icon name="chip" /><span><b>Compare five boards</b><small>Side by side, drawn to scale, with a picker for your project.</small></span></a>
        </section>
      </main>

      <footer className="home-foot">
        <span>Embedly</span>
        <span>The simulator runs a subset of Arduino C++. Progress is saved in this browser.</span>
      </footer>
    </div>
  );
}
