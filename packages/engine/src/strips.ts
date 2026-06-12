import { Symbol, GRID_ROWS } from './types';
import type { Rng } from './rng';

/**
 * Reel strip: an ordered list of symbols. A reel stop selects symbols
 * from this list starting at the chosen position (wrapping around).
 * The stop position is selected via weighted RNG.
 *
 * Each reel has one strip. The distribution of symbols in the strip
 * determines hit frequency, RTP, and scatter trigger rate.
 */
export interface ReelStrip {
  symbols: readonly Symbol[];
  weights?: readonly number[]; // If provided, use weighted selection; else uniform
}

/**
 * Create a weighted strip from a symbol and occurrence count.
 * E.g., createWeightedStrip([Symbol.Wild, 2, Symbol.Orange, 8])
 * creates a strip with 2 wilds and 8 oranges.
 */
export function createWeightedStrip(counts: readonly (Symbol | number)[]): ReelStrip {
  const symbols: Symbol[] = [];
  const weights: number[] = [];

  for (let i = 0; i < counts.length; i += 2) {
    const sym = counts[i] as Symbol;
    const count = counts[i + 1] as number;
    symbols.push(sym);
    weights.push(count);
  }

  return { symbols, weights };
}

/**
 * Factory for 5 reels. Each reel's strip is independent.
 * Weighting is tuned to achieve target RTP and hit frequency.
 *
 * This is a starting point; the RTP simulation will drive adjustments.
 */
export function createReels(): readonly ReelStrip[] {
  // All reels use the same strip for simplicity, but can be customized.
  const baseStrip = createWeightedStrip([
    Symbol.Scatter, 1,  // ~1.6% scatter chance per reel (tuned for ~1% free spin trigger)
    Symbol.Wild, 4,     // ~6.7% wild
    Symbol.BAR, 3,      // ~5% high pay
    Symbol.Seven, 3,    // ~5% high pay
    Symbol.Orange, 15,  // ~25% each low pay
    Symbol.Lemon, 15,
    Symbol.Plum, 10,
    Symbol.Banana, 10,
    Symbol.Cherry, 8,
    Symbol.Grapes, 8,
    Symbol.Watermelon, 7,  // Increased to compensate for scatter reduction
  ]);

  return [baseStrip, baseStrip, baseStrip, baseStrip, baseStrip];
}

/**
 * Select a symbol from a strip using weighted RNG.
 * Weights default to uniform (each symbol equally likely).
 */
export function selectSymbol(strip: ReelStrip, rng: Rng): Symbol {
  const { symbols, weights } = strip;

  if (!weights) {
    // Uniform selection
    const idx = rng.nextInt(symbols.length);
    return symbols[idx]!;
  }

  // Weighted selection
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;

  for (let i = 0; i < symbols.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) {
      return symbols[i]!;
    }
  }

  return symbols[symbols.length - 1]!; // Fallback (shouldn't happen)
}

/**
 * Select reel stop indices (0 to strip.length - 1 for each reel).
 * Returns one stop per reel.
 */
export function selectStops(reels: readonly ReelStrip[], rng: Rng): readonly [number, number, number, number, number] {
  return [
    rng.nextInt(reels[0]!.symbols.length),
    rng.nextInt(reels[1]!.symbols.length),
    rng.nextInt(reels[2]!.symbols.length),
    rng.nextInt(reels[3]!.symbols.length),
    rng.nextInt(reels[4]!.symbols.length),
  ] as const;
}

/**
 * Extract visible symbols from a reel, starting at `stopIndex`.
 * Returns GRID_ROWS (3) symbols, wrapping around the strip.
 */
export function getVisibleSymbols(strip: ReelStrip, stopIndex: number): readonly Symbol[] {
  const { symbols } = strip;
  const result: Symbol[] = [];

  for (let i = 0; i < GRID_ROWS; i++) {
    const idx = (stopIndex + i) % symbols.length;
    const sym = symbols[idx];
    if (sym === undefined) {
      throw new Error(`Invalid symbol at index ${idx}`);
    }
    result.push(sym);
  }

  return result;
}
