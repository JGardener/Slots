import { describe, it, expect } from 'vitest';
import { evaluateSpin } from './evaluator';
import { Symbol } from './types';

type Grid = readonly (readonly Symbol[])[];
const BET = 10;

const evalBase = (grid: Grid) => evaluateSpin(grid, BET, false, 1);
const middleLineWins = (grid: Grid) => evalBase(grid).wins.filter((w) => w.paylineIndex === 0);

const { Scatter: SC, Wild: W, BAR, Seven, Orange: O, Lemon, Plum, Banana, Cherry, Grapes, Watermelon } = Symbol;

describe('payline evaluation (hand-computed fixtures, bet=10)', () => {
  it('pays Orange×5 on the middle line: 16.5× bet = 165 credits', () => {
    // Fillers chosen so no other payline forms a left-anchored 3+ run.
    const grid: Grid = [
      [Seven, O, BAR],
      [Cherry, O, Grapes],
      [Watermelon, O, Banana],
      [Lemon, O, Plum],
      [Seven, O, BAR],
    ];
    const result = evalBase(grid);
    expect(result.wins).toEqual([
      { paylineIndex: 0, symbol: O, count: 5, multiplier: 1, payout: 165 },
    ]);
    expect(result.totalWin).toBe(165);
  });

  it('REGRESSION: does not pay right-anchored runs — Seven,O,O,O,O is no win', () => {
    const grid: Grid = [
      [Cherry, Seven, BAR],
      [Cherry, O, Grapes],
      [Watermelon, O, Banana],
      [Lemon, O, Plum],
      [Seven, O, BAR],
    ];
    const result = evalBase(grid);
    expect(result.wins).toEqual([]);
    expect(result.totalWin).toBe(0);
  });

  it('wilds substitute into a run: W,O,O,O,W pays Orange×5', () => {
    const grid: Grid = [
      [Cherry, W, BAR],
      [Lemon, O, Grapes],
      [Watermelon, O, Banana],
      [Plum, O, Grapes],
      [Seven, W, BAR],
    ];
    expect(middleLineWins(grid)).toEqual([
      { paylineIndex: 0, symbol: O, count: 5, multiplier: 1, payout: 165 },
    ]);
  });

  it('REGRESSION: wild best-pay — W,W,W,W,O pays Wild×4 (220), not Orange×5 (165)', () => {
    const grid: Grid = [
      [Cherry, W, BAR],
      [SC, W, SC],
      [Watermelon, W, Banana],
      [Plum, W, Seven],
      [Grapes, O, Banana],
    ];
    const result = evalBase(grid);
    expect(result.wins).toEqual([
      { paylineIndex: 0, symbol: W, count: 4, multiplier: 1, payout: 220 },
    ]);
  });

  it('five wilds pay Wild×5: 110× bet = 1100 credits', () => {
    const grid: Grid = [
      [Cherry, W, BAR],
      [SC, W, SC],
      [Watermelon, W, Banana],
      [Plum, W, Seven],
      [Grapes, W, Banana],
    ];
    expect(middleLineWins(grid)).toEqual([
      { paylineIndex: 0, symbol: W, count: 5, multiplier: 1, payout: 1100 },
    ]);
  });

  it('scatter breaks a line and never pays as a line symbol', () => {
    const grid: Grid = [
      [Cherry, SC, BAR],
      [Lemon, SC, Grapes],
      [Watermelon, SC, Banana],
      [Plum, Seven, Grapes],
      [Grapes, Seven, Banana],
    ];
    const result = evalBase(grid);
    expect(middleLineWins(grid)).toEqual([]);
    // ...but the three scatters pay the scatter award and trigger the feature.
    expect(result.scatterCount).toBe(3);
    expect(result.scatterWin).toBe(90); // 9× bet
    expect(result.triggeredFreeSpins).toBe(true);
    expect(result.freeSpinsCount).toBe(10);
  });

  it('two scatters pay nothing and do not trigger', () => {
    const grid: Grid = [
      [SC, Seven, BAR],
      [Cherry, Lemon, Grapes],
      [Watermelon, SC, Banana],
      [Lemon, Banana, Plum],
      [Seven, Cherry, BAR],
    ];
    const result = evalBase(grid);
    expect(result.scatterCount).toBe(2);
    expect(result.scatterWin).toBe(0);
    expect(result.triggeredFreeSpins).toBe(false);
  });

  it('free-spins multiplier doubles line wins and scatter pays', () => {
    const grid: Grid = [
      [Seven, O, BAR],
      [Cherry, O, Grapes],
      [Watermelon, O, Banana],
      [Lemon, O, Plum],
      [Seven, O, BAR],
    ];
    const base = evaluateSpin(grid, BET, false, 1);
    const free = evaluateSpin(grid, BET, true, 2);
    expect(free.totalWin).toBe(base.totalWin * 2);
    expect(free.wins[0]!.multiplier).toBe(2);
  });

  it('a 4-of-a-kind pays the 4 tier, not 3', () => {
    const grid: Grid = [
      [Seven, BAR, Cherry],
      [Cherry, BAR, Grapes],
      [Watermelon, BAR, Banana],
      [Lemon, BAR, Plum],
      [Seven, O, Lemon],
    ];
    expect(middleLineWins(grid)).toEqual([
      { paylineIndex: 0, symbol: BAR, count: 4, multiplier: 1, payout: 130 }, // 13× bet
    ]);
  });
});
