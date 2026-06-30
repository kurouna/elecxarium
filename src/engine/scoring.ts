import type { Role } from '@elecxarium/creature';
import type { World } from './types';

export interface ScoreRow {
  speciesId: string;
  name: string;
  role: Role;
  hue: number;
  alive: number;
  biomass: number;
  popIntegral: number;
  peak: number;
  births: number;
  deaths: number;
  kills: number;
  disqualified: boolean;
  survived: boolean;
  score: number;
  rank: number;
}

/**
 * Final/standings score. See docs/SPEC.md §6.6: survival dominates, then the
 * time-integrated population (sustained dominance), then current biomass as a tiebreak.
 */
export function computeScores(world: World): ScoreRow[] {
  const w = world.config.scoring;
  const biomass = new Map<string, number>();
  for (const a of world.animals.values()) {
    biomass.set(a.speciesId, (biomass.get(a.speciesId) ?? 0) + a.energy);
  }

  const rows: ScoreRow[] = [];
  for (const sp of world.species.values()) {
    const bm = biomass.get(sp.id) ?? 0;
    const survived = sp.alive > 0;
    const score = sp.disqualified
      ? -1
      : (survived ? w.wSurvival : 0) + w.wPopIntegral * sp.popIntegral + w.wBiomass * bm;
    rows.push({
      speciesId: sp.id,
      name: sp.name,
      role: sp.role,
      hue: sp.hue,
      alive: sp.alive,
      biomass: bm,
      popIntegral: sp.popIntegral,
      peak: sp.peak,
      births: sp.births,
      deaths: sp.deaths,
      kills: sp.kills,
      disqualified: sp.disqualified,
      survived,
      score,
      rank: 0,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });
  return rows;
}

export function aliveSpeciesCount(world: World): number {
  let n = 0;
  for (const sp of world.species.values()) if (sp.alive > 0) n++;
  return n;
}

export function isMatchOver(world: World): boolean {
  return world.tick >= world.config.match.matchTicks || aliveSpeciesCount(world) <= 1;
}
