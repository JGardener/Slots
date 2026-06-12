import { Symbol, GRID_COLS, GRID_ROWS, type Win } from './types';
import { PAYLINES, NUM_PAYLINES } from './paylines';

/**
 * Paytable: symbol + match count → payout (in units of bet).
 * Keyed by `${symbol},${count}` for O(1) lookup.
 * Tuned via 1M-spin simulation to target ~96% RTP.
 */
const PAYTABLE: Record<string, number> = {
  // Wild (5 = jackpot)
  '1,5': 50,
  '1,4': 10.6,
  '1,3': 2.12,

  // BAR (high pay)
  '2,5': 10.6,
  '2,4': 5.3,
  '2,3': 2.12,

  // Seven (high pay)
  '3,5': 10.6,
  '3,4': 5.3,
  '3,3': 2.12,

  // Low pays (all same payout per match count)
  '4,5': 3.13, // Orange
  '4,4': 1.56,
  '4,3': 0.54,

  '5,5': 3.13, // Lemon
  '5,4': 1.56,
  '5,3': 0.54,

  '6,5': 3.13, // Plum
  '6,4': 1.56,
  '6,3': 0.54,

  '7,5': 3.13, // Banana
  '7,4': 1.56,
  '7,3': 0.54,

  '8,5': 3.13, // Cherry
  '8,4': 1.56,
  '8,3': 0.54,

  '9,5': 3.13, // Grapes
  '9,4': 1.56,
  '9,3': 0.54,

  '10,5': 3.13, // Watermelon
  '10,4': 1.56,
  '10,3': 0.54,
};

interface PaylineEvalResult {
  win: Win | null;
}

/**
 * Evaluate a single payline given the visible grid.
 * Wilds substitute for all symbols except scatters.
 * Returns the win (if any).
 */
function evaluatePayline(
  grid: readonly (readonly Symbol[])[],
  paylineIndex: number,
  payline: readonly [number, number, number, number, number]
): PaylineEvalResult {
  let matchSymbol: Symbol | null = null;
  let matchCount = 0;

  for (let reelIdx = 0; reelIdx < GRID_COLS; reelIdx++) {
    const rowIdx = payline[reelIdx]!;
    const symbol = grid[reelIdx]![rowIdx]!;

    if (symbol === Symbol.Scatter) {
      matchSymbol = null; // Scatter breaks the payline sequence
      matchCount = 0;
      continue;
    }

    // Wild or regular symbol: determine the target symbol for matching
    let target: Symbol;
    if (matchSymbol === null) {
      target = symbol;
    } else {
      target = matchSymbol;
    }

    // Check if current symbol matches (accounting for wild)
    const matches = symbol === target || symbol === Symbol.Wild || matchSymbol === Symbol.Wild;

    if (matches) {
      if (matchSymbol === null) {
        matchSymbol = symbol === Symbol.Wild ? target : symbol;
      } else if (symbol !== Symbol.Wild && matchSymbol !== Symbol.Wild) {
        matchSymbol = symbol;
      } else if (matchSymbol === Symbol.Wild && symbol !== Symbol.Wild) {
        matchSymbol = symbol;
      }
      // If both or current is wild, keep the non-wild symbol
      matchCount++;
    } else {
      // No match; payline broken
      matchSymbol = null;
      matchCount = 0;
    }
  }

  // Winning condition: 3+ matches from the left
  const win = matchCount >= 3 && matchSymbol !== null ? createWin(paylineIndex, matchSymbol, matchCount) : null;

  return { win };
}

/**
 * Create a Win object from a payline match.
 */
function createWin(paylineIndex: number, symbol: Symbol, count: number): Win | null {
  const key = `${symbol},${count}`;
  const payout = PAYTABLE[key];

  if (!payout) {
    return null; // No payout for this combination (shouldn't happen in normal play)
  }

  return {
    paylineIndex,
    symbol,
    count,
    multiplier: 1, // Base multiplier; free spins will adjust
    payout,
  };
}

/**
 * Scatter payout table (not tied to paylines).
 * Applied once if any scatters appear (not multiplied by number of paylines).
 */
const SCATTER_PAYTABLE: Record<number, number> = {
  3: 1,   // 3 scatters = 1× bet
  4: 2,   // 4 scatters = 2× bet
  5: 5,   // 5 scatters = 5× bet
};

/**
 * Free spins trigger: 3+ scatters anywhere on the grid.
 */
function checkFreeSpin(totalScatters: number): { triggered: boolean; count: number; multiplier: number } {
  if (totalScatters >= 3) {
    return { triggered: true, count: 10, multiplier: 2 };
  }
  return { triggered: false, count: 0, multiplier: 1 };
}

/**
 * Evaluate the entire grid: paylines + scatters.
 * Returns all wins and scatter state.
 */
export function evaluateSpin(
  grid: readonly (readonly Symbol[])[],
  bet: number,
  isFreeSpin: boolean,
  freeSpinMultiplier: number
): {
  wins: Win[];
  totalWin: number;
  scatterCount: number;
  scatterPayout: number;
  triggeredFreeSpins: boolean;
  freeSpinsCount: number;
  freeSpinMultiplier: number;
} {
  const wins: Win[] = [];

  // Count all scatters in the grid (anywhere, not tied to paylines)
  let totalScatters = 0;
  for (let reelIdx = 0; reelIdx < GRID_COLS; reelIdx++) {
    for (let rowIdx = 0; rowIdx < GRID_ROWS; rowIdx++) {
      if (grid[reelIdx]![rowIdx]! === Symbol.Scatter) {
        totalScatters++;
      }
    }
  }

  // Evaluate all paylines
  for (let i = 0; i < NUM_PAYLINES; i++) {
    const payline = PAYLINES[i]!;
    const { win } = evaluatePayline(grid, i, payline);
    if (win) {
      // Apply free spin multiplier if active
      const multiplier = isFreeSpin ? freeSpinMultiplier : 1;
      wins.push({
        ...win,
        multiplier,
        payout: win.payout * multiplier,
      });
    }
  }

  // Scatter payout (on top of payline wins)
  const scatterPayout = SCATTER_PAYTABLE[totalScatters] || 0;

  // Check if scatters trigger free spins
  const freeSpinCheck = checkFreeSpin(totalScatters);

  // Total payout (in bet units)
  const totalWin = wins.reduce((sum, w) => sum + w.payout, 0) + scatterPayout;

  return {
    wins,
    totalWin: Math.round(totalWin * bet), // Convert to credits
    scatterCount: totalScatters,
    scatterPayout: Math.round(scatterPayout * bet),
    triggeredFreeSpins: freeSpinCheck.triggered,
    freeSpinsCount: freeSpinCheck.count,
    freeSpinMultiplier: freeSpinCheck.multiplier,
  };
}
