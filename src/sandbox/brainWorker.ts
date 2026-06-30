// Worker harness entry. esbuild bundles this (+ brainCore + creature-api) into a single
// IIFE string (`virtual:worker-harness`) that is concatenated after the prologue and the
// user's compiled code to form the Blob worker source. See docs/SPEC.md §4.5.

import * as creatureApi from '../creature-api';
import type { SensePayload } from '../creature-api/types';
import { createBrainRuntime } from './brainCore';

const g = globalThis as unknown as {
  __ELECX_MODULE__?: { exports: Record<string, unknown> };
  __ELECX_API__?: unknown;
  __ELECX_SEED__?: (seed: number) => void;
};

// Expose the public API so the require-shim in the prologue can resolve it.
g.__ELECX_API__ = creatureApi;

const runtime = createBrainRuntime((seed) => g.__ELECX_SEED__?.(seed));
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as { type?: string; senses?: { id: string; payload: SensePayload }[] };
  try {
    if (msg.type === 'init') {
      const res = runtime.init(g.__ELECX_MODULE__?.exports);
      ctx.postMessage({ type: 'ready', ...res });
    } else if (msg.type === 'tick') {
      const actions = runtime.tick(msg.senses ?? []);
      ctx.postMessage({ type: 'actions', actions });
    }
  } catch (e) {
    ctx.postMessage({ type: 'ready', ok: false, error: String((e as Error)?.message ?? e) });
  }
};
