# Slots Showcase — Project Plan

A portfolio slot game targeting **iGaming/slots studio roles**, built to demonstrate React + TypeScript, PixiJS, and GSAP at production depth. The audience is the studio engineer who has 90 seconds for the demo link and 10 minutes for the repo.

**One polished game on a clean engine** — a single 5×3 video slot, structured so the architecture itself says "game #2 would be cheap."

---

## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Target audience | iGaming/slots studios | They judge reel mechanics, math correctness, and the engine/presentation split — so those get the effort |
| Scope | One game, reusable engine underneath | Best depth-to-effort ratio; architecture implies reusability without building game #2 |
| Mechanics | 5×3, ~20 paylines, wilds, scatter-triggered free spins with multiplier | Industry-standard résumé game; every classic animation beat, non-trivial but well-understood evaluator |
| Math model | Weighted reel strips, designed paytable, ~96% target RTP, Monte Carlo sim as a CI test | The single strongest credibility signal for studio reviewers |
| React↔Pixi | React owns shell + DOM HUD; vanilla Pixi runs imperatively in one canvas component | The production pattern; shows knowing where React's model stops being the right tool |
| Game flow | Hand-rolled typed FSM (discriminated unions) in the engine; Zustand store as the read-model React subscribes to | TypeScript fundamentals over library knowledge; one source of truth observed by both Pixi and React |
| Animation | GSAP owns **all** motion, including reel spin (staggered tweens, engineered eases) | One motion authority — turbo and skip become `timeScale` / `progress()` operations; a genuine GSAP-depth flex |
| Assets | One coherent purchased/CC0 slot pack; FX custom-built | Engineering time goes to motion/FX, not illustration; spritesheet packing in the build pipeline |
| Features | Dev/QA panel (force outcomes, seed RNG, live RTP), turbo + quick-stop, sound + mute + ducking | Dev panel is how real slots teams test — high engineer signal. Autoplay deferred (cheap to add on the FSM later) |
| Mobile | Responsive, landscape-first + portrait relayout (HUD below reels) | Production slots are mobile-first; orientation handling is fiddly and therefore good signal |
| Repo | pnpm workspace: `packages/engine` (pure TS, zero deps) + `apps/game` | Dependency arrow physically enforces "engine knows nothing about rendering" |
| Testing | Engine fully unit-tested (Vitest), 1M-spin RTP sim asserting RTP ± tolerance in CI, one Playwright smoke test | High signal, bounded effort; GitHub Actions |
| FX bar | Pixi filters (reel motion blur, symbol glow), particle bursts, three win tiers with GSAP count-up rollup | Expected production polish without the custom-shader time sink |
| Theme | **Classic fruit/Vegas** — pack acquired (in local `assets/`, gitignored at 347MB): 11 symbols with 44-frame win animations (wild bell, scatter strawberry, BAR, seven, fruit lows), frames, paylines, popups, full interface set | Source art stays local; the Phase 2 asset pipeline packs optimized spritesheets into `apps/game`, which are committed |
| Presentation | Vercel demo (preloader w/ progress), README as an engineering tour with architecture diagram, RTP results table, big-win GIFs | The README sells before anyone reads code |
| Timeline | Evenings/weekends, ~4–6 weeks (~60–80h), shippable milestone per phase | Slots absorb infinite polish; phase gates keep it demo-able if life intervenes |

---

## Game design spec

- **Grid:** 5 reels × 3 rows, ~20 fixed paylines (left-to-right, line pays).
- **Symbols:** 11 from the pack — low pays (orange, lemon, plum, banana, cherry, grapes, watermelon, strawberry as available), high pays (BAR, seven), **Wild** (bell — substitutes all except scatter), **Scatter** (strawberry). Final low/high split tuned during Phase 1 RTP balancing.
- **Free spins:** 3+ scatters anywhere → 10 free spins at 2× multiplier. Retrigger allowed once. (Tune during RTP balancing.)
- **Win tiers:** Win / Big Win / Mega Win at ~5× / 25× / 100× total bet, escalating celebrations.
- **Bet model:** fake credits, selectable bet levels. No real money, no accounts — state a responsible-gaming/demo disclaimer.
- **Target math:** ~96% RTP, hit frequency ~25–30%, free-spins trigger roughly 1-in-150 spins. Tuned via the simulation CLI, locked in by the CI test.

## Architecture

```
packages/engine          pure TypeScript, zero runtime deps, 100% tested
├─ rng        seeded PRNG (e.g. mulberry32) — determinism for tests & dev panel
├─ strips     weighted reel strips + stop selection
├─ evaluator  payline evaluation, wild substitution, scatter counting
├─ fsm        Idle → Spinning → Evaluating → WinPresentation → FreeSpins → Idle
│             (discriminated-union states, exhaustive transitions)
└─ spin()     (bet, rng) → SpinOutcome — the full result (stops, wins, features)
              is resolved BEFORE any animation starts; presentation is playback.
              This mirrors the client/server split in real slots.

apps/game                React + Pixi v8 + GSAP 3 (Vite, TS strict)
├─ React shell  routing-free app frame, DOM HUD (balance, bet, paytable modal,
│               settings, dev panel) — subscribes to the Zustand read-model
├─ store        Zustand store fed by engine FSM events; single source of truth
├─ pixi/        imperative scene: reel containers, symbol pool, FX layers,
│               resize/orientation manager (landscape + portrait relayout)
├─ motion/      all GSAP: spin timelines (staggered reel stops, anticipation
│               ease on last reel when a feature tease is live), win-line
│               choreography, count-up rollups. Turbo = timeScale; skip =
│               progress(1). No motion outside GSAP.
└─ audio/       howler or @pixi/sound: spin loop, stops, stingers, fanfare,
                mute + ducking
```

## Phases & milestones

Each phase ends shippable. Cut line: if time runs out, ship the last completed phase.

**Phase 0 — Scaffold (~4h)**
Workspace, Vite app, CI (lint, typecheck, test), Vercel deploy of a hello-Pixi canvas. Select and license the asset pack. → *Milestone: pipeline proven end-to-end.*

**Phase 1 — Engine (~12–16h)**
RNG, strips, evaluator, FSM, `spin()`. Full unit tests with hand-computed fixtures. Simulation CLI + 1M-spin RTP test in CI; tune paytable/strips to targets. → *Milestone: engine done, RTP certified-ish.*

**Phase 2 — Playable loop (~14–18h)**
Pixi scene with reels, GSAP spin/stop timelines, quick-stop, basic HUD (spin, bet, balance), dev panel core (seed, force outcome). → *Milestone: it's a slot machine.*

**Phase 3 — Wins & feature (~14–18h)**
Win-line presentation, symbol win animations, tiered celebrations with rollup, scatter anticipation, free-spins mode (intro/outro transitions, multiplier, counter). → *Milestone: full game loop.*

**Phase 4 — Polish (~12–16h)**
Filters (motion blur, glow), particles, audio + ducking, turbo, portrait relayout, preloader, performance pass (texture atlas, object pooling, 60fps on mid phone). → *Milestone: feels like a product.*

**Phase 5 — Ship (~6–8h)**
Playwright smoke test, README engineering tour (architecture diagram, RTP table, GIFs), Vercel production polish, dev-panel discoverability for reviewers. → *Milestone: link in the CV.*

## Non-goals (explicitly cut)

- Autoplay (deferred — policy layer on the FSM, easy to add if asked in an interview)
- Custom fragment shaders, second game, real-money/account anything, localisation
- Visual-regression screenshot testing (flaky on animated canvas)

## Risks

- **Paytable tuning eats time** → the sim CLI exists from Phase 1 precisely to make tuning fast; timebox to targets ±0.5% RTP.
- **Asset pack disappoints** → select pack in Phase 0, before the scene is built around it.
- **Polish-phase scope creep** → FX bar is fixed (filters + particles + tiers); shader ideas go to the non-goals list.
