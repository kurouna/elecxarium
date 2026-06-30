import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { WORKER_PROLOGUE } from '@/sandbox/prologue';

// Each vm context is a fresh realm: overriding Math.random / nulling globals here
// cannot leak into the test runner. This exercises the real prologue logic.
function makeContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    fetch: () => undefined,
    XMLHttpRequest: function () {},
    WebSocket: function () {},
    importScripts: () => undefined,
    indexedDB: {},
    caches: {},
    navigator: {},
    location: {},
  };
  vm.createContext(ctx);
  vm.runInContext(WORKER_PROLOGUE, ctx);
  return ctx;
}

describe('worker prologue (sandbox hardening)', () => {
  it('nulls dangerous globals', () => {
    const ctx = makeContext();
    for (const k of [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'importScripts',
      'indexedDB',
      'caches',
      'navigator',
      'location',
    ]) {
      expect(ctx[k]).toBeUndefined();
    }
  });

  it('require only resolves @elecxarium/creature', () => {
    const ctx = makeContext();
    ctx.__ELECX_API__ = { defineCreature: true };
    vm.runInContext(
      `globalThis.__r1 = require("@elecxarium/creature");
       try { require("fs"); globalThis.__r2 = "no-throw"; } catch (e) { globalThis.__r2 = "threw"; }
       try { require("node:child_process"); globalThis.__r3 = "no-throw"; } catch (e) { globalThis.__r3 = "threw"; }`,
      ctx,
    );
    expect(ctx.__r1).toBe(ctx.__ELECX_API__);
    expect(ctx.__r2).toBe('threw');
    expect(ctx.__r3).toBe('threw');
  });

  it('Math.random is seeded and deterministic via __ELECX_SEED__', () => {
    const ctx = makeContext();
    vm.runInContext(
      `globalThis.__ELECX_SEED__(42); var a = [Math.random(), Math.random(), Math.random()];
       globalThis.__ELECX_SEED__(42); var b = [Math.random(), Math.random(), Math.random()];
       globalThis.__res = { eq: a[0]===b[0] && a[1]===b[1] && a[2]===b[2],
         range: a.every(function (x) { return x >= 0 && x < 1; }),
         varied: a[0] !== a[1] };`,
      ctx,
    );
    const res = ctx.__res as { eq: boolean; range: boolean; varied: boolean };
    expect(res.eq).toBe(true);
    expect(res.range).toBe(true);
    expect(res.varied).toBe(true);
  });

  it('Date.now is frozen for determinism', () => {
    const ctx = makeContext();
    vm.runInContext('globalThis.__now = Date.now();', ctx);
    expect(ctx.__now).toBe(0);
  });

  it('provides a CommonJS module for the imports transform', () => {
    const ctx = makeContext();
    vm.runInContext('module.exports.default = { hello: 1 };', ctx);
    const mod = ctx.__ELECX_MODULE__ as { exports: { default?: unknown } };
    expect(mod.exports.default).toEqual({ hello: 1 });
  });
});
