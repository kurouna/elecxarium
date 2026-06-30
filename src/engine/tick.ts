import type { Action, Vec2 } from '@elecxarium/creature';
import { hashSeed, makeRng, nextRange, shuffle } from './rng';
import { addAnimal, addCarcass, spawnPlants } from './world';
import type { Animal, OrganismId, World } from './types';

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

function resolveReproduce(world: World, parent: Animal): void {
  const sp = world.species.get(parent.speciesId)!;
  const cfg = world.config;
  if (parent.reproduceCooldown > 0) return;
  if (parent.energy < sp.derived.energyMax * cfg.repro.threshold) return;
  // Plant carrying capacity: prevents a naive/aggressive plant from carpeting the
  // world (which would balloon per-tick cost and the SVG node count).
  if (parent.role === 'plant' && sp.alive >= cfg.plants.speciesCap) return;

  const cost = sp.derived.energyMax * cfg.repro.cost;
  parent.energy -= cost;
  parent.reproduceCooldown = cfg.repro.cooldown;
  const childEnergy = cost * (1 - cfg.repro.tax);
  const ox = nextRange(world.rng, -10, 10);
  const oy = nextRange(world.rng, -10, 10);
  const child = addAnimal(
    world,
    sp,
    {
      x: clamp(parent.pos.x + ox, 0, cfg.world.width),
      y: clamp(parent.pos.y + oy, 0, cfg.world.height),
    },
    childEnergy,
  );
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
    else if (act.kind === 'reproduce') resolveReproduce(world, a);
  }

  // metabolism / photosynthesis + aging + cooldowns
  for (const a of order) {
    const sp = world.species.get(a.speciesId)!;
    if (a.role === 'plant') {
      // Photosynthesis: passive income scaled by eatingSpeed, minus light upkeep.
      const photo = cfg.plants.photoBase + sp.traits.eatingSpeed * cfg.plants.photoPerPoint;
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

  // plant respawn toward target
  if (world.tick % cfg.plants.respawnEvery === 0 && world.plants.size < cfg.plants.target) {
    const need = Math.min(cfg.plants.respawnBatch, cfg.plants.target - world.plants.size);
    spawnPlants(world, need);
  }

  world.tick += 1;

  // scoring accumulators
  for (const sp of world.species.values()) {
    sp.popIntegral += sp.alive;
    if (sp.alive > sp.peak) sp.peak = sp.alive;
  }
}
