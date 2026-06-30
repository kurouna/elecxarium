// @elecxarium/creature — the public API users code against.
// Re-exported as a namespace inside the worker (globalThis.__ELECX_API__) and imported
// directly by templates/tests. All helpers are pure.

export * from './types';
import type { Action, CreatureDef, Memory, Vec2 } from './types';

export const CREATURE_API_VERSION = 1 as const;

/** Identity helper that gives `think`/`initMemory` full type inference from the Memory generic. */
export function defineCreature<TMemory extends Memory = Memory>(
  def: CreatureDef<TMemory>,
): CreatureDef<TMemory> {
  return def;
}

// ---- Action constructors ----
export function move(to: Vec2): Action {
  return { kind: 'move', to };
}
/** Head toward `target`; the engine caps the step at your `moveMax`. */
export function moveToward(target: Vec2): Action {
  return { kind: 'move', to: target };
}
export function attack(targetId: string): Action {
  return { kind: 'attack', targetId };
}
export function eat(targetId: string): Action {
  return { kind: 'eat', targetId };
}
export function reproduce(): Action {
  return { kind: 'reproduce' };
}
export function defend(): Action {
  return { kind: 'defend' };
}
export function idle(): Action {
  return { kind: 'idle' };
}

// ---- Geometry / selection helpers ----
export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function nearest<T extends { distance: number }>(
  list: readonly T[],
  pred?: (o: T) => boolean,
): T | undefined {
  let best: T | undefined;
  for (const o of list) {
    if (pred && !pred(o)) continue;
    if (best === undefined || o.distance < best.distance) best = o;
  }
  return best;
}

export function farthest<T extends { distance: number }>(
  list: readonly T[],
  pred?: (o: T) => boolean,
): T | undefined {
  let best: T | undefined;
  for (const o of list) {
    if (pred && !pred(o)) continue;
    if (best === undefined || o.distance > best.distance) best = o;
  }
  return best;
}

export function clampToWorld(pos: Vec2, world: { width: number; height: number }): Vec2 {
  return {
    x: Math.min(Math.max(pos.x, 0), world.width),
    y: Math.min(Math.max(pos.y, 0), world.height),
  };
}
