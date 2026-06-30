import { useState } from 'react';
import { Arena } from '@/render/Arena';
import { DEFAULT_CONFIG } from '@/engine/config';
import { useMatch } from '@/state/store';
import { Legend } from './Legend';
import { ReplayView } from './ReplayView';
import { useLiveFrame } from './useLiveFrame';

const { width: WORLD_W, height: WORLD_H } = DEFAULT_CONFIG.world;

function EmptyState() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <p className="text-sm text-muted">No match running.</p>
        <p className="mt-1 text-xs text-muted/70">Edit creatures on the left, then press “Run match”.</p>
      </div>
    </div>
  );
}

export function ArenaPanel() {
  const frame = useLiveFrame();
  const species = useMatch((s) => s.arenaSpecies);
  const effects = useMatch((s) => s.effects);
  const hasWorld = useMatch((s) => s.curr !== null);
  const replayMode = useMatch((s) => s.replayMode);
  const [highlight, setHighlight] = useState<string | null>(null);

  if (replayMode) return <ReplayView />;

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="aspect-square h-full max-h-full max-w-full overflow-hidden rounded-2xl border border-border bg-[#0a0d14] shadow-2xl">
          {hasWorld ? (
            <Arena
              frame={frame}
              species={species}
              width={WORLD_W}
              height={WORLD_H}
              effects={effects}
              highlightSpecies={highlight}
            />
          ) : (
            <EmptyState />
          )}
        </div>
        {hasWorld && (
          <div className="pointer-events-none absolute left-7 top-7 rounded-md bg-black/30 px-2 py-1 text-xs tabular-nums text-muted backdrop-blur-sm">
            tick {frame.tick}
          </div>
        )}
      </div>
      <Legend onHover={setHighlight} />
    </div>
  );
}
