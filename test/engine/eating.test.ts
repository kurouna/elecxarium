import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { addAnimal, addCarcass, addPlant } from '@/engine/world';
import { resolveTick } from '@/engine/tick';
import { arena, sdef } from './helpers';

const eat = (id: string, targetId: string): Map<string, Action> =>
  new Map([[id, { kind: 'eat', targetId }]]);

describe('eating', () => {
  it('herbivore eats an adjacent plant', () => {
    const w = arena([sdef('h', 'herbivore', { maxEnergy: 50, eatingSpeed: 100 })]);
    const a = addAnimal(w, w.species.get('h')!, { x: 100, y: 100 });
    a.energy = 20;
    const plant = addPlant(w, { x: 103, y: 100 }, 60);
    resolveTick(w, eat(a.id, plant.id));
    expect(a.energy).toBeGreaterThan(20);
    expect(plant.energy).toBeLessThan(60);
    expect(a.events.some((e) => e.type === 'ateOk')).toBe(true);
  });

  it('carnivore scavenges a carcass', () => {
    const w = arena([sdef('c', 'carnivore', { maxEnergy: 50, eatingSpeed: 100 })]);
    const a = addAnimal(w, w.species.get('c')!, { x: 100, y: 100 });
    a.energy = 20;
    const c = addCarcass(w, { x: 102, y: 100 }, 40);
    resolveTick(w, eat(a.id, c.id));
    expect(a.energy).toBeGreaterThan(20);
  });

  it('eating out of reach fails and leaves food untouched', () => {
    const w = arena([sdef('h', 'herbivore', { maxEnergy: 50, eatingSpeed: 50 })]);
    const a = addAnimal(w, w.species.get('h')!, { x: 100, y: 100 });
    a.energy = 20;
    const plant = addPlant(w, { x: 500, y: 500 }, 60);
    resolveTick(w, eat(a.id, plant.id));
    expect(plant.energy).toBeGreaterThanOrEqual(60); // not consumed (only grew)
    expect(a.events.some((e) => e.type === 'eatFailed' && e.reason === 'tooFar')).toBe(true);
  });

  it('carnivore cannot eat live prey (notFood)', () => {
    const w = arena([sdef('c', 'carnivore', { maxEnergy: 50, eatingSpeed: 50 }), sdef('h', 'herbivore', { maxEnergy: 50 })]);
    const a = addAnimal(w, w.species.get('c')!, { x: 100, y: 100 });
    const prey = addAnimal(w, w.species.get('h')!, { x: 101, y: 100 });
    resolveTick(w, eat(a.id, prey.id));
    expect(a.events.some((e) => e.type === 'eatFailed' && e.reason === 'notFood')).toBe(true);
  });
});
