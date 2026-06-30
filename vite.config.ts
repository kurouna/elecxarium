import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { build as esbuildBuild } from 'esbuild';

/**
 * Bundles the worker harness (brainWorker.ts + brainCore + creature-api) into a single
 * self-contained IIFE string, exposed as the default export of `virtual:worker-harness`.
 * The sandbox concatenates this with the prologue and the user's compiled creature.
 */
function workerHarnessPlugin(): Plugin {
  const VIRTUAL = 'virtual:worker-harness';
  const RESOLVED = '\0' + VIRTUAL;
  const entry = fileURLToPath(new URL('./src/sandbox/brainWorker.ts', import.meta.url));
  return {
    name: 'elecx-worker-harness',
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return undefined;
      const res = await esbuildBuild({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2022',
        legalComments: 'none',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      });
      const code = res.outputFiles[0]?.text ?? '';
      return `export default ${JSON.stringify(code)};`;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // relative paths so the static build also runs under file:// (Electron) and subpaths
  plugins: [react(), tailwindcss(), workerHarnessPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@elecxarium/creature': fileURLToPath(new URL('./src/creature-api/index.ts', import.meta.url)),
    },
  },
  worker: { format: 'es' },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 5000 },
  server: { port: 5180, strictPort: true },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
});
