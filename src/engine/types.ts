import type {
  Action,
  Appearance,
  GameEvent,
  Role,
  SensePayload,
  Traits,
} from '@elecxarium/creature';
import type { Config } from './config';
import type { Rng } from './rng';
import type { Grid } from './spatialGrid';

export type { SensePayload };

export type OrganismId = string;
export type SpeciesId = string;

/** Transient things the renderer can flash (attacks, deaths, births). */
export type VisualEventType = 'attack' | 'death' | 'born';
export interface VisualEvent {
  type: VisualEventType;
  x: number;
  y: number;
  hue?: number;
}

/** Mutable 2D point used internally (the public Vec2 is readonly). */
export interface MutVec {
  x: number;
  y: number;
}

/** Capabilities derived from a species' Traits (computed once per species). */
export interface DerivedStats {
  energyMax: number;
  sightRadius: number;
  moveMax: number;
  attackDamage: number;
  defense: number;
  eatRate: number;
  camouflage: number;
}

export interface Animal {
  kind: 'animal';
  id: OrganismId;
  /** Numeric key (the id counter) used to derive deterministic per-creature seeds. */
  seedKey: number;
  speciesId: SpeciesId;
  role: Role;
  pos: MutVec;
  energy: number;
  age: number;
  lifespan: number;
  defending: boolean;
  attackCooldown: number;
  reproduceCooldown: number;
  lastMoveDist: number;
  /** Events that happened to this animal since its last think(), drained into the next Sense. */
  events: GameEvent[];
}

export interface Plant {
  kind: 'plant';
  id: OrganismId;
  pos: MutVec;
  energy: number;
}

export interface Carcass {
  kind: 'carcass';
  id: OrganismId;
  pos: MutVec;
  energy: number;
  decay: number;
}

export type Entity = Animal | Plant | Carcass;

export interface SpeciesRuntime {
  id: SpeciesId;
  name: string;
  role: Role;
  traits: Traits;
  derived: DerivedStats;
  /** Hue (0–360) for rendering. */
  hue: number;
  appearance?: Appearance;
  alive: number;
  births: number;
  deaths: number;
  kills: number;
  popIntegral: number;
  peak: number;
  disqualified: boolean;
}

export interface World {
  tick: number;
  masterSeed: number;
  config: Config;
  rng: Rng;
  animals: Map<OrganismId, Animal>;
  plants: Map<OrganismId, Plant>;
  carcasses: Map<OrganismId, Carcass>;
  species: Map<SpeciesId, SpeciesRuntime>;
  nextId: number;
  /** Visual events produced during the current tick (cleared at the start of each tick). */
  visualEvents: VisualEvent[];
  /** Reusable spatial-index scratch: rebuilt every tick but memory reused (perf). */
  grid?: Grid;
}

export type SpeciesSenses = {
  speciesId: SpeciesId;
  senses: { id: OrganismId; payload: SensePayload }[];
};

// ---- Snapshots (serializable, for rendering and determinism comparison) ----

export interface AnimalSnap {
  id: OrganismId;
  speciesId: SpeciesId;
  role: Role;
  x: number;
  y: number;
  energy: number;
  energyMax: number;
  defending: boolean;
  age: number;
}

export interface PlantSnap {
  id: OrganismId;
  x: number;
  y: number;
  energy: number;
}

export interface CarcassSnap {
  id: OrganismId;
  x: number;
  y: number;
  energy: number;
}

export interface SpeciesStat {
  id: SpeciesId;
  name: string;
  role: Role;
  hue: number;
  alive: number;
  biomass: number;
  births: number;
  deaths: number;
  kills: number;
  peak: number;
  popIntegral: number;
  disqualified: boolean;
}

export interface Snapshot {
  tick: number;
  animals: AnimalSnap[];
  plants: PlantSnap[];
  carcasses: CarcassSnap[];
  species: SpeciesStat[];
  events: VisualEvent[];
}

export type { Action };
