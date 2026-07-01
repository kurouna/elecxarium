import { describe, it, expect } from 'vitest';
import { computeScores, createWorld, isMatchOver, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG } from '@/engine/config';
import { stepWithBrainsSync } from '@/match/runMatch';
import { TEMPLATES } from '@/templates';
import { loadCreature, LocalHost } from '../../scripts/localHost';

function template(id: string): string {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t.source;
}

// Guards against balance regressions in the default three-way ecosystem (the app's
// starting roster). A healthy run is a real contest — the plant no longer wins every
// seed ("Bloom 100%" regression), the herbivore is a genuine contender, predation
// happens, and the carnivore persists as a viable (if sparse) apex. We check the
// carnivore's *survival*, not its wins: an apex predator is the thinnest trophic tier
// and rarely tops the score, so demanding it "win" would only reward prey-wipeout
// boom-bust — the opposite of a stable ecosystem.
describe('balance: default 3-way (Bloom vs Grazer vs Stalker)', () => {
  it('no single role dominates every seed, predation occurs, and all three coexist', () => {
    const ids = ['bloom', 'grazer', 'stalker'];
    const loaded = ids.map((id) => loadCreature(id, template(id)));
    const defs: SpeciesDef[] = loaded.map((l) => l.def);
    const mods = new Map(loaded.map((l) => [l.def.id, l.mod] as const));

    const wins = new Map<string, number>(ids.map((id) => [id, 0]));
    const survived = new Map<string, number>(ids.map((id) => [id, 0]));
    let totalKills = 0;
    const N = 10;

    for (let s = 0; s < N; s++) {
      const world = createWorld({ seed: s + 1, species: defs, config: DEFAULT_CONFIG });
      const host = new LocalHost(mods);
      let guard = 0;
      while (!isMatchOver(world) && guard < DEFAULT_CONFIG.match.matchTicks + 1) {
        stepWithBrainsSync(world, host);
        guard++;
      }
      const scores = computeScores(world);
      const top = scores[0];
      if (top && top.alive > 0) wins.set(top.speciesId, (wins.get(top.speciesId) ?? 0) + 1);
      for (const sc of scores) {
        if (sc.alive > 0) survived.set(sc.speciesId, (survived.get(sc.speciesId) ?? 0) + 1);
        totalKills += sc.kills;
      }
    }

    const bloomWins = wins.get('bloom')!;
    const grazerWins = wins.get('grazer')!;
    // Neither the plant nor the herbivore runs away with every seed (guards the old
    // "plant always wins" / "herbivore always wins" degenerate states).
    expect(bloomWins).toBeGreaterThanOrEqual(2);
    expect(grazerWins).toBeGreaterThanOrEqual(2);
    expect(bloomWins).toBeLessThanOrEqual(N - 2);
    expect(grazerWins).toBeLessThanOrEqual(N - 2);
    // Predation actually occurs.
    expect(totalKills).toBeGreaterThan(0);
    // The carnivore is a viable apex — it persists in a real share of matches.
    expect(survived.get('stalker')!).toBeGreaterThanOrEqual(4);
    // The producer base coexists throughout (rooted plants are essentially never wiped out).
    expect(survived.get('bloom')!).toBeGreaterThanOrEqual(N - 1);
  }, 120000);
});
