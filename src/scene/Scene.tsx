/* The 3D canvas and everything in it. This module and three.js are loaded only when a mission opens, so the home page stays light. */
import { Canvas } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import { selectHot } from '../state/actions';
import { useLab } from '../state/store';
import { Bench } from './Bench';

export default function Scene({ labelLayer }: { labelLayer: RefObject<HTMLDivElement | null> }) {
  const down = useRef([0, 0]);
  return (
    <div style={{ position: 'absolute', inset: 0 }} onPointerDown={e => { down.current = [e.clientX, e.clientY]; }}>
      {/* legacy linear flat: plain colours in, plain colours out. The toon look needs no colour management or tone mapping. */}
      <Canvas
        orthographic legacy linear flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ manual: true, near: 1, far: 4000 }}
        style={{ position: 'absolute', inset: 0 }}
        onPointerMissed={e => { if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) < 5 && !useLab.getState().tool) selectHot(null); }}
      >
        <Bench labelLayer={labelLayer} />
      </Canvas>
    </div>
  );
}
