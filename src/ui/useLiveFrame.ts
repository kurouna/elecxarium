import { useEffect, useState } from 'react';
import { frameFromSnapshot, interpolateFrame } from '@/render/interpolate';
import type { RenderFrame } from '@/render/types';
import { useMatch } from '@/state/store';

const EMPTY: RenderFrame = { tick: 0, animals: [], plants: [], carcasses: [] };

/** Smoothly interpolates between the last two live snapshots; idle while paused. */
export function useLiveFrame(): RenderFrame {
  const prev = useMatch((s) => s.prev);
  const curr = useMatch((s) => s.curr);
  const lastStepAt = useMatch((s) => s.lastStepAt);
  const speed = useMatch((s) => s.speed);
  const running = useMatch((s) => s.running);
  const [animated, setAnimated] = useState<RenderFrame>(EMPTY);

  // Running: interpolate on each animation frame. The time read and setState both
  // happen inside the rAF callback — never synchronously during render or in the effect body.
  useEffect(() => {
    if (!running || !curr) return;
    const interval = 1000 / Math.max(1, speed);
    let raf = 0;
    const loop = (): void => {
      const alpha = Math.min(1, (performance.now() - lastStepAt) / interval);
      setAnimated(prev ? interpolateFrame(prev, curr, alpha) : frameFromSnapshot(curr));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, prev, curr, lastStepAt, speed]);

  // Paused / pre-first-frame: derive directly from the latest snapshot (pure).
  if (running && curr && animated !== EMPTY) return animated;
  return curr ? frameFromSnapshot(curr) : EMPTY;
}
