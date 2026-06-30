export interface CreatureTemplate {
  id: string;
  label: string;
  source: string;
}

const GRAZER = `import { defineCreature, moveToward, nearest, eat, defend, dist } from '@elecxarium/creature';

interface Mem { roam: { x: number; y: number } | null }

// Grazer — a herbivore with survival instincts:
//   1. flees the nearest carnivore (braces with defend() if cornered)
//   2. breeds only when safe AND nearly full (breeding hungry starves the young)
//   3. eats the nearest plant
//   4. roams to explore when nothing is in sight
export default defineCreature<Mem>({
  meta: { name: 'Grazer', author: 'you', role: 'herbivore' },
  traits: { maxEnergy: 25, eyesight: 25, speed: 20, attack: 0, defense: 10, eatingSpeed: 20, camouflage: 0 },
  appearance: {
    viewBox: '0 0 32 32',
    svg:
      '<polygon points="16,4 27,10 27,22 16,28 5,22 5,10" fill="currentColor"/>' +
      '<circle cx="12.6" cy="15" r="1.7" fill="#0a0e15"/><circle cx="19.4" cy="15" r="1.7" fill="#0a0e15"/>',
  },
  initMemory: () => ({ roam: null }),
  think(sense, mem) {
    const self = sense.self;

    // If something just bit us, bolt directly away from it (reacts to sense.events).
    const hit = sense.events.find((e) => e.type === 'attacked');
    if (hit && 'byId' in hit) {
      const attacker = sense.nearby.find((o) => o.id === hit.byId);
      if (attacker) {
        return moveToward({
          x: self.position.x * 2 - attacker.position.x,
          y: self.position.y * 2 - attacker.position.y,
        });
      }
    }

    const predator = nearest(sense.nearby, (o) => o.role === 'carnivore' && o.isAlive);
    if (predator) {
      if (predator.distance <= self.reach) return defend(); // can't escape — brace
      if (predator.distance < self.sightRadius * 0.6) {
        return moveToward({
          x: self.position.x + (self.position.x - predator.position.x),
          y: self.position.y + (self.position.y - predator.position.y),
        });
      }
    }

    if (self.canReproduce && self.energy > self.energyMax * 0.8) return { kind: 'reproduce' };

    // Forage smartly: head for the nearest plant that's actually worth eating, and
    // once a plant is grazed down ('low'), move on to a fuller one instead of camping
    // its slow regrowth. (A grazer that squats on one plant is both boring and starves.)
    const plant = nearest(sense.nearby, (o) => o.kind === 'plant' && o.energyState !== 'low');
    if (plant) {
      mem.roam = null;
      return plant.distance <= self.reach ? eat(plant.id) : moveToward(plant.position);
    }

    if (!mem.roam || dist(self.position, mem.roam) < 30) {
      mem.roam = { x: sense.random() * sense.world.width, y: sense.random() * sense.world.height };
    }
    return moveToward(mem.roam);
  },
});
`;

const STALKER = `import { defineCreature, moveToward, attack, eat, nearest, dist } from '@elecxarium/creature';

interface Mem { roam: { x: number; y: number } | null }

// Stalker — a carnivore that hunts smart:
//   1. eats carcasses in reach (free energy)
//   2. prefers weakened (low-energy) prey, attacks when adjacent
//   3. breeds only when well-fed
//   4. patrols to find prey
export default defineCreature<Mem>({
  meta: { name: 'Stalker', author: 'you', role: 'carnivore' },
  traits: { maxEnergy: 12, eyesight: 25, speed: 33, attack: 20, defense: 0, eatingSpeed: 10, camouflage: 0 },
  initMemory: () => ({ roam: null }),
  think(sense, mem) {
    const self = sense.self;

    const carcass = nearest(sense.nearby, (o) => o.kind === 'carcass');
    if (carcass && carcass.distance <= self.reach) return eat(carcass.id);

    // Breed when well-fed — don't hunt forever, grow the pack.
    if (self.canReproduce && self.energy > self.energyMax * 0.8) return { kind: 'reproduce' };

    const prey =
      nearest(sense.nearby, (o) => o.role === 'herbivore' && o.isAlive && o.energyState === 'low') ??
      nearest(sense.nearby, (o) => o.role === 'herbivore' && o.isAlive);
    if (prey) {
      mem.roam = null;
      return prey.distance <= self.reach ? attack(prey.id) : moveToward(prey.position);
    }

    if (carcass) return moveToward(carcass.position);
    if (!mem.roam || dist(self.position, mem.roam) < 30) {
      mem.roam = { x: sense.random() * sense.world.width, y: sense.random() * sense.world.height };
    }
    return moveToward(mem.roam);
  },
});
`;

const MIN_HERBIVORE = `import { defineCreature, moveToward, nearest } from '@elecxarium/creature';

// A simple herbivore: breed when full, otherwise walk to the nearest plant and eat it.
export default defineCreature({
  meta: { name: 'Sprout', role: 'herbivore' },
  traits: { maxEnergy: 30, eyesight: 25, speed: 20, attack: 0, defense: 5, eatingSpeed: 20, camouflage: 0 },
  think(sense) {
    const self = sense.self;
    if (self.canReproduce && self.energy > self.energyMax * 0.8) return { kind: 'reproduce' };
    const plant = nearest(sense.nearby, (o) => o.kind === 'plant');
    if (!plant) return moveToward(sense.world.center);
    return plant.distance <= self.reach
      ? { kind: 'eat', targetId: plant.id }
      : moveToward(plant.position);
  },
});
`;

const MIN_CARNIVORE = `import { defineCreature, moveToward, attack, eat, nearest } from '@elecxarium/creature';

// A simple carnivore: eat carcasses, breed when full, otherwise chase & bite prey.
export default defineCreature({
  meta: { name: 'Fang', role: 'carnivore' },
  traits: { maxEnergy: 10, eyesight: 25, speed: 30, attack: 20, defense: 0, eatingSpeed: 15, camouflage: 0 },
  think(sense) {
    const self = sense.self;
    const carcass = nearest(sense.nearby, (o) => o.kind === 'carcass');
    if (carcass && carcass.distance <= self.reach) return eat(carcass.id);
    if (self.canReproduce && self.energy > self.energyMax * 0.8) return { kind: 'reproduce' };
    const prey = nearest(sense.nearby, (o) => o.role === 'herbivore' && o.isAlive);
    if (!prey) return moveToward(sense.world.center);
    return prey.distance <= self.reach ? attack(prey.id) : moveToward(prey.position);
  },
});
`;

const PLANT = `import { defineCreature } from '@elecxarium/creature';

// Bloom — a programmable plant (role:'plant'):
//   • photosynthesises passively (income scales with the eatingSpeed trait)
//   • is rooted: move/attack/eat are ignored; herbivores graze it for energy
//   • spreads by reproducing when full, but not into an already-dense patch of its own kind
export default defineCreature({
  meta: { name: 'Bloom', author: 'you', role: 'plant' },
  // For plants: maxEnergy = storage, eatingSpeed = photosynthesis rate, eyesight = sensing range.
  traits: { maxEnergy: 35, eyesight: 20, speed: 0, attack: 0, defense: 0, eatingSpeed: 45, camouflage: 0 },
  appearance: {
    viewBox: '0 0 32 32',
    svg:
      '<circle cx="16" cy="16.5" r="5" fill="currentColor"/>' +
      '<ellipse cx="16" cy="6.5" rx="3" ry="4.6" fill="currentColor"/>' +
      '<ellipse cx="24.8" cy="12.6" rx="4.6" ry="3" fill="currentColor"/>' +
      '<ellipse cx="21.2" cy="24" rx="3" ry="4.4" fill="currentColor"/>' +
      '<ellipse cx="9.6" cy="23" rx="4.4" ry="3" fill="currentColor"/>' +
      '<ellipse cx="6.8" cy="11.4" rx="4.4" ry="3" fill="currentColor"/>',
  },
  think(sense) {
    const self = sense.self;
    if (!self.canReproduce || self.energy < self.energyMax * 0.9) return { kind: 'idle' };
    // Don't seed into a crowded patch — leave room (and light) for the offspring.
    const crowd = sense.nearby.filter((o) => o.isOwn && o.distance < 80).length;
    return crowd >= 2 ? { kind: 'idle' } : { kind: 'reproduce' };
  },
});
`;

const MIN_PLANT = `import { defineCreature } from '@elecxarium/creature';

// A simple plant: photosynthesise, and spread by reproducing whenever nearly full.
export default defineCreature({
  meta: { name: 'Moss', role: 'plant' },
  // For plants: maxEnergy = storage, eatingSpeed = photosynthesis rate (no eyes/legs needed).
  traits: { maxEnergy: 45, eyesight: 0, speed: 0, attack: 0, defense: 0, eatingSpeed: 55, camouflage: 0 },
  appearance: {
    viewBox: '0 0 32 32',
    svg:
      '<ellipse cx="16" cy="23" rx="12.5" ry="6.5" fill="currentColor"/>' +
      '<circle cx="8.5" cy="18.5" r="4.5" fill="currentColor"/>' +
      '<circle cx="16" cy="14.5" r="5.6" fill="currentColor"/>' +
      '<circle cx="23.5" cy="18.5" r="4.5" fill="currentColor"/>',
  },
  think(sense) {
    const self = sense.self;
    return self.canReproduce && self.energy > self.energyMax * 0.85
      ? { kind: 'reproduce' }
      : { kind: 'idle' };
  },
});
`;

export const TEMPLATES: CreatureTemplate[] = [
  { id: 'grazer', label: 'Grazer — smart herbivore', source: GRAZER },
  { id: 'sprout', label: 'Sprout — simple herbivore', source: MIN_HERBIVORE },
  { id: 'stalker', label: 'Stalker — smart carnivore', source: STALKER },
  { id: 'fang', label: 'Fang — simple carnivore', source: MIN_CARNIVORE },
  { id: 'bloom', label: 'Bloom — smart plant', source: PLANT },
  { id: 'moss', label: 'Moss — simple plant', source: MIN_PLANT },
];

export const DEFAULT_HERBIVORE = GRAZER;
export const DEFAULT_CARNIVORE = STALKER;
