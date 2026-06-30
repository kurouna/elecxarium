import type { Role } from '@elecxarium/creature';

/** Species accent color from its hue. */
export function speciesColor(hue: number, lightness = 62, sat = 72): string {
  return `hsl(${Math.round(hue)} ${sat}% ${lightness}%)`;
}

export interface Skin {
  viewBox: string;
  /** Inner SVG markup; `currentColor` is replaced with the species color. */
  svg: string;
}

const HERBIVORE_SKIN: Skin = {
  viewBox: '0 0 32 32',
  svg:
    '<ellipse cx="16" cy="17" rx="11" ry="9.5" fill="currentColor"/>' +
    '<ellipse cx="16" cy="13.5" rx="7.5" ry="5" fill="rgba(255,255,255,0.22)"/>' +
    '<circle cx="12.6" cy="15" r="1.7" fill="#0a0e15"/><circle cx="19.4" cy="15" r="1.7" fill="#0a0e15"/>',
};

const CARNIVORE_SKIN: Skin = {
  viewBox: '0 0 32 32',
  svg:
    '<path d="M16 2 L29 27 L16 21 L3 27 Z" fill="currentColor"/>' +
    '<path d="M16 2 L22 20 L16 17.5 L10 20 Z" fill="rgba(255,255,255,0.2)"/>' +
    '<circle cx="13" cy="14" r="1.5" fill="#0a0e15"/><circle cx="19" cy="14" r="1.5" fill="#0a0e15"/>',
};

const PLANT_SKIN: Skin = {
  viewBox: '0 0 32 32',
  svg:
    '<circle cx="16" cy="16.5" r="5" fill="currentColor"/>' +
    '<ellipse cx="16" cy="6.5" rx="3" ry="4.6" fill="currentColor"/>' +
    '<ellipse cx="24.8" cy="12.6" rx="4.6" ry="3" fill="currentColor"/>' +
    '<ellipse cx="21.2" cy="24" rx="3" ry="4.4" fill="currentColor"/>' +
    '<ellipse cx="9.6" cy="23" rx="4.4" ry="3" fill="currentColor"/>' +
    '<ellipse cx="6.8" cy="11.4" rx="4.4" ry="3" fill="currentColor"/>',
};

export function defaultSkin(role: Role): Skin {
  return role === 'carnivore' ? CARNIVORE_SKIN : role === 'plant' ? PLANT_SKIN : HERBIVORE_SKIN;
}

const ALLOWED_SVG_TAGS = new Set([
  'path',
  'circle',
  'rect',
  'polygon',
  'polyline',
  'line',
  'ellipse',
  'g',
]);

/**
 * Conservative allowlist check for creature-supplied SVG before it is injected via
 * dangerouslySetInnerHTML. Rejects (→ default skin) anything outside a small set of
 * shape tags, or containing scripts, event handlers, external refs, or url()/data:.
 */
export function isSafeSkinSvg(svg: string): boolean {
  if (typeof svg !== 'string' || svg.length === 0 || svg.length > 2000) return false;
  if (/<\s*(script|foreignobject|image|use|a|style|animate|set|iframe|text)/i.test(svg)) return false;
  if (/\son\w+\s*=/i.test(svg)) return false; // event-handler attributes
  if (/(href|xlink|javascript:|data:|url\()/i.test(svg)) return false;
  const tags = svg.match(/<\s*\/?\s*([a-zA-Z][\w-]*)/g) ?? [];
  for (const raw of tags) {
    const name = raw.replace(/[^a-zA-Z-]/g, '').toLowerCase();
    if (!ALLOWED_SVG_TAGS.has(name)) return false;
  }
  return true;
}

export function skinFor(role: Role, appearance?: Skin): Skin {
  if (appearance && isSafeSkinSvg(appearance.svg)) return appearance;
  return defaultSkin(role);
}
