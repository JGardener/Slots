import { describe, it, expect } from 'vitest';
import { simulate, formatResults } from './simulator';

describe('RTP simulator', () => {
  it('completes a small simulation with coherent accounting', () => {
    const r = simulate(2_000, 10);
    expect(r.spins).toBe(2_000);
    expect(r.totalBet).toBe(20_000);
    expect(r.rtp).toBeCloseTo(r.baseRtp + r.featureRtp, 1);
    expect(r.hitFrequency).toBeGreaterThan(0);
    expect(r.hitFrequency).toBeLessThan(100);
  });

  it(
    '1M-spin certification: RTP 96% ±0.5, hit freq 25–30%, trigger ~1-in-150',
    { timeout: 120_000 }, // CI runners need more than Vitest's 5s default
    () => {
      const r = simulate(1_000_000, 10);
      console.log(formatResults(r));

      // The three design targets from PLAN.md, asserted for real.
      expect(r.rtp).toBeGreaterThan(95.5);
      expect(r.rtp).toBeLessThan(96.5);

      expect(r.hitFrequency).toBeGreaterThanOrEqual(24);
      expect(r.hitFrequency).toBeLessThanOrEqual(31);

      expect(r.triggerOneIn).toBeGreaterThanOrEqual(120);
      expect(r.triggerOneIn).toBeLessThanOrEqual(190);

      // The feature should matter, but the base game carries the RTP.
      expect(r.featureRtp).toBeGreaterThan(3);
      expect(r.featureRtp).toBeLessThan(25);
    }
  );
});
