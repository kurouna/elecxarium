import { describe, it, expect } from 'vitest';
import { nearest } from '@elecxarium/creature';
import { createWorld, type SpeciesDef } from '@/engine/world';
import { runHeadless, type Brain } from '@/engine/sim';

const herb: SpeciesDef = {
  id: 'h',
  name: 'Herb',
  role: 'herbivore',
  traits: { maxEnergy: 40, eyesight: 40, speed: 30, attack: 0, defense: 10, eatingSpeed: 30, camouflage: 0 },
};
const carn: SpeciesDef = {
  id: 'c',
  name: 'Carn',
  role: 'carnivore',
  traits: { maxEnergy: 30, eyesight: 40, speed: 35, attack: 30, defense: 5, eatingSpeed: 20, camouflage: 0 },
};

const herbBrain: Brain = (s) => {
  if (s.self.canReproduce) return { kind: 'reproduce' };
  const plant = nearest(s.nearby, (o) => o.kind === 'plant');
  if (!plant) return { kind: 'move', to: s.world.center };
  return plant.distance <= s.self.reach
    ? { kind: 'eat', targetId: plant.id }
    : { kind: 'move', to: plant.position };
};

const carnBrain: Brain = (s) => {
  const carcass = nearest(s.nearby, (o) => o.kind === 'carcass');
  if (carcass && carcass.distance <= s.self.reach) return { kind: 'eat', targetId: carcass.id };
  const prey = nearest(s.nearby, (o) => o.role === 'herbivore' && o.isAlive);
  if (prey) {
    return prey.distance <= s.self.reach
      ? { kind: 'attack', targetId: prey.id }
      : { kind: 'move', to: prey.position };
  }
  if (carcass) return { kind: 'move', to: carcass.position };
  return { kind: 'move', to: s.world.center };
};

const idleBrain: Brain = () => ({ kind: 'idle' });

const brains = (): Map<string, Brain> =>
  new Map([
    ['h', herbBrain],
    ['c', carnBrain],
  ]);

describe('ecosystem (full rules)', () => {
  it('stays deterministic with combat / eating / reproduction', () => {
    const s1 = runHeadless(createWorld({ seed: 55, species: [herb, carn] }), brains(), { ticks: 80 });
    const s2 = runHeadless(createWorld({ seed: 55, species: [herb, carn] }), brains(), { ticks: 80 });
    expect(s1).toEqual(s2);
  });

  it('eating sustains herbivores that would otherwise starve', () => {
    const eatW = createWorld({ seed: 7, species: [herb] });
    runHeadless(eatW, new Map([['h', herbBrain]]), { ticks: 150 });
    const idleW = createWorld({ seed: 7, species: [herb] });
    runHeadless(idleW, new Map([['h', idleBrain]]), { ticks: 150 });
    expect(eatW.species.get('h')!.alive).toBeGreaterThan(0);
    expect(idleW.species.get('h')!.alive).toBe(0);
  });

  it('produces predation or growth in a shared arena', () => {
    const w = createWorld({ seed: 99, species: [herb, carn] });
    runHeadless(w, brains(), { ticks: 200 });
    expect(w.species.get('c')!.kills + w.species.get('h')!.births).toBeGreaterThan(0);
  });
});
