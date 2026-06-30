import { describe, it, expect } from 'vitest';
import type { Action } from '@elecxarium/creature';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import type { SensePayload } from '@/engine/types';
import type { SpeciesDef } from '@/engine';
import { runTournament, type TournamentHost } from '@/match/tournament';

const defs: SpeciesDef[] = [
  { id: 'a', name: 'A', role: 'herbivore', traits: { maxEnergy: 20, eyesight: 20, speed: 10, attack: 0, defense: 0, eatingSpeed: 20, camouflage: 0 } },
  { id: 'b', name: 'B', role: 'herbivore', traits: { maxEnergy: 20, eyesight: 20, speed: 10, attack: 0, defense: 0, eatingSpeed: 20, camouflage: 0 } },
];

const cfg: Config = { ...DEFAULT_CONFIG, match: { ...DEFAULT_CONFIG.match, matchTicks: 120 } };

class IdleHost implements TournamentHost {
  resets = 0;
  async resetForRound(): Promise<void> {
    this.resets += 1;
  }
  async tick(_speciesId: string, senses: { id: string; payload: SensePayload }[]): Promise<Map<string, Action>> {
    const m = new Map<string, Action>();
    for (const s of senses) m.set(s.id, { kind: 'idle' });
    return m;
  }
}

describe('runTournament', () => {
  it('runs one round per seed and resets between rounds', async () => {
    const host = new IdleHost();
    const result = await runTournament(defs, host, [1, 2, 3], cfg);
    expect(result.rounds).toHaveLength(3);
    expect(host.resets).toBe(3);
    expect(result.standings).toHaveLength(2);
  });

  it('aggregates wins + totals and sorts standings', async () => {
    const result = await runTournament(defs, new IdleHost(), [10, 20], cfg);
    const totalWins = result.standings.reduce((n, s) => n + s.wins, 0);
    expect(totalWins).toBeLessThanOrEqual(2); // at most one winner per round
    // sorted: wins desc, then avgRank asc
    for (let i = 1; i < result.standings.length; i++) {
      const prev = result.standings[i - 1]!;
      const cur = result.standings[i]!;
      expect(prev.wins >= cur.wins).toBe(true);
    }
  });

  it('is deterministic for the same seeds', async () => {
    const r1 = await runTournament(defs, new IdleHost(), [7, 8], cfg);
    const r2 = await runTournament(defs, new IdleHost(), [7, 8], cfg);
    expect(r1.standings).toEqual(r2.standings);
  });
});
