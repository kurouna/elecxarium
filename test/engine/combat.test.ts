import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { addAnimal } from '@/engine/world';
import { resolveTick } from '@/engine/tick';
import { arena, sdef } from './helpers';

describe('combat', () => {
  it('a carnivore damages an adjacent target', () => {
    const w = arena([sdef('c', 'carnivore', { attack: 100 }), sdef('h', 'herbivore', { maxEnergy: 50 })]);
    const att = addAnimal(w, w.species.get('c')!, { x: 100, y: 100 });
    const tgt = addAnimal(w, w.species.get('h')!, { x: 103, y: 100 });
    const e0 = tgt.energy;
    resolveTick(w, new Map<string, Action>([[att.id, { kind: 'attack', targetId: tgt.id }]]));
    expect(tgt.energy).toBeLessThan(e0 - 25); // ~30 damage dominates metabolism
  });

  it('defending reduces incoming damage', () => {
    const lost = (defend: boolean): number => {
      const w = arena([
        sdef('c', 'carnivore', { attack: 100 }),
        sdef('h', 'herbivore', { maxEnergy: 80, defense: 80 }),
      ]);
      const att = addAnimal(w, w.species.get('c')!, { x: 100, y: 100 });
      const tgt = addAnimal(w, w.species.get('h')!, { x: 102, y: 100 });
      const e0 = tgt.energy;
      const actions = new Map<string, Action>([[att.id, { kind: 'attack', targetId: tgt.id }]]);
      if (defend) actions.set(tgt.id, { kind: 'defend' });
      resolveTick(w, actions);
      return e0 - tgt.energy;
    };
    expect(lost(true)).toBeLessThan(lost(false));
  });

  it('credits a kill and leaves a carcass', () => {
    const w = arena([sdef('c', 'carnivore', { attack: 100 }), sdef('h', 'herbivore', { maxEnergy: 50 })]);
    const spC = w.species.get('c')!;
    const att = addAnimal(w, spC, { x: 100, y: 100 });
    const tgt = addAnimal(w, w.species.get('h')!, { x: 101, y: 100 });
    tgt.energy = 5;
    resolveTick(w, new Map<string, Action>([[att.id, { kind: 'attack', targetId: tgt.id }]]));
    expect(w.animals.has(tgt.id)).toBe(false);
    expect(spC.kills).toBe(1);
    expect(w.carcasses.size).toBeGreaterThan(0);
  });

  it('herbivores cannot attack', () => {
    const w = arena([sdef('h', 'herbivore', { attack: 100, maxEnergy: 50 }), sdef('p', 'herbivore', { maxEnergy: 50 })]);
    const att = addAnimal(w, w.species.get('h')!, { x: 100, y: 100 });
    const tgt = addAnimal(w, w.species.get('p')!, { x: 101, y: 100 });
    const e0 = tgt.energy;
    resolveTick(w, new Map<string, Action>([[att.id, { kind: 'attack', targetId: tgt.id }]]));
    expect(e0 - tgt.energy).toBeLessThan(2); // only metabolism, no attack
  });
});
