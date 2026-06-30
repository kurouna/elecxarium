import { describe, it, expect } from 'vitest';
import type { Traits } from '@elecxarium/creature';
import { validateTraits, deriveStats, traitsTotal, TRAIT_KEYS } from '@/engine/traits';

const T = (over: Partial<Traits>): Traits => ({
  maxEnergy: 0,
  eyesight: 0,
  speed: 0,
  attack: 0,
  defense: 0,
  eatingSpeed: 0,
  camouflage: 0,
  ...over,
});

describe('traits', () => {
  it('sums all keys', () => {
    expect(traitsTotal(T({ maxEnergy: 10, attack: 5 }))).toBe(15);
    expect(TRAIT_KEYS.length).toBe(7);
  });

  it('accepts a budget-respecting allocation', () => {
    const v = validateTraits(T({ maxEnergy: 50, speed: 50 }), 100);
    expect(v.ok).toBe(true);
    expect(v.total).toBe(100);
  });

  it('rejects over-budget allocation', () => {
    const v = validateTraits(T({ maxEnergy: 80, speed: 80 }), 100);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('budget'))).toBe(true);
  });

  it('rejects negative and non-integer traits', () => {
    expect(validateTraits(T({ attack: -1 }), 100).ok).toBe(false);
    expect(validateTraits(T({ attack: 1.5 }), 100).ok).toBe(false);
  });

  it('derives monotonic, expected stats', () => {
    const low = deriveStats(T({ speed: 0 }));
    const high = deriveStats(T({ speed: 100 }));
    expect(high.moveMax).toBeGreaterThan(low.moveMax);
    expect(deriveStats(T({ eyesight: 100 })).sightRadius).toBeCloseTo(300);
    expect(deriveStats(T({ maxEnergy: 100 })).energyMax).toBeCloseTo(200);
  });
});
