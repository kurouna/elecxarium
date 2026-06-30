import { describe, it, expect } from 'vitest';
import { createBrainRuntime, sanitizeAction } from '@/sandbox/brainCore';
import { defineCreature } from '@elecxarium/creature';
import type { SensePayload } from '@elecxarium/creature';

const basePayload = (over: Partial<SensePayload> = {}): SensePayload => ({
  tick: 0,
  self: {
    id: 'a1',
    position: { x: 0, y: 0 },
    energy: 10,
    energyMax: 88,
    age: 0,
    lifespan: 1500,
    reach: 6,
    moveMax: 8,
    sightRadius: 100,
    canReproduce: false,
  },
  world: { width: 1000, height: 1000, center: { x: 500, y: 500 } },
  nearby: [],
  events: [],
  randomSeed: 7,
  ...over,
});

describe('sanitizeAction', () => {
  it('passes valid actions through', () => {
    expect(sanitizeAction({ kind: 'move', to: { x: 1, y: 2 } })).toEqual({ kind: 'move', to: { x: 1, y: 2 } });
    expect(sanitizeAction({ kind: 'attack', targetId: 'z' })).toEqual({ kind: 'attack', targetId: 'z' });
    expect(sanitizeAction({ kind: 'defend' })).toEqual({ kind: 'defend' });
    expect(sanitizeAction({ kind: 'reproduce' })).toEqual({ kind: 'reproduce' });
  });

  it('coerces junk to idle', () => {
    expect(sanitizeAction(null)).toEqual({ kind: 'idle' });
    expect(sanitizeAction(42)).toEqual({ kind: 'idle' });
    expect(sanitizeAction({ kind: 'move', to: { x: NaN, y: 0 } })).toEqual({ kind: 'idle' });
    expect(sanitizeAction({ kind: 'move', to: { x: Infinity, y: 0 } })).toEqual({ kind: 'idle' });
    expect(sanitizeAction({ kind: 'attack' })).toEqual({ kind: 'idle' });
    expect(sanitizeAction({ kind: 'fly' })).toEqual({ kind: 'idle' });
  });
});

describe('createBrainRuntime', () => {
  const def = defineCreature<{ n: number }>({
    meta: { name: 'T', role: 'herbivore' },
    traits: { maxEnergy: 10, eyesight: 10, speed: 10, attack: 0, defense: 0, eatingSpeed: 10, camouflage: 0 },
    initMemory: () => ({ n: 0 }),
    think(sense, mem) {
      mem.n++;
      return { kind: 'move', to: { x: sense.random() * 10, y: mem.n } };
    },
  });

  it('initializes a valid creature', () => {
    const rt = createBrainRuntime();
    const r = rt.init({ default: def });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.name).toBe('T');
      expect(r.traits.eyesight).toBe(10);
    }
  });

  it('rejects creatures missing think()', () => {
    const rt = createBrainRuntime();
    const r = rt.init({ default: { meta: { name: 'x', role: 'herbivore' }, traits: {} } });
    expect(r.ok).toBe(false);
  });

  it('rejects an invalid role', () => {
    const rt = createBrainRuntime();
    const r = rt.init({ default: { meta: { name: 'x', role: 'plant' }, traits: {}, think: () => ({ kind: 'idle' }) } });
    expect(r.ok).toBe(false);
  });

  it('persists per-creature memory across ticks', () => {
    const rt = createBrainRuntime();
    rt.init(def);
    const a1 = rt.tick([{ id: 'a1', payload: basePayload() }])[0]!.action;
    const a2 = rt.tick([{ id: 'a1', payload: basePayload() }])[0]!.action;
    expect(a1.kind).toBe('move');
    expect(a2.kind).toBe('move');
    if (a1.kind === 'move' && a2.kind === 'move') {
      expect(a1.to.y).toBe(1);
      expect(a2.to.y).toBe(2);
    }
  });

  it('is deterministic given the same randomSeed', () => {
    const rtA = createBrainRuntime();
    rtA.init(def);
    const rtB = createBrainRuntime();
    rtB.init(def);
    const a = rtA.tick([{ id: 'x', payload: basePayload({ randomSeed: 999 }) }])[0]!.action;
    const b = rtB.tick([{ id: 'x', payload: basePayload({ randomSeed: 999 }) }])[0]!.action;
    expect(a).toEqual(b);
  });

  it('returns idle before init', () => {
    const rt = createBrainRuntime();
    expect(rt.tick([{ id: 'x', payload: basePayload() }])[0]!.action).toEqual({ kind: 'idle' });
  });

  it('rejects traits that exceed the budget', () => {
    const rt = createBrainRuntime();
    const over = defineCreature({
      meta: { name: 'X', role: 'herbivore' },
      traits: { maxEnergy: 50, eyesight: 50, speed: 50, attack: 0, defense: 0, eatingSpeed: 0, camouflage: 0 }, // 150 > 100
      think: () => ({ kind: 'idle' }),
    });
    expect(rt.init(over).ok).toBe(false);
  });

  it('rejects non-integer / missing traits', () => {
    const rt = createBrainRuntime();
    const res = rt.init({
      default: { meta: { name: 'X', role: 'herbivore' }, traits: { maxEnergy: 1.5 }, think: () => ({ kind: 'idle' }) },
    });
    expect(res.ok).toBe(false);
  });
});
