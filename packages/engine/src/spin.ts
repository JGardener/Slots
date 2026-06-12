import { createRng } from './rng';
import type { SpinOutcome, Symbol } from './types';
import { createReels, selectStops, getVisibleSymbols } from './strips';
import { evaluateSpin } from './evaluator';

/**
 * Execute a single spin with deterministic RNG.
 * Returns the complete outcome (stops, wins, balance impact) before any animation.
 * This is the core spin resolution function — pure TS, no side effects.
 */
export function spin(
  bet: number,
  seed: number,
  isFreeSpin: boolean = false,
  freeSpinMultiplier: number = 1
): SpinOutcome {
  const rng = createRng(seed);
  const reels = createReels();

  // Select stop positions for each reel
  const stops = selectStops(reels, rng);

  // Extract visible symbols for each reel (3 rows)
  const reel0 = getVisibleSymbols(reels[0]!, stops[0]!);
  const reel1 = getVisibleSymbols(reels[1]!, stops[1]!);
  const reel2 = getVisibleSymbols(reels[2]!, stops[2]!);
  const reel3 = getVisibleSymbols(reels[3]!, stops[3]!);
  const reel4 = getVisibleSymbols(reels[4]!, stops[4]!);

  const symbolGrid: readonly (readonly Symbol[])[] = [reel0, reel1, reel2, reel3, reel4];

  // Evaluate the grid for wins and scatters
  const evaluation = evaluateSpin(symbolGrid, bet, isFreeSpin, freeSpinMultiplier);

  const outcome: SpinOutcome = {
    rng: { seed },
    stops,
    symbols: [reel0, reel1, reel2, reel3, reel4] as const,
    wins: evaluation.wins,
    totalWin: evaluation.totalWin,
    scatters: evaluation.scatterCount,
    triggeredFreeSpins: evaluation.triggeredFreeSpins,
    freeSpinsCount: evaluation.freeSpinsCount,
  };

  return outcome;
}
