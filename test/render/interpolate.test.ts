import { describe, it, expect } from 'vitest';
import { interpolateFrame, frameFromSnapshot } from '@/render/interpolate';
import type { AnimalSnap, Snapshot } from '@/engine/types';

const an = (id: string, x: number, y: number): AnimalSnap => ({
  id,
  speciesId: 's',
  role: 'herbivore',
  x,
  y,
  energy: 10,
  energyMax: 20,
  defending: false,
  age: 0,
});

const snap = (tick: number, animals: AnimalSnap[]): Snapshot => ({
  tick,
  animals,
  plants: [],
  carcasses: [],
  species: [],
  events: [],
});

describe('interpolateFrame', () => {
  it('lerps positions at the midpoint', () => {
    const f = interpolateFrame(snap(0, [an('a1', 0, 0)]), snap(1, [an('a1', 10, 20)]), 0.5);
    expect(f.animals[0]!.x).toBe(5);
    expect(f.animals[0]!.y).toBe(10);
  });

  it('clamps alpha to [0,1]', () => {
    const prev = snap(0, [an('a1', 0, 0)]);
    const next = snap(1, [an('a1', 10, 0)]);
    expect(interpolateFrame(prev, next, 2).animals[0]!.x).toBe(10);
    expect(interpolateFrame(prev, next, -1).animals[0]!.x).toBe(0);
  });

  it('places newborns (absent from prev) at their next position', () => {
    const f = interpolateFrame(snap(0, []), snap(1, [an('a2', 7, 7)]), 0.5);
    expect(f.animals).toHaveLength(1);
    expect(f.animals[0]!.x).toBe(7);
  });

  it('drops animals absent from next (dead)', () => {
    expect(interpolateFrame(snap(0, [an('a1', 0, 0)]), snap(1, []), 0.5).animals).toHaveLength(0);
  });

  it('frameFromSnapshot copies through', () => {
    const f = frameFromSnapshot(snap(3, [an('a1', 1, 2)]));
    expect(f.tick).toBe(3);
    expect(f.animals[0]!.id).toBe('a1');
  });
});
