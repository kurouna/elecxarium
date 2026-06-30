import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@/engine/types';
import { frameFromSnapshot, interpolateFrame } from './interpolate';
import type { RenderFrame } from './types';

const EMPTY: RenderFrame = { tick: 0, animals: [], plants: [], carcasses: [] };

export interface Playback {
  frame: RenderFrame;
  /** Float playhead in snapshot-index units. */
  head: number;
  index: number;
  total: number;
  playing: boolean;
  atEnd: boolean;
  setPlaying: (p: boolean) => void;
  seek: (index: number) => void;
}

/** Plays an array of snapshots, interpolating between them at `tickRate` snapshots/sec. */
export function usePlayback(snapshots: Snapshot[], tickRate: number, loop = false): Playback {
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState(0);

  // Latest-value refs are synced in effects (never written during render).
  const headRef = useRef(0);
  const snapsRef = useRef(snapshots);
  const loopRef = useRef(loop);

  useEffect(() => {
    snapsRef.current = snapshots;
  }, [snapshots]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // The rAF loop only runs while playing, so a paused page is genuinely idle.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      const max = snapsRef.current.length - 1;
      if (max > 0) {
        let h = headRef.current + dt * tickRate;
        if (h >= max) {
          if (loopRef.current) {
            h = 0;
          } else {
            headRef.current = max;
            setHead(max);
            setPlaying(false);
            return;
          }
        }
        headRef.current = h;
        setHead(h);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, tickRate]);

  const seek = (index: number): void => {
    headRef.current = index;
    setHead(index);
  };

  const max = Math.max(0, snapshots.length - 1);
  const clamped = Math.min(Math.max(head, 0), max);
  const i = Math.floor(clamped);

  let frame: RenderFrame;
  if (snapshots.length === 0) frame = EMPTY;
  else if (i >= max) frame = frameFromSnapshot(snapshots[max]!);
  else frame = interpolateFrame(snapshots[i]!, snapshots[i + 1]!, clamped - i);

  return {
    frame,
    head: clamped,
    index: i,
    total: snapshots.length,
    playing,
    atEnd: i >= max && max > 0,
    setPlaying,
    seek,
  };
}
