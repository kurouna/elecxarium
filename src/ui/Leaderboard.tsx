import type { Role } from '@elecxarium/creature';
import { useMatch } from '@/state/store';

// Terrarium ranked plants, herbivores and carnivores in SEPARATE leaderboards — an apex
// carnivore is never out-ranked by a plant just for being less numerous. We group the
// standings by trophic type and crown the champion of each type.
const ROLE_ORDER: Role[] = ['carnivore', 'herbivore', 'plant'];
const ROLE_LABEL: Record<Role, string> = {
  carnivore: 'Carnivores',
  herbivore: 'Herbivores',
  plant: 'Plants',
};

export function Leaderboard() {
  const rows = useMatch((s) => s.leaderboard);
  const over = useMatch((s) => s.matchOver);

  // rows arrive globally sorted by score, so each role's slice is already best-first.
  const groups = ROLE_ORDER.map((role) => ({ role, rows: rows.filter((r) => r.role === role) })).filter(
    (g) => g.rows.length > 0,
  );

  return (
    <div className="flex h-full flex-col bg-surface/20">
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Leaderboard
      </h2>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {rows.length === 0 && <p className="px-2 py-4 text-xs text-muted">Run a match to see standings.</p>}
        {groups.map((g) => (
          <div key={g.role} className="mb-2">
            <div className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              {ROLE_LABEL[g.role]}
            </div>
            {g.rows.map((r) => (
              <div key={r.speciesId} className="mb-1 rounded-lg bg-surface-2/50 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs tabular-nums text-muted">{r.rankInRole}</span>
                  <span className="size-2.5 rounded-full" style={{ background: `hsl(${r.hue} 72% 62%)` }} />
                  <span className="flex-1 truncate text-sm">
                    {r.name}
                    {over && r.rankInRole === 1 && r.alive > 0 && !r.disqualified ? ' 👑' : ''}
                  </span>
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: r.alive > 0 ? 'var(--color-fg)' : 'var(--color-muted)' }}
                  >
                    {r.alive}
                  </span>
                </div>
                <div className="mt-1 flex gap-3 pl-6 text-[11px] tabular-nums text-muted">
                  <span>bio {Math.round(r.biomass)}</span>
                  <span>kills {r.kills}</span>
                  <span>births {r.births}</span>
                  {r.disqualified && <span style={{ color: 'hsl(0 70% 68%)' }}>DQ</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
