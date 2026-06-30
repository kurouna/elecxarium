import type { Action } from '@elecxarium/creature';
import { collectSenses, resolveTick } from '@/engine';
import type { Config } from '@/engine/config';
import type { SensePayload, World } from '@/engine/types';

/** Anything that can turn a species' sensory batch into actions (real worker host or a mock). */
export interface BrainProvider {
  tick(
    speciesId: string,
    senses: { id: string; payload: SensePayload }[],
    budgetMs: number,
  ): Promise<Map<string, Action>>;
  /** True once a species has been struck out (compute budget / crashes). Optional for mocks. */
  isDisqualified?(speciesId: string): boolean;
}

/** Per-species compute budget for one tick (see docs/SPEC.md §4.4). */
export function tickBudgetMs(cfg: Config, liveCount: number): number {
  return Math.min(cfg.compute.maxMs, cfg.compute.baseMs + cfg.compute.perCreatureMs * liveCount);
}

/**
 * Advance the world one tick by querying the brain provider for every species in
 * parallel, then resolving all actions authoritatively in the engine.
 */
export async function stepWithBrains(world: World, host: BrainProvider): Promise<void> {
  const batch = collectSenses(world);
  const perSpecies = await Promise.all(
    batch.map((b) => host.tick(b.speciesId, b.senses, tickBudgetMs(world.config, b.senses.length))),
  );
  const actions = new Map<string, Action>();
  for (const m of perSpecies) {
    for (const [id, action] of m) actions.set(id, action);
  }
  resolveTick(world, actions);
  // Propagate host-side disqualification into the authoritative engine state so
  // scoring/standings actually penalise a struck-out species (otherwise it scores normally).
  for (const sp of world.species.values()) {
    if (host.isDisqualified?.(sp.id)) sp.disqualified = true;
  }
}

/** Synchronous, fully CPU-bound stepping for the headless CLI/tests (no async, no sleep). */
export interface SyncBrainProvider {
  tickSync(
    speciesId: string,
    senses: { id: string; payload: SensePayload }[],
    budgetMs: number,
  ): Map<string, Action>;
}

export function stepWithBrainsSync(world: World, host: SyncBrainProvider): void {
  const batch = collectSenses(world);
  const actions = new Map<string, Action>();
  for (const b of batch) {
    const m = host.tickSync(b.speciesId, b.senses, tickBudgetMs(world.config, b.senses.length));
    for (const [id, action] of m) actions.set(id, action);
  }
  resolveTick(world, actions);
}
