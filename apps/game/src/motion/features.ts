import gsap from 'gsap';
import { FREE_SPINS, Symbol } from '@slots/engine';
import type { SlotScene } from '../pixi/scene';
import { TURBO_TIME_SCALE, type MotionHandle } from './types';

/**
 * Feature choreography: scatter anticipation flags consumed by the spin
 * timeline, and the free-spins intro/outro banners on the celebration
 * overlay. The math is already resolved when these play — they are pure
 * presentation beats.
 */

/**
 * Per-reel anticipation flags for a resolved spin. A reel anticipates when
 * the reels to its left have landed exactly one scatter short of the
 * trigger — the player can see the feature is live, so the reel crawls.
 */
export function computeAnticipation(grid: readonly (readonly Symbol[])[]): boolean[] {
  const flags: boolean[] = [];
  let scattersSoFar = 0;
  for (const column of grid) {
    flags.push(scattersSoFar === FREE_SPINS.triggerCount - 1);
    scattersSoFar += column.filter((symbol) => symbol === Symbol.Scatter).length;
  }
  return flags;
}

export interface FreeSpinsIntroOptions {
  scene: SlotScene;
  spins: number;
  multiplier: number;
  turbo: boolean;
  onComplete: () => void;
}

export function playFreeSpinsIntro(options: FreeSpinsIntroOptions): MotionHandle {
  const { overlay } = options.scene;
  overlay.reset();

  const tl = gsap.timeline({ onComplete: options.onComplete });

  tl.call(() => {
    overlay.title.text = 'FREE SPINS';
    overlay.amount.text = `${options.spins} SPINS`;
    overlay.sub.text = `ALL WINS ×${options.multiplier}`;
  }, undefined, 0);

  tl.to(overlay.dim, { alpha: 0.6, duration: 0.3 }, 0);
  tl.fromTo(overlay.title, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0.1);
  tl.fromTo(overlay.title.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.55, ease: 'back.out(2)' }, 0.1);
  tl.fromTo(overlay.amount, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0.35);
  tl.fromTo(overlay.sub, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0.5);

  const fadeAt = 2.1;
  tl.to([overlay.title, overlay.amount, overlay.sub], { alpha: 0, duration: 0.35 }, fadeAt);
  tl.to(overlay.dim, { alpha: 0, duration: 0.35 }, fadeAt);
  tl.call(() => overlay.reset());

  return finishHandle(tl, options.turbo);
}

export interface FreeSpinsOutroOptions {
  scene: SlotScene;
  totalWin: number;
  spins: number;
  turbo: boolean;
  onComplete: () => void;
}

export function playFreeSpinsOutro(options: FreeSpinsOutroOptions): MotionHandle {
  const { overlay } = options.scene;
  overlay.reset();

  const tl = gsap.timeline({ onComplete: options.onComplete });

  tl.call(() => {
    overlay.title.text = options.totalWin > 0 ? 'TOTAL WIN' : 'FEATURE COMPLETE';
    overlay.sub.text = `${options.spins} FREE SPINS PLAYED`;
  }, undefined, 0);

  tl.to(overlay.dim, { alpha: 0.6, duration: 0.3 }, 0);
  tl.fromTo(overlay.title, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0.1);
  tl.fromTo(overlay.title.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.55, ease: 'back.out(2)' }, 0.1);

  let fadeAt = 1.6;
  if (options.totalWin > 0) {
    const counter = { value: 0 };
    const render = () => void (overlay.amount.text = `+${Math.round(counter.value).toLocaleString()}`);
    tl.call(render, undefined, 0.3);
    tl.fromTo(overlay.amount, { alpha: 0 }, { alpha: 1, duration: 0.25 }, 0.3);
    tl.to(counter, { value: options.totalWin, duration: 1.6, ease: 'power1.out', onUpdate: render }, 0.35);
    fadeAt = 0.35 + 1.6 + 1.0; // rollup end + hold
  }

  tl.to([overlay.title, overlay.amount, overlay.sub], { alpha: 0, duration: 0.35 }, fadeAt);
  tl.to(overlay.dim, { alpha: 0, duration: 0.35 }, fadeAt);
  tl.call(() => overlay.reset());

  return finishHandle(tl, options.turbo);
}

function finishHandle(tl: gsap.core.Timeline, turbo: boolean): MotionHandle {
  tl.timeScale(turbo ? TURBO_TIME_SCALE : 1);
  return {
    skip: () => tl.progress(1, false),
    setTurbo: (on: boolean) => {
      tl.timeScale(on ? TURBO_TIME_SCALE : 1);
    },
    kill: () => tl.kill(),
  };
}
