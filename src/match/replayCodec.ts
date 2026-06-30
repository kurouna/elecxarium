// A match is fully reproducible from its seed + the species sources (the engine is
// deterministic), so a shareable "replay" is just that spec, base64-encoded.

export interface ReplaySpeciesSpec {
  title: string;
  source: string;
}

export interface ReplaySpec {
  seed: number;
  species: ReplaySpeciesSpec[];
}

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeReplay(spec: ReplaySpec): string {
  return toBase64(JSON.stringify(spec));
}

export function decodeReplay(code: string): ReplaySpec | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64(code));
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as { seed?: unknown; species?: unknown };
    if (typeof o.seed !== 'number' || !Array.isArray(o.species)) return null;
    const species: ReplaySpeciesSpec[] = [];
    for (const item of o.species) {
      if (!item || typeof item !== 'object') return null;
      const sp = item as { title?: unknown; source?: unknown };
      if (typeof sp.source !== 'string') return null;
      species.push({ title: typeof sp.title === 'string' ? sp.title : 'Creature', source: sp.source });
    }
    return { seed: o.seed >>> 0, species };
  } catch {
    return null;
  }
}
