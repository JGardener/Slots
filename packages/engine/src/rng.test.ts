import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays in [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt() stays in [0, max) and hits every bucket', () => {
    const rng = createRng(7);
    const counts = new Array<number>(5).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextInt(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
    }
  });

  it('nextInt() rejects non-positive or non-integer bounds', () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-1)).toThrow(RangeError);
    expect(() => rng.nextInt(2.5)).toThrow(RangeError);
  });
});
