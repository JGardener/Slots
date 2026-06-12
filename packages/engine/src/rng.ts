/**
 * Deterministic PRNG (mulberry32). Seeded so that every spin outcome is
 * reproducible — required by the RTP simulation, engine tests, and the
 * dev panel's "replay this exact spin" mode.
 */
export interface Rng {
  /** Float in [0, 1), like Math.random. */
  next(): number;
  /** Integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`nextInt requires a positive integer, got ${maxExclusive}`);
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
