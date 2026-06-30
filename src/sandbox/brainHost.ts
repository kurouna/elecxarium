import type { Action, Appearance, CreatureMeta, SensePayload, Traits } from '@elecxarium/creature';
import { buildWorkerSource } from './buildWorkerSource';

export interface LoadResult {
  ok: boolean;
  meta?: CreatureMeta;
  traits?: Traits;
  appearance?: Appearance;
  error?: string;
}

interface Entry {
  compiledJs: string;
  worker: Worker | null;
  url: string | null;
  ready: boolean;
  meta?: CreatureMeta;
  traits?: Traits;
  strikes: number;
  disqualified: boolean;
}

interface WorkerMsg {
  type?: string;
  ok?: boolean;
  meta?: CreatureMeta;
  traits?: Traits;
  appearance?: Appearance;
  error?: string;
  actions?: { id: string; action: Action }[];
}

type RequestResult = WorkerMsg | { __timeout: true } | { __error: string };

const INIT_TIMEOUT_MS = 4000;

/**
 * Owns one persistent Web Worker per species. Enforces a per-tick compute budget:
 * a worker that overruns is terminated, respawned, and struck; repeated strikes
 * disqualify the species. The authoritative organism state lives in the engine, so a
 * terminated worker only loses the user's in-memory `Memory`.
 */
export class BrainHost {
  private readonly entries = new Map<string, Entry>();
  private readonly strikesMax: number;

  constructor(strikesMax = 3) {
    this.strikesMax = strikesMax;
  }

  private spawn(compiledJs: string): { worker: Worker; url: string } {
    const src = buildWorkerSource(compiledJs);
    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    return { worker: new Worker(url), url };
  }

  private request(worker: Worker, msg: unknown, timeoutMs: number): Promise<RequestResult> {
    return new Promise((resolve) => {
      const cleanup = (): void => {
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve({ __timeout: true });
      }, timeoutMs);
      worker.onmessage = (ev: MessageEvent) => {
        cleanup();
        resolve(ev.data as WorkerMsg);
      };
      worker.onerror = (ev: ErrorEvent) => {
        cleanup();
        resolve({ __error: String(ev.message || 'worker error') });
      };
      worker.postMessage(msg);
    });
  }

  async load(speciesId: string, compiledJs: string): Promise<LoadResult> {
    this.dispose(speciesId);
    const { worker, url } = this.spawn(compiledJs);
    const entry: Entry = {
      compiledJs,
      worker,
      url,
      ready: false,
      strikes: 0,
      disqualified: false,
    };
    this.entries.set(speciesId, entry);

    const res = await this.request(worker, { type: 'init' }, INIT_TIMEOUT_MS);
    if ('__timeout' in res) return { ok: false, error: 'creature init timed out' };
    if ('__error' in res) return { ok: false, error: res.__error };
    if (res.type === 'ready' && res.ok) {
      entry.ready = true;
      if (res.meta) entry.meta = res.meta;
      if (res.traits) entry.traits = res.traits;
      return {
        ok: true,
        ...(res.meta ? { meta: res.meta } : {}),
        ...(res.traits ? { traits: res.traits } : {}),
        ...(res.appearance ? { appearance: res.appearance } : {}),
      };
    }
    return { ok: false, error: res.error ?? 'creature failed to initialize' };
  }

  isReady(speciesId: string): boolean {
    const e = this.entries.get(speciesId);
    return !!e && e.ready && !e.disqualified;
  }

  isDisqualified(speciesId: string): boolean {
    return this.entries.get(speciesId)?.disqualified ?? false;
  }

  async tick(
    speciesId: string,
    senses: { id: string; payload: SensePayload }[],
    budgetMs: number,
  ): Promise<Map<string, Action>> {
    const result = new Map<string, Action>();
    const entry = this.entries.get(speciesId);
    if (!entry || !entry.ready || entry.disqualified || !entry.worker) return result;
    if (senses.length === 0) return result;

    const res = await this.request(entry.worker, { type: 'tick', senses }, budgetMs);
    if ('__timeout' in res || '__error' in res) {
      this.penalize(entry);
      return result; // all idle this tick
    }
    if (res.type === 'actions' && res.actions) {
      entry.strikes = 0;
      for (const { id, action } of res.actions) result.set(id, action);
    }
    return result;
  }

  private penalize(entry: Entry): void {
    entry.strikes++;
    entry.worker?.terminate();
    if (entry.url) URL.revokeObjectURL(entry.url);

    if (entry.strikes >= this.strikesMax) {
      entry.disqualified = true;
      entry.worker = null;
      entry.url = null;
      entry.ready = false;
      return;
    }

    const { worker, url } = this.spawn(entry.compiledJs);
    entry.worker = worker;
    entry.url = url;
    entry.ready = false;
    void this.request(worker, { type: 'init' }, INIT_TIMEOUT_MS).then((r) => {
      if (!('__timeout' in r) && !('__error' in r) && r.type === 'ready' && r.ok) {
        entry.ready = true;
      }
    });
  }

  dispose(speciesId?: string): void {
    if (speciesId !== undefined) {
      const e = this.entries.get(speciesId);
      if (e) {
        e.worker?.terminate();
        if (e.url) URL.revokeObjectURL(e.url);
        this.entries.delete(speciesId);
      }
      return;
    }
    for (const e of this.entries.values()) {
      e.worker?.terminate();
      if (e.url) URL.revokeObjectURL(e.url);
    }
    this.entries.clear();
  }
}
