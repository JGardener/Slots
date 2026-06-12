import { create } from 'zustand';
import { GameFsm, spin as engineSpin } from '@slots/engine';
import type { GameState, SpinOutcome } from '@slots/engine';

/**
 * The engine FSM is the single source of truth for game logic. It lives
 * outside the store; after every transition we push an immutable snapshot
 * of its state into Zustand so React and Pixi observe changes.
 *
 * Round lifecycle (each step driven by the motion layer finishing a beat):
 *   spin()             — FSM: idle → spinning → evaluating (math resolved)
 *   reelsStopped()     — reel animation done → win presentation (if any)
 *   presentationDone() — the active presentation finished:
 *       wins      → FSM advances (win credited) → idle, free-spins intro,
 *                   next free spin, or feature outro
 *       fs-intro  → clears; the Pixi layer auto-spins the first free spin
 *       fs-outro  → clears; back to player control
 *   spinFreeSpin()     — one free spin (no bet deduction, multiplier applied)
 *
 * The FSM stays in `evaluating` while the win presentation plays, so the
 * balance visibly credits when the rollup completes — not before.
 */
const INITIAL_BALANCE = 10000;
const INITIAL_SEED = 2026;
const fsm = new GameFsm(INITIAL_BALANCE);

export const BET_LEVELS = [1, 5, 10, 25, 50, 100] as const;

export type Presentation =
  | { kind: 'none' }
  | { kind: 'wins'; id: number }
  | { kind: 'fs-intro'; id: number; spins: number; multiplier: number }
  | { kind: 'fs-outro'; id: number; totalWin: number; spins: number };

let presentationId = 0;

interface GameStore {
  gameState: GameState;
  lastOutcome: SpinOutcome | null;
  /** Result of the last completed free-spins feature (HUD recap). */
  lastFeature: { spins: number; totalWin: number } | null;
  /** Increments on every spin; the Pixi layer keys reel animations off it. */
  spinId: number;
  /** Active presentation beat; the Pixi layer plays it and reports back. */
  presentation: Presentation;
  /** Running totals for the in-progress free-spins feature. */
  featureTotalWin: number;
  featureSpinsPlayed: number;

  bet: number;
  /** Base seed; spin n uses seed + n so a seed reproduces a full session. */
  seed: number;
  spinCount: number;
  /** One-shot seed armed by the dev panel ("force outcome"). */
  forcedSeed: number | null;
  forcedLabel: string | null;

  /** Counter; HUD increments it, the Pixi layer skips the active timeline. */
  stopRequest: number;
  turbo: boolean;
  devPanelOpen: boolean;

  /** Session totals for the dev panel's live RTP readout. */
  totalWagered: number;
  totalWon: number;

  spin: () => void;
  spinFreeSpin: () => void;
  reelsStopped: () => void;
  presentationDone: () => void;
  setBet: (bet: number) => void;
  setSeed: (seed: number) => void;
  requestStop: () => void;
  setTurbo: (on: boolean) => void;
  setDevPanelOpen: (open: boolean) => void;
  armForcedSeed: (seed: number, label: string) => void;
  disarmForcedSeed: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  /**
   * Advance the FSM out of `evaluating` once the win presentation (or the
   * no-win pause) is over: credit the win, then route the round to idle,
   * into the feature, to the next free spin, or to the feature outro.
   */
  const advanceRound = () => {
    const s = get();
    if (s.gameState.type !== 'evaluating') return;
    const outcome = s.gameState.outcome;
    const wasInFeature = s.gameState.freeSpins !== null;

    fsm.transition({ type: 'presentation-complete' }); // → presenting-win (credits win)
    fsm.transition({ type: 'presentation-complete' }); // → idle | free-spins-mode
    const next = fsm.getState();

    const featureTotalWin = wasInFeature ? s.featureTotalWin + outcome.totalWin : s.featureTotalWin;
    const featureSpinsPlayed = wasInFeature ? s.featureSpinsPlayed + 1 : s.featureSpinsPlayed;

    if (next.type === 'free-spins-mode' && !wasInFeature) {
      // Base-game trigger: play the intro, then the feature loop starts.
      set({
        gameState: next,
        featureTotalWin: 0,
        featureSpinsPlayed: 0,
        presentation: {
          kind: 'fs-intro',
          id: ++presentationId,
          spins: next.freeSpins.remaining,
          multiplier: next.freeSpins.multiplier,
        },
      });
    } else if (next.type === 'free-spins-mode') {
      // Feature continues (possibly retriggered); Pixi auto-spins next.
      set({ gameState: next, featureTotalWin, featureSpinsPlayed, presentation: { kind: 'none' } });
    } else if (wasInFeature) {
      // Feature exhausted: recap the total before returning control.
      set({
        gameState: next,
        featureTotalWin,
        featureSpinsPlayed,
        presentation: {
          kind: 'fs-outro',
          id: ++presentationId,
          totalWin: featureTotalWin,
          spins: featureSpinsPlayed,
        },
      });
    } else {
      set({ gameState: next, presentation: { kind: 'none' } });
    }
  };

  return {
    gameState: fsm.getState(),
    lastOutcome: null,
    lastFeature: null,
    spinId: 0,
    presentation: { kind: 'none' },
    featureTotalWin: 0,
    featureSpinsPlayed: 0,

    bet: 10,
    seed: INITIAL_SEED,
    spinCount: 0,
    forcedSeed: null,
    forcedLabel: null,

    stopRequest: 0,
    turbo: false,
    devPanelOpen: import.meta.env.DEV,

    totalWagered: 0,
    totalWon: 0,

    spin: () => {
      const s = get();
      if (s.gameState.type !== 'idle' || s.presentation.kind !== 'none') return;
      if (s.gameState.balance < s.bet) return;

      fsm.transition({ type: 'spin', bet: s.bet });
      const spinSeed = s.forcedSeed ?? s.seed + s.spinCount;
      const outcome = engineSpin(s.bet, spinSeed);
      fsm.transition({ type: 'outcome-ready', outcome });

      set({
        gameState: fsm.getState(),
        lastOutcome: outcome,
        lastFeature: null,
        spinId: s.spinId + 1,
        // Forced spins don't consume the seeded sequence.
        spinCount: s.forcedSeed === null ? s.spinCount + 1 : s.spinCount,
        forcedSeed: null,
        forcedLabel: null,
        totalWagered: s.totalWagered + s.bet,
        totalWon: s.totalWon + outcome.totalWin,
      });
    },

    spinFreeSpin: () => {
      const s = get();
      if (s.gameState.type !== 'free-spins-mode' || s.presentation.kind !== 'none') return;

      const { bet, freeSpins } = s.gameState;
      fsm.transition({ type: 'spin', bet }); // no deduction during the feature
      const outcome = engineSpin(bet, s.seed + s.spinCount, true, freeSpins.multiplier);
      fsm.transition({ type: 'outcome-ready', outcome });

      set({
        gameState: fsm.getState(),
        lastOutcome: outcome,
        spinId: s.spinId + 1,
        spinCount: s.spinCount + 1,
        totalWon: s.totalWon + outcome.totalWin,
      });
    },

    reelsStopped: () => {
      const s = get();
      if (s.gameState.type !== 'evaluating') return;
      const outcome = s.gameState.outcome;
      if (outcome.totalWin > 0 || outcome.triggeredFreeSpins) {
        set({ presentation: { kind: 'wins', id: ++presentationId } });
      } else {
        advanceRound();
      }
    },

    presentationDone: () => {
      const p = get().presentation;
      switch (p.kind) {
        case 'wins':
          advanceRound();
          break;
        case 'fs-intro':
          set({ presentation: { kind: 'none' } });
          break;
        case 'fs-outro':
          set({
            presentation: { kind: 'none' },
            lastFeature: { spins: p.spins, totalWin: p.totalWin },
          });
          break;
        case 'none':
          break;
      }
    },

    setBet: (bet) => {
      const s = get();
      if (s.gameState.type !== 'idle' || s.presentation.kind !== 'none') return;
      set({ bet });
    },

    setSeed: (seed) => {
      set({ seed, spinCount: 0, forcedSeed: null, forcedLabel: null });
    },

    requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
    setTurbo: (turbo) => set({ turbo }),
    setDevPanelOpen: (devPanelOpen) => set({ devPanelOpen }),
    armForcedSeed: (forcedSeed, forcedLabel) => set({ forcedSeed, forcedLabel }),
    disarmForcedSeed: () => set({ forcedSeed: null, forcedLabel: null }),
  };
});
