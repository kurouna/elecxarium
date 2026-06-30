// engine — pure, deterministic simulation core (no DOM / Worker / Node).
export const ENGINE_VERSION = 1 as const;

export * from './config';
export * from './rng';
export * from './traits';
export * from './types';
export * from './spatialGrid';
export * from './world';
export * from './sense';
export * from './tick';
export * from './scoring';
export * from './sim';
