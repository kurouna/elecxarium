import { describe, it, expect } from 'vitest';
import { computeScores, createWorld, isMatchOver, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG } from '@/engine/config';
import { stepWithBrains } from '@/match/runMatch';
import { TEMPLATES } from '@/templates';
import { loadCreature, LocalHost } from '../../scripts/localHost';

function template(id: string): string {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t.source;
}

// Guards against balance regressions: the default matchup must stay a real contest
// (both roles win some seeds) with actual predation — not the "carnivore always wins"
// or "herbivore always wins" degenerate states found during tuning.
describe('balance: default Grazer vs Stalker', () => {
  it('neither role dominates across seeds, and carnivores hunt', async () => {
    const loaded = [loadCreature('grazer', template('grazer')), loadCreature('stalker', template('stalker'))];
    const defs: SpeciesDef[] = loaded.map((l) => l.def);
    const mods = new Map(loaded.map((l) => [l.def.id, l.mod] as const));

    const wins = new Map<string, number>([
      ['grazer', 0],
      ['stalker', 0],
    ]);
    let totalKills = 0;
    const N = 16;

    for (let s = 0; s < N; s++) {
      const world = createWorld({ seed: s + 1, species: defs, config: DEFAULT_CONFIG });
      const host = new LocalHost(mods);
      let guard = 0;
      while (!isMatchOver(world) && guard < DEFAULT_CONFIG.match.matchTicks + 1) {
        await stepWithBrains(world, host);
        guard++;
      }
      const scores = computeScores(world);
      const top = scores[0];
      if (top && top.alive > 0) wins.set(top.speciesId, (wins.get(top.speciesId) ?? 0) + 1);
      totalKills += scores.reduce((n, sc) => n + sc.kills, 0);
    }

    const grazerWins = wins.get('grazer')!;
    const stalkerWins = wins.get('stalker')!;
    expect(grazerWins).toBeGreaterThanOrEqual(1); // herbivores win some seeds
    expect(stalkerWins).toBeGreaterThanOrEqual(1); // carnivores win some seeds
    expect(totalKills).toBeGreaterThan(0); // predation actually occurs
  }, 60000);
});
