import { describe, it, expect } from 'vitest';
import { compileCreature } from '@/sandbox/compile';

describe('compileCreature (sucrase)', () => {
  it('strips TypeScript type annotations', () => {
    const r = compileCreature('const x: number = 1; export const y: string = "a";');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.code).not.toContain(': number');
      expect(r.code).toContain('exports');
    }
  });

  it('rewrites imports to require', () => {
    const r = compileCreature(
      `import { defineCreature } from '@elecxarium/creature'; export default defineCreature;`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.code).toContain("require('@elecxarium/creature')");
  });

  it('reports syntax errors instead of throwing', () => {
    const r = compileCreature('const = ;');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
