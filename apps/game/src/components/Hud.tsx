import { useGameStore, BET_LEVELS } from '../store';

/**
 * Main HUD: balance, bet selector, spin / stop, turbo.
 * Pure read-model consumer — every fact comes from the store.
 */
export function Hud() {
  const gameState = useGameStore((s) => s.gameState);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const bet = useGameStore((s) => s.bet);
  const turbo = useGameStore((s) => s.turbo);
  const spin = useGameStore((s) => s.spin);
  const setBet = useGameStore((s) => s.setBet);
  const requestStop = useGameStore((s) => s.requestStop);
  const setTurbo = useGameStore((s) => s.setTurbo);

  const isIdle = gameState.type === 'idle';
  // After spin() the FSM rests in `evaluating` while the reels animate.
  const isAnimating = !isIdle;
  const canSpin = isIdle && gameState.balance >= bet;

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.label}>Balance</div>
        <div style={styles.value}>{gameState.balance.toLocaleString()}</div>
      </div>

      <div style={styles.section}>
        <div style={styles.label}>Bet</div>
        <div style={styles.betSelector}>
          {BET_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setBet(level)}
              disabled={isAnimating}
              style={{
                ...styles.betButton,
                ...(bet === level ? styles.betButtonActive : {}),
                ...(isAnimating ? styles.buttonDisabled : {}),
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.buttonGroup}>
        <button
          onClick={spin}
          disabled={!canSpin}
          style={{ ...styles.spinButton, ...(canSpin ? {} : styles.buttonDisabled) }}
        >
          {isAnimating ? 'SPINNING…' : 'SPIN'}
        </button>

        {isAnimating && (
          <button onClick={requestStop} style={styles.quickStopButton}>
            STOP
          </button>
        )}
      </div>

      {isIdle && lastOutcome && (
        <div style={styles.section}>
          <div style={styles.label}>Last win</div>
          <div style={{ ...styles.value, color: lastOutcome.totalWin > 0 ? '#f1c40f' : '#666' }}>
            {lastOutcome.totalWin > 0 ? `+${lastOutcome.totalWin.toLocaleString()}` : '—'}
          </div>
          {lastOutcome.triggeredFreeSpins && (
            <div style={styles.featureNote}>Scatter hit! Free spins land in Phase 3.</div>
          )}
        </div>
      )}

      <label style={styles.turboRow}>
        <input
          type="checkbox"
          checked={turbo}
          onChange={(e) => setTurbo(e.target.checked)}
          style={styles.checkbox}
        />
        <span style={styles.label}>Turbo</span>
      </label>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    padding: '16px',
    backgroundColor: '#1a1a20',
    borderRadius: '8px',
    color: '#e8e0c8',
    fontSize: '14px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    opacity: 0.7,
    textTransform: 'uppercase' as const,
  },
  value: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
  },
  featureNote: {
    fontSize: '12px',
    color: '#ff6b9d',
  },
  betSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  betButton: {
    padding: '8px 4px',
    backgroundColor: '#2a2a30',
    color: '#e8e0c8',
    border: '1px solid #4a4a50',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  betButtonActive: {
    backgroundColor: '#f39c12',
    color: '#000',
    border: '1px solid #f39c12',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexDirection: 'column' as const,
  },
  spinButton: {
    padding: '12px 16px',
    backgroundColor: '#f39c12',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  quickStopButton: {
    padding: '12px 16px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  turboRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
};
