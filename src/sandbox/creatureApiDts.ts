// Ambient declaration for '@elecxarium/creature', injected into Monaco so user code
// gets autocomplete and type-checking. Mirrors src/creature-api/types.ts + helpers.
// Kept as a string (not a real .d.ts) so it never collides with the project's own module.

export const CREATURE_API_DTS = `declare module '@elecxarium/creature' {
  export type Role = 'herbivore' | 'carnivore' | 'plant';
  export type EntityKind = 'animal' | 'plant' | 'carcass';
  export type EnergyLevel = 'high' | 'medium' | 'low';

  export interface Vec2 { readonly x: number; readonly y: number }

  /** Point-buy traits. Each is a non-negative integer; the sum must be <= 100. */
  export interface Traits {
    readonly maxEnergy: number;
    readonly eyesight: number;
    readonly speed: number;
    readonly attack: number;
    readonly defense: number;
    readonly eatingSpeed: number;
    readonly camouflage: number;
  }

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

  export interface SelfView {
    readonly id: string;
    readonly position: Vec2;
    readonly energy: number;
    readonly energyMax: number;
    readonly age: number;
    readonly lifespan: number;
    /** Distance within which attack/eat succeed. */
    readonly reach: number;
    /** Max distance you can travel in one tick. */
    readonly moveMax: number;
    readonly sightRadius: number;
    readonly canReproduce: boolean;
  }

  export type GameEvent =
    | { readonly type: 'attacked'; readonly byId: string; readonly damage: number }
    | { readonly type: 'collided'; readonly withId: string }
    | { readonly type: 'ateOk'; readonly targetId: string; readonly gained: number }
    | { readonly type: 'eatFailed'; readonly reason: 'tooFar' | 'notFood' | 'full' | 'gone' }
    | { readonly type: 'born' }
    | { readonly type: 'reproduced'; readonly childId: string };

  export interface WorldView { readonly width: number; readonly height: number; readonly center: Vec2 }

  export interface Sense {
    readonly tick: number;
    readonly self: SelfView;
    readonly world: WorldView;
    readonly nearby: readonly OrganismView[];
    readonly events: readonly GameEvent[];
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

  export type Memory = Record<string, unknown>;
  export interface CreatureMeta { readonly name: string; readonly author?: string; readonly role: Role }
  export interface Appearance { readonly viewBox: string; readonly svg: string }

  export interface CreatureDef<TMemory extends Memory = Memory> {
    readonly meta: CreatureMeta;
    readonly traits: Traits;
    readonly appearance?: Appearance;
    readonly initMemory?: () => TMemory;
    readonly think: (sense: Sense, memory: TMemory) => Action;
  }

  export function defineCreature<TMemory extends Memory = Memory>(def: CreatureDef<TMemory>): CreatureDef<TMemory>;
  export function move(to: Vec2): Action;
  /** Head toward target; the engine caps the step at your moveMax. */
  export function moveToward(target: Vec2): Action;
  export function attack(targetId: string): Action;
  export function eat(targetId: string): Action;
  export function reproduce(): Action;
  export function defend(): Action;
  export function idle(): Action;
  export function dist(a: Vec2, b: Vec2): number;
  export function nearest<T extends { distance: number }>(list: readonly T[], pred?: (o: T) => boolean): T | undefined;
  export function farthest<T extends { distance: number }>(list: readonly T[], pred?: (o: T) => boolean): T | undefined;
  export function clampToWorld(pos: Vec2, world: { width: number; height: number }): Vec2;
}
`;
