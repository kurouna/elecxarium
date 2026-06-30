import { useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { Arena } from '@/render/Arena';
import { DEFAULT_CONFIG } from '@/engine/config';
import { usePlayback } from '@/render/usePlayback';
import { useMatch } from '@/state/store';
import { Legend } from './Legend';

const { width: WORLD_W, height: WORLD_H } = DEFAULT_CONFIG.world;

export function ReplayView() {
  const recorded = useMatch((s) => s.recorded);
  const species = useMatch((s) => s.arenaSpecies);
  const exitReplay = useMatch((s) => s.exitReplay);
  const pb = usePlayback(recorded, 16, false);
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="aspect-square h-full max-h-full max-w-full overflow-hidden rounded-2xl border border-accent/40 bg-[#0b0f17] shadow-2xl">
          <Arena frame={pb.frame} species={species} width={WORLD_W} height={WORLD_H} highlightSpecies={highlight} />
        </div>
        <div className="pointer-events-none absolute left-7 top-7 rounded-md bg-black/30 px-2 py-1 text-xs tabular-nums text-muted backdrop-blur-sm">
          replay · tick {pb.frame.tick}
        </div>
        <button
          type="button"
          onClick={exitReplay}
          className="absolute right-6 top-6 flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-fg transition hover:brightness-125"
        >
          <X className="size-3" /> Exit replay
        </button>
      </div>
      <Legend onHover={setHighlight} />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => pb.setPlaying(!pb.playing)}
          className="grid size-8 place-items-center rounded-full bg-accent/20 text-accent transition hover:bg-accent/30"
          aria-label={pb.playing ? 'Pause replay' : 'Play replay'}
        >
          {pb.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, pb.total - 1)}
          step={0.01}
          value={pb.head}
          onChange={(e) => pb.seek(Number(e.target.value))}
          className="flex-1 accent-accent"
          aria-label="Replay timeline"
        />
        <span className="w-20 text-right text-xs tabular-nums text-muted">
          {pb.index} / {Math.max(0, pb.total - 1)}
        </span>
      </div>
    </div>
  );
}
