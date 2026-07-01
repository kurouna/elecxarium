import type {
  EnergyLevel,
  EntityKind,
  OrganismView,
  Role,
  SelfView,
  Sense,
} from '@elecxarium/creature';
import type { Config } from './config';
import { hashSeed, makeRandomFn } from './rng';
import { buildGrid, queryRadius } from './spatialGrid';
import type {
  Animal,
  MutVec,
  OrganismId,
  SensePayload,
  SpeciesId,
  SpeciesRuntime,
  SpeciesSenses,
  World,
} from './types';

interface Ref {
  kind: EntityKind;
  id: OrganismId;
  pos: MutVec;
  energy: number;
  energyMax: number;
  role?: Role;
  speciesId?: SpeciesId;
  isAlive: boolean;
  camo: number;
}

const CARCASS_ENERGY_SCALE = 120;

function energyLevel(energy: number, max: number): EnergyLevel {
  const r = max > 0 ? energy / max : 0;
  return r >= 0.66 ? 'high' : r >= 0.33 ? 'medium' : 'low';
}

function buildView(r: Ref, observerSpecies: SpeciesId, distance: number): OrganismView {
  return {
    id: r.id,
    kind: r.kind,
    ...(r.role ? { role: r.role } : {}),
    species: r.speciesId ?? r.kind,
    isOwn: r.speciesId === observerSpecies,
    position: { x: r.pos.x, y: r.pos.y },
    distance,
    energyState: energyLevel(r.energy, r.energyMax),
    isAlive: r.isAlive,
  };
}

function buildSelf(a: Animal, sp: SpeciesRuntime, cfg: Config): SelfView {
  const canReproduce =
    a.reproduceCooldown <= 0 && a.energy >= sp.derived.energyMax * cfg.repro.threshold;
  return {
    id: a.id,
    position: { x: a.pos.x, y: a.pos.y },
    energy: a.energy,
    energyMax: sp.derived.energyMax,
    age: a.age,
    lifespan: a.lifespan,
    reach: cfg.world.interactRange,
    moveMax: sp.derived.moveMax,
    sightRadius: sp.derived.sightRadius,
    canReproduce,
  };
}

/** Build the per-species batch of sensory payloads for the current tick. */
export function collectSenses(world: World): SpeciesSenses[] {
  const cfg = world.config;

  const refs: Ref[] = [];
  for (const a of world.animals.values()) {
    const sp = world.species.get(a.speciesId)!;
    refs.push({
      // A role:'plant' organism is an animal internally but presents to others as a plant
      // (food), so existing herbivore `o.kind === 'plant'` logic targets it automatically.
      kind: a.role === 'plant' ? 'plant' : 'animal',
      id: a.id,
      pos: a.pos,
      energy: a.energy,
      energyMax: sp.derived.energyMax,
      role: a.role,
      speciesId: a.speciesId,
      isAlive: true,
      camo: sp.derived.camouflage,
    });
  }
  for (const p of world.plants.values()) {
    refs.push({
      kind: 'plant',
      id: p.id,
      pos: p.pos,
      energy: p.energy,
      energyMax: cfg.plants.max,
      isAlive: true,
      camo: 0,
    });
  }
  for (const c of world.carcasses.values()) {
    refs.push({
      kind: 'carcass',
      id: c.id,
      pos: c.pos,
      energy: c.energy,
      energyMax: CARCASS_ENERGY_SCALE,
      isAlive: false,
      camo: 0,
    });
  }

  const positions = refs.map((r) => r.pos);
  let maxSight = 40;
  for (const sp of world.species.values()) maxSight = Math.max(maxSight, sp.derived.sightRadius);
  // Reuse the previous tick's grid storage when dimensions match (perf: avoids
  // reallocating all bucket arrays each tick). Rebuilt contents are identical.
  const grid = (world.grid = buildGrid(
    positions,
    cfg.world.width,
    cfg.world.height,
    Math.max(20, maxSight),
    world.grid,
  ));

  const bySpecies = new Map<SpeciesId, { id: OrganismId; payload: SensePayload }[]>();
  for (const sp of world.species.values()) bySpecies.set(sp.id, []);

  const center = { x: cfg.world.width / 2, y: cfg.world.height / 2 };
  const candidates: number[] = [];

  for (const a of world.animals.values()) {
    const sp = world.species.get(a.speciesId)!;
    const sight = sp.derived.sightRadius;
    candidates.length = 0;
    queryRadius(grid, a.pos.x, a.pos.y, sight, candidates);

    const nearby: OrganismView[] = [];
    for (const idx of candidates) {
      const r = refs[idx]!;
      if (r.id === a.id) continue;
      const dx = r.pos.x - a.pos.x;
      const dy = r.pos.y - a.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const effSight = r.camo > 0 ? sight * (1 - (r.camo / 100) * 0.7) : sight;
      if (d > effSight) continue;
      nearby.push(buildView(r, a.speciesId, d));
    }
    nearby.sort((p, q) => p.distance - q.distance || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));

    const payload: SensePayload = {
      tick: world.tick,
      self: buildSelf(a, sp, cfg),
      world: { width: cfg.world.width, height: cfg.world.height, center },
      nearby,
      events: a.events.slice(),
      randomSeed: hashSeed(world.masterSeed, a.seedKey, world.tick),
    };
    bySpecies.get(a.speciesId)!.push({ id: a.id, payload });
    a.events.length = 0;
  }

  return [...bySpecies.entries()].map(([speciesId, senses]) => ({ speciesId, senses }));
}

/** Reconstruct a full Sense (with deterministic random()) from a serializable payload. */
export function attachRandom(payload: SensePayload): Sense {
  const { randomSeed, ...data } = payload;
  return { ...data, random: makeRandomFn(randomSeed) };
}
