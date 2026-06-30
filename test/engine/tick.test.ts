import { describe, it, expect } from 'vitest';
import { createWorld, type SpeciesDef } from '@/engine/world';
import { resolveTick } from '@/engine/tick';
import { DEFAULT_CONFIG } from '@/engine/config';

const sp: SpeciesDef = {
  id: 'h',
  name: 'Herb',
  role: 'herbivore',
  traits: { maxEnergy: 20, eyesight: 20, speed: 0, attack: 0, defense: 0, eatingSpeed: 0, camouflage: 0 },
};

describe('tick (M1: movement / metabolism / death / plants)', () => {
  it('metabolism drains energy and advances age/tick', () => {
    const w = createWorld({ seed: 1, species: [sp] });
    const a = [...w.animals.values()][0]!;
    const e0 = a.energy;
    resolveTick(w, new Map());
    expect(a.energy).toBeLessThan(e0);
    expect(a.age).toBe(1);
    expect(w.tick).toBe(1);
  });

  it('starvation removes animals and leaves carcasses', () => {
    const w = createWorld({ seed: 1, species: [sp] });
    const before = w.animals.size;
    for (let i = 0; i < 2000 && w.animals.size > 0; i++) resolveTick(w, new Map());
    expect(w.animals.size).toBe(0);
    expect(w.carcasses.size).toBeGreaterThan(0);
    expect(w.species.get('h')!.deaths).toBe(before);
  });

  it('plants grow but never exceed max', () => {
    const w = createWorld({ seed: 1, species: [sp] });
    const p = [...w.plants.values()][0]!;
    const e0 = p.energy;
    resolveTick(w, new Map());
    expect(p.energy).toBeGreaterThan(e0);
    for (let i = 0; i < 200; i++) resolveTick(w, new Map());
    for (const pl of w.plants.values()) {
      expect(pl.energy).toBeLessThanOrEqual(DEFAULT_CONFIG.plants.max);
    }
  });

  it('tracks population integral and peak', () => {
    const w = createWorld({ seed: 1, species: [sp] });
    resolveTick(w, new Map());
    const s = w.species.get('h')!;
    expect(s.peak).toBe(DEFAULT_CONFIG.match.initialPop);
    expect(s.popIntegral).toBe(DEFAULT_CONFIG.match.initialPop);
  });
});
