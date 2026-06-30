import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { addAnimal } from '@/engine/world';
import { resolveTick } from '@/engine/tick';
import { collectSenses } from '@/engine/sense';
import { arena, sdef } from './helpers';

const NONE: Map<string, Action> = new Map();
const eat = (id: string, targetId: string): Map<string, Action> => new Map([[id, { kind: 'eat', targetId }]]);
const move = (id: string, to: { x: number; y: number }): Map<string, Action> =>
  new Map([[id, { kind: 'move', to }]]);
const reproduce = (id: string): Map<string, Action> => new Map([[id, { kind: 'reproduce' }]]);
const attack = (id: string, targetId: string): Map<string, Action> =>
  new Map([[id, { kind: 'attack', targetId }]]);

describe('programmable plants (role:plant)', () => {
  it('photosynthesises: gains energy each tick with no input', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 40, eatingSpeed: 50 })]);
    const p = addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    p.energy = 30;
    resolveTick(w, NONE);
    expect(p.energy).toBeGreaterThan(30);
  });

  it('is rooted: ignores move actions', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 40, speed: 100 })]);
    const p = addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    resolveTick(w, move(p.id, { x: 800, y: 800 }));
    expect(p.pos.x).toBe(100);
    expect(p.pos.y).toBe(100);
  });

  it('presents to others as kind "plant" so herbivores target it as food', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 40 }), sdef('h', 'herbivore', { eyesight: 50 })]);
    addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    addAnimal(w, w.species.get('h')!, { x: 112, y: 100 });
    const batch = collectSenses(w);
    const herb = batch.find((b) => b.speciesId === 'h')!.senses[0]!;
    const seen = herb.payload.nearby.find((o) => o.kind === 'plant');
    expect(seen).toBeDefined();
    expect(seen!.role).toBe('plant');
  });

  it('a herbivore grazing a plant moves energy from plant to herbivore', () => {
    const w = arena([
      sdef('p', 'plant', { maxEnergy: 80 }),
      sdef('h', 'herbivore', { maxEnergy: 80, eatingSpeed: 100 }),
    ]);
    const p = addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    p.energy = 60;
    const h = addAnimal(w, w.species.get('h')!, { x: 102, y: 100 });
    h.energy = 20;
    resolveTick(w, eat(h.id, p.id));
    expect(h.energy).toBeGreaterThan(20);
    expect(p.energy).toBeLessThan(60);
    expect(h.events.some((e) => e.type === 'ateOk')).toBe(true);
  });

  it('leaves no carcass when it dies (old age)', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 40 })]);
    const p = addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    p.age = p.lifespan + 1;
    resolveTick(w, NONE);
    expect(w.animals.has(p.id)).toBe(false);
    expect(w.carcasses.size).toBe(0);
    expect(w.species.get('p')!.deaths).toBe(1);
  });

  it('cannot be attacked by carnivores (graze it, do not bite it)', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 80 }), sdef('c', 'carnivore', { attack: 100 })]);
    const p = addAnimal(w, w.species.get('p')!, { x: 100, y: 100 });
    p.energy = 60;
    const c = addAnimal(w, w.species.get('c')!, { x: 101, y: 100 });
    resolveTick(w, attack(c.id, p.id));
    expect(p.energy).toBeGreaterThanOrEqual(60); // unharmed (only photosynthesis applied)
  });

  it('reproduces (spreads) when full and off cooldown, and the child is also a plant', () => {
    const w = arena([sdef('p', 'plant', { maxEnergy: 40 })]);
    const sp = w.species.get('p')!;
    const p = addAnimal(w, sp, { x: 100, y: 100 });
    p.energy = sp.derived.energyMax;
    resolveTick(w, reproduce(p.id));
    expect(sp.births).toBe(1);
    expect(w.animals.size).toBe(2);
    const child = [...w.animals.values()].find((x) => x.id !== p.id)!;
    expect(child.role).toBe('plant');
  });
});
