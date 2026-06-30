import { describe, it, expect } from 'vitest';
import { compileCreature } from '@/sandbox/compile';
import { createBrainRuntime } from '@/sandbox/brainCore';
import * as creatureApi from '@elecxarium/creature';
import type { SensePayload } from '@elecxarium/creature';

// Mimic the worker harness's module/require contract in-process (test only — the real
// path runs the same compiled code + brainCore inside a Blob worker under CSP).
function evalCreature(code: string): unknown {
  const module = { exports: {} as Record<string, unknown> };
  const require = (n: string): unknown => {
    if (n === '@elecxarium/creature') return creatureApi;
    throw new Error('no import: ' + n);
  };
  const fn = new Function('module', 'exports', 'require', code);
  fn(module, module.exports, require);
  return module.exports;
}

const payload = (over: Partial<SensePayload> = {}): SensePayload => ({
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
  randomSeed: 123,
  ...over,
});

const HERBIVORE_SRC = `
import { defineCreature, moveToward, nearest, idle } from '@elecxarium/creature';
interface Mem { seen: number }
export default defineCreature<Mem>({
  meta: { name: 'Tester', author: 'me', role: 'herbivore' },
  traits: { maxEnergy: 20, eyesight: 30, speed: 20, attack: 0, defense: 10, eatingSpeed: 20, camouflage: 0 },
  initMemory: () => ({ seen: 0 }),
  think(sense, mem) {
    mem.seen += sense.nearby.length;
    const food = nearest(sense.nearby, (o) => o.kind === 'plant');
    return food ? moveToward(food.position) : idle();
  },
});
`;

describe('sandbox pipeline (compile → define → think)', () => {
  it('runs a compiled creature end-to-end', () => {
    const c = compileCreature(HERBIVORE_SRC, 'Tester');
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    const rt = createBrainRuntime();
    const init = rt.init(evalCreature(c.code));
    expect(init.ok).toBe(true);
    if (init.ok) {
      expect(init.meta.name).toBe('Tester');
      expect(init.traits.eyesight).toBe(30);
    }

    const withFood = payload({
      nearby: [
        {
          id: 'p1',
          kind: 'plant',
          species: 'plant',
          isOwn: false,
          position: { x: 10, y: 0 },
          distance: 10,
          energyState: 'high',
          isAlive: true,
        },
      ],
    });
    expect(rt.tick([{ id: 'a1', payload: withFood }])[0]!.action).toEqual({
      kind: 'move',
      to: { x: 10, y: 0 },
    });
    expect(rt.tick([{ id: 'a1', payload: payload() }])[0]!.action).toEqual({ kind: 'idle' });
  });

  it('isolates a throwing think() as idle', () => {
    const bad = compileCreature(
      `import { defineCreature } from '@elecxarium/creature';
       export default defineCreature({
         meta: { name: 'Bad', role: 'carnivore' },
         traits: { maxEnergy: 0, eyesight: 0, speed: 0, attack: 0, defense: 0, eatingSpeed: 0, camouflage: 0 },
         think() { throw new Error('boom'); },
       });`,
      'Bad',
    );
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    const rt = createBrainRuntime();
    expect(rt.init(evalCreature(bad.code)).ok).toBe(true);
    expect(rt.tick([{ id: 'x', payload: payload() }])[0]!.action).toEqual({ kind: 'idle' });
  });
});
