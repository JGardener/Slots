import type { GameState, GameEvent } from './types';

/**
 * FSM state machine for the game.
 * Validates state transitions and returns the new state or an error.
 */
export class GameFsm {
  private state: GameState;

  constructor(initialBalance: number = 1000) {
    this.state = {
      type: 'idle',
      balance: initialBalance,
      bet: 10,
      freeSpinsRemaining: 0,
      freeSpinsMultiplier: 1,
    };
  }

  getState(): GameState {
    return this.state;
  }

  /**
   * Attempt a state transition given an event.
   * Returns the new state or throws an error if the transition is invalid.
   */
  transition(event: GameEvent): GameState {
    const currentState = this.state;

    switch (event.type) {
      case 'spin':
        if (currentState.type !== 'idle') {
          throw new Error(`Cannot spin from state "${currentState.type}"`);
        }
        if (currentState.balance < event.bet) {
          throw new Error(`Insufficient balance: ${currentState.balance} < ${event.bet}`);
        }
        this.state = {
          type: 'spinning',
          balance: currentState.balance - event.bet,
          bet: event.bet,
          freeSpinsRemaining: currentState.freeSpinsRemaining,
          freeSpinsMultiplier: currentState.freeSpinsMultiplier,
        };
        return this.state;

      case 'outcome-ready':
        if (currentState.type !== 'spinning') {
          throw new Error(`Cannot receive outcome from state "${currentState.type}"`);
        }
        this.state = {
          type: 'evaluating',
          balance: currentState.balance,
          bet: currentState.bet,
          outcome: event.outcome,
          freeSpinsRemaining: currentState.freeSpinsRemaining,
          freeSpinsMultiplier: currentState.freeSpinsMultiplier,
        };
        return this.state;

      case 'presentation-complete':
        if (currentState.type === 'evaluating') {
          // Evaluating → WinPresentation
          this.state = {
            type: 'presenting-win',
            balance: currentState.balance + (currentState.outcome?.totalWin || 0),
            bet: currentState.bet,
            outcome: currentState.outcome,
            freeSpinsRemaining: currentState.freeSpinsRemaining,
            freeSpinsMultiplier: currentState.freeSpinsMultiplier,
          };
          return this.state;
        } else if (currentState.type === 'presenting-win') {
          // WinPresentation → Idle or FreeSpin
          if (currentState.outcome.triggeredFreeSpins) {
            this.state = {
              type: 'free-spins-mode',
              balance: currentState.balance,
              bet: currentState.bet,
              freeSpinsRemaining: currentState.freeSpinsRemaining + currentState.outcome.freeSpinsCount,
              freeSpinsMultiplier: currentState.freeSpinsMultiplier * currentState.outcome.freeSpinsCount,
            };
          } else {
            this.state = {
              type: 'idle',
              balance: currentState.balance,
              bet: currentState.bet,
              freeSpinsRemaining: currentState.freeSpinsRemaining,
              freeSpinsMultiplier: currentState.freeSpinsMultiplier,
            };
          }
          return this.state;
        } else if (currentState.type === 'free-spins-mode') {
          // FreeSpin auto-spin completed, decrement
          const remaining = currentState.freeSpinsRemaining - 1;
          if (remaining <= 0) {
            this.state = {
              type: 'idle',
              balance: currentState.balance,
              bet: currentState.bet,
              freeSpinsRemaining: 0,
              freeSpinsMultiplier: 1,
            };
          } else {
            this.state = {
              type: 'idle',
              balance: currentState.balance,
              bet: currentState.bet,
              freeSpinsRemaining: remaining,
              freeSpinsMultiplier: currentState.freeSpinsMultiplier,
            };
          }
          return this.state;
        } else {
          throw new Error(`Cannot complete presentation from state "${currentState.type}"`);
        }

      case 'free-spin-start':
        if (currentState.type !== 'evaluating' && currentState.type !== 'presenting-win') {
          throw new Error(`Cannot start free spins from state "${currentState.type}"`);
        }
        this.state = {
          type: 'free-spins-mode',
          balance: currentState.balance,
          bet: currentState.bet,
          freeSpinsRemaining: event.count,
          freeSpinsMultiplier: event.multiplier,
        };
        return this.state;

      case 'reset':
        this.state = {
          type: 'idle',
          balance: currentState.balance,
          bet: 10,
          freeSpinsRemaining: 0,
          freeSpinsMultiplier: 1,
        };
        return this.state;

      default:
        throw new Error(`Unknown event type`);
    }
  }
}
