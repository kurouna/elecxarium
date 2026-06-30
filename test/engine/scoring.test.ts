import { describe, it, expect } from 'vitest';
import { computeScores, aliveSpeciesCount, isMatchOver } from '@/engine/scoring';
import { arena, sdef } from './helpers';

describe('scoring', () => {
  it('ranks survivors above the extinct, even with less popIntegral', () => {
    const w = arena([sdef('a', 'herbivore'), sdef('b', 'herbivore')]);
    const a = w.species.get('a')!;
    const b = w.species.get('b')!;
    a.alive = 5;
    a.popIntegral = 100;
    b.alive = 0;
    b.popIntegral = 5000;
    const rows = computeScores(w);
    expect(rows[0]!.speciesId).toBe('a');
    expect(rows[0]!.rank).toBe(1);
  });

  it('places disqualified species last', () => {
    const w = arena([sdef('a', 'herbivore'), sdef('b', 'herbivore')]);
    w.species.get('a')!.popIntegral = 10;
    const b = w.species.get('b')!;
    b.popIntegral = 5000;
    b.disqualified = true;
    const rows = computeScores(w);
    expect(rows.find((r) => r.speciesId === 'b')!.rank).toBe(2);
  });

  it('reports alive-species count and match-over', () => {
    const w = arena([sdef('a', 'herbivore'), sdef('b', 'herbivore')]);
    w.species.get('a')!.alive = 3;
    expect(aliveSpeciesCount(w)).toBe(1);
    expect(isMatchOver(w)).toBe(true);
  });
});
