import { describe, it, expect } from 'vitest';
import { GameFsm } from './fsm';
import type { SpinOutcome } from './types';

function makeOutcome(overrides: Partial<SpinOutcome> = {}): SpinOutcome {
  return {
    rng: { seed: 1 },
    stops: [0, 0, 0, 0, 0],
    symbols: [[], [], [], [], []],
    wins: [],
    scatterWin: 0,
    totalWin: 0,
    scatters: 0,
    triggeredFreeSpins: false,
    freeSpinsCount: 0,
    ...overrides,
  };
}

/** Drive one full round: spin → outcome → credit → round end. */
function playRound(fsm: GameFsm, outcome: SpinOutcome, bet = 10) {
  fsm.transition({ type: 'spin', bet });
  fsm.transition({ type: 'outcome-ready', outcome });
  fsm.transition({ type: 'presentation-complete' }); // → presenting-win (credits)
  return fsm.transition({ type: 'presentation-complete' }); // → idle | free-spins-mode
}

describe('GameFsm — base game', () => {
  it('starts idle with the configured balance', () => {
    const fsm = new GameFsm(500);
    expect(fsm.getState()).toEqual({ type: 'idle', balance: 500, bet: 10 });
  });

  it('deducts the bet on spin and credits the win when presentation starts', () => {
    const fsm = new GameFsm(100);
    fsm.transition({ type: 'spin', bet: 10 });
    expect(fsm.getState()).toMatchObject({ type: 'spinning', balance: 90, freeSpins: null });

    fsm.transition({ type: 'outcome-ready', outcome: makeOutcome({ totalWin: 25 }) });
    expect(fsm.getState()).toMatchObject({ type: 'evaluating', balance: 90 });

    fsm.transition({ type: 'presentation-complete' });
    expect(fsm.getState()).toMatchObject({ type: 'presenting-win', balance: 115 });

    fsm.transition({ type: 'presentation-complete' });
    expect(fsm.getState()).toEqual({ type: 'idle', balance: 115, bet: 10 });
  });

  it('a losing round returns to idle down one bet', () => {
    const fsm = new GameFsm(100);
    const end = playRound(fsm, makeOutcome());
    expect(end).toEqual({ type: 'idle', balance: 90, bet: 10 });
  });

  it('rejects a spin the balance cannot cover', () => {
    const fsm = new GameFsm(5);
    expect(() => fsm.transition({ type: 'spin', bet: 10 })).toThrow(/Insufficient balance/);
    expect(fsm.getState().type).toBe('idle');
  });

  it('rejects out-of-order events', () => {
    const fsm = new GameFsm(100);
    expect(() => fsm.transition({ type: 'outcome-ready', outcome: makeOutcome() })).toThrow();
    expect(() => fsm.transition({ type: 'presentation-complete' })).toThrow();
    fsm.transition({ type: 'spin', bet: 10 });
    expect(() => fsm.transition({ type: 'spin', bet: 10 })).toThrow(/Cannot spin/);
  });

  it('reset returns to idle and keeps balance and bet', () => {
    const fsm = new GameFsm(100);
    fsm.transition({ type: 'spin', bet: 25 });
    fsm.transition({ type: 'reset' });
    expect(fsm.getState()).toEqual({ type: 'idle', balance: 75, bet: 25 });
  });
});

describe('GameFsm — free spins', () => {
  const trigger = makeOutcome({ triggeredFreeSpins: true, freeSpinsCount: 10, totalWin: 20 });

  it('3+ scatters enter free-spins-mode with 10 spins at 2×', () => {
    const fsm = new GameFsm(100);
    const end = playRound(fsm, trigger);
    expect(end).toEqual({
      type: 'free-spins-mode',
      balance: 110, // 100 − 10 bet + 20 scatter pay
      bet: 10,
      freeSpins: { remaining: 10, multiplier: 2, retriggered: false },
    });
  });

  it('free spins cost nothing and decrement at round end', () => {
    const fsm = new GameFsm(100);
    playRound(fsm, trigger);

    fsm.transition({ type: 'spin', bet: 999 }); // bet argument ignored in the feature
    expect(fsm.getState()).toMatchObject({ type: 'spinning', balance: 110, bet: 10 });

    fsm.transition({ type: 'outcome-ready', outcome: makeOutcome({ totalWin: 40 }) });
    fsm.transition({ type: 'presentation-complete' });
    const end = fsm.transition({ type: 'presentation-complete' });
    expect(end).toEqual({
      type: 'free-spins-mode',
      balance: 150,
      bet: 10,
      freeSpins: { remaining: 9, multiplier: 2, retriggered: false },
    });
  });

  it('the feature ends back at idle when spins are exhausted', () => {
    const fsm = new GameFsm(100);
    playRound(fsm, trigger);
    for (let i = 0; i < 10; i++) {
      expect(fsm.getState().type).toBe('free-spins-mode');
      fsm.transition({ type: 'spin', bet: 10 });
      fsm.transition({ type: 'outcome-ready', outcome: makeOutcome() });
      fsm.transition({ type: 'presentation-complete' });
      fsm.transition({ type: 'presentation-complete' });
    }
    expect(fsm.getState()).toEqual({ type: 'idle', balance: 110, bet: 10 });
  });

  it('a retrigger adds 10 spins, once per feature', () => {
    const fsm = new GameFsm(100);
    playRound(fsm, trigger);

    // First retrigger: 10 − 1 + 10 = 19 remaining.
    fsm.transition({ type: 'spin', bet: 10 });
    fsm.transition({ type: 'outcome-ready', outcome: trigger });
    fsm.transition({ type: 'presentation-complete' });
    fsm.transition({ type: 'presentation-complete' });
    expect(fsm.getState()).toMatchObject({
      type: 'free-spins-mode',
      freeSpins: { remaining: 19, multiplier: 2, retriggered: true },
    });

    // Second trigger is ignored: 19 − 1 = 18 remaining.
    fsm.transition({ type: 'spin', bet: 10 });
    fsm.transition({ type: 'outcome-ready', outcome: trigger });
    fsm.transition({ type: 'presentation-complete' });
    fsm.transition({ type: 'presentation-complete' });
    expect(fsm.getState()).toMatchObject({
      freeSpins: { remaining: 18, multiplier: 2, retriggered: true },
    });
  });
});
