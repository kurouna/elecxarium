import { describe, it, expect } from 'vitest';
import { computeScores, createWorld, isMatchOver, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import { stepWithBrainsSync } from '@/match/runMatch';
import { TEMPLATES } from '@/templates';
import { loadCreature, LocalHost } from '../../scripts/localHost';

function template(id: string): string {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`no template ${id}`);
  return t.source;
}

// Guards the default three-way ecosystem (the app's starting roster). Success is
// COEXISTENCE with active predation — the plant, herbivore and carnivore all persist and
// the food chain runs. We deliberately do NOT assert on who "tops" the score: the plant is
// the most numerous by trophic necessity, and standings are ranked per trophic type
// (see computeScores.rankInRole), so an apex carnivore is a champion among carnivores even
// though it never out-populates a plant. A regression here means a role went extinct or
// predation stopped.
describe('balance: default 3-way (Bloom / Grazer / Stalker)', () => {
  it('all three roles coexist with active predation', () => {
    const ids = ['bloom', 'grazer', 'stalker'];
    const loaded = ids.map((id) => loadCreature(id, template(id)));
    const defs: SpeciesDef[] = loaded.map((l) => l.def);
    const mods = new Map(loaded.map((l) => [l.def.id, l.mod] as const));
    // 2000 ticks is plenty for the ecosystem to establish (plants colonise, herbivores
    // build, carnivores hunt) while keeping this heavy-population test reasonably quick.
    const cfg: Config = { ...DEFAULT_CONFIG, match: { ...DEFAULT_CONFIG.match, matchTicks: 2000 } };

    const survived = new Map<string, number>(ids.map((id) => [id, 0]));
    let totalKills = 0;
    let allButOneExtinct = 0;
    const N = 6;

    for (let s = 0; s < N; s++) {
      const world = createWorld({ seed: s + 1, species: defs, config: cfg });
      const host = new LocalHost(mods);
      let guard = 0;
      while (!isMatchOver(world) && guard < cfg.match.matchTicks + 1) {
        stepWithBrainsSync(world, host);
        guard++;
      }
      const scores = computeScores(world);
      let aliveRoles = 0;
      for (const sc of scores) {
        if (sc.alive > 0) {
          survived.set(sc.speciesId, (survived.get(sc.speciesId) ?? 0) + 1);
          aliveRoles++;
        }
        totalKills += sc.kills;
      }
      if (aliveRoles <= 1) allButOneExtinct++;
    }

    // The producer base always persists (rooted, capped, colonising).
    expect(survived.get('bloom')!).toBe(N);
    // The herbivore is sustained by the plant base.
    expect(survived.get('grazer')!).toBeGreaterThanOrEqual(N - 1);
    // The carnivore is a viable apex: it persists in the clear majority of matches (it is
    // sparse — survival, not population, is its health metric).
    expect(survived.get('stalker')!).toBeGreaterThanOrEqual(Math.floor(N / 2));
    // Predation actually runs (carnivores hunt herbivores across the whole run).
    expect(totalKills).toBeGreaterThan(N * 20);
    // The ecosystem never collapses to a single surviving role.
    expect(allButOneExtinct).toBe(0);
  }, 120000);
});
