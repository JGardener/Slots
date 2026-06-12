import { Symbol, GRID_COLS, GRID_ROWS, type Win } from './types';
import { PAYLINES } from './paylines';
import { linePay, scatterPay, FREE_SPINS } from './paytable';

/**
 * Payline evaluation. Line pays are strictly left-anchored: a run must
 * start on reel 0 and is broken by the first non-matching symbol — runs
 * never restart mid-line. Scatter never participates in line wins.
 *
 * Wild best-pay rule: for a wild-led line we price both interpretations —
 * the leading wilds as their own symbol, and the wilds substituting into
 * the first regular symbol's run — and pay whichever is worth more.
 * (E.g. W W W W Orange pays Wild×4, not Orange×5.)
 */
function evaluatePayline(
  grid: readonly (readonly Symbol[])[],
  payline: readonly [number, number, number, number, number]
): { symbol: Symbol; count: number; payUnits: number } | null {
  const line: Symbol[] = [];
  for (let reel = 0; reel < GRID_COLS; reel++) {
    line.push(grid[reel]![payline[reel]!]!);
  }

  let leadWilds = 0;
  while (leadWilds < GRID_COLS && line[leadWilds] === Symbol.Wild) leadWilds++;

  // First non-wild symbol anchors the substituted run (scatter can't).
  const anchor = leadWilds < GRID_COLS ? line[leadWilds]! : null;
  let substitutedCount = 0;
  if (anchor !== null && anchor !== Symbol.Scatter) {
    substitutedCount = leadWilds;
    for (let i = leadWilds; i < GRID_COLS; i++) {
      if (line[i] === anchor || line[i] === Symbol.Wild) substitutedCount++;
      else break;
    }
  }

  const substitutedPay = anchor !== null && anchor !== Symbol.Scatter ? linePay(anchor, substitutedCount) : 0;
  const wildPay = linePay(Symbol.Wild, leadWilds);

  if (substitutedPay <= 0 && wildPay <= 0) return null;
  return substitutedPay >= wildPay
    ? { symbol: anchor!, count: substitutedCount, payUnits: substitutedPay }
    : { symbol: Symbol.Wild, count: leadWilds, payUnits: wildPay };
}

export interface SpinEvaluation {
  wins: Win[];
  totalWin: number; // Credits
  scatterWin: number; // Credits (included in totalWin)
  scatterCount: number;
  triggeredFreeSpins: boolean;
  freeSpinsCount: number;
}

/** Round to whole cents — keeps fractional-bet pays exact in credits. */
function toCredits(units: number, bet: number): number {
  return Math.round(units * bet * 100) / 100;
}

/**
 * Evaluate the entire grid: paylines + scatters + free-spins trigger.
 * The free-spins multiplier applies to line wins and scatter pays alike.
 */
export function evaluateSpin(
  grid: readonly (readonly Symbol[])[],
  bet: number,
  isFreeSpin: boolean,
  freeSpinMultiplier: number
): SpinEvaluation {
  const multiplier = isFreeSpin ? freeSpinMultiplier : 1;
  const wins: Win[] = [];
  let totalUnits = 0;

  for (let i = 0; i < PAYLINES.length; i++) {
    const hit = evaluatePayline(grid, PAYLINES[i]!);
    if (hit) {
      const units = hit.payUnits * multiplier;
      totalUnits += units;
      wins.push({
        paylineIndex: i,
        symbol: hit.symbol,
        count: hit.count,
        multiplier,
        payout: toCredits(units, bet),
      });
    }
  }

  let scatterCount = 0;
  for (let reel = 0; reel < GRID_COLS; reel++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      if (grid[reel]![row]! === Symbol.Scatter) scatterCount++;
    }
  }

  const scatterUnits = scatterPay(scatterCount) * multiplier;
  totalUnits += scatterUnits;

  const triggeredFreeSpins = scatterCount >= FREE_SPINS.triggerCount;

  return {
    wins,
    totalWin: toCredits(totalUnits, bet),
    scatterWin: toCredits(scatterUnits, bet),
    scatterCount,
    triggeredFreeSpins,
    freeSpinsCount: triggeredFreeSpins ? FREE_SPINS.spinsAwarded : 0,
  };
}
