import { useState } from 'react';
import { spin as engineSpin, type SpinOutcome } from '@slots/engine';
import { useGameStore } from '../store';

/**
 * Dev/QA panel: seed the RNG for reproducible sessions, force outcome
 * categories, and watch the live RTP of the current session.
 *
 * "Force" searches seeds through the real engine until the outcome matches,
 * then arms that seed for the next spin — the math path is never bypassed.
 */
const SEARCH_CAP = 500_000;

function findSeed(bet: number, matches: (o: SpinOutcome) => boolean): number | null {
  const start = Math.floor(Math.random() * 0x7fffffff);
  for (let i = 0; i < SEARCH_CAP; i++) {
    const seed = (start + i) % 0x7fffffff;
    if (matches(engineSpin(bet, seed))) return seed;
  }
  return null;
}

const FORCES: { label: string; matches: (o: SpinOutcome, bet: number) => boolean }[] = [
  { label: 'Any win', matches: (o) => o.totalWin > 0 },
  { label: 'Big win (≥25×)', matches: (o, bet) => o.totalWin >= bet * 25 },
  { label: 'Free spins', matches: (o) => o.triggeredFreeSpins },
];

export function DevPanel() {
  const seed = useGameStore((s) => s.seed);
  const spinCount = useGameStore((s) => s.spinCount);
  const bet = useGameStore((s) => s.bet);
  const forcedLabel = useGameStore((s) => s.forcedLabel);
  const totalWagered = useGameStore((s) => s.totalWagered);
  const totalWon = useGameStore((s) => s.totalWon);
  const setSeed = useGameStore((s) => s.setSeed);
  const armForcedSeed = useGameStore((s) => s.armForcedSeed);
  const disarmForcedSeed = useGameStore((s) => s.disarmForcedSeed);

  const [seedInput, setSeedInput] = useState(String(seed));

  const applySeed = () => {
    const parsed = Number.parseInt(seedInput, 10);
    if (Number.isFinite(parsed)) setSeed(parsed);
  };

  const force = (label: string, matches: (o: SpinOutcome, bet: number) => boolean) => {
    const found = findSeed(bet, (o) => matches(o, bet));
    if (found !== null) armForcedSeed(found, label);
  };

  const rtp = totalWagered > 0 ? ((totalWon / totalWagered) * 100).toFixed(1) : null;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Dev Panel</div>

      <div style={styles.section}>
        <label style={styles.label} htmlFor="seed-input">
          Seed RNG
        </label>
        <div style={styles.inputGroup}>
          <input
            id="seed-input"
            type="number"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySeed()}
            style={styles.input}
          />
          <button onClick={applySeed} style={styles.button}>
            Set
          </button>
        </div>
        <div style={styles.info}>
          Session: seed {seed}, spin #{spinCount}
        </div>
      </div>

      <div style={styles.section}>
        <span style={styles.label}>Force next spin</span>
        <div style={styles.forceButtons}>
          {FORCES.map((f) => (
            <button
              key={f.label}
              onClick={() => force(f.label, f.matches)}
              style={{
                ...styles.smallButton,
                ...(forcedLabel === f.label ? styles.buttonActive : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {forcedLabel && (
          <div style={styles.armedRow}>
            <span style={styles.armed}>Armed: {forcedLabel}</span>
            <button onClick={disarmForcedSeed} style={styles.smallButton}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <span style={styles.label}>Live RTP</span>
        <div style={styles.info}>
          {rtp !== null
            ? `${rtp}% over ${totalWagered.toLocaleString()} wagered`
            : 'No spins yet'}
        </div>
        <div style={styles.info}>Target: 96% ± 0.5 (1M-spin CI certified)</div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '12px',
    color: '#e8e0c8',
    fontSize: '12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    opacity: 0.7,
    textTransform: 'uppercase' as const,
  },
  inputGroup: {
    display: 'flex',
    gap: '4px',
  },
  input: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: '#2a2a30',
    color: '#e8e0c8',
    border: '1px solid #4a4a50',
    borderRadius: '4px',
    fontSize: '12px',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: '#f39c12',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold' as const,
  },
  forceButtons: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  smallButton: {
    padding: '6px 10px',
    backgroundColor: '#2a2a30',
    color: '#e8e0c8',
    border: '1px solid #4a4a50',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
  },
  buttonActive: {
    backgroundColor: '#f39c12',
    color: '#000',
    border: '1px solid #f39c12',
  },
  armedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  armed: {
    color: '#f1c40f',
    fontSize: '11px',
  },
  info: {
    fontSize: '11px',
    opacity: 0.7,
    lineHeight: 1.4,
  },
};
