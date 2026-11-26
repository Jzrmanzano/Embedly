import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef, type RefObject } from 'react';
import * as T from 'three';
import { BOARDS, ITEM_INFO } from '../data/boards';
import { setTone } from '../sim/audio';
import { RGB_CHANNELS } from '../sim/circuit';
import { DARK_LCD } from '../sim/lcd';
import { beginMove, currentReadout, dragBreadboard, dragPart, dropBreadboard, dropPart, finishMove, isWireEnd, moveTo, nudgeBreadboard, nudgePart, pressPoint, releasePoint, selectHot, setPoint, setProbe } from '../state/actions';
import { allTerminals, holeOffset, isHole, movable, movedPart, movedWire } from '../state/bench';
import { benchOf, burntOf, keyOf, missionOf, useLab } from '../state/store';
import { BB_HEIGHT, PITCH, placeOf, type Place } from '../state/table';
import { itemId, type Item } from '../types';
import { view } from './view';
import { buildWorld } from './world';

const VIEW_DIR = new T.Vector3(-0.42, 0.78, 1).normalize(), TOP_DIR = new T.Vector3(0, 1, 0.001).normalize(), projected = new T.Vector3();
/** Where the shadows are cast from: high up, behind and to the right, so each one falls a little way in front of what casts it, where the camera sees it. */
const SUN_DIR = new T.Vector3(0.45, 1, -0.35).normalize();
const ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3(), TOP_PLANE = new T.Plane(new T.Vector3(0, 1, 0), -BB_HEIGHT);
/** Is this the second breadboard, by its id? Is it a placed part that can be moved to other holes? */
const isSecond = (id: string | null) => !!id && benchOf(useLab.getState()).some((it, k) => it.t === 'breadboard' && itemId(it, k) === id);
const isMovable = (id: string | null) => !!id && benchOf(useLab.getState()).some((it, k) => movable(it) && itemId(it, k) === id);

function pickOf(o: T.Object3D | null): string | null {
  for (; o; o = o.parent) if (o.userData.pick) return o.userData.pick;
  return null;
}

/** Everything inside the canvas: lights, camera rig and the bench for the open lesson. Part labels are plain buttons placed in `labelLayer`, a div lying over the canvas. */
export function Bench({ labelLayer }: { labelLayer: RefObject<HTMLDivElement | null> }) {
  const gl = useThree(s => s.gl), size = useThree(s => s.size);
  const camera = useThree(s => s.camera) as T.OrthographicCamera;
  const board = useLab(s => s.board), hot = useLab(s => s.hot), showParts = useLab(s => !!missionOf(s).showParts);
  const probed = useLab(s => s.probe?.name ?? null), nav = useLab(s => s.nav), bench = useLab(benchOf), burnt = useLab(burntOf), point = useLab(s => s.point), pending = useLab(s => s.pending), sparks = useLab(s => s.sparks);
  const drag = useLab(s => s.drag), bbDrag = useLab(s => s.bbDrag), partDrag = useLab(s => s.partDrag), panels = useLab(s => s.panels), widths = useLab(s => s.widths);
  const second = useLab(s => { const bb = benchOf(s).find(it => it.t === 'breadboard'); return bb?.t === 'breadboard' ? bb.size : null; });
  const insets = useRef({ l: 0, r: 0 });   // how much of the left and right of the screen a panel covers
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  // While something is being dragged it is drawn where it would go: a wire end plugged into the point under the pointer, a part in the holes it has been dragged to
  // (or where it was, while those holes will not take it), and the second breadboard where it has got to, with its parts on it.
  const shown = useMemo(() => {
    let items = bbDrag ? bench.map(it => (it.t === 'breadboard' ? { ...it, ...bbDrag } : it)) : bench;
    if (partDrag) { const r = movedPart(board, items, partDrag.id, partDrag.rows, partDrag.cols); if ('items' in r) items = r.items; }
    if (!drag?.to) return items;
    const r = movedWire(board, items, drag.id, drag.end, drag.to);
    return 'items' in r ? r.items : items;
  }, [bench, board, drag, bbDrag, partDrag]);
  const viewH = useRef(200);   // world millimetres visible top to bottom at zoom 1
  const labelEls = useRef<HTMLButtonElement[]>([]);

  const world = useMemo(
    () => buildWorld({ board, parts: showParts ? BOARDS[board].parts : null, info: ITEM_INFO }, gl.capabilities.getMaxAnisotropy()),
    [board, showParts, gl],
  );
  useEffect(() => () => world.dispose(), [world]);

  /* the student's parts and wires */
  const sun = useRef<T.DirectionalLight>(null);
  /** Points the light's shadow camera at the whole bench, so everything on it casts a crisp, soft-edged shadow on the table. */
  const aimSun = () => {
    const light = sun.current, box = new T.Box3();
    world.group.children.forEach(o => { if (!o.userData.nofit && o.visible) box.expandByObject(o); });
    if (!light || box.isEmpty()) return;
    const c = box.getCenter(new T.Vector3()), r = box.getSize(new T.Vector3()).length() / 2 + 40, cam = light.shadow.camera;
    light.target.position.copy(c); light.target.updateMatrixWorld();
    light.position.copy(c).addScaledVector(SUN_DIR, 800);
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 1800; cam.updateProjectionMatrix();
  };
  useLayoutEffect(() => { world.setCircuit(shown, useLab.getState().burnt[keyOf(useLab.getState())] ?? [], bench); aimSun(); }, [world, shown, bench, board]);
  if (import.meta.env.DEV) (window as unknown as { __three: unknown }).__three = { gl, sun, world };
  useLayoutEffect(() => { const dpr = gl.getPixelRatio(); world.resize(size.width * dpr, size.height * dpr, dpr); }, [world, size, gl]);
  useEffect(() => {   // shadows follow the theme: the toggle's choice, or the system's when none has been made
    const system = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => world.shade((document.documentElement.dataset.theme ?? (system.matches ? 'dark' : 'light')) === 'dark');
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    system.addEventListener('change', apply);
    return () => { watch.disconnect(); system.removeEventListener('change', apply); };
  }, [world]);
  useEffect(() => { burnt.forEach(id => world.burn(id)); }, [world, burnt]);
  const firstSpark = useRef(sparks);
  useEffect(() => {
    if (sparks === firstSpark.current) return;
    firstSpark.current = sparks;
    const last = bench[bench.length - 1], at = last && world.anchor(last.t === 'wire' ? last.b : last.t === 'led' ? last.k : 'a1');
    if (at) world.puff(at.clone().setY(at.y + 3), 'spark');
  }, [world, sparks, bench]);

  useEffect(() => {
    const els = world.hots.map(h => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = h.sign ? `hot pole ${h.sign === '+' ? 'plus' : 'minus'}` : 'hot'; el.textContent = h.sign ? (h.sign === '+' ? '+' : '−') : h.title; el.onclick = () => selectHot(h.id);
      if (h.sign) el.setAttribute('aria-label', h.title);
      return el;
    });
    labelLayer.current!.append(...els); labelEls.current = els;
    return () => els.forEach(el => el.remove());
  }, [world, shown, showParts, labelLayer]);
  useEffect(() => {
    world.highlight(hot);
    labelEls.current.forEach((el, i) => el.setAttribute('aria-pressed', String(world.hots[i].id === hot)));
  }, [world, hot, shown]);
  useEffect(() => { world.markers(drag?.to ?? partDrag?.to ?? point ?? probed, pending); }, [world, point, pending, probed, drag?.to, partDrag?.to]);

  /* placing parts: the pointer picks the nearest hole or pin on screen, so tiny holes stay easy to hit */
  useEffect(() => {
    const el = gl.domElement, spots = allTerminals(board, bench).map(name => ({ name, at: world.anchor(name) })).filter((s): s is { name: string; at: T.Vector3 } => !!s.at);
    let grabbed = false;
    const nearest = (e: PointerEvent): string | null => {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, reach = e.pointerType === 'touch' ? 22 : 13;
      let best: string | null = null, bestD = reach;
      for (const s of spots) {
        projected.copy(s.at).project(camera);
        const d = Math.hypot((projected.x * 0.5 + 0.5) * r.width - x, (-projected.y * 0.5 + 0.5) * r.height - y);
        if (d < bestD) { bestD = d; best = s.name; }
      }
      return best;
    };
    /** The breadboard hole nearest the pointer on screen, however far: a part being dragged follows the pointer hole by hole. */
    const holes = spots.filter(s => isHole(s.name));
    const nearestHole = (e: PointerEvent): string | null => {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best: string | null = null, bestD = Infinity;
      for (const s of holes) {
        projected.copy(s.at).project(camera);
        const d = Math.hypot((projected.x * 0.5 + 0.5) * r.width - x, (-projected.y * 0.5 + 0.5) * r.height - y);
        if (d < bestD) { bestD = d; best = s.name; }
      }
      return best;
    };
    /* Press on a placed part and drag to move it to other holes, or on the second breadboard to move that around the table. A press that does not move is a click, which selects as before. */
    let piece: { id: string; from: string; x: number; y: number; moving: boolean } | null = null;
    let board2: { x: number; y: number; off: Place; moving: boolean } | null = null;
    const aim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const tableAt = (e: PointerEvent): Place | null => {   // the point under the pointer at the height of a breadboard's top, measured as places on the table are
      aim(e);
      return ray.ray.intersectPlane(TOP_PLANE, hit) ? { x: hit.x - world.origin.x, z: hit.z - world.origin.z } : null;
    };
    const under = (e: PointerEvent): { id: string; it: Item } | null => {   // the placed part or breadboard the pointer is on, nearest first
      aim(e);
      const id = pickOf(ray.intersectObject(world.group, true).find(h => pickOf(h.object))?.object ?? null), k = bench.findIndex((it, i) => itemId(it, i) === id);
      return id && k >= 0 ? { id, it: bench[k] } : null;
    };
    const hold = () => { setProbe(null); if (controls.current) controls.current.enabled = false; };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!useLab.getState().tool) {   // with no part in hand: a part can be picked up and moved, and so can a wire end and the second breadboard
        const got = under(e), from = got && movable(got.it) ? nearestHole(e) : null;
        if (got && from) { piece = { id: got.id, from, x: e.clientX, y: e.clientY, moving: false }; hold(); return; }
        const name = nearest(e);
        if (name && beginMove(name)) { grabbed = true; hold(); return; }
        const at = got?.it.t === 'breadboard' ? tableAt(e) : null;
        if (got?.it.t === 'breadboard' && at) {
          const p = placeOf(got.it);
          board2 = { x: e.clientX, y: e.clientY, off: { x: p.x - at.x, z: p.z - at.z }, moving: false };
          hold();
        }
        return;
      }
      if (pressPoint(nearest(e))) { grabbed = true; if (controls.current) controls.current.enabled = false; }
    };
    const move = (e: PointerEvent) => {
      if (piece) {
        if (!piece.moving && Math.hypot(e.clientX - piece.x, e.clientY - piece.y) < 5) return;
        piece.moving = true; el.style.cursor = 'grabbing';
        const to = nearestHole(e), by = to && holeOffset(piece.from, to);
        if (to && by) dragPart(piece.id, by[0], by[1], to);
        return;
      }
      if (board2) {
        if (!board2.moving && Math.hypot(e.clientX - board2.x, e.clientY - board2.y) < 5) return;
        board2.moving = true; setProbe(null); el.style.cursor = 'grabbing';
        const at = tableAt(e);
        if (at) dragBreadboard({ x: at.x + board2.off.x, z: at.z + board2.off.z });
        return;
      }
      if (useLab.getState().drag) { moveTo(nearest(e)); return; }
      if (useLab.getState().tool) { setProbe(null); setPoint(nearest(e)); return; }
      setPoint(null);
      if (e.buttons) { setProbe(null); return; }   // turning or sliding the view
      const name = nearest(e), r = el.getBoundingClientRect();
      setProbe(name ? { name, x: e.clientX - r.left, y: e.clientY - r.top } : null);
    };
    const leave = () => { setProbe(null); setPoint(null); };
    const up = (e: PointerEvent) => {
      if (piece) {
        const moved = piece.moving;
        piece = null;
        if (controls.current) controls.current.enabled = true;
        if (moved) { el.style.cursor = 'grab'; dropPart(); }
        return;
      }
      if (board2) {
        const moved = board2.moving;
        board2 = null;
        if (controls.current) controls.current.enabled = true;
        if (moved) { el.style.cursor = 'grab'; dropBreadboard(); }
        return;
      }
      if (!grabbed) return;
      grabbed = false;
      if (controls.current) controls.current.enabled = true;
      if (useLab.getState().drag) finishMove(nearest(e)); else releasePoint(nearest(e));
    };
    if (import.meta.env.DEV) {   // lets a test script find where a hole is on screen
      (window as unknown as { __screenOf: (n: string) => [number, number] | null }).__screenOf = name => {
        const at = world.anchor(name), r = el.getBoundingClientRect();
        if (!at) return null;
        projected.copy(at).project(camera);
        return [r.left + (projected.x * 0.5 + 0.5) * r.width, r.top + (-projected.y * 0.5 + 0.5) * r.height];
      };
    }
    if (import.meta.env.DEV) (window as unknown as { __nearest: (x: number, y: number) => string | null }).__nearest = (x, y) => nearest({ clientX: x, clientY: y, pointerType: 'mouse' } as PointerEvent);
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down, true); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); window.removeEventListener('pointerup', up); if (controls.current) controls.current.enabled = true; };
  }, [world, bench, board, gl, camera]);

  const measure = () => {   // side panels only; on a phone they are sheets along the bottom
    const wide = matchMedia('(min-width: 761px)').matches, width = (sel: string) => (wide ? document.querySelector<HTMLElement>(sel)?.offsetWidth ?? 0 : 0);
    const tools = wide ? document.querySelector<HTMLElement>('.tools') : null;   // the view buttons float on the right, so a wide bench (a long second breadboard) is kept clear of them too
    const toolsIn = tools ? Math.max(0, gl.domElement.getBoundingClientRect().right - tools.getBoundingClientRect().left + 8) : 0;
    insets.current = { l: width('.rail.left') + width('.drawer.left'), r: Math.max(width('.rail.right') + width('.drawer.right'), toolsIn) };
  };
  const frustum = () => {
    const a = size.width / size.height, h = viewH.current, shift = ((insets.current.l - insets.current.r) / 2) * (h / size.height);   // slide the window so the scene sits in the free part
    camera.left = -h * a / 2 - shift; camera.right = h * a / 2 - shift; camera.top = h / 2; camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
  };
  const fit = () => {   // frame the bench's bounding box as seen from the default camera direction
    measure();
    const box = new T.Box3();
    world.group.children.forEach(o => { if (!o.userData.nofit && o.visible) box.expandByObject(o); });
    const c = box.getCenter(new T.Vector3()), target = controls.current!.target;
    camera.position.copy(c).addScaledVector(VIEW_DIR, 900); camera.lookAt(c); camera.updateMatrixWorld();
    const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const d = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c);
      const x = d.dot(right), y = d.dot(up);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    viewH.current = Math.max((y1 - y0) * 1.08, (x1 - x0) * 1.14 / (Math.max(240, size.width - insets.current.l - insets.current.r) / size.height));
    target.copy(c).addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2);
    camera.position.copy(target).addScaledVector(VIEW_DIR, 900);
    camera.zoom = 1; frustum(); controls.current!.update();
  };
  useLayoutEffect(fit, [world, second]);   // a new board reframes the view, and so does a second breadboard coming, going or changing size; placing parts does not
  useLayoutEffect(frustum, [size]);     // a resize keeps the same framing
  useLayoutEffect(() => { measure(); frustum(); }, [panels, widths]);   // opening or resizing a panel slides the view, it does not zoom
  useEffect(() => {
    view.fit = fit;
    view.top = () => {   // look straight down: a flat 2D plan of the bench
      const target = controls.current!.target;
      camera.position.copy(target).addScaledVector(TOP_DIR, 900); camera.lookAt(target); controls.current!.update();
    };
    view.zoom = f => { camera.zoom = Math.min(6, Math.max(0.5, camera.zoom * f)); camera.updateProjectionMatrix(); };
  });

  useEffect(() => {   // arrow keys slide the view, as long as the student is not typing
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, number[]>)[e.key];
      if (!dir || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, select, [role="tab"], [role="slider"]') || !controls.current) return;
      e.preventDefault();
      const right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      // A selected part or second breadboard moves instead of the view, along whichever edge of the table points most the way of the arrow on screen:
      // a part one hole (five with Shift), the breadboard one hole's width (ten with Shift).
      const hot = useLab.getState().hot, way = right.clone().multiplyScalar(dir[0]).addScaledVector(up, dir[1]), along = Math.abs(way.x) >= Math.abs(way.z);
      const sx = along ? Math.sign(way.x) : 0, sz = along ? 0 : Math.sign(way.z);
      if (isSecond(hot)) { const step = PITCH * (e.shiftKey ? 10 : 1); nudgeBreadboard(sx * step, sz * step); return; }
      if (isMovable(hot)) { const n = e.shiftKey ? 5 : 1; nudgePart(hot!, sz * n, sx * n); return; }   // across the table is along the columns, away and towards is across the rows
      const step = (e.shiftKey ? 60 : 20) / camera.zoom;
      const move = right.multiplyScalar(dir[0] * step).addScaledVector(up, dir[1] * step);
      controls.current.target.add(move); camera.position.add(move); controls.current.update();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera]);

  useFrame(() => {   // copy pin states and on-screen inputs onto the 3D parts
    const s = useLab.getState(), now = currentReadout();   // the present, or the recorded moment the student is looking at
    let freq = 0;
    world.set('builtin', now ? now.builtinGlow : 0);
    benchOf(s).forEach((it, k) => {
      const id = itemId(it, k);
      if (it.t === 'led') world.set(id, now ? now.ledGlow(id) : 0);
      if (it.t === 'rgb') world.set(id, now ? RGB_CHANNELS.reduce((n, c) => n * 256 + Math.round(now.ledGlow(`${id}:${c[0]}`) * 255), 0) : 0);   // its three brightnesses in one number
      if (it.t === 'wire') world.set(id, now ? now.circuit.wireAmps(id) : 0);
      if (it.t === 'buzzer') { const f = now ? now.buzzFreq(id) : 0; world.set(id, f); freq ||= f; }
      if (it.t === 'servo' && now) world.set(id, now.servoAngle(id));   // an unpowered or stopped servo stays where it was
      if (it.t === 'lcd') world.lcd(id, now ? now.lcd(id) : DARK_LCD);   // a stopped sketch leaves the board, and so the display, without power
    });
    for (const id in s.inputs) world.set(id, s.inputs[id]);
    setTone(s.sound && !s.paused && s.cursor == null ? freq : 0);
    world.animate(performance.now());
    labelEls.current.forEach((el, i) => {   // keep each label over its part
      const p = projected.copy(world.hots[i].pos).project(camera);
      el.style.transform = `translate(${((p.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`;
    });
  });

  return (
    <>
      <hemisphereLight args={[0xffffff, 0x9aa6b2, 0.46 * Math.PI]} />
      <directionalLight args={[0xffffff, 0.56 * Math.PI]} position={[-70, 150, 110]} />
      {/* casts the shadows and lights nothing: shadows from the main light would fall straight behind everything, out of sight of the camera beside it */}
      <directionalLight ref={sun} args={[0xffffff, 0]} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={5} shadow-bias={-0.0004} shadow-normalBias={0.4} />
      <OrbitControls ref={controls} enableDamping zoomToCursor screenSpacePanning
        mouseButtons={{ LEFT: nav === 'pan' ? T.MOUSE.PAN : T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: nav === 'pan' ? T.MOUSE.ROTATE : T.MOUSE.PAN }}
        touches={{ ONE: nav === 'pan' ? T.TOUCH.PAN : T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN }} maxPolarAngle={Math.PI * 0.47} minZoom={0.5} maxZoom={6} />
      <primitive
        key={world.group.uuid}
        object={world.group}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta < 5 && !useLab.getState().tool) selectHot(pickOf(e.object)); }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const st = useLab.getState(); gl.domElement.style.cursor = st.drag || st.bbDrag || st.partDrag ? 'grabbing' : st.tool ? 'crosshair' : (st.probe && isWireEnd(st.probe.name)) || isSecond(pickOf(e.object)) || isMovable(pickOf(e.object)) ? 'grab' : pickOf(e.object) ? 'pointer' : ''; }}
        onPointerOut={() => { gl.domElement.style.cursor = ''; }}
      />
    </>
  );
}
