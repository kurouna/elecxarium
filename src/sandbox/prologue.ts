/**
 * Runs first in every brain worker. Hardens the sandbox (defence in depth — the real
 * boundary is the CSP) and sets up the CommonJS shims the compiled user code expects.
 *
 *  - nulls network / storage / nested-worker globals
 *  - replaces Math.random with a seeded stream (re-seeded per creature per tick)
 *  - freezes Date.now to keep creatures deterministic
 *  - provides `module` / `exports` / `require` (require only resolves '@elecxarium/creature')
 */
export const WORKER_PROLOGUE = `;(function () {
  var DANGER = ['fetch','XMLHttpRequest','WebSocket','EventSource','RTCPeerConnection',
    'importScripts','Worker','SharedWorker','indexedDB','caches','BroadcastChannel',
    'navigator','location'];
  for (var i = 0; i < DANGER.length; i++) {
    try { Object.defineProperty(globalThis, DANGER[i], { value: undefined, configurable: true, writable: true }); }
    catch (e) { try { globalThis[DANGER[i]] = undefined; } catch (e2) {} }
  }
  var __s = 0;
  globalThis.__ELECX_SEED__ = function (seed) { __s = seed >>> 0; };
  Math.random = function () {
    __s = (__s + 0x6D2B79F5) | 0;
    var t = Math.imul(__s ^ (__s >>> 15), 1 | __s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { if (globalThis.Date) globalThis.Date.now = function () { return 0; }; } catch (e) {}
})();
globalThis.__ELECX_MODULE__ = { exports: {} };
var module = globalThis.__ELECX_MODULE__;
var exports = module.exports;
function require(n) {
  if (n === '@elecxarium/creature') return globalThis.__ELECX_API__;
  throw new Error('imports are not available in creatures: ' + n);
}`;
