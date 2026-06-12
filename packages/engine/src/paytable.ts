import { Symbol } from './types';

/**
 * Paytable, in multiples of TOTAL bet, for 3 / 4 / 5 of a kind anchored at
 * reel 0 (credits won = multiple × bet). Tuned with the Monte Carlo sim
 * (`pnpm sim`) against the design targets:
 *   RTP ~96% · hit frequency 25–30% · free-spins trigger ~1-in-150.
 */
export const PAYTABLE: Partial<Record<Symbol, readonly [number, number, number]>> = {
  [Symbol.Wild]: [4.5, 22, 110],
  [Symbol.Seven]: [3.3, 16.5, 65],
  [Symbol.BAR]: [2.75, 13, 45],
  [Symbol.Orange]: [1.1, 4.4, 16.5],
  [Symbol.Lemon]: [1.1, 4.4, 16.5],
  [Symbol.Cherry]: [1.1, 4.4, 16.5],
  [Symbol.Plum]: [0.9, 3.3, 13],
  [Symbol.Banana]: [0.9, 3.3, 13],
  [Symbol.Grapes]: [0.9, 3.3, 13],
  [Symbol.Watermelon]: [0.9, 3.3, 13],
};

/** Line pay in total-bet multiples, or 0 if the combination doesn't pay. */
export function linePay(symbol: Symbol, count: number): number {
  if (count < 3) return 0;
  const tiers = PAYTABLE[symbol];
  return tiers ? tiers[Math.min(count, 5) - 3]! : 0;
}

/**
 * Scatter pays (total-bet multiples), keyed by scatter count anywhere on
 * the grid. Paid once per spin, on top of line wins.
 */
export const SCATTER_PAYS: Record<number, number> = {
  3: 9,
  4: 45,
  5: 220,
};

export function scatterPay(count: number): number {
  return SCATTER_PAYS[Math.min(count, 5)] ?? 0;
}

/** Free-spins feature configuration. */
export const FREE_SPINS = {
  triggerCount: 3, // Scatters needed anywhere on the grid
  spinsAwarded: 10,
  multiplier: 2,
  maxRetriggers: 1,
} as const;
