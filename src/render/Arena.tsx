import { useMemo, useState, type PointerEvent } from 'react';
import type { Role } from '@elecxarium/creature';
import type { EffectSprite } from '@/state/store';
import { skinFor, speciesColor, type Skin } from './skins';
import type { RenderAnimal, RenderFrame } from './types';

export interface ArenaSpecies {
  id: string;
  name: string;
  hue: number;
  role: Role;
  appearance?: Skin;
}

export interface ArenaProps {
  frame: RenderFrame;
  species: ArenaSpecies[];
  width?: number;
  height?: number;
  effects?: EffectSprite[];
  highlightSpecies?: string | null;
}

interface PieceInfo {
  color: string;
  role: Role;
  appearance?: Skin;
}

const RING_R = 11;
const RING_C = 2 * Math.PI * RING_R;
const SIZE = 22;

function Piece({ a, info, dim }: { a: RenderAnimal; info: PieceInfo | undefined; dim: boolean }) {
  const color = info?.color ?? '#ffffff';
  const role = info?.role ?? 'herbivore';
  const skin = skinFor(role, info?.appearance);
  const frac = a.energyMax > 0 ? Math.max(0, Math.min(1, a.energy / a.energyMax)) : 0;
  return (
    <g transform={`translate(${a.x} ${a.y})`} data-cid={a.id} style={{ color, opacity: dim ? 0.18 : 1, cursor: 'pointer' }}>
      <circle r={13.5} fill={color} opacity={0.16} /> {/* soft glow halo */}
      <circle r={RING_R} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1.5} />
      <circle
        r={RING_R}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeDasharray={RING_C}
        strokeDashoffset={RING_C * (1 - frac)}
        strokeLinecap="round"
        transform="rotate(-90)"
      />
      {a.defending && <circle r={RING_R + 2.5} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.85} />}
      <g
        transform={`translate(${-SIZE / 2} ${-SIZE / 2}) scale(${SIZE / 32})`}
        dangerouslySetInnerHTML={{ __html: skin.svg }}
      />
    </g>
  );
}

export function Arena({ frame, species, width = 1000, height = 1000, effects = [], highlightSpecies = null }: ArenaProps) {
  const lut = useMemo(() => {
    const m = new Map<string, PieceInfo>();
    for (const s of species) {
      m.set(s.id, { color: speciesColor(s.hue), role: s.role, ...(s.appearance ? { appearance: s.appearance } : {}) });
    }
    return m;
  }, [species]);

  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const plants = useMemo(
    () =>
      frame.plants.map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={3.2}
          fill="hsl(142 65% 55%)"
          opacity={0.35 + 0.55 * Math.min(1, p.energy / 80)}
        />
      )),
    [frame.plants],
  );
  const carcasses = useMemo(
    () => frame.carcasses.map((c) => <circle key={c.id} cx={c.x} cy={c.y} r={4} fill="hsl(40 10% 60%)" opacity={0.4} />),
    [frame.carcasses],
  );
  const pieces = useMemo(
    () =>
      frame.animals.map((a) => (
        <Piece
          key={a.id}
          a={a}
          info={lut.get(a.speciesId)}
          dim={highlightSpecies !== null && a.speciesId !== highlightSpecies}
        />
      )),
    [frame.animals, lut, highlightSpecies],
  );

  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    const el = (e.target as Element).closest?.('[data-cid]');
    const id = el?.getAttribute('data-cid') ?? null;
    if (id) {
      setHover({
        id,
        x: Math.min(e.clientX + 14, window.innerWidth - 190),
        y: Math.min(e.clientY + 14, window.innerHeight - 56),
      });
    } else if (hover) {
      setHover(null);
    }
  };

  const hovered = hover ? frame.animals.find((a) => a.id === hover.id) : undefined;
  const hInfo = hovered ? lut.get(hovered.speciesId) : undefined;
  const hSpecies = hovered ? species.find((s) => s.id === hovered.speciesId) : undefined;

  return (
    <div className="relative h-full w-full" onPointerLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="Ecosystem arena"
        onPointerMove={onPointerMove}
      >
        <defs>
          <radialGradient id="arena-bg" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="rgba(120,170,255,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="arena-vignette" cx="50%" cy="50%" r="72%">
            <stop offset="58%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </radialGradient>
          <pattern id="arena-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 H0 V48" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x={0} y={0} width={width} height={height} fill="url(#arena-grid)" />
        <rect x={0} y={0} width={width} height={height} fill="url(#arena-bg)" />

        {plants}
        {carcasses}
        {pieces}

        {effects.map((e) => {
          const isAttack = e.type === 'attack';
          const col = isAttack ? 'hsl(2 90% 62%)' : `hsl(${e.hue ?? 50} 88% 62%)`;
          const r = e.type === 'death' ? 10 : isAttack ? 7 : 6;
          return (
            <g key={e.id} transform={`translate(${e.x} ${e.y})`}>
              <circle
                className={`fx fx-${e.type}`}
                r={r}
                fill={isAttack ? 'none' : col}
                stroke={isAttack ? col : 'none'}
                strokeWidth={isAttack ? 2.2 : 0}
              />
            </g>
          );
        })}

        <rect x={0} y={0} width={width} height={height} fill="url(#arena-vignette)" style={{ pointerEvents: 'none' }} />
      </svg>

      {hover && hovered && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-border bg-surface-2/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-medium" style={{ color: hInfo?.color ?? '#ffffff' }}>
            {hSpecies?.name ?? hovered.speciesId}
          </div>
          <div className="tabular-nums text-muted">
            {hInfo?.role ?? 'animal'} · energy {Math.round(hovered.energy)}/{Math.round(hovered.energyMax)} · age{' '}
            {hovered.age}
            {hovered.defending ? ' · defending' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
