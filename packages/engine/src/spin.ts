import { createRng } from './rng';
import type { SpinOutcome, Symbol } from './types';
import { createReels, selectStops, getVisibleSymbols } from './strips';
import { evaluateSpin } from './evaluator';

/**
 * Execute a single spin with deterministic RNG.
 * Returns the complete outcome (stops, grid, wins) before any animation.
 * Pure TS, no side effects — this is the engine's whole public surface
 * for resolving game rounds.
 */
export function spin(
  bet: number,
  seed: number,
  isFreeSpin: boolean = false,
  freeSpinMultiplier: number = 1
): SpinOutcome {
  const rng = createRng(seed);
  const reels = createReels();

  const stops = selectStops(reels, rng);

  const symbolGrid: readonly (readonly Symbol[])[] = [
    getVisibleSymbols(reels[0]!, stops[0]!),
    getVisibleSymbols(reels[1]!, stops[1]!),
    getVisibleSymbols(reels[2]!, stops[2]!),
    getVisibleSymbols(reels[3]!, stops[3]!),
    getVisibleSymbols(reels[4]!, stops[4]!),
  ];

  const evaluation = evaluateSpin(symbolGrid, bet, isFreeSpin, freeSpinMultiplier);

  return {
    rng: { seed },
    stops,
    symbols: symbolGrid as SpinOutcome['symbols'],
    wins: evaluation.wins,
    scatterWin: evaluation.scatterWin,
    totalWin: evaluation.totalWin,
    scatters: evaluation.scatterCount,
    triggeredFreeSpins: evaluation.triggeredFreeSpins,
    freeSpinsCount: evaluation.freeSpinsCount,
  };
}
