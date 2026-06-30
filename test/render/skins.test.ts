import { describe, it, expect } from 'vitest';
import { speciesColor, defaultSkin, skinFor, isSafeSkinSvg } from '@/render/skins';

describe('skins', () => {
  it('formats an hsl color from hue', () => {
    expect(speciesColor(120)).toContain('hsl(120');
  });

  it('gives distinct default skins per role', () => {
    expect(defaultSkin('herbivore').svg).not.toBe(defaultSkin('carnivore').svg);
  });

  it('prefers a provided (safe) appearance', () => {
    const ap = { viewBox: '0 0 10 10', svg: '<rect width="10" height="10" fill="currentColor"/>' };
    expect(skinFor('herbivore', ap)).toBe(ap);
    expect(skinFor('carnivore')).toEqual(defaultSkin('carnivore'));
  });
});

describe('isSafeSkinSvg', () => {
  it('accepts simple shape SVG', () => {
    expect(isSafeSkinSvg('<polygon points="0,0 10,0 5,10" fill="currentColor"/>')).toBe(true);
    expect(isSafeSkinSvg('<g><circle cx="5" cy="5" r="4" fill="currentColor"/></g>')).toBe(true);
  });

  it('rejects scripts, handlers, external refs, and oversize', () => {
    expect(isSafeSkinSvg('<script>alert(1)</script>')).toBe(false);
    expect(isSafeSkinSvg('<image href="x" onerror="alert(1)"/>')).toBe(false);
    expect(isSafeSkinSvg('<circle onclick="x" r="3"/>')).toBe(false);
    expect(isSafeSkinSvg('<a href="javascript:alert(1)">x</a>')).toBe(false);
    expect(isSafeSkinSvg('<rect fill="url(#x)"/>')).toBe(false);
    expect(isSafeSkinSvg('<foreignObject><div/></foreignObject>')).toBe(false);
    expect(isSafeSkinSvg('x'.repeat(2001))).toBe(false);
    expect(isSafeSkinSvg('')).toBe(false);
  });

  it('skinFor falls back to default for unsafe appearance', () => {
    expect(skinFor('herbivore', { viewBox: '0 0 1 1', svg: '<script>x</script>' })).toEqual(
      defaultSkin('herbivore'),
    );
  });
});
