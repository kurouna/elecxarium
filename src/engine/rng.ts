// Deterministic PRNG (mulberry32). Integer-only ops → identical across JS engines.
// State is a plain serializable object so a World (and thus a replay) can carry it.

export interface Rng {
  s: number;
}

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** Next unsigned 32-bit integer; advances state. */
export function nextU32(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}

/** Float in [0, 1). */
export function nextFloat(r: Rng): number {
  return nextU32(r) / 4294967296;
}

/** Integer in [0, maxExclusive). */
export function nextInt(r: Rng, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return nextU32(r) % maxExclusive;
}

/** Float in [min, max). */
export function nextRange(r: Rng, min: number, max: number): number {
  return min + nextFloat(r) * (max - min);
}

/** Deterministic Fisher–Yates shuffle (in place) using the given Rng. */
export function shuffle<T>(arr: T[], r: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(r, i + 1);
    const a = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = a;
  }
  return arr;
}

/** FNV-1a style integer hash combiner — for deriving sub-seeds. */
export function hashSeed(...nums: readonly number[]): number {
  let h = 0x811c9dc5 | 0;
  for (const n of nums) {
    h = Math.imul(h ^ (n | 0), 0x01000193);
  }
  return h >>> 0;
}

/** A standalone deterministic random function seeded by `seed`. */
export function makeRandomFn(seed: number): () => number {
  const r = makeRng(seed);
  return () => nextFloat(r);
}
