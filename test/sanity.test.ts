import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '@/engine';
import { CREATURE_API_VERSION } from '@elecxarium/creature';

describe('toolchain sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves path aliases', () => {
    expect(ENGINE_VERSION).toBe(1);
    expect(CREATURE_API_VERSION).toBe(1);
  });
});
