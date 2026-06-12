import { create } from 'zustand';
import { GameFsm, spin as engineSpin } from '@slots/engine';
import type { GameState, SpinOutcome } from '@slots/engine';

/**
 * The engine FSM is the single source of truth for game logic. It lives
 * outside the store; after every transition we push an immutable snapshot
 * of its state into Zustand so React and Pixi observe changes.
 *
 * Spin lifecycle:
 *   spin()   — FSM: idle → spinning → evaluating (math fully resolved here)
 *   settle() — called by the motion layer when reels finish animating;
 *              FSM: evaluating → presenting-win (win credited) → idle
 */
const INITIAL_BALANCE = 10000;
const INITIAL_SEED = 2026;
const fsm = new GameFsm(INITIAL_BALANCE);

export const BET_LEVELS = [1, 5, 10, 25, 50, 100] as const;

interface GameStore {
  gameState: GameState;
  lastOutcome: SpinOutcome | null;
  /** Increments on every spin; the Pixi layer keys animations off it. */
  spinId: number;

  bet: number;
  /** Base seed; spin n uses seed + n so a seed reproduces a full session. */
  seed: number;
  spinCount: number;
  /** One-shot seed armed by the dev panel ("force outcome"). */
  forcedSeed: number | null;
  forcedLabel: string | null;

  /** Counter; HUD increments it, the Pixi layer quick-stops the timeline. */
  stopRequest: number;
  turbo: boolean;
  devPanelOpen: boolean;

  /** Session totals for the dev panel's live RTP readout. */
  totalWagered: number;
  totalWon: number;

  spin: () => void;
  settle: () => void;
  setBet: (bet: number) => void;
  setSeed: (seed: number) => void;
  requestStop: () => void;
  setTurbo: (on: boolean) => void;
  setDevPanelOpen: (open: boolean) => void;
  armForcedSeed: (seed: number, label: string) => void;
  disarmForcedSeed: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: fsm.getState(),
  lastOutcome: null,
  spinId: 0,

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
    if (s.gameState.type !== 'idle' || s.gameState.balance < s.bet) return;

    fsm.transition({ type: 'spin', bet: s.bet });
    const spinSeed = s.forcedSeed ?? s.seed + s.spinCount;
    const outcome = engineSpin(s.bet, spinSeed);
    fsm.transition({ type: 'outcome-ready', outcome });

    set({
      gameState: fsm.getState(),
      lastOutcome: outcome,
      spinId: s.spinId + 1,
      // Forced spins don't consume the seeded sequence.
      spinCount: s.forcedSeed === null ? s.spinCount + 1 : s.spinCount,
      forcedSeed: null,
      forcedLabel: null,
      totalWagered: s.totalWagered + s.bet,
      totalWon: s.totalWon + outcome.totalWin,
    });
  },

  settle: () => {
    if (get().gameState.type !== 'evaluating') return;
    fsm.transition({ type: 'presentation-complete' }); // → presenting-win (credits win)
    fsm.transition({ type: 'presentation-complete' }); // → idle | free-spins-mode
    if (fsm.getState().type === 'free-spins-mode') {
      // Free-spins mode is Phase 3 scope (the engine FSM's accounting needs
      // work there too). Until then a scatter trigger is presentational only.
      fsm.transition({ type: 'reset' });
    }
    set({ gameState: fsm.getState() });
  },

  setBet: (bet) => {
    if (get().gameState.type !== 'idle') return;
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
}));
