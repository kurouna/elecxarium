import { describe, it, expect } from 'vitest';
import { createWorld, type SpeciesDef } from '@/engine/world';
import { runHeadless, type Brain } from '@/engine/sim';

const defs: SpeciesDef[] = [
  {
    id: 'h',
    name: 'Herb',
    role: 'herbivore',
    traits: { maxEnergy: 30, eyesight: 20, speed: 20, attack: 0, defense: 10, eatingSpeed: 20, camouflage: 0 },
  },
  {
    id: 'c',
    name: 'Carn',
    role: 'carnivore',
    traits: { maxEnergy: 20, eyesight: 30, speed: 25, attack: 20, defense: 5, eatingSpeed: 5, camouflage: 0 },
  },
];

// Wander brain exercises sense.random() → tests the full determinism chain.
const wander: Brain = (sense) => {
  const ang = sense.random() * Math.PI * 2;
  const r = sense.self.moveMax;
  return {
    kind: 'move',
    to: {
      x: sense.self.position.x + Math.cos(ang) * r,
      y: sense.self.position.y + Math.sin(ang) * r,
    },
  };
};

const brains = (): Map<string, Brain> =>
  new Map([
    ['h', wander],
    ['c', wander],
  ]);

describe('determinism', () => {
  it('same seed + same brains → identical snapshots', () => {
    const s1 = runHeadless(createWorld({ seed: 777, species: defs }), brains(), { ticks: 60 });
    const s2 = runHeadless(createWorld({ seed: 777, species: defs }), brains(), { ticks: 60 });
    expect(s1).toEqual(s2);
  });

  it('different seed → diverging outcome', () => {
    const s1 = runHeadless(createWorld({ seed: 1, species: defs }), brains(), { ticks: 30 });
    const s2 = runHeadless(createWorld({ seed: 2, species: defs }), brains(), { ticks: 30 });
    expect(s1).not.toEqual(s2);
  });

  it('emits one snapshot per tick', () => {
    const snaps = runHeadless(createWorld({ seed: 3, species: defs }), brains(), { ticks: 25 });
    expect(snaps.length).toBe(25);
    expect(snaps[24]!.tick).toBe(25);
  });
});
