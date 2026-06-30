// Node-only: runs creatures IN-PROCESS for tests/CLI by mimicking what the Blob worker
// does (provide module/exports/require to sucrase output, drive it through brainCore).
// `new Function` is used here intentionally — this never ships to the browser.
import * as creatureApi from '@elecxarium/creature';
import type { Action, SensePayload } from '@elecxarium/creature';
import type { SpeciesDef } from '@/engine';
import { compileCreature } from '@/sandbox/compile';
import { createBrainRuntime, type BrainRuntime } from '@/sandbox/brainCore';
import type { TournamentHost } from '@/match/tournament';

function evalModule(code: string): unknown {
  const module = { exports: {} as Record<string, unknown> };
  const require = (n: string): unknown => {
    if (n === '@elecxarium/creature') return creatureApi;
    throw new Error('no import: ' + n);
  };
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}

export interface LoadedSpecies {
  def: SpeciesDef;
  mod: unknown;
}

export function loadCreature(id: string, source: string, hue?: number): LoadedSpecies {
  const c = compileCreature(source, id);
  if (!c.ok) throw new Error(`compile ${id}: ${c.error}`);
  const mod = evalModule(c.code);
  const res = createBrainRuntime().init(mod);
  if (!res.ok) throw new Error(`init ${id}: ${res.error}`);
  return {
    def: { id, name: res.meta.name, role: res.meta.role, traits: res.traits, ...(hue !== undefined ? { hue } : {}) },
    mod,
  };
}

/** In-process brain provider with per-round memory reset (for tournaments). */
export class LocalHost implements TournamentHost {
  private readonly runtimes = new Map<string, BrainRuntime>();
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
  /** Synchronous tick — used by the flat-out CLI/sim (no async, no sleep). */
  tickSync(speciesId: string, senses: { id: string; payload: SensePayload }[]): Map<string, Action> {
    const rt = this.runtimes.get(speciesId);
    const out = new Map<string, Action>();
    if (!rt) return out;
    for (const { id, action } of rt.tick(senses)) out.set(id, action);
    return out;
  }
  async tick(speciesId: string, senses: { id: string; payload: SensePayload }[]): Promise<Map<string, Action>> {
    return this.tickSync(speciesId, senses);
  }
}
