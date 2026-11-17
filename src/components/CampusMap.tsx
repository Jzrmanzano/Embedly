import { useEffect, useMemo, useRef } from 'react';
import { isAvailable, missionKey, MISSIONS, type Mission } from '../data/missions';
import { goTo, say } from '../state/actions';
import { graded, nextMission, sidesOf } from '../state/progress';
import { useLab } from '../state/store';
import { Icon } from './Icons';

const Lock = () => (
  <svg className="lock" viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><rect x="1" y="6" width="10" height="7.5" rx="1.5" /><path d="M3.5 6V4a2.5 2.5 0 0 1 5 0v2" fill="none" strokeWidth="1.6" /></svg>
);

/** How far apart the stops are along the road, how much room each side quest adds, the room above the last stop and below the first, and where the labels start (percent from the left). */
const ROW = 86, SIDE = 58, PAD = 46, LABEL_X = 31, SIDE_X = 33, SIDE_LABEL_X = 38;
/** The road wanders gently left and right of this line, between about 11% and 21% from the left edge. */
const roadX = (i: number) => 16 + 5 * Math.sin(i * 1.15);

/** The mission map drawn as a road map. The main quest is one road, from the first mission at the bottom to the last at the top, with a stop for each. The stretch you have driven has a solid yellow line down its middle, and the road ahead is dashed.
    Side quests (the repair jobs) are small optional turnings off the road, beside the mission they follow. A stop is closed until the missions it comes after are passed, and says which when it is pressed. The studio, which has no goal and is open from the start, is a side street at the bottom. */
export function CampusMap() {
  const board = useLab(s => s.board), current = useLab(s => s.mission), passed = useLab(s => s.passed);
  const nav = useRef<HTMLElement>(null);
  const missions = MISSIONS[board], stops = graded(board), studio = missions.find(m => m.sandbox), done = useMemo(() => new Set(Object.keys(passed)), [passed]);
  const next = useMemo(() => nextMission(board, passed)?.id, [board, passed]);
  const here = missions[current]?.id;
  useEffect(() => {   // the road is taller than its panel, so start with the open mission in the middle. Only the panel scrolls, not the page around it.
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="true"]'), box = nav.current?.parentElement;
    if (el && box) box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 2 + el.offsetHeight / 2;
  }, [board, current]);

  /* Where everything goes. The stops are placed from the bottom up, and a stop with side quests leaves extra room above it for them. */
  const sides = stops.map(m => sidesOf(board, m.id));
  const gap = stops.map((_, i) => ROW + SIDE * sides[i].length);
  const height = 2 * PAD + gap.slice(0, -1).reduce((a, b) => a + b, 0);
  const at: { x: number; y: number }[] = [];
  stops.forEach((_, i) => at.push({ x: roadX(i), y: i === 0 ? height - PAD : at[i - 1].y - gap[i - 1] }));
  const bend = (i: number) => `C ${at[i].x} ${at[i].y - gap[i] / 2} ${at[i + 1].x} ${at[i + 1].y + gap[i] / 2} ${at[i + 1].x} ${at[i + 1].y}`;
  const road = [`M ${at[0].x} ${height}`, `L ${at[0].x} ${at[0].y}`, ...at.slice(1).map((_, k) => bend(k)), `L ${at[at.length - 1].x} 0`].join(' ');
  /** A side quest sits in the free stretch above its stop, and its turning leaves the road at the height it is drawn at. */
  const sideAt = (i: number, j: number) => {
    const y = at[i].y - gap[i] / 2 + (j - (sides[i].length - 1) / 2) * SIDE, t = Math.min(1, Math.max(0, (at[i].y - y) / gap[i])), ease = t * t * (3 - 2 * t);
    return { y, roadX: at[i].x + (at[i + 1] ? at[i + 1].x - at[i].x : 0) * ease };
  };

  const need = (m: Mission) => m.after.filter(a => !done.has(missionKey(board, a))).map(a => missions.find(x => x.id === a)!.title);
  const open = (m: Mission) => { const n = need(m); if (!n.length) goTo(board, m.id); else say('info', `${m.place} is closed. Pass ${n.map(t => `“${t}”`).join(' and ')} first.`, 5000); };
  const describe = (m: Mission, ok: boolean, isOpen: boolean) => `${m.place}: ${m.title}.${m.choice ? ' Choose a board.' : ''}${m.repair ? ' Side quest, a repair job.' : ''} ${ok ? 'Passed.' : isOpen ? 'Open.' : `Locked. Pass ${need(m).join(' and ')} first.`}`;

  return (
    <>
      <p className="map-key" aria-hidden="true"><span className="k done" />Passed <span className="k open" />Open <span className="k locked" />Locked <span className="k side" />Side quest</p>
      <nav ref={nav} className="map" style={{ height }} aria-label="Mission map. The main quest is one road, from the first mission at the bottom to the last at the top. Side quests turn off it.">
        <svg className="ground" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {stops.map((_, i) => sides[i].map((_, j) => { const s = sideAt(i, j); return <path key={`${i}-${j}`} d={`M ${s.roadX} ${s.y} L ${SIDE_X} ${s.y}`} className="spur" vectorEffect="non-scaling-stroke" />; }))}
          <path d={road} className="curb" vectorEffect="non-scaling-stroke" />
          <path d={road} className="asphalt" vectorEffect="non-scaling-stroke" />
          {stops.slice(0, -1).map((m, i) => <path key={m.id} d={`M ${at[i].x} ${at[i].y} ${bend(i)}`} className={done.has(missionKey(board, m.id)) ? 'lane driven' : 'lane'} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {stops.map((m, i) => {
          const isOpen = isAvailable(board, m, done), ok = done.has(missionKey(board, m.id)), state = ok ? 'passed' : isOpen ? 'open' : 'locked';
          return (
            <div key={m.id}>
              <div className={`stop ${state}`} style={{ top: at[i].y }}>
                <span className="pin" style={{ left: `${at[i].x}%` }} aria-hidden="true">{ok ? <Icon name="check" /> : !isOpen ? <Lock /> : m.choice ? <Icon name="chip" /> : i + 1}</span>
                <span className="tie" style={{ left: `${at[i].x}%`, width: `${LABEL_X - at[i].x}%` }} aria-hidden="true" />
                <button type="button" className="card" style={{ left: `${LABEL_X}%` }} aria-current={m.id === here || undefined} aria-disabled={!isOpen || undefined} aria-label={describe(m, ok, isOpen)} onClick={() => open(m)}>
                  <b>{m.place}</b>
                  <small>{m.title}</small>
                  {m.id === next && <i className="next-tag">Next stop</i>}
                </button>
              </div>
              {sides[i].map((q, j) => {
                const qOpen = isAvailable(board, q, done), qOk = done.has(missionKey(board, q.id)), s = sideAt(i, j);
                return (
                  <div key={q.id} className={`stop side ${qOk ? 'passed' : qOpen ? 'open' : 'locked'}`} style={{ top: s.y }}>
                    <span className="pin" style={{ left: `${SIDE_X}%` }} aria-hidden="true">{qOk ? <Icon name="check" /> : !qOpen ? <Lock /> : <Icon name="wrench" />}</span>
                    <button type="button" className="card" style={{ left: `${SIDE_LABEL_X}%` }} aria-current={q.id === here || undefined} aria-disabled={!qOpen || undefined} aria-label={describe(q, qOk, qOpen)} onClick={() => open(q)}>
                      <b>{q.title}</b>
                      <small>{q.place}</small>
                      <i className="side-tag">Side quest</i>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
      {studio && (
        <button type="button" className="side-street" aria-disabled={!isAvailable(board, studio, done) || undefined} aria-current={studio.id === here || undefined} onClick={() => open(studio)}
          aria-label={describe(studio, false, isAvailable(board, studio, done))}>
          <span className="pin" aria-hidden="true">{isAvailable(board, studio, done) ? '+' : <Lock />}</span>
          <span><b>{studio.place}</b><small>Free build with every part, open at any time</small></span>
        </button>
      )}
    </>
  );
}
