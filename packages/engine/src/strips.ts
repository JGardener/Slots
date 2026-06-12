import { Symbol, GRID_ROWS } from './types';
import { createRng, type Rng } from './rng';

/**
 * A reel strip is an ordered, cyclic list of symbol positions — the
 * physical tape of a mechanical reel. A spin picks one stop position
 * uniformly per reel; the visible window is GRID_ROWS consecutive
 * positions from there. Symbol frequency on the tape IS the weighting;
 * there is no separate weights table.
 */
export interface ReelStrip {
  symbols: readonly Symbol[];
}

/**
 * Symbol counts per reel. Tuned with the Monte Carlo sim (`pnpm sim`):
 * scatter count drives the free-spins trigger rate, wild and low-pay
 * counts drive hit frequency, and together with the paytable they set RTP.
 */
const REEL_COUNTS: readonly Partial<Record<Symbol, number>>[] = [
  // 65 positions per reel; 2 scatters each → window p = 6/65 ≈ 1-in-148 trigger.
  // Reel 1 — fewer wilds on the anchor reel keeps left-anchored runs honest.
  { [Symbol.Scatter]: 2, [Symbol.Wild]: 1, [Symbol.Seven]: 4, [Symbol.BAR]: 5, [Symbol.Orange]: 8, [Symbol.Lemon]: 7, [Symbol.Cherry]: 7, [Symbol.Plum]: 8, [Symbol.Banana]: 7, [Symbol.Grapes]: 8, [Symbol.Watermelon]: 8 },
  { [Symbol.Scatter]: 2, [Symbol.Wild]: 2, [Symbol.Seven]: 4, [Symbol.BAR]: 5, [Symbol.Orange]: 7, [Symbol.Lemon]: 8, [Symbol.Cherry]: 8, [Symbol.Plum]: 7, [Symbol.Banana]: 8, [Symbol.Grapes]: 7, [Symbol.Watermelon]: 7 },
  { [Symbol.Scatter]: 2, [Symbol.Wild]: 2, [Symbol.Seven]: 4, [Symbol.BAR]: 5, [Symbol.Orange]: 8, [Symbol.Lemon]: 7, [Symbol.Cherry]: 7, [Symbol.Plum]: 8, [Symbol.Banana]: 7, [Symbol.Grapes]: 8, [Symbol.Watermelon]: 7 },
  { [Symbol.Scatter]: 2, [Symbol.Wild]: 2, [Symbol.Seven]: 4, [Symbol.BAR]: 5, [Symbol.Orange]: 7, [Symbol.Lemon]: 7, [Symbol.Cherry]: 7, [Symbol.Plum]: 7, [Symbol.Banana]: 8, [Symbol.Grapes]: 8, [Symbol.Watermelon]: 8 },
  { [Symbol.Scatter]: 2, [Symbol.Wild]: 1, [Symbol.Seven]: 4, [Symbol.BAR]: 5, [Symbol.Orange]: 7, [Symbol.Lemon]: 8, [Symbol.Cherry]: 8, [Symbol.Plum]: 8, [Symbol.Banana]: 7, [Symbol.Grapes]: 8, [Symbol.Watermelon]: 7 },
];

/** Fixed seed: strips are data, generated once and identical every run. */
const STRIP_LAYOUT_SEED = 0x5107;

/**
 * Layout constraints, checked cyclically:
 * - scatters at least GRID_ROWS apart → at most one scatter per window,
 *   so the per-reel window probability is exactly 3 × count / length
 * - wilds at least GRID_ROWS apart → at most one wild per window
 * - no 3+ identical consecutive symbols → no single-reel triple in a window
 */
function violatesAt(symbols: readonly Symbol[], index: number): boolean {
  const n = symbols.length;
  const sym = symbols[index]!;

  if (sym === Symbol.Scatter || sym === Symbol.Wild) {
    for (let d = 1; d < GRID_ROWS; d++) {
      if (symbols[(index + d) % n] === sym || symbols[(index - d + n) % n] === sym) {
        return true;
      }
    }
  }

  const prev = symbols[(index - 1 + n) % n];
  const next = symbols[(index + 1) % n];
  const prev2 = symbols[(index - 2 + n) % n];
  const next2 = symbols[(index + 2) % n];
  return (prev === sym && (prev2 === sym || next === sym)) || (next === sym && next2 === sym);
}

/**
 * Build one strip: expand counts to a bag, shuffle deterministically,
 * then repair constraint violations by swapping offenders to random
 * positions until the layout is clean.
 */
export function buildStrip(counts: Partial<Record<Symbol, number>>, rng: Rng): ReelStrip {
  const symbols: Symbol[] = [];
  for (const [key, count] of Object.entries(counts)) {
    const sym = Number(key) as Symbol;
    for (let i = 0; i < (count ?? 0); i++) symbols.push(sym);
  }

  // Fisher–Yates
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [symbols[i], symbols[j]] = [symbols[j]!, symbols[i]!];
  }

  // Constraint repair
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const bad = symbols.findIndex((_, i) => violatesAt(symbols, i));
    if (bad === -1) return { symbols };
    const swapWith = rng.nextInt(symbols.length);
    [symbols[bad], symbols[swapWith]] = [symbols[swapWith]!, symbols[bad]!];
  }
  throw new Error('buildStrip: could not satisfy layout constraints');
}

let cachedReels: readonly ReelStrip[] | null = null;

/** The five production reels. Deterministic; built once and cached. */
export function createReels(): readonly ReelStrip[] {
  if (!cachedReels) {
    const rng = createRng(STRIP_LAYOUT_SEED);
    cachedReels = REEL_COUNTS.map((counts) => buildStrip(counts, rng));
  }
  return cachedReels;
}

/**
 * Select reel stop positions, uniform over each strip's length.
 * Uniform stops over a weighted tape is the entire math model —
 * exactly how physical reels work.
 */
export function selectStops(
  reels: readonly ReelStrip[],
  rng: Rng
): readonly [number, number, number, number, number] {
  return [
    rng.nextInt(reels[0]!.symbols.length),
    rng.nextInt(reels[1]!.symbols.length),
    rng.nextInt(reels[2]!.symbols.length),
    rng.nextInt(reels[3]!.symbols.length),
    rng.nextInt(reels[4]!.symbols.length),
  ] as const;
}

/**
 * Extract the visible window: GRID_ROWS consecutive symbols starting at
 * `stopIndex`, wrapping around the strip.
 */
export function getVisibleSymbols(strip: ReelStrip, stopIndex: number): readonly Symbol[] {
  const { symbols } = strip;
  const result: Symbol[] = [];
  for (let i = 0; i < GRID_ROWS; i++) {
    result.push(symbols[(stopIndex + i) % symbols.length]!);
  }
  return result;
}
