import { describe, it, expect } from 'vitest';
import { buildWorkerSource } from '@/sandbox/buildWorkerSource';
import { compileCreature } from '@/sandbox/compile';

describe('buildWorkerSource', () => {
  it('assembles prologue + bundled harness + user code', () => {
    const c = compileCreature(
      `import { defineCreature, idle } from '@elecxarium/creature';
       export default defineCreature({
         meta: { name: 'A', role: 'herbivore' },
         traits: { maxEnergy: 0, eyesight: 0, speed: 0, attack: 0, defense: 0, eatingSpeed: 0, camouflage: 0 },
         think() { return idle(); },
       });`,
    );
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    const src = buildWorkerSource(c.code);
    // prologue markers
    expect(src).toContain('__ELECX_MODULE__');
    expect(src).toContain('imports are not available in creatures');
    // bundled harness present (non-trivial size)
    expect(src.length).toBeGreaterThan(1500);
    // user code present
    expect(src).toContain("require('@elecxarium/creature')");
  });
});
