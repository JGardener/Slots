import { describe, it, expect } from 'vitest';
import { spin } from './spin';
import { createReels } from './strips';
import { GRID_ROWS } from './types';

describe('spin()', () => {
  it('returns a complete, valid SpinOutcome', () => {
    const outcome = spin(10, 12345);

    expect(outcome.rng.seed).toBe(12345);
    expect(outcome.stops).toHaveLength(5);
    expect(outcome.symbols).toHaveLength(5);
    const reels = createReels();
    outcome.stops.forEach((stop, i) => {
      expect(stop).toBeGreaterThanOrEqual(0);
      expect(stop).toBeLessThan(reels[i]!.symbols.length);
      expect(outcome.symbols[i]).toHaveLength(GRID_ROWS);
    });
    expect(outcome.totalWin).toBeGreaterThanOrEqual(0);
    expect(outcome.scatterWin).toBeLessThanOrEqual(outcome.totalWin);
  });

  it('the visible grid matches the strip windows at the stops', () => {
    const outcome = spin(10, 777);
    const reels = createReels();
    outcome.symbols.forEach((window, i) => {
      const strip = reels[i]!.symbols;
      window.forEach((sym, row) => {
        expect(sym).toBe(strip[(outcome.stops[i]! + row) % strip.length]);
      });
    });
  });

  it('is deterministic for the same seed and varies across seeds', () => {
    expect(spin(10, 999)).toEqual(spin(10, 999));
    expect(spin(10, 111).stops).not.toEqual(spin(10, 222).stops);
  });

  it('totalWin scales linearly with bet', () => {
    // Find a winning seed, then check bet scaling on it.
    let seed = 0;
    while (spin(10, seed).totalWin === 0) seed++;
    const at10 = spin(10, seed).totalWin;
    const at50 = spin(50, seed).totalWin;
    expect(at50).toBeCloseTo(at10 * 5, 6);
  });
});
