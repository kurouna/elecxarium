import type { Action, Vec2 } from '@elecxarium/creature';
import { hashSeed, makeRng, nextRange, shuffle } from './rng';
import { addAnimal, addCarcass, spawnPlants } from './world';
import { buildGrid, queryRadius, type Grid } from './spatialGrid';
import type { Animal, OrganismId, SpeciesId, World } from './types';

const TWO_PI = Math.PI * 2;

/** Tick-start plant snapshot: drives local-shading crowd counts and seed spatial exclusion. */
interface PlantField {
  grid: Grid | null;
  list: Animal[];
  /** Seeds placed earlier this tick (not yet in `grid`) — two seeds mustn't stack either. */
  newSeeds: { x: number; y: number; speciesId: SpeciesId }[];
}

/** True if a same-species plant already sits within `spacing` of (x,y). */
function plantSpotOccupied(x: number, y: number, speciesId: SpeciesId, spacing: number, field: PlantField): boolean {
  const r2 = spacing * spacing;
  if (field.grid) {
    const cand: number[] = [];
    queryRadius(field.grid, x, y, spacing, cand);
    for (const idx of cand) {
      const q = field.list[idx]!;
      if (q.speciesId !== speciesId) continue;
      const dx = q.pos.x - x;
      const dy = q.pos.y - y;
      if (dx * dx + dy * dy < r2) return true;
    }
  }
  for (const ns of field.newSeeds) {
    if (ns.speciesId !== speciesId) continue;
    const dx = ns.x - x;
    const dy = ns.y - y;
    if (dx * dx + dy * dy < r2) return true;
  }
  return false;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function applyMove(a: Animal, to: Vec2, world: World): void {
  if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
  const sp = world.species.get(a.speciesId)!;
  const moveMax = sp.derived.moveMax;
  let dx = to.x - a.pos.x;
  let dy = to.y - a.pos.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > moveMax) {
    dx = (dx / len) * moveMax;
    dy = (dy / len) * moveMax;
  }
  const nx = clamp(a.pos.x + dx, 0, world.config.world.width);
  const ny = clamp(a.pos.y + dy, 0, world.config.world.height);
  a.lastMoveDist = distance(nx, ny, a.pos.x, a.pos.y);
  a.pos.x = nx;
  a.pos.y = ny;
}

function resolveAttack(world: World, attacker: Animal, targetId: OrganismId): void {
  if (attacker.role !== 'carnivore' || attacker.attackCooldown > 0) return;
  const target = world.animals.get(targetId);
  if (!target || target === attacker) return;
  if (target.role === 'plant') return; // plants aren't meat — graze them with eat(), not attack()
  if (distance(attacker.pos.x, attacker.pos.y, target.pos.x, target.pos.y) > world.config.world.interactRange) {
    return;
  }
  const spA = world.species.get(attacker.speciesId)!;
  const spT = world.species.get(target.speciesId)!;
  let dmg = Math.max(0, spA.derived.attackDamage - spT.derived.defense);
  if (target.defending) dmg *= 1 - world.config.combat.defendReduction; // defending halves the hit
  const wasAlive = target.energy > 0;
  target.energy -= dmg;
  attacker.attackCooldown = world.config.combat.attackCooldown;
  target.events.push({ type: 'attacked', byId: attacker.id, damage: dmg });
  if (dmg > 0) world.visualEvents.push({ type: 'attack', x: target.pos.x, y: target.pos.y });
  if (wasAlive && target.energy <= 0) spA.kills++;
}

function resolveEat(world: World, eater: Animal, targetId: OrganismId): void {
  const sp = world.species.get(eater.speciesId)!;
  const reach = world.config.world.interactRange;
  const room = sp.derived.energyMax - eater.energy;

  if (eater.role === 'plant') return; // plants photosynthesise; they don't eat

  if (eater.role === 'herbivore') {
    // Environmental plant (auto-spawned food).
    const plant = world.plants.get(targetId);
    if (plant) {
      if (distance(eater.pos.x, eater.pos.y, plant.pos.x, plant.pos.y) > reach) {
        eater.events.push({ type: 'eatFailed', reason: 'tooFar' });
        return;
      }
      const gained = Math.min(sp.derived.eatRate, plant.energy, room);
      if (gained <= 0) {
        eater.events.push({ type: 'eatFailed', reason: 'full' });
        return;
      }
      plant.energy -= gained;
      eater.energy += gained;
      eater.events.push({ type: 'ateOk', targetId, gained });
      if (plant.energy <= 0) world.plants.delete(plant.id);
      return;
    }
    // Programmable plant (a role:'plant' organism, stored as an animal). Grazing it to
    // 0 lets it die in the death phase (plants leave no carcass).
    const pa = world.animals.get(targetId);
    if (pa && pa.role === 'plant') {
      if (distance(eater.pos.x, eater.pos.y, pa.pos.x, pa.pos.y) > reach) {
        eater.events.push({ type: 'eatFailed', reason: 'tooFar' });
        return;
      }
      const gained = Math.min(sp.derived.eatRate, pa.energy, room);
      if (gained <= 0) {
        eater.events.push({ type: 'eatFailed', reason: 'full' });
        return;
      }
      pa.energy -= gained;
      eater.energy += gained;
      eater.events.push({ type: 'ateOk', targetId, gained });
      return;
    }
    eater.events.push({ type: 'eatFailed', reason: world.animals.has(targetId) ? 'notFood' : 'gone' });
    return;
  }

  // carnivore: scavenge carcasses (live prey must be attacked first)
  const carcass = world.carcasses.get(targetId);
  if (!carcass) {
    eater.events.push({ type: 'eatFailed', reason: world.animals.has(targetId) ? 'notFood' : 'gone' });
    return;
  }
  if (distance(eater.pos.x, eater.pos.y, carcass.pos.x, carcass.pos.y) > reach) {
    eater.events.push({ type: 'eatFailed', reason: 'tooFar' });
    return;
  }
  const gained = Math.min(sp.derived.eatRate, carcass.energy, room);
  if (gained <= 0) {
    eater.events.push({ type: 'eatFailed', reason: 'full' });
    return;
  }
  carcass.energy -= gained;
  eater.energy += gained;
  eater.events.push({ type: 'ateOk', targetId, gained });
  if (carcass.energy <= 0) world.carcasses.delete(carcass.id);
}

function resolveReproduce(world: World, parent: Animal, field: PlantField): void {
  const sp = world.species.get(parent.speciesId)!;
  const cfg = world.config;
  if (parent.reproduceCooldown > 0) return;
  if (parent.energy < sp.derived.energyMax * cfg.repro.threshold) return;

  let childX: number;
  let childY: number;
  if (parent.role === 'plant') {
    // Hard backstop against a pathological plant carpeting the world (SVG node / per-tick
    // cost blowup); the real limiter below is spatial (seeds need open ground).
    if (sp.alive >= cfg.plants.speciesCap) return;
    // Terrarium-style dispersal: fling the seed away from the parent and let it take root
    // only on open ground (no same-species plant within seedSpacing). A blocked seed costs
    // the parent nothing and it retries next tick — so plants colonise outward and self-limit
    // at a spatial carrying capacity instead of piling up on one spot.
    let placed = false;
    childX = parent.pos.x;
    childY = parent.pos.y;
    for (let attempt = 0; attempt < cfg.plants.seedAttempts; attempt++) {
      const ang = nextRange(world.rng, 0, TWO_PI);
      const d = cfg.plants.seedSpacing + nextRange(world.rng, 0, cfg.plants.seedSpread);
      const cx = clamp(parent.pos.x + Math.cos(ang) * d, 0, cfg.world.width);
      const cy = clamp(parent.pos.y + Math.sin(ang) * d, 0, cfg.world.height);
      if (!plantSpotOccupied(cx, cy, parent.speciesId, cfg.plants.seedSpacing, field)) {
        childX = cx;
        childY = cy;
        placed = true;
        break;
      }
    }
    if (!placed) return; // hemmed in by its own kind — no open ground, no offspring, no cost
  } else {
    // Animals: offspring appears next to the parent.
    childX = clamp(parent.pos.x + nextRange(world.rng, -10, 10), 0, cfg.world.width);
    childY = clamp(parent.pos.y + nextRange(world.rng, -10, 10), 0, cfg.world.height);
  }

  const cost = sp.derived.energyMax * cfg.repro.cost;
  parent.energy -= cost;
  parent.reproduceCooldown = cfg.repro.cooldown;
  const child = addAnimal(world, sp, { x: childX, y: childY }, cost * (1 - cfg.repro.tax));
  if (parent.role === 'plant') field.newSeeds.push({ x: childX, y: childY, speciesId: parent.speciesId });
  sp.births++;
  parent.events.push({ type: 'reproduced', childId: child.id });
  child.events.push({ type: 'born' });
  world.visualEvents.push({ type: 'born', x: child.pos.x, y: child.pos.y, hue: sp.hue });
}

/**
 * Advance the world one tick. Movement is resolved first (positions settle), then
 * attack/eat/reproduce in a per-tick seeded-shuffled order (fairness), then the
 * environment (metabolism, aging, death, plant growth/respawn, carcass decay).
 */
export function resolveTick(world: World, actions: ReadonlyMap<OrganismId, Action>): void {
  const cfg = world.config;
  world.visualEvents = [];
  const order = [...world.animals.values()];
  shuffle(order, makeRng(hashSeed(world.masterSeed, world.tick, 1)));

  for (const a of order) {
    a.defending = false;
    a.lastMoveDist = 0;
  }

  // Plant field (tick-start snapshot): rooted plants don't move, so one snapshot serves the
  // whole tick. It powers the local-shading crowd count (radius crowdRadius) AND seed spatial
  // exclusion at reproduction (radius seedSpacing); newSeeds tracks this tick's own births.
  const plantList = order.filter((a) => a.role === 'plant');
  const plantCell = Math.max(20, cfg.plants.crowdRadius, cfg.plants.seedSpacing);
  const pgrid =
    plantList.length > 0
      ? buildGrid(
          plantList.map((p) => p.pos),
          cfg.world.width,
          cfg.world.height,
          plantCell,
        )
      : null;
  const plantCrowd = new Map<OrganismId, number>();
  if (pgrid && plantList.length > 1) {
    const R = cfg.plants.crowdRadius;
    const cand: number[] = [];
    for (let i = 0; i < plantList.length; i++) {
      const p = plantList[i]!;
      cand.length = 0;
      queryRadius(pgrid, p.pos.x, p.pos.y, R, cand);
      let n = 0;
      for (const idx of cand) {
        if (idx === i) continue;
        const q = plantList[idx]!;
        const dx = q.pos.x - p.pos.x;
        const dy = q.pos.y - p.pos.y;
        if (dx * dx + dy * dy <= R * R) n++;
      }
      plantCrowd.set(p.id, n);
    }
  }
  const field: PlantField = { grid: pgrid, list: plantList, newSeeds: [] };

  // Phase A — movement & defend
  for (const a of order) {
    const act = actions.get(a.id);
    if (!act) continue;
    if (act.kind === 'move' && a.role !== 'plant') applyMove(a, act.to, world); // plants are rooted
    else if (act.kind === 'defend') a.defending = true;
  }

  // Phase B — interactions (dead-but-not-removed animals don't act)
  for (const a of order) {
    if (a.energy <= 0) continue;
    const act = actions.get(a.id);
    if (!act) continue;
    if (act.kind === 'attack') resolveAttack(world, a, act.targetId);
    else if (act.kind === 'eat') resolveEat(world, a, act.targetId);
    else if (act.kind === 'reproduce') resolveReproduce(world, a, field);
  }

  // metabolism / photosynthesis + aging + cooldowns
  for (const a of order) {
    const sp = world.species.get(a.speciesId)!;
    if (a.role === 'plant') {
      // Photosynthesis with net-surplus density feedback: crowded plants shade each other,
      // so income falls toward (upkeep + surplusFloor) — the net gain shrinks to
      // surplusFloor when dense, slowing reproduction rather than starving. See GOAL.md.
      const photo0 = cfg.plants.photoBase + sp.traits.eatingSpeed * cfg.plants.photoPerPoint;
      const n = plantCrowd.get(a.id) ?? 0;
      const photoMin = cfg.plants.upkeep + cfg.plants.surplusFloor;
      const photo = Math.max(photoMin, photo0 * (1 - cfg.plants.crowdK * n));
      a.energy = Math.min(sp.derived.energyMax, a.energy + photo - cfg.plants.upkeep);
    } else {
      const metab =
        cfg.energy.metabFloor +
        sp.derived.energyMax * cfg.energy.metabBaseK +
        a.lastMoveDist * cfg.energy.moveCostK;
      a.energy -= metab;
    }
    a.age += 1;
    if (a.attackCooldown > 0) a.attackCooldown--;
    if (a.reproduceCooldown > 0) a.reproduceCooldown--;
  }

  // death → carcass
  for (const a of order) {
    if (a.energy <= 0 || a.age > a.lifespan) {
      const sp = world.species.get(a.speciesId)!;
      world.animals.delete(a.id);
      sp.alive = Math.max(0, sp.alive - 1);
      sp.deaths++;
      if (sp.role !== 'plant') addCarcass(world, a.pos, sp.derived.energyMax * cfg.carcass.residual);
      world.visualEvents.push({ type: 'death', x: a.pos.x, y: a.pos.y, hue: sp.hue });
    }
  }

  // plant growth
  for (const p of world.plants.values()) {
    if (p.energy < cfg.plants.max) {
      p.energy = Math.min(cfg.plants.max, p.energy + cfg.plants.growth);
    }
  }

  // carcass decay
  for (const c of [...world.carcasses.values()]) {
    c.decay -= 1;
    if (c.decay <= 0 || c.energy <= 0) world.carcasses.delete(c.id);
  }

  // Environmental-plant respawn — suppressed when a player plant is the producer (see createWorld).
  const envTarget = world.hasPlantSpecies ? cfg.plants.targetWithPlayer : cfg.plants.target;
  if (world.tick % cfg.plants.respawnEvery === 0 && world.plants.size < envTarget) {
    const need = Math.min(cfg.plants.respawnBatch, envTarget - world.plants.size);
    spawnPlants(world, need);
  }

  world.tick += 1;

  // scoring accumulators
  for (const sp of world.species.values()) {
    sp.popIntegral += sp.alive;
    if (sp.alive > sp.peak) sp.peak = sp.alive;
  }
}
