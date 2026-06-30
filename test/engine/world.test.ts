import { describe, it, expect } from 'vitest';
import { createWorld, buildSnapshot, type SpeciesDef } from '@/engine/world';
import { DEFAULT_CONFIG } from '@/engine/config';

const herb: SpeciesDef = {
  id: 'h',
  name: 'Herb',
  role: 'herbivore',
  traits: { maxEnergy: 20, eyesight: 20, speed: 20, attack: 0, defense: 10, eatingSpeed: 20, camouflage: 10 },
};
const carn: SpeciesDef = {
  id: 'c',
  name: 'Carn',
  role: 'carnivore',
  traits: { maxEnergy: 15, eyesight: 25, speed: 25, attack: 25, defense: 5, eatingSpeed: 5, camouflage: 0 },
};

describe('world', () => {
  it('spawns initial population + plants', () => {
    const w = createWorld({ seed: 1, species: [herb, carn] });
    expect(w.animals.size).toBe(DEFAULT_CONFIG.match.initialPop * 2);
    expect(w.plants.size).toBe(DEFAULT_CONFIG.plants.target);
    expect(w.species.size).toBe(2);
  });

  it('assigns distinct hues per species', () => {
    const w = createWorld({ seed: 1, species: [herb, carn] });
    const hues = [...w.species.values()].map((s) => s.hue);
    expect(new Set(hues).size).toBe(2);
  });

  it('produces a snapshot matching world contents', () => {
    const w = createWorld({ seed: 1, species: [herb, carn] });
    const snap = buildSnapshot(w);
    expect(snap.tick).toBe(0);
    expect(snap.animals.length).toBe(DEFAULT_CONFIG.match.initialPop * 2);
    expect(snap.plants.length).toBe(DEFAULT_CONFIG.plants.target);
    expect(snap.species.length).toBe(2);
  });

  it('places animals within world bounds', () => {
    const w = createWorld({ seed: 5, species: [herb] });
    for (const a of w.animals.values()) {
      expect(a.pos.x).toBeGreaterThanOrEqual(0);
      expect(a.pos.x).toBeLessThanOrEqual(DEFAULT_CONFIG.world.width);
      expect(a.pos.y).toBeGreaterThanOrEqual(0);
      expect(a.pos.y).toBeLessThanOrEqual(DEFAULT_CONFIG.world.height);
    }
  });
});
