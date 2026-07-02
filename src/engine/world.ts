import type { Appearance, Role, Traits } from '@elecxarium/creature';
import { DEFAULT_CONFIG, type Config } from './config';
import { makeRng, nextRange } from './rng';
import { deriveStats } from './traits';
import type {
  Animal,
  AnimalSnap,
  Carcass,
  CarcassSnap,
  MutVec,
  Plant,
  PlantSnap,
  Snapshot,
  SpeciesRuntime,
  SpeciesStat,
  World,
} from './types';

export interface SpeciesDef {
  id: string;
  name: string;
  role: Role;
  traits: Traits;
  appearance?: Appearance;
  /** Render hue 0–360. Defaults to an evenly-spaced value by species index. */
  hue?: number;
}

export interface CreateWorldOptions {
  seed: number;
  species: SpeciesDef[];
  config?: Config;
}

export function createWorld(opts: CreateWorldOptions): World {
  const config = opts.config ?? DEFAULT_CONFIG;
  const world: World = {
    tick: 0,
    masterSeed: opts.seed >>> 0,
    config,
    rng: makeRng(opts.seed),
    animals: new Map(),
    plants: new Map(),
    carcasses: new Map(),
    species: new Map(),
    hasPlantSpecies: opts.species.some((s) => s.role === 'plant'),
    nextId: 1,
    visualEvents: [],
  };

  const n = opts.species.length;
  opts.species.forEach((def, i) => {
    const sp: SpeciesRuntime = {
      id: def.id,
      name: def.name,
      role: def.role,
      traits: def.traits,
      derived: deriveStats(def.traits),
      hue: def.hue ?? Math.round((360 * i) / Math.max(1, n)),
      ...(def.appearance ? { appearance: def.appearance } : {}),
      alive: 0,
      births: 0,
      deaths: 0,
      kills: 0,
      popIntegral: 0,
      peak: 0,
      disqualified: false,
    };
    world.species.set(def.id, sp);
  });

  spawnInitial(world);
  // The auto-spawned environmental-plant field is the food base ONLY when no player plant
  // is in play. If a role:'plant' species exists it IS the producer (it seeds and colonises
  // the world), so environmental plants drop to targetWithPlayer (0 by default) — the real
  // Terrarium has no separate environmental plants; plants are creatures.
  const envTarget = world.hasPlantSpecies ? config.plants.targetWithPlayer : config.plants.target;
  if (envTarget > 0) spawnPlants(world, envTarget);
  return world;
}

/** Scatter every species uniformly across the arena so predators and prey mix from tick 0. */
function spawnInitial(world: World): void {
  const { width, height } = world.config.world;
  for (const sp of world.species.values()) {
    for (let j = 0; j < world.config.match.initialPop; j++) {
      addAnimal(world, sp, { x: nextRange(world.rng, 0, width), y: nextRange(world.rng, 0, height) });
    }
  }
}

export function addAnimal(world: World, sp: SpeciesRuntime, pos: MutVec, energy?: number): Animal {
  const seedKey = world.nextId++;
  const id = `a${seedKey}`;
  const jitter = world.config.life.lifespanJitter;
  const lifespan = Math.round(
    world.config.life.lifespanBase + nextRange(world.rng, -jitter, jitter),
  );
  const a: Animal = {
    kind: 'animal',
    id,
    seedKey,
    speciesId: sp.id,
    role: sp.role,
    pos: { x: pos.x, y: pos.y },
    energy: energy ?? sp.derived.energyMax * 0.7,
    age: 0,
    lifespan,
    defending: false,
    attackCooldown: 0,
    reproduceCooldown: 0,
    lastMoveDist: 0,
    events: [],
  };
  world.animals.set(id, a);
  sp.alive++;
  return a;
}

export function addPlant(world: World, pos: MutVec, energy: number): Plant {
  const id = `p${world.nextId++}`;
  const plant: Plant = { kind: 'plant', id, pos: { x: pos.x, y: pos.y }, energy };
  world.plants.set(id, plant);
  return plant;
}

export function spawnPlants(world: World, count: number): void {
  const { width, height } = world.config.world;
  for (let i = 0; i < count; i++) {
    addPlant(
      world,
      { x: nextRange(world.rng, 0, width), y: nextRange(world.rng, 0, height) },
      world.config.plants.startEnergy,
    );
  }
}

export function addCarcass(world: World, pos: MutVec, energy: number): Carcass {
  const id = `c${world.nextId++}`;
  const carcass: Carcass = {
    kind: 'carcass',
    id,
    pos: { x: pos.x, y: pos.y },
    energy,
    decay: world.config.carcass.decayTicks,
  };
  world.carcasses.set(id, carcass);
  return carcass;
}

export function buildSnapshot(world: World): Snapshot {
  const animals: AnimalSnap[] = [];
  const biomass = new Map<string, number>();
  for (const a of world.animals.values()) {
    const sp = world.species.get(a.speciesId)!;
    animals.push({
      id: a.id,
      speciesId: a.speciesId,
      role: a.role,
      x: a.pos.x,
      y: a.pos.y,
      energy: a.energy,
      energyMax: sp.derived.energyMax,
      defending: a.defending,
      age: a.age,
    });
    biomass.set(a.speciesId, (biomass.get(a.speciesId) ?? 0) + a.energy);
  }

  const plants: PlantSnap[] = [];
  for (const p of world.plants.values()) plants.push({ id: p.id, x: p.pos.x, y: p.pos.y, energy: p.energy });

  const carcasses: CarcassSnap[] = [];
  for (const c of world.carcasses.values())
    carcasses.push({ id: c.id, x: c.pos.x, y: c.pos.y, energy: c.energy });

  const species: SpeciesStat[] = [];
  for (const sp of world.species.values()) {
    species.push({
      id: sp.id,
      name: sp.name,
      role: sp.role,
      hue: sp.hue,
      alive: sp.alive,
      biomass: biomass.get(sp.id) ?? 0,
      births: sp.births,
      deaths: sp.deaths,
      kills: sp.kills,
      peak: sp.peak,
      popIntegral: sp.popIntegral,
      disqualified: sp.disqualified,
    });
  }

  return { tick: world.tick, animals, plants, carcasses, species, events: world.visualEvents.slice(-80) };
}
