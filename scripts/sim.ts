// Headless balance simulator (no UI). Run many matches and report win rates.
//   npm run sim                              -> Grazer vs Stalker, 24 seeds
//   npm run sim -- grazer stalker --seeds=40
//   npm run sim -- sprout fang --ticks=2000 --verbose
import { computeScores, createWorld, isMatchOver, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import { stepWithBrainsSync } from '@/match/runMatch';
import { TEMPLATES } from '@/templates';
import { loadCreature, LocalHost } from './localHost';

function flag(name: string): string | undefined {
  const pre = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pre));
  return a ? a.slice(pre.length) : undefined;
}

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = positional.length >= 2 ? positional : ['grazer', 'stalker'];
const seeds = Number(flag('seeds') ?? '24');
const ticks = Number(flag('ticks') ?? String(DEFAULT_CONFIG.match.matchTicks));
const verbose = process.argv.includes('--verbose');

const config: Config = { ...DEFAULT_CONFIG, match: { ...DEFAULT_CONFIG.match, matchTicks: ticks } };

const loaded = ids.map((id) => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) {
    console.error(`unknown template "${id}". available: ${TEMPLATES.map((x) => x.id).join(', ')}`);
    process.exit(1);
  }
  return loadCreature(id, t.source);
});
const defs: SpeciesDef[] = loaded.map((l) => l.def);
const mods = new Map(loaded.map((l) => [l.def.id, l.mod] as const));

interface Agg {
  wins: number;
  survived: number;
  peak: number;
  finalAlive: number;
  kills: number;
}
const agg = new Map<string, Agg>(defs.map((d) => [d.id, { wins: 0, survived: 0, peak: 0, finalAlive: 0, kills: 0 }]));
let bothExtinct = 0;
let totalTicks = 0;

for (let s = 0; s < seeds; s++) {
  const seed = s + 1;
  const host = new LocalHost(mods);
  const world = createWorld({ seed, species: defs, config });
  let guard = 0;
  while (!isMatchOver(world) && guard < ticks + 1) {
    stepWithBrainsSync(world, host);
    guard++;
  }
  totalTicks += world.tick;
  const scores = computeScores(world);
  const top = scores[0];
  const winner = top && top.alive > 0 ? top : null;
  if (!winner) bothExtinct++;
  for (const sc of scores) {
    const a = agg.get(sc.speciesId)!;
    if (winner && winner.speciesId === sc.speciesId) a.wins++;
    if (sc.alive > 0) a.survived++;
    a.peak += sc.peak;
    a.finalAlive += sc.alive;
    a.kills += sc.kills;
  }
  if (verbose) {
    console.log(`seed ${seed}: ${world.tick}t -> ${winner ? winner.name : 'none'}  [${scores.map((x) => `${x.name}:${x.alive}`).join(' ')}]`);
  }
}

console.log(`\n=== Balance: ${defs.map((d) => `${d.name}(${d.role})`).join(' vs ')} ===`);
console.log(`seeds ${seeds} | matchTicks ${ticks} | avg length ${Math.round(totalTicks / seeds)}t | both-extinct ${bothExtinct}\n`);
for (const d of defs) {
  const a = agg.get(d.id)!;
  const pct = ((a.wins / seeds) * 100).toFixed(0);
  console.log(
    `${d.name.padEnd(10)} ${d.role.padEnd(9)} wins ${String(a.wins).padStart(2)}/${seeds} (${pct.padStart(3)}%) | survived ${String(a.survived).padStart(2)}/${seeds} | avgPeak ${(a.peak / seeds).toFixed(1).padStart(5)} | avgFinal ${(a.finalAlive / seeds).toFixed(1).padStart(5)} | avgKills ${(a.kills / seeds).toFixed(1)}`,
  );
}
