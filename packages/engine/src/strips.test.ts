import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { buildStrip, createReels, getVisibleSymbols, selectStops } from './strips';
import { Symbol, GRID_ROWS } from './types';

/** Cyclic min distance between two indices on a strip of length n. */
function cyclicDist(a: number, b: number, n: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, n - d);
}

function positionsOf(symbols: readonly Symbol[], sym: Symbol): number[] {
  return symbols.flatMap((s, i) => (s === sym ? [i] : []));
}

describe('reel strips', () => {
  const reels = createReels();

  it('has five reels of substantial length (real tapes, not a symbol alphabet)', () => {
    expect(reels).toHaveLength(5);
    for (const reel of reels) {
      expect(reel.symbols.length).toBeGreaterThanOrEqual(50);
    }
  });

  it('is deterministic: identical strips on every call', () => {
    const again = createReels();
    expect(again.map((r) => [...r.symbols])).toEqual(reels.map((r) => [...r.symbols]));
  });

  it('keeps scatters at least GRID_ROWS apart (max one per window)', () => {
    for (const reel of reels) {
      const pos = positionsOf(reel.symbols, Symbol.Scatter);
      expect(pos.length).toBeGreaterThanOrEqual(1);
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          expect(cyclicDist(pos[i]!, pos[j]!, reel.symbols.length)).toBeGreaterThanOrEqual(GRID_ROWS);
        }
      }
    }
  });

  it('keeps wilds at least GRID_ROWS apart (max one per window)', () => {
    for (const reel of reels) {
      const pos = positionsOf(reel.symbols, Symbol.Wild);
      for (let i = 0; i < pos.length; i++) {
        for (let j = i + 1; j < pos.length; j++) {
          expect(cyclicDist(pos[i]!, pos[j]!, reel.symbols.length)).toBeGreaterThanOrEqual(GRID_ROWS);
        }
      }
    }
  });

  it('never has three identical consecutive symbols (incl. wraparound)', () => {
    for (const reel of reels) {
      const n = reel.symbols.length;
      for (let i = 0; i < n; i++) {
        const a = reel.symbols[i]!;
        expect(a === reel.symbols[(i + 1) % n] && a === reel.symbols[(i + 2) % n]).toBe(false);
      }
    }
  });

  it('buildStrip preserves the requested symbol counts', () => {
    const counts = { [Symbol.Scatter]: 2, [Symbol.Orange]: 10, [Symbol.BAR]: 5, [Symbol.Lemon]: 9 };
    const strip = buildStrip(counts, createRng(7));
    expect(strip.symbols.length).toBe(26);
    expect(positionsOf(strip.symbols, Symbol.Scatter)).toHaveLength(2);
    expect(positionsOf(strip.symbols, Symbol.Orange)).toHaveLength(10);
    expect(positionsOf(strip.symbols, Symbol.BAR)).toHaveLength(5);
    expect(positionsOf(strip.symbols, Symbol.Lemon)).toHaveLength(9);
  });

  it('getVisibleSymbols wraps around the strip end', () => {
    const reel = reels[0]!;
    const n = reel.symbols.length;
    const window = getVisibleSymbols(reel, n - 1);
    expect(window).toEqual([reel.symbols[n - 1]!, reel.symbols[0]!, reel.symbols[1]!]);
  });

  it('selectStops is deterministic per seed and within bounds', () => {
    const a = selectStops(reels, createRng(42));
    const b = selectStops(reels, createRng(42));
    expect(a).toEqual(b);
    a.forEach((stop, i) => {
      expect(stop).toBeGreaterThanOrEqual(0);
      expect(stop).toBeLessThan(reels[i]!.symbols.length);
    });
  });
});
