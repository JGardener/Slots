import type { FreeSpinsCtx, GameEvent, GameState } from './types';
import { FREE_SPINS } from './paytable';

/**
 * Game state machine. Validates every transition and owns all balance
 * accounting:
 *
 *   idle ──spin (deduct bet)──▶ spinning ──outcome-ready──▶ evaluating
 *   evaluating ──presentation-complete (credit win)──▶ presenting-win
 *   presenting-win ──presentation-complete──▶ idle | free-spins-mode
 *   free-spins-mode ──spin (no deduction)──▶ spinning … (same loop)
 *
 * Free spins: triggered by the evaluator (3+ scatters), 10 spins at 2×,
 * bet locked at trigger, one retrigger allowed per feature. The remaining
 * count decrements as each free spin's presentation completes.
 */
export class GameFsm {
  private state: GameState;

  constructor(initialBalance: number = 1000) {
    this.state = { type: 'idle', balance: initialBalance, bet: 10 };
  }

  getState(): GameState {
    return this.state;
  }

  /** Apply an event. Returns the new state; throws on invalid transitions. */
  transition(event: GameEvent): GameState {
    const current = this.state;

    switch (event.type) {
      case 'spin': {
        if (current.type === 'idle') {
          if (current.balance < event.bet) {
            throw new Error(`Insufficient balance: ${current.balance} < ${event.bet}`);
          }
          this.state = {
            type: 'spinning',
            balance: current.balance - event.bet,
            bet: event.bet,
            freeSpins: null,
          };
        } else if (current.type === 'free-spins-mode') {
          // Free spins cost nothing; bet stays locked at the trigger value.
          this.state = {
            type: 'spinning',
            balance: current.balance,
            bet: current.bet,
            freeSpins: current.freeSpins,
          };
        } else {
          throw new Error(`Cannot spin from state "${current.type}"`);
        }
        return this.state;
      }

      case 'outcome-ready': {
        if (current.type !== 'spinning') {
          throw new Error(`Cannot receive outcome from state "${current.type}"`);
        }
        this.state = {
          type: 'evaluating',
          balance: current.balance,
          bet: current.bet,
          outcome: event.outcome,
          freeSpins: current.freeSpins,
        };
        return this.state;
      }

      case 'presentation-complete': {
        if (current.type === 'evaluating') {
          // Win presentation starts: credit the (already resolved) win.
          this.state = {
            type: 'presenting-win',
            balance: current.balance + current.outcome.totalWin,
            bet: current.bet,
            outcome: current.outcome,
            freeSpins: current.freeSpins,
          };
          return this.state;
        }

        if (current.type === 'presenting-win') {
          this.state = this.afterPresentation(current);
          return this.state;
        }

        throw new Error(`Cannot complete presentation from state "${current.type}"`);
      }

      case 'reset': {
        this.state = { type: 'idle', balance: current.balance, bet: current.bet };
        return this.state;
      }
    }
  }

  /** Resolve where the round ends: back to idle, or into/through free spins. */
  private afterPresentation(
    current: Extract<GameState, { type: 'presenting-win' }>
  ): GameState {
    const { balance, bet, outcome, freeSpins } = current;

    if (freeSpins === null) {
      // Base-game round: a trigger starts the feature.
      if (outcome.triggeredFreeSpins) {
        return {
          type: 'free-spins-mode',
          balance,
          bet,
          freeSpins: {
            remaining: outcome.freeSpinsCount,
            multiplier: FREE_SPINS.multiplier,
            retriggered: false,
          },
        };
      }
      return { type: 'idle', balance, bet };
    }

    // Free-spin round: consume one spin, apply at most one retrigger.
    let next: FreeSpinsCtx = { ...freeSpins, remaining: freeSpins.remaining - 1 };
    if (outcome.triggeredFreeSpins && !next.retriggered) {
      next = {
        ...next,
        remaining: next.remaining + outcome.freeSpinsCount,
        retriggered: true,
      };
    }

    if (next.remaining > 0) {
      return { type: 'free-spins-mode', balance, bet, freeSpins: next };
    }
    return { type: 'idle', balance, bet };
  }
}
