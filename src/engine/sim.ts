import type { Action, Memory, Sense } from '@elecxarium/creature';
import { attachRandom, collectSenses } from './sense';
import { resolveTick } from './tick';
import { buildSnapshot } from './world';
import type { OrganismId, Snapshot, SpeciesId, World } from './types';

/** A host-side brain: maps a Sense to an Action. Used for tests and the local fallback. */
export type Brain = (sense: Sense, memory: Memory) => Action;

export interface RunOptions {
  ticks: number;
  onSnapshot?: (snap: Snapshot) => void;
}

/** Advance the world one tick using in-process brains (no workers). Deterministic. */
export function stepHeadless(
  world: World,
  brains: Map<SpeciesId, Brain>,
  memories: Map<OrganismId, Memory>,
): void {
  const batch = collectSenses(world);
  const actions = new Map<OrganismId, Action>();
  for (const { speciesId, senses } of batch) {
    const brain = brains.get(speciesId);
    if (!brain) continue;
    for (const { id, payload } of senses) {
      const sense = attachRandom(payload);
      let mem = memories.get(id);
      if (!mem) {
        mem = {};
        memories.set(id, mem);
      }
      let action: Action;
      try {
        action = brain(sense, mem);
      } catch {
        action = { kind: 'idle' };
      }
      actions.set(id, action);
    }
  }
  resolveTick(world, actions);
}

export function runHeadless(
  world: World,
  brains: Map<SpeciesId, Brain>,
  opts: RunOptions,
): Snapshot[] {
  const memories = new Map<OrganismId, Memory>();
  const snaps: Snapshot[] = [];
  for (let i = 0; i < opts.ticks; i++) {
    stepHeadless(world, brains, memories);
    const snap = buildSnapshot(world);
    snaps.push(snap);
    opts.onSnapshot?.(snap);
  }
  return snaps;
}
