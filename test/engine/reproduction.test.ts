import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { addAnimal } from '@/engine/world';
import { resolveTick } from '@/engine/tick';
import { arena, sdef } from './helpers';

const reproduce = (id: string): Map<string, Action> => new Map([[id, { kind: 'reproduce' }]]);

describe('reproduction', () => {
  it('spawns a child when energetic and off cooldown', () => {
    const w = arena([sdef('h', 'herbivore', { maxEnergy: 100 })]);
    const sp = w.species.get('h')!;
    const a = addAnimal(w, sp, { x: 100, y: 100 });
    a.energy = sp.derived.energyMax;
    resolveTick(w, reproduce(a.id));
    expect(sp.births).toBe(1);
    expect(w.animals.size).toBe(2);
    expect(a.reproduceCooldown).toBeGreaterThan(0);
    expect(a.events.some((e) => e.type === 'reproduced')).toBe(true);
  });

  it('does not reproduce below the energy threshold', () => {
    const w = arena([sdef('h', 'herbivore', { maxEnergy: 100 })]);
    const sp = w.species.get('h')!;
    const a = addAnimal(w, sp, { x: 100, y: 100 });
    a.energy = sp.derived.energyMax * 0.3;
    resolveTick(w, reproduce(a.id));
    expect(sp.births).toBe(0);
    expect(w.animals.size).toBe(1);
  });

  it('child starts with the taxed reproduction cost', () => {
    const w = arena([sdef('h', 'herbivore', { maxEnergy: 100 })]);
    const sp = w.species.get('h')!;
    const a = addAnimal(w, sp, { x: 100, y: 100 });
    a.energy = sp.derived.energyMax;
    resolveTick(w, reproduce(a.id));
    const child = [...w.animals.values()].find((x) => x.id !== a.id)!;
    const expected = sp.derived.energyMax * w.config.repro.cost * (1 - w.config.repro.tax);
    expect(child.energy).toBeCloseTo(expected, 5);
  });
});
