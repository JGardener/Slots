# Slots Showcase — Codebase Guide

**Audience:** iGaming/slots studio engineers evaluating candidates. **Goal:** demonstrate production-depth React, TypeScript, PixiJS, and GSAP in one polished slot game. Engine is reusable; one game proves the architecture.

## Architecture

The repo splits cleanly:

```
packages/engine          Pure TypeScript, zero runtime deps, 100% tested
├─ rng                   Seeded PRNG (determinism for tests, dev panel)
├─ strips                Weighted reel strips + stop selection
├─ evaluator             Payline math, wild substitution, scatter detection
├─ fsm                   Idle → Spinning → Evaluating → WinPresentation → FreeSpins → Idle
│                        (discriminated unions, exhaustive transitions)
└─ index                 spin(bet, rng) → SpinOutcome (all math resolved before animation)

apps/game                React + PixiJS v8 + GSAP 3 (Vite, TS strict)
├─ React shell           DOM HUD (balance, bet, paytable, settings, dev panel)
├─ store                 Zustand read-model fed by engine FSM; single source of truth
├─ pixi/                 Imperative scene: reels, symbol pool, FX layers, resize/orientation
├─ motion/               All GSAP: spin, win-line, rollups. Turbo = timeScale. Skip = progress(1).
└─ audio/                Howler or @pixi/sound: spin loop, stops, stingers, mute + ducking
```

### Key principles

- **React knows nothing about game logic.** It observes the Zustand store. The store is fed by engine state changes.
- **All animation is GSAP.** One motion authority means turbo and skip are trivial (`timeScale` / `progress()` ops).
- **Math is resolved before rendering.** The `spin()` function returns a complete `SpinOutcome` — stops, wins, free-spins state. This mirrors the client/server split in real slots.
- **Engine is pure TS, zero deps.** The dependency arrow enforces "engine doesn't know it's running in a browser."

## Game mechanics

- **Grid:** 5 reels × 3 rows, ~20 fixed paylines (left-to-right, line pays).
- **Symbols:** 11 from asset pack — low pays (fruit), high pays (BAR, seven), Wild (bell, substitutes all except scatter), Scatter (strawberry).
- **Free spins:** 3+ scatters → 10 free spins at 2× multiplier. Retrigger allowed once.
- **Win tiers:** Win / Big Win / Mega Win at ~5× / 25× / 100× total bet — escalating FX and celebrations.
- **Target RTP:** ~96%, hit frequency ~25–30%, scatter trigger ~1-in-150 spins. Locked in by CI sim test.

## Tech stack

| Layer | Tech | Why |
|-------|------|-----|
| Engine | TypeScript, Vitest | Pure logic, zero deps, deterministic testing |
| Scene | PixiJS v8 | Imperative 2D renderer; Pixi is where React's reactivity model *stops working* |
| Animation | GSAP 3 | One motion authority; handles symbol FX, reel spin, rollups, eases |
| HUD | React 18 + TypeScript | Component structure, state subscription via Zustand |
| Store | Zustand | Lightweight read-model; engine pushes state changes, React observes |
| Build | Vite | Fast HMR, monorepo-friendly |
| Deploy | Vercel | Auto-deploy on push; preloader + progress bar in the landing UI |
| Testing | Vitest + Playwright | Unit tests for engine, 1M-spin RTP simulation in CI, smoke test for demo |

## File structure

```
packages/engine/
├─ src/
│  ├─ rng.ts               mulberry32 PRNG + seed/reset
│  ├─ strips.ts            Reel definitions, weighted selection
│  ├─ evaluator.ts         Payline logic, wild/scatter detection
│  ├─ fsm.ts               State machine (discriminated unions)
│  ├─ types.ts             All game types (SpinOutcome, Symbol, etc.)
│  ├─ sim.ts               1M-spin RTP simulator
│  └─ index.ts             Exports spin(), RNG, strips
├─ tests/
│  ├─ *.test.ts            Unit tests (hand-computed fixtures)
│  └─ rtp.test.ts          1M-spin CI test asserting RTP ± tolerance
└─ vitest.config.ts

apps/game/
├─ src/
│  ├─ App.tsx              Router-free app frame, render HUD + Pixi canvas
│  ├─ store.ts             Zustand store + engine event subscription
│  ├─ pixi/
│  │  ├─ scene.ts          Main scene setup (reels, symbols, layers)
│  │  ├─ reels.ts          Reel containers, symbol pooling
│  │  ├─ resize.ts         Orientation handling (landscape + portrait relayout)
│  │  └─ fx.ts             Filter setup (motion blur, glow)
│  ├─ motion/
│  │  ├─ spin.ts           Staggered reel-stop timeline (GSAP)
│  │  ├─ wins.ts           Win-line choreography + count-up rollups
│  │  └─ features.ts       Scatter anticipation, free-spins intro/outro
│  ├─ audio/
│  │  └─ index.ts          Howler setup, ducking logic
│  ├─ components/          React HUD components
│  │  ├─ Hud.tsx           Balance, bet, spin button
│  │  ├─ PaytableModal.tsx
│  │  ├─ DevPanel.tsx      Force outcome, seed RNG, live RTP
│  │  └─ Settings.tsx      Mute, turbo toggle
│  ├─ index.css            TailwindCSS or custom (minimal, game-focused)
│  └─ main.tsx             App mount
├─ vite.config.ts
├─ vitest.config.ts
└─ playwright.config.ts

assets/                     (gitignored, local; 347MB source art pack)
```

## Development workflow

### Run the game locally

```bash
pnpm install
pnpm -r build          # Build engine
pnpm dev               # Vite dev server, HMR on code changes
```

Navigate to `http://localhost:5173`. Dev panel is available in settings (or always shown in dev mode).

### Run tests

```bash
pnpm test              # Vitest: unit tests + RTP sim
pnpm test:ui           # Vitest UI
pnpm test:e2e          # Playwright smoke test
```

The RTP test runs 1M spins and asserts `|RTP - 0.96| < 0.005`. This is the strongest credibility signal; it runs on every push to main.

### Build for deployment

```bash
pnpm build
pnpm preview           # Local preview of production build
```

Vercel auto-deploys the built `dist/` on push.

## Key decisions & tradeoffs

| Decision | Tradeoff |
|----------|----------|
| One game, reusable engine | Depth → breadth; "game #2 would be cheap" is architecture, not code. |
| React + Pixi split | React's reactivity model breaks for imperative rendering. One canvas component owns Pixi imperativity; HUD is React. Learnable friction. |
| GSAP owns all motion | Overhead: Pixi has built-in tweening. Payoff: turbo/skip are one-liners; motion is a dedicated skill-flex. |
| Zustand, not Redux/MobX | Minimal boilerplate; single source of truth is the store, fed by engine events. |
| Math-first architecture | Engine resolves all outcomes before any animation starts. This mirrors real slots (client resolves, server validates). Tight coupling to the demo story. |
| FSM over event emitters | Discriminated unions exhaustively encode state transitions. Compiler verifies you handle every state. |
| Pure TS engine | The dependency arrow says "engine is portable"; zero runtime deps proves it. |

## Phases & shipping

Each phase ends shippable. If time runs out, the last completed phase is what ships.

- **Phase 0:** Workspace, Vite, CI, Vercel, asset selection. → Pipeline proven.
- **Phase 1:** Engine (RNG, strips, evaluator, FSM), full unit tests, 1M-spin RTP sim in CI. → Math certified.
- **Phase 2:** Pixi scene, GSAP spin/stops, basic HUD, dev panel. → It's a slot machine.
- **Phase 3:** Win-line display, symbol animations, free-spins mode. → Full game loop.
- **Phase 4:** Filters, particles, audio, turbo, portrait relayout, preloader. → Feels like a product.
- **Phase 5:** Smoke test, README architecture tour, RTP table, big-win GIFs. → CV-ready.

## Testing strategy

- **Engine:** 100% unit-tested (Vitest), hand-computed fixtures for critical payline/scatter scenarios.
- **RTP:** 1M-spin Monte Carlo simulation asserts `RTP ± 0.5%` on every push (CI gate).
- **Smoke test:** Playwright visits the Vercel URL, spins a few times, checks for console errors.
- **Visual:** Canvas is animated; visual-regression screenshots are flaky. Manual review in the dev panel.

## Dev panel (high-signal QA feature)

Accessible in settings or always visible in dev mode. Allows:

- **Force outcome:** Select a specific spin result to verify win presentation, free-spins mode, etc.
- **Seed RNG:** Reproduce any spin sequence for debugging.
- **Live RTP:** Shows the running RTP % of recent spins; helps tune paytable.
- **Multiplier override:** Test free-spins scaling.

This is how real slots teams test. It signals production-grade thinking.

## Asset pack & spritesheets

The asset pack (11 symbols, 44-frame animations, frames, popups, interface set) is purchased and stored locally in `assets/` (gitignored). During Phase 2, a build step (not yet written) will pack optimized spritesheets into `apps/game/public/assets/`, which are committed. This split keeps the repo lean while preserving the full art source.

## Performance targets

- 60 FPS on mid-range phone (2-year-old Android/iPhone).
- < 100ms spin-start latency (math instant, animation eases in).
- Reels/symbols pooled (no GC stalls during spin).
- Texture atlas for all symbols (one draw call per reel).

## Non-goals (explicitly cut)

- Autoplay (deferred; cheap to add as a policy layer on the FSM if asked in an interview).
- Custom shaders (FX bar: Pixi filters + particles; shaders → non-goals list).
- Real money, accounts, localisation.
- Visual-regression testing (flaky on canvas).
- Second game (one game proves architecture).

## Common tasks

### Add a new symbol or paytable tier

1. Update `packages/engine/src/types.ts` (Symbol enum).
2. Add strip weights in `packages/engine/src/strips.ts`.
3. Add payline rows in `packages/engine/src/evaluator.ts`.
4. Run the RTP sim: `pnpm sim --paytable` to tune hit frequency / RTP.
5. Update the Pixi spritesheet and `apps/game/src/pixi/reels.ts` symbol → sprite mapping.
6. Test: `pnpm test` asserts RTP is within tolerance.

### Adjust animation timing

All tweens are in `apps/game/src/motion/`. GSAP timelines are keyed by phase (anticipation, reel stop, win rollup, etc.). Change eases or durations there; turbo scales everything via `timeScale`.

### Debug a paytable issue

1. Use the dev panel: set a seed, force a specific outcome, observe the win presentation.
2. Check `packages/engine/src/evaluator.ts` for payline logic.
3. Run `pnpm test -- --reporter=verbose` to see which fixture is failing.
4. Update the fixture or the evaluator; retest.

## Interview context

The README (in Phase 5) will include:

- **Architecture diagram:** Engine (pure TS) → Store (Zustand) → React + Pixi (separate concerns).
- **RTP certification:** "1M-spin Monte Carlo asserting 96% ± 0.5%."
- **Big-win GIFs:** Tiers in action, sound, free-spins intro.
- **Code tour:** Why the math-first design, why GSAP owns motion, why the engine is zero-deps.

The demo is 90 seconds. The repo tells the story to a studio engineer in 10 minutes.

