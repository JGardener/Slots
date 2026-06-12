# Slots Showcase

A 5×3 video slot built as an engineering showcase: a pure-TypeScript game engine
(weighted reel strips, payline evaluation, Monte Carlo-verified RTP) presented
through React, PixiJS, and GSAP.

> **Status:** Phase 0 — scaffold. See [PLAN.md](./PLAN.md) for the full project plan.

## Structure

- `packages/engine` — pure TypeScript game engine. Zero runtime dependencies, fully unit-tested. Knows nothing about rendering.
- `apps/game` — the presentation layer. React owns the shell and DOM HUD; PixiJS renders the game scene imperatively; GSAP owns all motion.

## Develop

```sh
pnpm install
pnpm dev        # run the game locally
pnpm test       # engine unit tests
pnpm typecheck
pnpm lint
pnpm build
```
