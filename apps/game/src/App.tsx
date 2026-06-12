import { PixiCanvas } from './pixi/PixiCanvas';

export function App() {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <PixiCanvas />
      <header
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          color: '#e8e0c8',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <strong>slots-showcase</strong>
        <span style={{ opacity: 0.6 }}> — Phase 0: pipeline check (React + Pixi + GSAP)</span>
      </header>
    </div>
  );
}
