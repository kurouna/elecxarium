import type { Snapshot } from '@/engine/types';
import type { RenderAnimal, RenderFrame } from './types';

export function frameFromSnapshot(s: Snapshot): RenderFrame {
  return {
    tick: s.tick,
    animals: s.animals.map((a) => ({
      id: a.id,
      speciesId: a.speciesId,
      role: a.role,
      x: a.x,
      y: a.y,
      energy: a.energy,
      energyMax: a.energyMax,
      defending: a.defending,
      age: a.age,
    })),
    plants: s.plants.map((p) => ({ id: p.id, x: p.x, y: p.y, energy: p.energy })),
    carcasses: s.carcasses.map((c) => ({ id: c.id, x: c.x, y: c.y, energy: c.energy })),
  };
}

/**
 * Smoothly blend two snapshots for rendering. Animals present in `next` are drawn,
 * lerped from their `prev` position when they existed (newborns appear at their spot);
 * animals absent from `next` (dead) drop out. Plants/carcasses don't move → taken from next.
 */
export function interpolateFrame(prev: Snapshot, next: Snapshot, alpha: number): RenderFrame {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const prevPos = new Map<string, { x: number; y: number }>();
  for (const an of prev.animals) prevPos.set(an.id, { x: an.x, y: an.y });

  const animals: RenderAnimal[] = next.animals.map((an) => {
    const p = prevPos.get(an.id);
    return {
      id: an.id,
      speciesId: an.speciesId,
      role: an.role,
      x: p ? p.x + (an.x - p.x) * a : an.x,
      y: p ? p.y + (an.y - p.y) * a : an.y,
      energy: an.energy,
      energyMax: an.energyMax,
      defending: an.defending,
      age: an.age,
    };
  });

  return {
    tick: next.tick,
    animals,
    plants: next.plants.map((p) => ({ id: p.id, x: p.x, y: p.y, energy: p.energy })),
    carcasses: next.carcasses.map((c) => ({ id: c.id, x: c.x, y: c.y, energy: c.energy })),
  };
}
