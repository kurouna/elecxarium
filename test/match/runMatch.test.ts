import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { addAnimal } from '@/engine/world';
import { DEFAULT_CONFIG } from '@/engine/config';
import type { SensePayload, World } from '@/engine/types';
import { stepWithBrains, tickBudgetMs, type BrainProvider } from '@/match/runMatch';
import { arena, sdef } from '../engine/helpers';

class MockHost implements BrainProvider {
  seen = new Map<string, number>();
  constructor(private readonly decide: (speciesId: string, id: string) => Action) {}
  async tick(speciesId: string, senses: { id: string; payload: SensePayload }[]): Promise<Map<string, Action>> {
    this.seen.set(speciesId, (this.seen.get(speciesId) ?? 0) + senses.length);
    const out = new Map<string, Action>();
    for (const s of senses) out.set(s.id, this.decide(speciesId, s.id));
    return out;
  }
}

function withOneHerbivore(): { world: World; id: string } {
  const w = arena([sdef('h', 'herbivore', { maxEnergy: 50, speed: 50 })]);
  const a = addAnimal(w, w.species.get('h')!, { x: 100, y: 100 });
  return { world: w, id: a.id };
}

describe('tickBudgetMs', () => {
  it('scales with live count and caps at maxMs', () => {
    expect(tickBudgetMs(DEFAULT_CONFIG, 0)).toBe(DEFAULT_CONFIG.compute.baseMs);
    expect(tickBudgetMs(DEFAULT_CONFIG, 10)).toBeCloseTo(
      DEFAULT_CONFIG.compute.baseMs + DEFAULT_CONFIG.compute.perCreatureMs * 10,
    );
    expect(tickBudgetMs(DEFAULT_CONFIG, 100000)).toBe(DEFAULT_CONFIG.compute.maxMs);
  });
});

describe('stepWithBrains', () => {
  it('applies brain actions and advances the tick', async () => {
    const { world, id } = withOneHerbivore();
    const host = new MockHost(() => ({ kind: 'move', to: { x: 900, y: 100 } }));
    const before = world.animals.get(id)!.pos.x;
    await stepWithBrains(world, host);
    expect(world.tick).toBe(1);
    expect(world.animals.get(id)!.pos.x).toBeGreaterThan(before); // moved toward 900
    expect(host.seen.get('h')).toBe(1);
  });

  it('queries every species each tick', async () => {
    const w = arena([sdef('h', 'herbivore'), sdef('c', 'carnivore')]);
    addAnimal(w, w.species.get('h')!, { x: 100, y: 100 });
    addAnimal(w, w.species.get('c')!, { x: 200, y: 200 });
    const host = new MockHost(() => ({ kind: 'idle' }));
    await stepWithBrains(w, host);
    expect(host.seen.get('h')).toBe(1);
    expect(host.seen.get('c')).toBe(1);
  });
});
