import harness from 'virtual:worker-harness';
import { WORKER_PROLOGUE } from './prologue';

/**
 * Assemble the full worker script: hardening prologue → bundled harness (sets
 * __ELECX_API__ + message loop) → the user's compiled creature (require/module shims
 * from the prologue resolve `@elecxarium/creature` to the harness-exposed API).
 */
export function buildWorkerSource(compiledUserCode: string): string {
  return `${WORKER_PROLOGUE}\n${harness}\n${compiledUserCode}\n`;
}
