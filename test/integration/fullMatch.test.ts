import { describe, it, expect } from 'vitest';
import * as creatureApi from '@elecxarium/creature';
import type { Action, SensePayload } from '@elecxarium/creature';
import { compileCreature } from '@/sandbox/compile';
import { createBrainRuntime, type BrainRuntime } from '@/sandbox/brainCore';
import { buildSnapshot, computeScores, createWorld, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import type { World } from '@/engine/types';
import { stepWithBrains } from '@/match/runMatch';
import { runTournament, type TournamentHost } from '@/match/tournament';
import { decodeReplay, encodeReplay } from '@/match/replayCodec';
import { DEFAULT_CARNIVORE, DEFAULT_HERBIVORE } from '@/templates';

// Faithfully mirrors what the real Blob worker does: provide module/exports/require to
// the sucrase-compiled code (require resolves only '@elecxarium/creature'), grab the
// default export, and drive it through the SAME brainCore the worker uses.
function evalModule(code: string): unknown {
  const module = { exports: {} as Record<string, unknown> };
  const require = (n: string): unknown => {
    if (n === '@elecxarium/creature') return creatureApi;
    throw new Error('no import: ' + n);
  };
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}

interface Loaded {
  defs: SpeciesDef[];
  mods: Map<string, unknown>;
}

function loadAll(entries: { id: string; source: string }[]): Loaded {
  const defs: SpeciesDef[] = [];
  const mods = new Map<string, unknown>();
  for (const e of entries) {
    const c = compileCreature(e.source, e.id);
    if (!c.ok) throw new Error(`compile failed: ${c.error}`);
    const mod = evalModule(c.code);
    const probe = createBrainRuntime();
    const res = probe.init(mod);
    if (!res.ok) throw new Error(`init failed: ${res.error}`);
    defs.push({ id: e.id, name: res.meta.name, role: res.meta.role, traits: res.traits });
    mods.set(e.id, mod);
  }
  return { defs, mods };
}

class InProcessHost implements TournamentHost {
  private runtimes = new Map<string, BrainRuntime>();
  constructor(private readonly mods: Map<string, unknown>) {
    this.build();
  }
  private build(): void {
    this.runtimes.clear();
    for (const [id, mod] of this.mods) {
      const rt = createBrainRuntime();
      rt.init(mod);
      this.runtimes.set(id, rt);
    }
  }
  async resetForRound(): Promise<void> {
    this.build();
  }
  async tick(speciesId: string, senses: { id: string; payload: SensePayload }[]): Promise<Map<string, Action>> {
    const rt = this.runtimes.get(speciesId);
    const out = new Map<string, Action>();
    if (!rt) return out;
    for (const { id, action } of rt.tick(senses)) out.set(id, action);
    return out;
  }
}

const ENTRIES = [
  { id: 'h', source: DEFAULT_HERBIVORE },
  { id: 'c', source: DEFAULT_CARNIVORE },
];

async function runMatch(loaded: Loaded, seed: number, ticks: number): Promise<World> {
  const host = new InProcessHost(loaded.mods);
  const world = createWorld({ seed, species: loaded.defs });
  for (let i = 0; i < ticks; i++) await stepWithBrains(world, host);
  return world;
}

describe('integration: source → compile → worker-runtime → engine', () => {
  it('loads the built-in templates end-to-end', () => {
    const { defs } = loadAll(ENTRIES);
    expect(defs.map((d) => d.role).sort()).toEqual(['carnivore', 'herbivore']);
  });

  it('runs a full ecosystem with emergent activity and a ranking', async () => {
    const loaded = loadAll(ENTRIES);
    const world = await runMatch(loaded, 123, 250);
    const scores = computeScores(world);
    expect(scores).toHaveLength(2);
    expect(scores[0]!.rank).toBe(1);
    const births = scores.reduce((n, s) => n + s.births, 0);
    const kills = scores.reduce((n, s) => n + s.kills, 0);
    expect(births + kills).toBeGreaterThan(0); // creatures actually ate/bred/hunted
  });

  it('is deterministic from source to final snapshot', async () => {
    const loaded = loadAll(ENTRIES);
    const a = buildSnapshot(await runMatch(loaded, 999, 150));
    const b = buildSnapshot(await runMatch(loaded, 999, 150));
    expect(a).toEqual(b);
  });

  it('runs a deterministic multi-seed tournament', async () => {
    const loaded = loadAll(ENTRIES);
    const cfg: Config = { ...DEFAULT_CONFIG, match: { ...DEFAULT_CONFIG.match, matchTicks: 300 } };
    const r1 = await runTournament(loaded.defs, new InProcessHost(loaded.mods), [1, 2, 3], cfg);
    const r2 = await runTournament(loaded.defs, new InProcessHost(loaded.mods), [1, 2, 3], cfg);
    expect(r1.rounds).toHaveLength(3);
    expect(r1.standings).toHaveLength(2);
    expect(r1.standings).toEqual(r2.standings);
  });

  it('reproduces a match from a shared replay code', async () => {
    const code = encodeReplay({
      seed: 555,
      species: [
        { title: 'H', source: DEFAULT_HERBIVORE },
        { title: 'C', source: DEFAULT_CARNIVORE },
      ],
    });
    const spec = decodeReplay(code);
    expect(spec).not.toBeNull();
    const loaded = loadAll(spec!.species.map((sp, i) => ({ id: `s${i}`, source: sp.source })));
    const a = buildSnapshot(await runMatch(loaded, spec!.seed, 120));
    const b = buildSnapshot(await runMatch(loaded, spec!.seed, 120));
    expect(a).toEqual(b);
  });
});
