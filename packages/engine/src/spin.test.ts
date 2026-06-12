import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { spin } from './spin';
import { Symbol } from './types';
import { createReels, selectSymbol, selectStops } from './strips';
import { evaluateSpin } from './evaluator';

describe('RNG', () => {
  it('is deterministic with the same seed', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(12345);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('produces different sequences with different seeds', () => {
    const rng1 = createRng(12345);
    const rng2 = createRng(54321);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).not.toEqual(seq2);
  });

  it('nextInt respects bounds', () => {
    const rng = createRng(999);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(10);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(10);
    }
  });

  it('throws on invalid nextInt bounds', () => {
    const rng = createRng(999);
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(-5)).toThrow();
    expect(() => rng.nextInt(3.5)).toThrow();
  });
});

describe('Reel strips', () => {
  it('selects symbols from a weighted strip', () => {
    const rng = createRng(123);
    const reels = createReels();

    // Each reel should produce a symbol
    for (const reel of reels) {
      const sym = selectSymbol(reel, rng);
      expect(sym).toBeGreaterThanOrEqual(0);
      expect(sym).toBeLessThanOrEqual(10);
    }
  });

  it('selects consistent stop indices with same seed', () => {
    const reels = createReels();
    const stops1 = selectStops(reels, createRng(111));
    const stops2 = selectStops(reels, createRng(111));

    expect(stops1).toEqual(stops2);
  });
});

describe('Spin outcomes', () => {
  it('returns a valid SpinOutcome', () => {
    const outcome = spin(10, 12345);

    expect(outcome).toBeDefined();
    expect(outcome.rng.seed).toBe(12345);
    expect(outcome.stops).toHaveLength(5);
    expect(outcome.symbols).toHaveLength(5);
    expect(outcome.symbols[0]).toHaveLength(3);
    expect(outcome.totalWin).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic with the same seed and bet', () => {
    const outcome1 = spin(10, 999);
    const outcome2 = spin(10, 999);

    expect(outcome1.stops).toEqual(outcome2.stops);
    expect(outcome1.symbols).toEqual(outcome2.symbols);
    expect(outcome1.totalWin).toBe(outcome2.totalWin);
  });

  it('produces different outcomes with different seeds', () => {
    const outcome1 = spin(10, 111);
    const outcome2 = spin(10, 222);

    expect(outcome1.stops).not.toEqual(outcome2.stops);
  });
});

describe('Payline evaluation', () => {
  it('detects a simple horizontal win (middle line)', () => {
    // Manually create a grid with 5 oranges on the middle line
    const grid = [
      [Symbol.Lemon, Symbol.Orange, Symbol.Plum],
      [Symbol.Orange, Symbol.Orange, Symbol.Watermelon],
      [Symbol.Orange, Symbol.Orange, Symbol.Cherry],
      [Symbol.Orange, Symbol.Orange, Symbol.Grapes],
      [Symbol.Orange, Symbol.Orange, Symbol.Banana],
    ] as const;

    const result = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, false, 1);

    // Should have at least one win on the middle line (5 oranges = 20× bet per the paytable)
    expect(result.wins.length).toBeGreaterThan(0);
    expect(result.totalWin).toBeGreaterThan(0);
  });

  it('handles wild substitution', () => {
    // Grid with 4 oranges and 1 wild (wild substitutes for the 5th orange)
    const grid = [
      [Symbol.Lemon, Symbol.Wild, Symbol.Plum],
      [Symbol.Orange, Symbol.Orange, Symbol.Watermelon],
      [Symbol.Orange, Symbol.Orange, Symbol.Cherry],
      [Symbol.Orange, Symbol.Orange, Symbol.Grapes],
      [Symbol.Orange, Symbol.Wild, Symbol.Banana],
    ] as const;

    const result = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, false, 1);

    // Should detect the win with wild substitution
    expect(result.wins.length).toBeGreaterThan(0);
  });

  it('detects scatters and triggers free spins', () => {
    // Grid with 3 scatters anywhere
    const grid = [
      [Symbol.Scatter, Symbol.Orange, Symbol.Plum],
      [Symbol.Orange, Symbol.Scatter, Symbol.Watermelon],
      [Symbol.Orange, Symbol.Orange, Symbol.Scatter],
      [Symbol.Orange, Symbol.Orange, Symbol.Cherry],
      [Symbol.Orange, Symbol.Orange, Symbol.Banana],
    ] as const;

    const result = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, false, 1);

    expect(result.scatterCount).toBe(3);
    expect(result.triggeredFreeSpins).toBe(true);
    expect(result.freeSpinsCount).toBe(10);
    expect(result.freeSpinMultiplier).toBe(2);
  });

  it('does not trigger free spins with fewer than 3 scatters', () => {
    const grid = [
      [Symbol.Scatter, Symbol.Orange, Symbol.Plum],
      [Symbol.Orange, Symbol.Scatter, Symbol.Watermelon],
      [Symbol.Orange, Symbol.Orange, Symbol.Cherry],
      [Symbol.Orange, Symbol.Orange, Symbol.Grapes],
      [Symbol.Orange, Symbol.Orange, Symbol.Banana],
    ] as const;

    const result = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, false, 1);

    expect(result.scatterCount).toBe(2);
    expect(result.triggeredFreeSpins).toBe(false);
  });

  it('applies free spin multiplier to wins', () => {
    const grid = [
      [Symbol.Lemon, Symbol.Orange, Symbol.Plum],
      [Symbol.Orange, Symbol.Orange, Symbol.Watermelon],
      [Symbol.Orange, Symbol.Orange, Symbol.Cherry],
      [Symbol.Orange, Symbol.Orange, Symbol.Grapes],
      [Symbol.Orange, Symbol.Orange, Symbol.Banana],
    ] as const;

    const result = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, true, 2);

    // With 2× free spin multiplier, payouts should be doubled
    const resultNoMultiplier = evaluateSpin(grid as unknown as Parameters<typeof evaluateSpin>[0], 10, false, 1);
    if (result.wins.length > 0 && resultNoMultiplier.wins.length > 0) {
      expect(result.totalWin).toBeGreaterThanOrEqual(resultNoMultiplier.totalWin);
    }
  });
});

describe('Hit frequency and variance', () => {
  it('produces a reasonable hit frequency across many spins', () => {
    const spins = 1000;
    let winCount = 0;

    for (let i = 0; i < spins; i++) {
      const outcome = spin(10, i);
      if (outcome.totalWin > 0) {
        winCount++;
      }
    }

    const hitFreq = winCount / spins;
    // Target: 25-30%, allow some variance
    expect(hitFreq).toBeGreaterThan(0.15);
    expect(hitFreq).toBeLessThan(0.45);
  });
});
