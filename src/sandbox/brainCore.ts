// Transport-agnostic brain logic. The DOM worker (brainWorker.ts) wraps this with
// self.onmessage; tests drive it directly. Pure except for the injected reseed hook.

import { makeRandomFn } from '../engine/rng';
import { DEFAULT_CONFIG } from '../engine/config';
import { validateTraits } from '../engine/traits';
import type {
  Action,
  Appearance,
  CreatureDef,
  CreatureMeta,
  Memory,
  Sense,
  SensePayload,
  Traits,
} from '../creature-api/types';

export type InitResult =
  | { ok: true; meta: CreatureMeta; traits: Traits; appearance?: Appearance }
  | { ok: false; error: string };

export interface TickedAction {
  id: string;
  action: Action;
}

export interface BrainRuntime {
  init(moduleExports: unknown): InitResult;
  tick(senses: ReadonlyArray<{ id: string; payload: SensePayload }>): TickedAction[];
}

function isVec(v: unknown): v is { x: number; y: number } {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Number.isFinite(o.x) && Number.isFinite(o.y);
}

/** Coerce whatever `think` returned into a valid, safe Action. */
export function sanitizeAction(a: unknown): Action {
  if (!a || typeof a !== 'object') return { kind: 'idle' };
  const act = a as { kind?: unknown; to?: unknown; targetId?: unknown };
  switch (act.kind) {
    case 'move':
      return isVec(act.to) ? { kind: 'move', to: { x: act.to.x, y: act.to.y } } : { kind: 'idle' };
    case 'attack':
      return typeof act.targetId === 'string' ? { kind: 'attack', targetId: act.targetId } : { kind: 'idle' };
    case 'eat':
      return typeof act.targetId === 'string' ? { kind: 'eat', targetId: act.targetId } : { kind: 'idle' };
    case 'reproduce':
      return { kind: 'reproduce' };
    case 'defend':
      return { kind: 'defend' };
    default:
      return { kind: 'idle' };
  }
}

function extractDefault(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in (mod as Record<string, unknown>)) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

function validateDef(def: unknown): InitResult {
  if (!def || typeof def !== 'object') {
    return { ok: false, error: 'creature must export a default object (use defineCreature).' };
  }
  const d = def as Partial<CreatureDef>;
  if (typeof d.think !== 'function') return { ok: false, error: 'creature is missing a think() function.' };
  if (!d.meta || typeof d.meta.name !== 'string') return { ok: false, error: 'creature.meta.name is required.' };
  if (d.meta.role !== 'herbivore' && d.meta.role !== 'carnivore' && d.meta.role !== 'plant') {
    return { ok: false, error: 'creature.meta.role must be "herbivore", "carnivore", or "plant".' };
  }
  if (!d.traits || typeof d.traits !== 'object') return { ok: false, error: 'creature.traits is required.' };
  const tv = validateTraits(d.traits as Traits, DEFAULT_CONFIG.traits.budget);
  if (!tv.ok) return { ok: false, error: `invalid traits — ${tv.errors.join('; ')}` };
  const appearance = isAppearance(d.appearance) ? d.appearance : undefined;
  return {
    ok: true,
    meta: d.meta as CreatureMeta,
    traits: d.traits as Traits,
    ...(appearance ? { appearance } : {}),
  };
}

function isAppearance(a: unknown): a is Appearance {
  if (!a || typeof a !== 'object') return false;
  const ap = a as { viewBox?: unknown; svg?: unknown };
  return typeof ap.viewBox === 'string' && typeof ap.svg === 'string';
}

function assembleSense(payload: SensePayload): Sense {
  const { randomSeed, ...data } = payload;
  return { ...data, random: makeRandomFn(randomSeed) };
}

function safeInitMemory(def: CreatureDef): Memory {
  try {
    return def.initMemory ? def.initMemory() : {};
  } catch {
    return {};
  }
}

export function createBrainRuntime(reseed?: (seed: number) => void): BrainRuntime {
  let def: CreatureDef | null = null;
  const memories = new Map<string, Memory>();

  return {
    init(moduleExports) {
      const candidate = extractDefault(moduleExports);
      const res = validateDef(candidate);
      if (res.ok) def = candidate as CreatureDef;
      return res;
    },
    tick(senses) {
      const out: TickedAction[] = [];
      const d = def;
      if (!d) {
        for (const s of senses) out.push({ id: s.id, action: { kind: 'idle' } });
        return out;
      }
      for (const { id, payload } of senses) {
        reseed?.(payload.randomSeed);
        let mem = memories.get(id);
        if (mem === undefined) {
          mem = safeInitMemory(d);
          memories.set(id, mem);
        }
        let action: Action;
        try {
          action = sanitizeAction(d.think(assembleSense(payload), mem));
        } catch {
          action = { kind: 'idle' };
        }
        out.push({ id, action });
      }
      return out;
    },
  };
}
