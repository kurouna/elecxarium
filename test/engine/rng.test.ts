import { describe, it, expect } from 'vitest';
import {
  makeRng,
  nextFloat,
  nextInt,
  shuffle,
  hashSeed,
  makeRandomFn,
} from '@/engine/rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeRng(123);
    const b = makeRng(123);
    const seqA = Array.from({ length: 8 }, () => nextFloat(a));
    const seqB = Array.from({ length: 8 }, () => nextFloat(b));
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(nextFloat(a)).not.toBe(nextFloat(b));
  });

  it('produces floats in [0, 1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 2000; i++) {
      const f = nextFloat(r);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('nextInt stays in [0, max)', () => {
    const r = makeRng(9);
    for (let i = 0; i < 2000; i++) {
      const n = nextInt(r, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it('shuffle is deterministic and a true permutation', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const s1 = shuffle([...base], makeRng(42));
    const s2 = shuffle([...base], makeRng(42));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(base);
  });

  it('hashSeed is stable and order-sensitive', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
  });

  it('makeRandomFn yields a deterministic stream', () => {
    const f1 = makeRandomFn(5);
    const f2 = makeRandomFn(5);
    expect([f1(), f1(), f1()]).toEqual([f2(), f2(), f2()]);
  });
});
