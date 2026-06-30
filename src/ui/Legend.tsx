import type { Role } from '@elecxarium/creature';
import { useMatch } from '@/state/store';

function Marker({ hue, role }: { hue: number; role: Role }) {
  const color = `hsl(${hue} 72% 62%)`;
  return (
    <svg width="12" height="12" viewBox="0 0 32 32" style={{ color }} aria-hidden>
      {role === 'carnivore' ? (
        <path d="M16 3 L28 27 L16 21 L4 27 Z" fill="currentColor" />
      ) : role === 'plant' ? (
        <>
          <circle cx="16" cy="17" r="5" fill="currentColor" />
          <circle cx="16" cy="7" r="3.4" fill="currentColor" />
          <circle cx="25" cy="14" r="3.4" fill="currentColor" />
          <circle cx="7" cy="14" r="3.4" fill="currentColor" />
        </>
      ) : (
        <circle cx="16" cy="16" r="11" fill="currentColor" />
      )}
    </svg>
  );
}

/** Explains the arena's colors/shapes (each species + plants/carcasses); hovering a
 * species highlights it in the arena. */
export function Legend({ onHover }: { onHover?: (id: string | null) => void }) {
  const species = useMatch((s) => s.arenaSpecies);
  const leaderboard = useMatch((s) => s.leaderboard);
  const aliveById = new Map(leaderboard.map((r) => [r.speciesId, r.alive] as const));

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted">
      {species.map((s) => (
        <span
          key={s.id}
          className="flex cursor-default items-center gap-1.5 rounded px-1 transition hover:bg-surface-2"
          onMouseEnter={() => onHover?.(s.id)}
          onMouseLeave={() => onHover?.(null)}
        >
          <Marker hue={s.hue} role={s.role} />
          <span className="text-fg">{s.name}</span>
          <span className="tabular-nums">×{aliveById.get(s.id) ?? 0}</span>
          <span>· {s.role}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: 'hsl(140 60% 55%)' }} />
        plant (food)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ background: 'hsl(40 12% 62%)', opacity: 0.6 }} />
        carcass
      </span>
    </div>
  );
}
