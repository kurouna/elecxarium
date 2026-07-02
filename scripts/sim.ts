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

// Deep-clone so --set overrides never mutate the shared DEFAULT_CONFIG (nested objects).
const config: Config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;
config.match.matchTicks = ticks;

// Config sweeping: `--set=plants.seedSpacing=90 --set=plants.photoBase=0.3` (repeatable).
for (const arg of process.argv) {
  if (!arg.startsWith('--set=')) continue;
  const body = arg.slice('--set='.length);
  const eq = body.indexOf('=');
  if (eq < 0) continue;
  const path = body.slice(0, eq).split('.');
  const value = Number(body.slice(eq + 1));
  let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]!] as Record<string, unknown>;
  obj[path[path.length - 1]!] = value;
}

// Adversarial / stress creatures for balance testing (not shipped in the UI templates).
const EXTRA: Record<string, string> = {
  // eatingSpeed=100, unconditional reproduce — stress-tests the plant density feedback.
  greedy: `import { defineCreature } from '@elecxarium/creature';
export default defineCreature({
  meta: { name: 'Greedy', role: 'plant' },
  traits: { maxEnergy: 0, eyesight: 0, speed: 0, attack: 0, defense: 0, eatingSpeed: 100, camouflage: 0 },
  think() { return { kind: 'reproduce' }; },
});`,
};

const loaded = ids.map((id) => {
  const source = TEMPLATES.find((x) => x.id === id)?.source ?? EXTRA[id];
  if (!source) {
    const avail = [...TEMPLATES.map((x) => x.id), ...Object.keys(EXTRA)].join(', ');
    console.error(`unknown creature "${id}". available: ${avail}`);
    process.exit(1);
  }
  return loadCreature(id, source);
});
const defs: SpeciesDef[] = loaded.map((l) => l.def);
const mods = new Map(loaded.map((l) => [l.def.id, l.mod] as const));

interface Agg {
  wins: number;
  survived: number;
  peak: number;
  finalAlive: number;
  kills: number;
  moveSum: number; // Σ per-creature move distance, to detect "camping" (avgMove ≈ 0)
  moveTicks: number; // number of (creature, tick) samples that contributed to moveSum
  esHigh: number; // plant energyState samples (high/med/low) — density-feedback tuning
  esMed: number;
  esLow: number;
}
const agg = new Map<string, Agg>(
  defs.map((d) => [
    d.id,
    { wins: 0, survived: 0, peak: 0, finalAlive: 0, kills: 0, moveSum: 0, moveTicks: 0, esHigh: 0, esMed: 0, esLow: 0 },
  ]),
);
let bothExtinct = 0;
let totalTicks = 0;

for (let s = 0; s < seeds; s++) {
  const seed = s + 1;
  const host = new LocalHost(mods);
  const world = createWorld({ seed, species: defs, config });
  let guard = 0;
  while (!isMatchOver(world) && guard < ticks + 1) {
    stepWithBrainsSync(world, host);
    for (const a of world.animals.values()) {
      const ag = agg.get(a.speciesId)!;
      ag.moveSum += a.lastMoveDist;
      ag.moveTicks += 1;
      if (a.role === 'plant') {
        const r = a.energy / world.species.get(a.speciesId)!.derived.energyMax;
        if (r >= 0.66) ag.esHigh += 1;
        else if (r >= 0.33) ag.esMed += 1;
        else ag.esLow += 1;
      }
    }
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
  const esT = a.esHigh + a.esMed + a.esLow;
  const es =
    d.role === 'plant' && esT > 0
      ? ` | eState H/M/L ${Math.round((a.esHigh / esT) * 100)}/${Math.round((a.esMed / esT) * 100)}/${Math.round((a.esLow / esT) * 100)}`
      : '';
  console.log(
    `${d.name.padEnd(10)} ${d.role.padEnd(9)} wins ${String(a.wins).padStart(2)}/${seeds} (${pct.padStart(3)}%) | survived ${String(a.survived).padStart(2)}/${seeds} | avgPeak ${(a.peak / seeds).toFixed(1).padStart(5)} | avgFinal ${(a.finalAlive / seeds).toFixed(1).padStart(5)} | avgKills ${(a.kills / seeds).toFixed(1)} | avgMove ${(a.moveSum / Math.max(1, a.moveTicks)).toFixed(2)}${es}`,
  );
}
