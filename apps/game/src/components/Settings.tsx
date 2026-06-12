import { useGameStore } from '../store';

/**
 * Settings strip: dev panel toggle, mute placeholder (audio lands in Phase 4).
 */
export function Settings() {
  const devPanelOpen = useGameStore((s) => s.devPanelOpen);
  const setDevPanelOpen = useGameStore((s) => s.setDevPanelOpen);

  return (
    <div style={styles.container}>
      <button onClick={() => setDevPanelOpen(!devPanelOpen)} style={styles.button}>
        {devPanelOpen ? 'Hide dev panel' : 'Dev panel'}
      </button>

      <div style={styles.divider} />

      <label style={styles.label} title="Audio arrives in Phase 4">
        <input type="checkbox" disabled style={styles.checkbox} />
        <span>Mute</span>
      </label>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: '#1a1a20',
    borderRadius: '4px',
    color: '#e8e0c8',
    fontSize: '12px',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: '#2a2a30',
    color: '#e8e0c8',
    border: '1px solid #4a4a50',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  divider: {
    width: '1px',
    height: '20px',
    backgroundColor: '#4a4a50',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    opacity: 0.5,
    userSelect: 'none' as const,
  },
  checkbox: {
    width: '16px',
    height: '16px',
  },
};
