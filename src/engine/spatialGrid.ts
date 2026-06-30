import type { MutVec } from './types';

/** Uniform-grid spatial index. Rebuilt each tick; keeps neighbor queries near O(1). */
export interface Grid {
  cell: number;
  cols: number;
  rows: number;
  /** buckets[cy * cols + cx] = indices into the positions array. */
  buckets: number[][];
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function buildGrid(
  positions: readonly MutVec[],
  width: number,
  height: number,
  cell: number,
): Grid {
  const c = Math.max(1, cell);
  const cols = Math.max(1, Math.ceil(width / c));
  const rows = Math.max(1, Math.ceil(height / c));
  const buckets: number[][] = new Array(cols * rows);
  for (let i = 0; i < buckets.length; i++) buckets[i] = [];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    const cx = clampInt(Math.floor(p.x / c), 0, cols - 1);
    const cy = clampInt(Math.floor(p.y / c), 0, rows - 1);
    buckets[cy * cols + cx]!.push(i);
  }
  return { cell: c, cols, rows, buckets };
}

/**
 * Append the indices of positions whose cells overlap the (x,y,radius) box into `out`.
 * Callers must still do a precise distance check — this is a broad-phase filter.
 */
export function queryRadius(
  grid: Grid,
  x: number,
  y: number,
  radius: number,
  out: number[],
): number[] {
  const { cell, cols, rows, buckets } = grid;
  const minCx = clampInt(Math.floor((x - radius) / cell), 0, cols - 1);
  const maxCx = clampInt(Math.floor((x + radius) / cell), 0, cols - 1);
  const minCy = clampInt(Math.floor((y - radius) / cell), 0, rows - 1);
  const maxCy = clampInt(Math.floor((y + radius) / cell), 0, rows - 1);
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const b = buckets[cy * cols + cx]!;
      for (let k = 0; k < b.length; k++) out.push(b[k]!);
    }
  }
  return out;
}
