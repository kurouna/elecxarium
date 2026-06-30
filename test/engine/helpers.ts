import type { Role, Traits } from '@elecxarium/creature';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import { createWorld, type SpeciesDef } from '@/engine/world';
import type { World } from '@/engine/types';

/** Config that spawns nothing, so tests can place exactly the entities they need. */
export const ZERO_SPAWN: Config = {
  ...DEFAULT_CONFIG,
  match: { ...DEFAULT_CONFIG.match, initialPop: 0 },
  plants: { ...DEFAULT_CONFIG.plants, target: 0 },
};

export const traits = (over: Partial<Traits> = {}): Traits => ({
  maxEnergy: 0,
  eyesight: 0,
  speed: 0,
  attack: 0,
  defense: 0,
  eatingSpeed: 0,
  camouflage: 0,
  ...over,
});

export const sdef = (
  id: string,
  role: Role,
  t: Partial<Traits> = {},
  name = id,
): SpeciesDef => ({ id, name, role, traits: traits(t) });

export function arena(species: SpeciesDef[], seed = 1, config: Config = ZERO_SPAWN): World {
  return createWorld({ seed, species, config });
}
