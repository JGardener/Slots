/**
 * Core game types: symbols, paylines, outcomes, and FSM states.
 * All math is pure and deterministic; money amounts are in credits
 * unless a name says otherwise.
 */

export enum Symbol {
  Scatter = 0,
  Wild = 1,
  BAR = 2,
  Seven = 3,
  Orange = 4,
  Lemon = 5,
  Plum = 6,
  Banana = 7,
  Cherry = 8,
  Grapes = 9,
  Watermelon = 10,
}

// All non-wild, non-scatter symbols
export const REGULAR_SYMBOLS = [
  Symbol.BAR,
  Symbol.Seven,
  Symbol.Orange,
  Symbol.Lemon,
  Symbol.Plum,
  Symbol.Banana,
  Symbol.Cherry,
  Symbol.Grapes,
  Symbol.Watermelon,
] as const;

// High-pay symbols (higher payout per line)
export const HIGH_PAYS = [Symbol.BAR, Symbol.Seven] as const;

// Low-pay symbols
export const LOW_PAYS = [
  Symbol.Orange,
  Symbol.Lemon,
  Symbol.Plum,
  Symbol.Banana,
  Symbol.Cherry,
  Symbol.Grapes,
  Symbol.Watermelon,
] as const;

export const GRID_COLS = 5;
export const GRID_ROWS = 3;

/**
 * Payline: a sequence of row indices (one per reel, left to right).
 * E.g., [1, 1, 1, 1, 1] is the middle line.
 */
export type Payline = readonly [number, number, number, number, number];

/**
 * A winning payline. `symbol`/`count` describe the paying interpretation
 * after the wild best-pay rule (a wild-led line pays as whichever of
 * "wilds as themselves" or "wilds substituting" is worth more).
 */
export interface Win {
  paylineIndex: number;
  symbol: Symbol;
  count: number; // Consecutive matching symbols anchored at reel 0
  multiplier: number; // 1 in base game, the free-spins multiplier during the feature
  payout: number; // Credits (already scaled by bet and multiplier)
}

/**
 * The complete result of a single spin, resolved before any animation.
 * This is the source of truth that drives both the Pixi scene and the FSM.
 */
export interface SpinOutcome {
  rng: { seed: number }; // For reproducibility in dev panel / tests
  stops: readonly [number, number, number, number, number]; // Strip position per reel
  symbols: readonly [
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[]
  ]; // Full visible grid (3 per reel)
  wins: Win[];
  scatterWin: number; // Credits from scatter pays (included in totalWin)
  totalWin: number; // Total credits won (line wins + scatter pays)
  scatters: number; // Scatter symbols anywhere on the grid
  triggeredFreeSpins: boolean; // 3+ scatters (a retrigger when already in free spins)
  freeSpinsCount: number; // Spins awarded when triggered (e.g. 10)
}

/**
 * Free-spins feature context carried through FSM states.
 */
export interface FreeSpinsCtx {
  remaining: number;
  multiplier: number;
  retriggered: boolean; // Retrigger is allowed once per feature
}

/**
 * Game state machine: discriminated unions for exhaustive state coverage.
 * `freeSpins` is null in base-game spins, populated during the feature.
 */
export type GameState =
  | { type: 'idle'; balance: number; bet: number }
  | { type: 'spinning'; balance: number; bet: number; freeSpins: FreeSpinsCtx | null }
  | {
      type: 'evaluating';
      balance: number;
      bet: number;
      outcome: SpinOutcome;
      freeSpins: FreeSpinsCtx | null;
    }
  | {
      type: 'presenting-win';
      balance: number;
      bet: number;
      outcome: SpinOutcome;
      freeSpins: FreeSpinsCtx | null;
    }
  | { type: 'free-spins-mode'; balance: number; bet: number; freeSpins: FreeSpinsCtx };

/**
 * FSM transition events.
 */
export type GameEvent =
  | { type: 'spin'; bet: number } // bet is ignored during free spins (locked at trigger)
  | { type: 'outcome-ready'; outcome: SpinOutcome }
  | { type: 'presentation-complete' }
  | { type: 'reset' };
