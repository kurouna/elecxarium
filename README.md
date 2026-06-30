# elecxarium

Terrarium-inspired, browser-native **creature-coding battle simulator**. Paste a creature written in
TypeScript, it is compiled with **sucrase** and run inside a sandboxed **Web Worker** (no network, no
filesystem, no `eval`), and competes against other players' creatures in a single deterministic
ecosystem.

- **Design spec:** [docs/SPEC.md](docs/SPEC.md)
- **Stack:** Vite + React + TypeScript + Tailwind, Electron for desktop, static build for the web.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (http://localhost:5180) |
| `npm run electron:dev` | Vite + Electron desktop shell |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | `tsc` typecheck (app + engine-purity config) |
| `npm run lint` | ESLint |
| `npm run build:web` | Type-check + static build into `dist/` |
| `npm run app:build` | Static build + Electron installer |

## Security model

The real boundary is the **Content-Security-Policy** (no `unsafe-eval`, `connect-src 'self'`) plus a
Web Worker whose dangerous globals (`fetch`, `XMLHttpRequest`, `WebSocket`, …) are nulled. User code
only ever exchanges plain-data messages (sensory snapshot in, action out) with the engine. See
[docs/SPEC.md §4](docs/SPEC.md).
