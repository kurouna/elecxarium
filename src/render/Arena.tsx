import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Role } from '@elecxarium/creature';
import type { EffectSprite } from '@/state/store';
import { skinFor, speciesColor, type Skin } from './skins';
import type { RenderFrame } from './types';

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

interface SpeciesGfx {
  color: string;
  role: Role;
  /** The species' skin rasterised to a bitmap (currentColor baked to the species colour),
   * so the canvas can blit it per organism instead of React reconciling an SVG per creature. */
  sprite: HTMLImageElement;
}

const TAU = Math.PI * 2;
const SPRITE_PX = 64; // offscreen raster resolution for a skin
const R = 11; // energy-ring radius (matches the old SVG piece)

function buildSprite(skin: Skin, color: string): HTMLImageElement {
  const body = skin.svg.split('currentColor').join(color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${skin.viewBox}" width="${SPRITE_PX}" height="${SPRITE_PX}">${body}</svg>`;
  const img = new Image(SPRITE_PX, SPRITE_PX);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img;
}

/**
 * Canvas renderer for the arena. The heavy, per-tick mass — plants, carcasses and every
 * creature — is drawn on a single <canvas> (one blit + a couple of arcs each), which scales
 * to hundreds of organisms where an SVG-node-per-creature approach stalls on React
 * reconciliation. The static background and the handful of transient effects stay as thin
 * SVG layers, and the hover tooltip stays plain HTML.
 */
export function Arena({ frame, species, width = 1000, height = 1000, effects = [], highlightSpecies = null }: ArenaProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [spriteReady, setSpriteReady] = useState(0);

  // Per-species graphics (colour + rasterised sprite). Rebuilt only when the roster changes.
  const gfx = useMemo(() => {
    const m = new Map<string, SpeciesGfx>();
    for (const s of species) {
      const color = speciesColor(s.hue);
      m.set(s.id, { color, role: s.role, sprite: buildSprite(skinFor(s.role, s.appearance), color) });
    }
    return m;
  }, [species]);

  // Sprites decode asynchronously; force one redraw each time one becomes ready (covers the
  // paused/initial case where the frame isn't advancing on its own).
  useEffect(() => {
    let alive = true;
    const bump = (): void => {
      if (alive) setSpriteReady((n) => n + 1);
    };
    for (const g of gfx.values()) if (!g.sprite.complete) g.sprite.addEventListener('load', bump, { once: true });
    return () => {
      alive = false;
    };
  }, [gfx]);

  // Draw the organism layer. Runs on every frame (and on highlight/sprite/size changes).
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round((box.clientWidth || 1) * dpr));
    const bh = Math.max(1, Math.round((box.clientHeight || 1) * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fit the square world into the backing store and centre it (matches SVG xMidYMid meet).
    const drawn = Math.min(bw, bh);
    const scale = drawn / width;
    const offX = (bw - drawn) / 2;
    const offY = (bh - drawn) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    ctx.setTransform(scale, 0, 0, scale, offX, offY);

    // Environmental plants (auto-food dots).
    ctx.fillStyle = 'hsl(142 65% 55%)';
    for (const p of frame.plants) {
      ctx.globalAlpha = 0.35 + 0.55 * Math.min(1, p.energy / 80);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, TAU);
      ctx.fill();
    }
    // Carcasses.
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = 'hsl(40 10% 60%)';
    for (const c of frame.carcasses) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Creatures (plant-role, herbivore, carnivore).
    for (const a of frame.animals) {
      const g = gfx.get(a.speciesId);
      const color = g?.color ?? '#ffffff';
      const dim = highlightSpecies !== null && a.speciesId !== highlightSpecies;
      const base = dim ? 0.18 : 1;
      // soft glow halo
      ctx.globalAlpha = dim ? 0.03 : 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 13.5, 0, TAU);
      ctx.fill();
      // track ring
      ctx.globalAlpha = base;
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(a.x, a.y, R, 0, TAU);
      ctx.stroke();
      // energy arc
      const frac = a.energyMax > 0 ? Math.max(0, Math.min(1, a.energy / a.energyMax)) : 0;
      if (frac > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(a.x, a.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.stroke();
      }
      // defend ring
      if (a.defending) {
        ctx.globalAlpha = dim ? 0.18 : 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, R + 2.5, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = base;
      }
      // body sprite (fallback disc until the raster decodes)
      const sprite = g?.sprite;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.drawImage(sprite, a.x - R, a.y - R, R * 2, R * 2);
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [frame, gfx, highlightSpecies, width, height, spriteReady]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) || 1;
    const offX = (rect.width - size) / 2;
    const offY = (rect.height - size) / 2;
    const wx = ((e.clientX - rect.left - offX) / size) * width;
    const wy = ((e.clientY - rect.top - offY) / size) * height;
    let best: { id: string; d2: number } | null = null;
    for (const a of frame.animals) {
      const dx = a.x - wx;
      const dy = a.y - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= (R + 3) * (R + 3) && (!best || d2 < best.d2)) best = { id: a.id, d2 };
    }
    if (best) {
      setHover({
        id: best.id,
        x: Math.min(e.clientX + 14, window.innerWidth - 190),
        y: Math.min(e.clientY + 14, window.innerHeight - 56),
      });
    } else if (hover) {
      setHover(null);
    }
  };

  const hovered = hover ? frame.animals.find((a) => a.id === hover.id) : undefined;
  const hInfo = hovered ? gfx.get(hovered.speciesId) : undefined;
  const hSpecies = hovered ? species.find((s) => s.id === hovered.speciesId) : undefined;

  return (
    <div ref={boxRef} className="relative h-full w-full" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      {/* static background — in-flow so its 1:1 viewBox sizes the square box; other layers overlay it */}
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="arena-bg" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="rgba(120,170,255,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <pattern id="arena-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 H0 V48" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill="url(#arena-grid)" />
        <rect x={0} y={0} width={width} height={height} fill="url(#arena-bg)" />
      </svg>

      {/* organism layer */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label="Ecosystem arena" />

      {/* transient effects + vignette (few, cheap; keeps the existing CSS animations) */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: 'none' }}
        aria-hidden
      >
        <defs>
          <radialGradient id="arena-vignette" cx="50%" cy="50%" r="72%">
            <stop offset="58%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </radialGradient>
        </defs>
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
        <rect x={0} y={0} width={width} height={height} fill="url(#arena-vignette)" />
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
