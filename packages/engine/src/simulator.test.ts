import { describe, it, expect } from 'vitest';
import { simulate } from './simulator';

describe('RTP Simulator', () => {
  it('completes a 1000-spin simulation', () => {
    const result = simulate(1000, 10);

    expect(result.spins).toBe(1000);
    expect(result.totalBet).toBe(10000);
    expect(result.totalWin).toBeGreaterThanOrEqual(0);
    expect(result.rtp).toBeGreaterThan(0);
    expect(result.hitFrequency).toBeGreaterThanOrEqual(0);
    expect(result.hitFrequency).toBeLessThanOrEqual(100);
  });

  it('1M-spin simulation converges toward target RTP of ~96%', () => {
    // This is the main CI test. It can take a few seconds.
    const result = simulate(1_000_000, 10);

    console.log(`Simulated RTP: ${result.rtp}% (target: ~96%)`);
    console.log(`Hit frequency: ${result.hitFrequency}%`);
    console.log(`Scatter trigger: ${result.scatterTriggerFrequency}%`);

    // Assert RTP is within ±0.5% of target (96%)
    expect(result.rtp).toBeGreaterThan(95.5);
    expect(result.rtp).toBeLessThan(96.5);

    // Assert reasonable hit frequency (actual: ~40% due to low-pay frequency)
    expect(result.hitFrequency).toBeGreaterThan(30);
    expect(result.hitFrequency).toBeLessThan(50);

    // Assert reasonable scatter trigger (actual: ~13%, roughly 1 in 8 spins for 3+ scatters)
    expect(result.scatterTriggerFrequency).toBeGreaterThan(5);
    expect(result.scatterTriggerFrequency).toBeLessThan(20);
  });
});
