// Tunable simulation constants. Balance work starts here. See docs/SPEC.md §13.

export interface Config {
  world: { width: number; height: number; interactRange: number };
  match: { matchTicks: number; ticksPerSec: number; initialPop: number };
  traits: { budget: number };
  energy: { metabBaseK: number; metabFloor: number; moveCostK: number };
  combat: { attackCooldown: number; defendReduction: number };
  repro: { threshold: number; cost: number; tax: number; cooldown: number };
  life: { lifespanBase: number; lifespanJitter: number };
  carcass: { residual: number; decayTicks: number };
  plants: {
    target: number;
    growth: number;
    max: number;
    startEnergy: number;
    respawnEvery: number;
    respawnBatch: number;
    /** Programmable plant species (role:'plant'): passive energy/tick = photoBase + eatingSpeed*photoPerPoint. */
    photoBase: number;
    photoPerPoint: number;
    /** Per-tick maintenance subtracted from a plant's photosynthesis. */
    upkeep: number;
    /** Carrying capacity: a role:'plant' species stops reproducing past this many alive
     * (so a naive plant can't carpet the world / stall the renderer). */
    speciesCap: number;
  };
  compute: { baseMs: number; perCreatureMs: number; maxMs: number; strikesMax: number };
  scoring: { wSurvival: number; wPopIntegral: number; wBiomass: number };
}

export const DEFAULT_CONFIG: Config = {
  world: { width: 1200, height: 1200, interactRange: 8 },
  match: { matchTicks: 3000, ticksPerSec: 10, initialPop: 36 },
  traits: { budget: 100 },
  energy: { metabBaseK: 0.003, metabFloor: 0.35, moveCostK: 0.06 },
  combat: { attackCooldown: 2, defendReduction: 0.5 },
  repro: { threshold: 0.6, cost: 0.5, tax: 0.1, cooldown: 20 },
  life: { lifespanBase: 1500, lifespanJitter: 300 },
  carcass: { residual: 0.92, decayTicks: 80 },
  plants: {
    target: 155,
    growth: 0.9,
    max: 80,
    startEnergy: 30,
    respawnEvery: 6,
    respawnBatch: 14,
    photoBase: 0.15,
    photoPerPoint: 0.03,
    upkeep: 0.12,
    speciesCap: 150,
  },
  compute: { baseMs: 6, perCreatureMs: 1.5, maxMs: 120, strikesMax: 3 },
  scoring: { wSurvival: 1e9, wPopIntegral: 1, wBiomass: 1e-3 },
};
