import { describe, it, expect } from 'vitest';
import { encodeReplay, decodeReplay, type ReplaySpec } from '@/match/replayCodec';

const spec: ReplaySpec = {
  seed: 4242,
  species: [
    { title: 'Grazer', source: 'export default 1; // 日本語コメント ok' },
    { title: 'Stalker', source: 'const x = "<svg/>";' },
  ],
};

describe('replayCodec', () => {
  it('round-trips a spec', () => {
    const decoded = decodeReplay(encodeReplay(spec));
    expect(decoded).toEqual(spec);
  });

  it('handles unicode sources', () => {
    const s: ReplaySpec = { seed: 1, species: [{ title: '🐺', source: 'const x = "あ"' }] };
    expect(decodeReplay(encodeReplay(s))).toEqual(s);
  });

  it('returns null for garbage', () => {
    expect(decodeReplay('not base64 !!!')).toBeNull();
    expect(decodeReplay(btoa('{"seed":"x"}'))).toBeNull();
    expect(decodeReplay(btoa('[]'))).toBeNull();
  });
});
