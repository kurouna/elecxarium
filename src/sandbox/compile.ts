import { transform } from 'sucrase';

export type CompileResult = { ok: true; code: string } | { ok: false; error: string };

/**
 * Compile user TypeScript into CommonJS the worker harness can run.
 * `imports` rewrites `import`/`export` into require/module.exports so the
 * concatenated worker script needs no ESM loader (which CSP would block).
 */
export function compileCreature(source: string, name = 'creature'): CompileResult {
  try {
    const out = transform(source, {
      transforms: ['typescript', 'imports'],
      filePath: `${name}.ts`,
      production: true,
    });
    return { ok: true, code: out.code };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, error: e.message ?? String(err) };
  }
}
