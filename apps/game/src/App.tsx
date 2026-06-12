import { PixiCanvas } from './pixi/PixiCanvas';
import { Hud } from './components/Hud';
import { Settings } from './components/Settings';
import { DevPanel } from './components/DevPanel';
import { useGameStore } from './store';

/**
 * Phase 2 layout: Pixi canvas (left) + HUD (right) + optional dev panel.
 */
export function App() {
  const devPanelOpen = useGameStore((s) => s.devPanelOpen);

  return (
    <div style={styles.root}>
      {/* Main game area */}
      <div style={styles.gameContainer}>
        {/* Pixi canvas */}
        <div style={styles.canvasArea}>
          <PixiCanvas />
        </div>

        {/* Right sidebar: HUD + settings */}
        <div style={styles.hudPanel}>
          <div style={styles.hudHeader}>
            <h1 style={styles.title}>Slots</h1>
            <Settings />
          </div>

          <Hud />
        </div>
      </div>

      {/* Dev panel (conditional) */}
      {devPanelOpen && (
        <div style={styles.devPanelContainer}>
          <DevPanel />
        </div>
      )}
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0d0d14',
    color: '#e8e0c8',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  gameContainer: {
    display: 'flex',
    flex: 1,
    gap: '0',
    minHeight: 0,
  },

  canvasArea: {
    flex: 1,
    position: 'relative' as const,
    minWidth: 0,
  },

  hudPanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '300px',
    padding: '16px',
    backgroundColor: '#0d0d14',
    borderLeft: '1px solid #4a4a50',
    overflowY: 'auto' as const,
    gap: '16px',
  },

  hudHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  title: {
    fontSize: '24px',
    fontWeight: 'bold' as const,
    margin: 0,
    padding: 0,
  },

  devPanelContainer: {
    borderTop: '1px solid #4a4a50',
    maxHeight: '30vh',
    overflowY: 'auto' as const,
    backgroundColor: '#1a1a20',
  },
};
