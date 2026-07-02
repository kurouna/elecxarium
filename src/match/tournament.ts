import { computeScores, createWorld, isMatchOver, type SpeciesDef } from '@/engine';
import type { Config } from '@/engine/config';
import { stepWithBrains, type BrainProvider } from './runMatch';

/** A brain provider that can be reset to fresh per-creature memory between rounds. */
export interface TournamentHost extends BrainProvider {
  resetForRound(): Promise<void>;
}

export interface RoundRanking {
  speciesId: string;
  name: string;
  rank: number;
  score: number;
  alive: number;
}

export interface RoundResult {
  seed: number;
  ranking: RoundRanking[];
}

export interface Standing {
  speciesId: string;
  name: string;
  wins: number;
  avgRank: number;
  totalScore: number;
}

export interface TournamentResult {
  rounds: RoundResult[];
  standings: Standing[];
}

/**
 * Run one deterministic match per seed, resetting brain memory between rounds, and
 * aggregate standings (wins, then average rank, then total score).
 */
export async function runTournament(
  defs: SpeciesDef[],
  host: TournamentHost,
  seeds: number[],
  config: Config,
  onRound?: (round: RoundResult, index: number) => void,
): Promise<TournamentResult> {
  const agg = new Map<string, { name: string; wins: number; rankSum: number; scoreSum: number }>();
  for (const d of defs) agg.set(d.id, { name: d.name, wins: 0, rankSum: 0, scoreSum: 0 });

  const rounds: RoundResult[] = [];
  const cap = config.match.matchTicks + 1;

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    await host.resetForRound();
    const world = createWorld({ seed, species: defs, config });
    let guard = 0;
    while (!isMatchOver(world) && guard < cap) {
      await stepWithBrains(world, host);
      guard++;
    }

    const scores = computeScores(world);
    // Per trophic type (Terrarium-style): a "win" is being the surviving champion of your
    // own role, so a carnivore competes against carnivores — never against a plant's headcount.
    const ranking: RoundRanking[] = scores.map((s) => ({
      speciesId: s.speciesId,
      name: s.name,
      rank: s.rankInRole,
      score: s.score,
      alive: s.alive,
    }));
    for (const s of scores) {
      const a = agg.get(s.speciesId);
      if (!a) continue;
      a.rankSum += s.rankInRole;
      a.scoreSum += s.score;
      if (s.rankInRole === 1 && !s.disqualified && s.alive > 0) a.wins += 1;
    }

    const round: RoundResult = { seed, ranking };
    rounds.push(round);
    onRound?.(round, i);
  }

  const n = Math.max(1, seeds.length);
  const standings: Standing[] = [...agg.entries()]
    .map(([speciesId, a]) => ({
      speciesId,
      name: a.name,
      wins: a.wins,
      avgRank: a.rankSum / n,
      totalScore: a.scoreSum,
    }))
    .sort((x, y) => y.wins - x.wins || x.avgRank - y.avgRank || y.totalScore - x.totalScore);

  return { rounds, standings };
}
