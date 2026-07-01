import { create } from 'zustand';
import type { Role } from '@elecxarium/creature';
import { buildSnapshot, computeScores, createWorld, isMatchOver, type ScoreRow, type SpeciesDef } from '@/engine';
import { DEFAULT_CONFIG, type Config } from '@/engine/config';
import type { Snapshot, VisualEventType, World } from '@/engine/types';
import { BrainHost } from '@/sandbox/brainHost';
import { compileCreature } from '@/sandbox/compile';
import { stepWithBrains } from '@/match/runMatch';
import { decodeReplay, encodeReplay } from '@/match/replayCodec';
import { runTournament, type Standing, type TournamentHost } from '@/match/tournament';
import type { ArenaSpecies } from '@/render/Arena';
import { DEFAULT_CARNIVORE, DEFAULT_HERBIVORE, DEFAULT_PLANT } from '@/templates';

export type EntryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EditorEntry {
  id: string;
  title: string;
  source: string;
  status: EntryStatus;
  error: string | undefined;
  role: Role;
  hue: number;
}

export interface LogLine {
  id: number;
  speciesId?: string;
  level: 'info' | 'error';
  text: string;
}

export interface MatchStore {
  entries: EditorEntry[];
  activeId: string;
  running: boolean;
  speed: number;
  seed: number;
  lockSeed: boolean;
  tick: number;
  matchOver: boolean;
  prev: Snapshot | null;
  curr: Snapshot | null;
  lastStepAt: number;
  effects: EffectSprite[];
  arenaSpecies: ArenaSpecies[];
  leaderboard: ScoreRow[];
  logs: LogLine[];
  recorded: Snapshot[];
  recordedCount: number;
  replayMode: boolean;
  tournamentRunning: boolean;
  tournamentStandings: Standing[];

  setSource: (id: string, source: string) => void;
  setActive: (id: string) => void;
  setSpeed: (speed: number) => void;
  setSeed: (seed: number) => void;
  setLockSeed: (v: boolean) => void;
  setHue: (id: string, hue: number) => void;
  /** Persist all creature tabs (source/name/role/color) to this browser; restored on reload. */
  saveCreatures: () => void;
  addEntry: () => void;
  removeEntry: (id: string) => void;
  startMatch: () => Promise<void>;
  togglePlay: () => void;
  stepOnce: () => Promise<void>;
  reset: () => void;
  enterReplay: () => void;
  exitReplay: () => void;
  shareCode: () => string;
  loadFromCode: (code: string) => boolean;
  runTournament: () => Promise<void>;
}

// Non-serializable runtime state lives outside the store.
let world: World | null = null;
const host = new BrainHost(DEFAULT_CONFIG.compute.strikesMax);
let timer: ReturnType<typeof setTimeout> | null = null;
let recordedBuffer: Snapshot[] = [];
let logSeq = 0;
let entrySeq = 0;
const disqualifiedLogged = new Set<string>();
let stepping = false;

const HUES = [150, 330, 40, 210, 280, 100];
const EFFECT_TICKS = 5;
const EFFECT_CAP = 120;

export interface EffectSprite {
  id: string;
  type: VisualEventType;
  x: number;
  y: number;
  hue?: number;
  bornTick: number;
}

/** Best-effort role detection from source so tabs show the right role before a match runs. */
function parseRole(source: string): Role | undefined {
  const m = /role\s*:\s*['"](herbivore|carnivore|plant)['"]/.exec(source);
  return m ? (m[1] as Role) : undefined;
}

const CREATURES_KEY = 'elecxarium:creatures:v1';

const DEFAULT_ENTRIES: EditorEntry[] = [
  { id: 'sp-bloom', title: 'Bloom', source: DEFAULT_PLANT, status: 'idle', error: undefined, role: 'plant', hue: 100 },
  { id: 'sp-grazer', title: 'Grazer', source: DEFAULT_HERBIVORE, status: 'idle', error: undefined, role: 'herbivore', hue: 150 },
  { id: 'sp-stalker', title: 'Stalker', source: DEFAULT_CARNIVORE, status: 'idle', error: undefined, role: 'carnivore', hue: 330 },
];

/** Restore creatures the user saved in this browser (Save button), else the defaults. */
function loadSavedCreatures(): { entries: EditorEntry[]; activeId: string } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CREATURES_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { activeId?: string; entries?: unknown };
    if (!Array.isArray(data.entries) || data.entries.length === 0) return null;
    const entries: EditorEntry[] = data.entries.map((c, i) => {
      const e = (c ?? {}) as Partial<EditorEntry>;
      const role: Role = e.role === 'carnivore' || e.role === 'plant' ? e.role : 'herbivore';
      return {
        id: typeof e.id === 'string' && e.id ? e.id : `sp-restored-${i}`,
        title: typeof e.title === 'string' ? e.title : `Creature ${i + 1}`,
        source: typeof e.source === 'string' ? e.source : '',
        role,
        hue: typeof e.hue === 'number' ? e.hue : 200,
        status: 'idle',
        error: undefined,
      };
    });
    const activeId = entries.some((e) => e.id === data.activeId) ? String(data.activeId) : entries[0]!.id;
    return { entries, activeId };
  } catch {
    return null;
  }
}

const restored = loadSavedCreatures();
const initialEntries: EditorEntry[] = restored?.entries ?? DEFAULT_ENTRIES;
const initialActiveId: string = restored?.activeId ?? initialEntries[0]!.id;

export const useMatch = create<MatchStore>((set, get) => {
  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleNext = (): void => {
    clearTimer();
    const { running, speed } = get();
    if (!running || !world) return;
    timer = setTimeout(() => void step(true), Math.max(8, 1000 / speed));
  };

  const step = async (cont: boolean): Promise<void> => {
    if (stepping) return; // no overlapping steps (interval loop or manual step)
    const w = world;
    if (!w) return;
    stepping = true;
    try {
      await stepWithBrains(w, host);
      if (world !== w) return; // world was reset/replaced (reset/tournament) during the await

      const prev = get().curr;
      const curr = buildSnapshot(w);
      recordedBuffer.push(curr);

      const newLogs: LogLine[] = [];
      for (const e of get().entries) {
        if (e.status === 'ready' && host.isDisqualified(e.id) && !disqualifiedLogged.has(e.id)) {
          disqualifiedLogged.add(e.id);
          newLogs.push({ id: ++logSeq, speciesId: e.id, level: 'error', text: `${e.title} disqualified (compute budget exceeded or crashed).` });
        }
      }

      const over = isMatchOver(w);
      const tick = w.tick;
      const fresh: EffectSprite[] = curr.events.map((e, i) => ({
        id: `${tick}-${i}`,
        type: e.type,
        x: e.x,
        y: e.y,
        ...(e.hue !== undefined ? { hue: e.hue } : {}),
        bornTick: tick,
      }));
      set((s) => ({
        prev,
        curr,
        lastStepAt: performance.now(),
        tick,
        recordedCount: recordedBuffer.length,
        leaderboard: computeScores(w),
        matchOver: over,
        running: over ? false : s.running,
        effects: [...s.effects.filter((fx) => tick - fx.bornTick < EFFECT_TICKS), ...fresh].slice(-EFFECT_CAP),
        logs: newLogs.length ? [...s.logs, ...newLogs].slice(-100) : s.logs,
      }));

      if (cont && !over && get().running) scheduleNext();
      else clearTimer();
    } finally {
      stepping = false;
    }
  };

  return {
    entries: initialEntries,
    activeId: initialActiveId,
    running: false,
    speed: 12,
    seed: 1,
    lockSeed: false,
    tick: 0,
    matchOver: false,
    prev: null,
    curr: null,
    lastStepAt: 0,
    effects: [],
    arenaSpecies: [],
    leaderboard: [],
    logs: [],
    recorded: [],
    recordedCount: 0,
    replayMode: false,
    tournamentRunning: false,
    tournamentStandings: [],

    setSource: (id, source) =>
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === id ? { ...e, source, status: 'idle', error: undefined, role: parseRole(source) ?? e.role } : e,
        ),
      })),

    setActive: (id) => set({ activeId: id }),
    setSpeed: (speed) => set({ speed }),
    setSeed: (seed) => set({ seed: seed >>> 0 }),
    setLockSeed: (v) => set({ lockSeed: v }),
    setHue: (id, hue) =>
      set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, hue } : e)) })),

    saveCreatures: () => {
      if (typeof localStorage === 'undefined') return;
      try {
        const { entries, activeId } = get();
        const payload = {
          activeId,
          entries: entries.map((e) => ({ id: e.id, title: e.title, source: e.source, role: e.role, hue: e.hue })),
        };
        localStorage.setItem(CREATURES_KEY, JSON.stringify(payload));
      } catch {
        /* storage unavailable or over quota — ignore */
      }
    },

    addEntry: () => {
      entrySeq += 1;
      const id = `sp-new-${entrySeq}`;
      const hue = HUES[get().entries.length % HUES.length] ?? 200;
      const entry: EditorEntry = {
        id,
        title: `Creature ${get().entries.length + 1}`,
        source: '',
        status: 'idle',
        error: undefined,
        role: 'herbivore',
        hue,
      };
      set((s) => ({ entries: [...s.entries, entry], activeId: id }));
    },

    removeEntry: (id) =>
      set((s) => {
        const entries = s.entries.filter((e) => e.id !== id);
        const activeId = s.activeId === id ? (entries[0]?.id ?? '') : s.activeId;
        return { entries, activeId };
      }),

    startMatch: async () => {
      clearTimer();
      host.dispose();
      disqualifiedLogged.clear();
      recordedBuffer = [];
      world = null;
      const seed = get().lockSeed ? get().seed : (Math.floor(Math.random() * 0xffffffff) >>> 0);
      set({ seed });

      const entries = [...get().entries];
      const defs: SpeciesDef[] = [];
      const logs: LogLine[] = [];

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (!e.source.trim()) {
          entries[i] = { ...e, status: 'idle', error: undefined };
          continue;
        }
        const c = compileCreature(e.source, e.title || e.id);
        if (!c.ok) {
          entries[i] = { ...e, status: 'error', error: c.error };
          logs.push({ id: ++logSeq, speciesId: e.id, level: 'error', text: `${e.title}: ${c.error}` });
          continue;
        }
        const res = await host.load(e.id, c.code);
        if (!res.ok || !res.meta || !res.traits) {
          entries[i] = { ...e, status: 'error', error: res.error ?? 'failed to load' };
          logs.push({ id: ++logSeq, speciesId: e.id, level: 'error', text: `${e.title}: ${res.error ?? 'failed to load'}` });
          continue;
        }
        defs.push({
          id: e.id,
          name: res.meta.name,
          role: res.meta.role,
          traits: res.traits,
          hue: e.hue,
          ...(res.appearance ? { appearance: res.appearance } : {}),
        });
        entries[i] = { ...e, status: 'ready', error: undefined, role: res.meta.role, title: res.meta.name };
      }

      if (defs.length === 0) {
        set((s) => ({
          entries,
          logs: [...s.logs, ...logs, { id: ++logSeq, level: 'error' as const, text: 'Load at least one valid creature to start a match.' }].slice(-100),
        }));
        return;
      }

      world = createWorld({ seed, species: defs });
      const arenaSpecies: ArenaSpecies[] = [...world.species.values()].map((s) => ({
        id: s.id,
        name: s.name,
        hue: s.hue,
        role: s.role,
        ...(s.appearance ? { appearance: s.appearance } : {}),
      }));
      const first = buildSnapshot(world);
      recordedBuffer.push(first);

      set((s) => ({
        entries,
        arenaSpecies,
        prev: null,
        curr: first,
        lastStepAt: performance.now(),
        effects: [],
        tick: 0,
        matchOver: false,
        replayMode: false,
        recorded: [],
        recordedCount: recordedBuffer.length,
        leaderboard: computeScores(world!),
        running: true,
        logs: [...s.logs, ...logs, { id: ++logSeq, level: 'info' as const, text: `Match started with ${defs.length} species (seed ${seed}).` }].slice(-100),
      }));
      scheduleNext();
    },

    togglePlay: () => {
      if (get().running) {
        set({ running: false });
        clearTimer();
        return;
      }
      if (!world || get().matchOver || get().replayMode) return;
      set({ running: true });
      scheduleNext();
    },

    stepOnce: async () => {
      set({ running: false });
      clearTimer();
      if (!world || get().matchOver || get().replayMode) return;
      await step(false);
    },

    reset: () => {
      clearTimer();
      host.dispose();
      disqualifiedLogged.clear();
      recordedBuffer = [];
      world = null;
      set({ running: false, matchOver: false, tick: 0, prev: null, curr: null, lastStepAt: 0, effects: [], leaderboard: [], arenaSpecies: [], recorded: [], recordedCount: 0, replayMode: false });
    },

    enterReplay: () => {
      if (recordedBuffer.length < 2) return;
      set({ running: false, replayMode: true, recorded: recordedBuffer.slice() });
      clearTimer();
    },

    exitReplay: () => set({ replayMode: false }),

    shareCode: () =>
      encodeReplay({
        seed: get().seed,
        species: get().entries.map((e) => ({ title: e.title, source: e.source })),
      }),

    loadFromCode: (code) => {
      const spec = decodeReplay(code);
      if (!spec || spec.species.length === 0) return false;
      const entries: EditorEntry[] = spec.species.map((sp, i) => ({
        id: `sp-load-${i}`,
        title: sp.title || `Creature ${i + 1}`,
        source: sp.source,
        status: 'idle',
        error: undefined,
        role: parseRole(sp.source) ?? 'herbivore',
        hue: HUES[i % HUES.length] ?? 200,
      }));
      set({ entries, activeId: entries[0]!.id, seed: spec.seed >>> 0 });
      return true;
    },

    runTournament: async () => {
      if (get().tournamentRunning) return;
      clearTimer();
      host.dispose();
      disqualifiedLogged.clear();
      recordedBuffer = [];
      world = null;
      set({ running: false, replayMode: false, tournamentRunning: true, tournamentStandings: [], curr: null, prev: null, arenaSpecies: [], recordedCount: 0 });

      try {
        const entries = [...get().entries];
        const defs: SpeciesDef[] = [];
        const compiledById = new Map<string, string>();
        const logs: LogLine[] = [];
        for (const e of entries) {
          if (!e.source.trim()) continue;
          const c = compileCreature(e.source, e.title || e.id);
          if (!c.ok) {
            logs.push({ id: ++logSeq, speciesId: e.id, level: 'error', text: `${e.title}: ${c.error}` });
            continue;
          }
          const res = await host.load(e.id, c.code);
          if (!res.ok || !res.meta || !res.traits) {
            logs.push({ id: ++logSeq, speciesId: e.id, level: 'error', text: `${e.title}: ${res.error ?? 'failed to load'}` });
            continue;
          }
          defs.push({ id: e.id, name: res.meta.name, role: res.meta.role, traits: res.traits });
          compiledById.set(e.id, c.code);
        }

        if (defs.length < 1) {
          set((s) => ({
            logs: [...s.logs, ...logs, { id: ++logSeq, level: 'error' as const, text: 'Tournament needs at least one valid creature.' }].slice(-100),
          }));
          return;
        }

        const seeds = Array.from({ length: 5 }, (_, i) => (get().seed + i * 101) >>> 0);
        const tourneyConfig: Config = { ...DEFAULT_CONFIG, match: { ...DEFAULT_CONFIG.match, matchTicks: 800 } };
        const tHost: TournamentHost = {
          tick: (id, senses, budget) => host.tick(id, senses, budget),
          isDisqualified: (id) => host.isDisqualified(id),
          resetForRound: async () => {
            for (const [id, code] of compiledById) {
              const r = await host.load(id, code);
              if (!r.ok) {
                set((s) => ({
                  logs: [...s.logs, { id: ++logSeq, speciesId: id, level: 'error' as const, text: `reload failed for ${id} — idle this round` }].slice(-100),
                }));
              }
            }
          },
        };

        set((s) => ({ logs: [...s.logs, ...logs, { id: ++logSeq, level: 'info' as const, text: `Tournament: ${defs.length} species × ${seeds.length} seeds…` }].slice(-100) }));

        const result = await runTournament(defs, tHost, seeds, tourneyConfig, (r, i) => {
          set((s) => ({
            logs: [...s.logs, { id: ++logSeq, level: 'info' as const, text: `  round ${i + 1} (seed ${r.seed}) → ${r.ranking[0]?.name ?? '—'}` }].slice(-100),
          }));
        });

        const standLogs: LogLine[] = result.standings.map((st, i) => ({
          id: ++logSeq,
          level: 'info' as const,
          text: `  #${i + 1} ${st.name}: ${st.wins}W · avgRank ${st.avgRank.toFixed(2)}`,
        }));
        set((s) => ({
          tournamentStandings: result.standings,
          logs: [...s.logs, { id: ++logSeq, level: 'info' as const, text: 'Tournament complete:' }, ...standLogs].slice(-100),
        }));
      } finally {
        set({ tournamentRunning: false });
      }
    },
  };
});
