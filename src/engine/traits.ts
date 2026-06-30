import type { Traits } from '@elecxarium/creature';
import type { DerivedStats } from './types';

export const TRAIT_KEYS = [
  'maxEnergy',
  'eyesight',
  'speed',
  'attack',
  'defense',
  'eatingSpeed',
  'camouflage',
] as const satisfies readonly (keyof Traits)[];

export function traitsTotal(t: Traits): number {
  let sum = 0;
  for (const k of TRAIT_KEYS) sum += t[k];
  return sum;
}

export interface TraitValidation {
  ok: boolean;
  total: number;
  errors: string[];
}

export function validateTraits(t: Traits, budget: number): TraitValidation {
  const errors: string[] = [];
  for (const k of TRAIT_KEYS) {
    const v = t[k];
    if (!Number.isFinite(v) || v < 0) errors.push(`trait "${k}" must be a non-negative number (got ${v})`);
    if (!Number.isInteger(v)) errors.push(`trait "${k}" must be an integer (got ${v})`);
  }
  const total = traitsTotal(t);
  if (total > budget) errors.push(`trait total ${total} exceeds budget ${budget}`);
  return { ok: errors.length === 0, total, errors };
}

/** Map point-buy traits to in-game capabilities. See docs/SPEC.md §6.3. */
export function deriveStats(t: Traits): DerivedStats {
  return {
    energyMax: 60 + t.maxEnergy * 1.4,
    sightRadius: 40 + t.eyesight * 2.6,
    moveMax: 4 + t.speed * 0.16,
    attackDamage: 4 + t.attack * 0.5,
    defense: t.defense * 0.25,
    eatRate: 4 + t.eatingSpeed * 0.26,
    camouflage: t.camouflage,
  };
}
