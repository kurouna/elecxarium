// Public contract shared by the engine (producer) and user creature code (consumer).
// Everything here is plain data except Sense.random (assembled inside the worker).

export type Role = 'herbivore' | 'carnivore' | 'plant';
export type EntityKind = 'animal' | 'plant' | 'carcass';
export type EnergyLevel = 'high' | 'medium' | 'low';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Point-buy traits. Each is a non-negative integer; the sum must be <= TRAIT_BUDGET. */
export interface Traits {
  readonly maxEnergy: number;
  readonly eyesight: number;
  readonly speed: number;
  readonly attack: number;
  readonly defense: number;
  readonly eatingSpeed: number;
  readonly camouflage: number;
}

/** A read-only view of another organism within sight. Exact energy is hidden (level only). */
export interface OrganismView {
  readonly id: string;
  readonly kind: EntityKind;
  readonly role?: Role;
  readonly species: string;
  readonly isOwn: boolean;
  readonly position: Vec2;
  readonly distance: number;
  readonly energyState: EnergyLevel;
  readonly isAlive: boolean;
}

/** What a creature knows about itself this tick (exact numbers allowed). */
export interface SelfView {
  readonly id: string;
  readonly position: Vec2;
  readonly energy: number;
  readonly energyMax: number;
  readonly age: number;
  readonly lifespan: number;
  /** Distance within which attack/eat succeed. */
  readonly reach: number;
  /** Max distance this creature can travel in one tick. */
  readonly moveMax: number;
  readonly sightRadius: number;
  readonly canReproduce: boolean;
}

export type GameEvent =
  | { readonly type: 'attacked'; readonly byId: string; readonly damage: number }
  | { readonly type: 'ateOk'; readonly targetId: string; readonly gained: number }
  | { readonly type: 'eatFailed'; readonly reason: 'tooFar' | 'notFood' | 'full' | 'gone' }
  | { readonly type: 'born' }
  | { readonly type: 'reproduced'; readonly childId: string };

export interface WorldView {
  readonly width: number;
  readonly height: number;
  readonly center: Vec2;
}

/** Serializable part of a Sense (crosses the worker boundary). */
export interface SenseData {
  readonly tick: number;
  readonly self: SelfView;
  readonly world: WorldView;
  readonly nearby: readonly OrganismView[];
  readonly events: readonly GameEvent[];
}

/** What `think()` receives: SenseData plus a deterministic RNG. */
export interface Sense extends SenseData {
  /** Deterministic, re-seeded per (creature, tick). Float in [0, 1). */
  readonly random: () => number;
}

export type Action =
  | { readonly kind: 'move'; readonly to: Vec2 }
  | { readonly kind: 'attack'; readonly targetId: string }
  | { readonly kind: 'eat'; readonly targetId: string }
  | { readonly kind: 'reproduce' }
  | { readonly kind: 'defend' }
  | { readonly kind: 'idle' };

/** Per-individual memory, persisted across ticks inside the worker. */
export type Memory = Record<string, unknown>;

export interface CreatureMeta {
  readonly name: string;
  readonly author?: string;
  readonly role: Role;
}

export interface Appearance {
  /** SVG viewBox, e.g. "0 0 32 32". */
  readonly viewBox: string;
  /** Inner SVG markup. `currentColor` is replaced with the species color. */
  readonly svg: string;
}

/** What a user exports via `defineCreature(...)`. Generic over its Memory shape. */
export interface CreatureDef<TMemory extends Memory = Memory> {
  readonly meta: CreatureMeta;
  readonly traits: Traits;
  readonly appearance?: Appearance;
  readonly initMemory?: () => TMemory;
  readonly think: (sense: Sense, memory: TMemory) => Action;
}

/**
 * Serializable sensory payload that crosses the worker boundary (no functions).
 * The worker harness re-attaches `random` from `randomSeed` to form a Sense.
 */
export type SensePayload = SenseData & { readonly randomSeed: number };
