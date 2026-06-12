/**
 * Core game types: symbols, paylines, outcomes, and FSM states.
 * The RNG is deterministic; all math is pure.
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
 * A winning position on a single payline.
 */
export interface Win {
  paylineIndex: number;
  symbol: Symbol;
  count: number; // Consecutive symbols (including wilds) from the left
  multiplier: number; // 2x, 3x, etc. based on payline/reel
  payout: number; // In units of bet size (e.g., 10 = 10× bet)
}

/**
 * The complete result of a single spin, resolved before any animation.
 * This is the source of truth that drives both the Pixi scene and the FSM.
 */
export interface SpinOutcome {
  rng: { seed: number }; // For reproducibility in dev panel / tests
  stops: readonly [number, number, number, number, number]; // Row index at each reel
  symbols: readonly [
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[],
    readonly Symbol[]
  ]; // Full visible grid (3 per reel)
  wins: Win[];
  totalWin: number; // Total payout (units of bet)
  scatters: number; // How many scatter symbols appeared
  triggeredFreeSpins: boolean;
  freeSpinsCount: number; // If triggered, how many (e.g. 10)
}

/**
 * Game state machine: discriminated unions for exhaustive state coverage.
 */
export type GameState =
  | { type: 'idle'; balance: number; bet: number; freeSpinsRemaining: number; freeSpinsMultiplier: number }
  | { type: 'spinning'; balance: number; bet: number; freeSpinsRemaining: number; freeSpinsMultiplier: number }
  | {
      type: 'evaluating';
      balance: number;
      bet: number;
      outcome: SpinOutcome;
      freeSpinsRemaining: number;
      freeSpinsMultiplier: number;
    }
  | {
      type: 'presenting-win';
      balance: number;
      bet: number;
      outcome: SpinOutcome;
      freeSpinsRemaining: number;
      freeSpinsMultiplier: number;
    }
  | {
      type: 'free-spins-mode';
      balance: number;
      bet: number;
      freeSpinsRemaining: number;
      freeSpinsMultiplier: number;
    };

/**
 * FSM transition events.
 */
export type GameEvent =
  | { type: 'spin'; bet: number }
  | { type: 'outcome-ready'; outcome: SpinOutcome }
  | { type: 'presentation-complete' }
  | { type: 'free-spin-start'; count: number; multiplier: number }
  | { type: 'free-spins-complete' }
  | { type: 'reset' };
