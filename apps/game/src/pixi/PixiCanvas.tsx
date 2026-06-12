import { useEffect, useRef } from 'react';
import { SlotScene } from './scene';
import { playSpin, type SpinHandle } from '../motion/spin';
import { useGameStore } from '../store';

/**
 * React↔Pixi bridge. React owns the host div; the scene renders
 * imperatively inside it. Effects key off store changes:
 *   spinId      → play the spin timeline for the resolved outcome
 *   stopRequest → quick-stop the running timeline
 *   turbo       → retime the running timeline
 */
export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SlotScene | null>(null);
  const spinRef = useRef<SpinHandle | null>(null);

  const spinId = useGameStore((s) => s.spinId);
  const stopRequest = useGameStore((s) => s.stopRequest);
  const turbo = useGameStore((s) => s.turbo);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let status: 'booting' | 'ready' | 'disposed' = 'booting';
    const scene = new SlotScene(host);

    const boot = async () => {
      await scene.init();
      // React StrictMode mounts effects twice; if cleanup ran mid-init, bail.
      if (status === 'disposed') {
        scene.dispose();
        return;
      }
      status = 'ready';
      sceneRef.current = scene;

      // If a spin resolved before the scene was ready (fast click, remount
      // mid-spin), skip the animation: show the result and settle the FSM.
      const { gameState, lastOutcome, settle } = useGameStore.getState();
      if (gameState.type === 'evaluating' && lastOutcome) {
        scene.setGrid(lastOutcome.symbols);
        settle();
      }
    };

    void boot();

    return () => {
      const wasReady = status === 'ready';
      status = 'disposed';
      spinRef.current?.kill();
      spinRef.current = null;
      sceneRef.current = null;
      if (wasReady) scene.dispose();
    };
  }, []);

  // A new spin resolved: animate the reels to the outcome, then settle.
  useEffect(() => {
    if (spinId === 0) return;
    const scene = sceneRef.current;
    const { lastOutcome, settle, turbo: turboNow } = useGameStore.getState();
    if (!scene || !lastOutcome) return;

    spinRef.current?.kill();
    spinRef.current = playSpin({
      reels: scene.reels,
      finalGrid: lastOutcome.symbols,
      turbo: turboNow,
      onComplete: () => {
        spinRef.current = null;
        settle();
      },
    });
  }, [spinId]);

  useEffect(() => {
    if (stopRequest > 0) spinRef.current?.quickStop();
  }, [stopRequest]);

  useEffect(() => {
    spinRef.current?.setTurbo(turbo);
  }, [turbo]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}
