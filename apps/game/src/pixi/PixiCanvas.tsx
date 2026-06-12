import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SlotScene } from './scene';
import { playSpin } from '../motion/spin';
import { playWinPresentation } from '../motion/wins';
import { computeAnticipation, playFreeSpinsIntro, playFreeSpinsOutro } from '../motion/features';
import type { MotionHandle } from '../motion/types';
import { useGameStore } from '../store';

/** Pause between free spins so each result lands before the next spin. */
const FREE_SPIN_GAP = 0.5;
const FREE_SPIN_GAP_TURBO = 0.15;

/**
 * React↔Pixi bridge. React owns the host div; the scene renders
 * imperatively inside it. Effects key off store changes:
 *   spinId       → play the spin timeline (with scatter anticipation)
 *   presentation → play wins / free-spins intro / outro; auto-spin the
 *                  next free spin when the feature loop is between beats
 *   stopRequest  → skip whatever timeline is active
 *   turbo        → retime the active timeline
 */
export function PixiCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SlotScene | null>(null);
  const motionRef = useRef<MotionHandle | null>(null);
  const freeSpinDelayRef = useRef<gsap.core.Tween | null>(null);

  const spinId = useGameStore((s) => s.spinId);
  const presentation = useGameStore((s) => s.presentation);
  const inFreeSpinsMode = useGameStore((s) => s.gameState.type === 'free-spins-mode');
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

      // Recovery after a remount mid-round (fast click, HMR): show the
      // resolved grid, skip any pending presentation, and let the store
      // route the round forward — visuals are skipped, accounting isn't.
      const store = useGameStore.getState();
      if (store.lastOutcome) scene.setGrid(store.lastOutcome.symbols);
      if (store.gameState.type === 'evaluating' && store.presentation.kind === 'none') {
        store.reelsStopped();
      } else if (store.presentation.kind !== 'none') {
        store.presentationDone();
      }
    };

    void boot();

    return () => {
      const wasReady = status === 'ready';
      status = 'disposed';
      motionRef.current?.kill();
      motionRef.current = null;
      freeSpinDelayRef.current?.kill();
      freeSpinDelayRef.current = null;
      sceneRef.current = null;
      if (wasReady) scene.dispose();
    };
  }, []);

  // A new spin resolved: animate the reels to the outcome.
  useEffect(() => {
    if (spinId === 0) return;
    const scene = sceneRef.current;
    const { lastOutcome, turbo: turboNow, reelsStopped } = useGameStore.getState();
    if (!scene || !lastOutcome) return;

    motionRef.current?.kill();
    scene.winLines.clear();
    scene.overlay.reset();
    motionRef.current = playSpin({
      reels: scene.reels,
      finalGrid: lastOutcome.symbols,
      anticipation: computeAnticipation(lastOutcome.symbols),
      turbo: turboNow,
      onComplete: () => {
        motionRef.current = null;
        reelsStopped();
      },
    });
  }, [spinId]);

  // Presentation beats: wins, free-spins intro/outro, feature auto-spin.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const store = useGameStore.getState();
    const done = () => {
      motionRef.current = null;
      useGameStore.getState().presentationDone();
    };

    switch (presentation.kind) {
      case 'wins': {
        if (!store.lastOutcome) return;
        const gs = store.gameState;
        motionRef.current?.kill();
        motionRef.current = playWinPresentation({
          scene,
          outcome: store.lastOutcome,
          bet: gs.type === 'idle' ? store.bet : gs.bet,
          inFeature: gs.type !== 'idle' && gs.freeSpins !== null,
          turbo: store.turbo,
          onComplete: done,
        });
        break;
      }
      case 'fs-intro': {
        motionRef.current?.kill();
        motionRef.current = playFreeSpinsIntro({
          scene,
          spins: presentation.spins,
          multiplier: presentation.multiplier,
          turbo: store.turbo,
          onComplete: done,
        });
        break;
      }
      case 'fs-outro': {
        motionRef.current?.kill();
        motionRef.current = playFreeSpinsOutro({
          scene,
          totalWin: presentation.totalWin,
          spins: presentation.spins,
          turbo: store.turbo,
          onComplete: done,
        });
        break;
      }
      case 'none': {
        // Feature loop between beats: schedule the next free spin.
        if (inFreeSpinsMode) {
          freeSpinDelayRef.current = gsap.delayedCall(
            store.turbo ? FREE_SPIN_GAP_TURBO : FREE_SPIN_GAP,
            () => useGameStore.getState().spinFreeSpin()
          );
        }
        break;
      }
    }

    return () => {
      freeSpinDelayRef.current?.kill();
      freeSpinDelayRef.current = null;
    };
  }, [presentation, inFreeSpinsMode]);

  useEffect(() => {
    if (stopRequest > 0) motionRef.current?.skip();
  }, [stopRequest]);

  useEffect(() => {
    motionRef.current?.setTurbo(turbo);
  }, [turbo]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}
