import { useState } from 'react';
import { Dices, Film, Pause, Play, RotateCcw, Rocket, Share2, SkipForward, Trophy } from 'lucide-react';
import { useMatch } from '@/state/store';

const BTN =
  'grid size-9 place-items-center rounded-lg bg-surface-2 text-fg transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40';

export function Controls() {
  const running = useMatch((s) => s.running);
  const matchOver = useMatch((s) => s.matchOver);
  const replayMode = useMatch((s) => s.replayMode);
  const tick = useMatch((s) => s.tick);
  const speed = useMatch((s) => s.speed);
  const seed = useMatch((s) => s.seed);
  const lockSeed = useMatch((s) => s.lockSeed);
  const setLockSeed = useMatch((s) => s.setLockSeed);
  const hasWorld = useMatch((s) => s.curr !== null);
  const recordedCount = useMatch((s) => s.recordedCount);
  const startMatch = useMatch((s) => s.startMatch);
  const togglePlay = useMatch((s) => s.togglePlay);
  const stepOnce = useMatch((s) => s.stepOnce);
  const reset = useMatch((s) => s.reset);
  const enterReplay = useMatch((s) => s.enterReplay);
  const setSpeed = useMatch((s) => s.setSpeed);
  const setSeed = useMatch((s) => s.setSeed);
  const shareCode = useMatch((s) => s.shareCode);
  const tournamentRunning = useMatch((s) => s.tournamentRunning);
  const runTournament = useMatch((s) => s.runTournament);
  const [copied, setCopied] = useState(false);

  const status = matchOver ? 'finished' : running ? 'running' : 'paused';
  const statusColor = matchOver ? 'hsl(45 90% 70%)' : running ? 'hsl(140 60% 70%)' : 'var(--color-muted)';

  const onShare = (): void => {
    const url = `${location.origin}${location.pathname}#m=${shareCode()}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
      <button
        type="button"
        onClick={() => void startMatch()}
        disabled={tournamentRunning}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-[#06121a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Rocket className="size-4" /> Run match
      </button>
      <button
        type="button"
        onClick={togglePlay}
        disabled={!hasWorld || matchOver || replayMode}
        className={BTN}
        aria-label={running ? 'Pause' : 'Play'}
      >
        {running ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => void stepOnce()}
        disabled={!hasWorld || matchOver || running || replayMode}
        className={BTN}
        aria-label="Step one tick"
      >
        <SkipForward className="size-4" />
      </button>
      <button
        type="button"
        onClick={enterReplay}
        disabled={recordedCount < 2 || replayMode}
        className={BTN}
        aria-label="Replay"
      >
        <Film className="size-4" />
      </button>
      <button type="button" onClick={reset} className={BTN} aria-label="Reset">
        <RotateCcw className="size-4" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Speed</span>
        <input
          type="range"
          min={1}
          max={60}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="w-28 accent-accent"
          aria-label="Simulation speed"
        />
        <span className="w-9 tabular-nums text-xs text-muted">{speed}/s</span>
      </div>

      <span className="flex items-center gap-1.5 text-xs text-muted">
        <span>Seed</span>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value) || 0)}
          className="w-24 rounded bg-surface-2 px-2 py-1 text-fg outline-none"
          aria-label="Seed"
        />
        <button
          type="button"
          onClick={() => setSeed(Math.floor(Math.random() * 0xffffffff) >>> 0)}
          className="grid size-7 place-items-center rounded bg-surface-2 text-muted transition hover:text-fg"
          aria-label="Randomize seed"
          title="Randomize seed"
        >
          <Dices className="size-3.5" />
        </button>
        <label
          className="flex cursor-pointer items-center gap-1"
          title="Lock the seed so every Run reuses it (debugging / reproducible replays). Unlocked = random each Run."
        >
          <input
            type="checkbox"
            checked={lockSeed}
            onChange={(e) => setLockSeed(e.target.checked)}
            className="accent-accent"
          />
          lock
        </label>
      </span>

      <button
        type="button"
        onClick={() => void runTournament()}
        disabled={tournamentRunning || running}
        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-fg transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trophy className="size-3.5" /> {tournamentRunning ? 'Running…' : 'Tournament'}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-fg transition hover:brightness-125"
      >
        <Share2 className="size-3.5" /> {copied ? 'Copied!' : 'Share'}
      </button>

      <div className="ml-auto flex items-center gap-2 text-xs">
        <span className="tabular-nums text-muted">tick {tick}</span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5" style={{ color: statusColor }}>
          {status}
        </span>
      </div>
    </div>
  );
}
