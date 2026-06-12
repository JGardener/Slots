import gsap from 'gsap';
import { PAYLINES, Symbol } from '@slots/engine';
import type { SpinOutcome } from '@slots/engine';
import type { SlotScene } from '../pixi/scene';
import { TURBO_TIME_SCALE, type MotionHandle } from './types';

/**
 * Win presentation choreography, all in one timeline so skip and turbo
 * stay one-liners:
 *
 *   1. Flash every winning payline at once, then cycle them one by one,
 *      pulsing the paying symbols on the highlighted line.
 *   2. In parallel, the rollup counts the win up on the overlay. Tier
 *      thresholds (× total bet) escalate the celebration: dim + title
 *      ("WIN" / "BIG WIN" / "MEGA WIN"), longer rollups, longer holds.
 *   3. Scatters pulse when a feature (re)triggers, with a sub-line tease.
 *
 * Every tween ends back at its resting value (yoyo pulses, explicit
 * fade-outs, final reset), so progress(1) leaves the scene clean.
 */
export type WinTier = 'small' | 'win' | 'big' | 'mega';

/** Celebration thresholds in multiples of total bet. */
export const TIER_THRESHOLDS = { win: 5, big: 25, mega: 100 } as const;

export function winTier(totalWin: number, bet: number): WinTier {
  if (totalWin >= bet * TIER_THRESHOLDS.mega) return 'mega';
  if (totalWin >= bet * TIER_THRESHOLDS.big) return 'big';
  if (totalWin >= bet * TIER_THRESHOLDS.win) return 'win';
  return 'small';
}

const TIER_CONFIG: Record<WinTier, { dim: number; title: string; rollup: number; hold: number }> = {
  small: { dim: 0, title: '', rollup: 0.6, hold: 0.4 },
  win: { dim: 0.35, title: 'WIN', rollup: 0.9, hold: 0.6 },
  big: { dim: 0.55, title: 'BIG WIN', rollup: 1.8, hold: 0.9 },
  mega: { dim: 0.65, title: 'MEGA WIN', rollup: 2.6, hold: 1.2 },
};

const LINE_FLASH_HOLD = 0.55; // all-lines beat before cycling
const LINE_BEAT = 0.78; // per-line highlight duration
const PULSE = { scale: 1.16, duration: 0.3 };

export interface WinPresentationOptions {
  scene: SlotScene;
  outcome: SpinOutcome;
  /** Total bet of the round — tier thresholds are bet multiples. */
  bet: number;
  /** True during free spins: a trigger then reads as a retrigger. */
  inFeature: boolean;
  turbo: boolean;
  onComplete: () => void;
}

export function playWinPresentation(options: WinPresentationOptions): MotionHandle {
  const { scene, outcome } = options;
  const { winLines, overlay } = scene;
  overlay.reset();

  const tl = gsap.timeline({ onComplete: options.onComplete });
  let t = 0;

  // ── 1. Payline flash + cycle ──────────────────────────────────────────
  if (outcome.wins.length > 0) {
    tl.call(() => winLines.draw(outcome.wins, scene.getCellSize(), null), undefined, 0);
    tl.fromTo(winLines.graphics, { alpha: 0 }, { alpha: 1, duration: 0.2 }, 0);
    t = LINE_FLASH_HOLD;

    outcome.wins.forEach((win, i) => {
      tl.call(() => winLines.draw(outcome.wins, scene.getCellSize(), i), undefined, t);
      const line = PAYLINES[win.paylineIndex]!;
      for (let reel = 0; reel < win.count; reel++) {
        const holder = scene.getSymbolHolder(reel, line[reel]!);
        tl.to(
          holder.scale,
          { x: `*=${PULSE.scale}`, y: `*=${PULSE.scale}`, duration: PULSE.duration, ease: 'sine.inOut', yoyo: true, repeat: 1 },
          t
        );
      }
      t += LINE_BEAT;
    });

    tl.to(winLines.graphics, { alpha: 0, duration: 0.25 }, t);
    t += 0.25;
  }
  tl.call(() => winLines.clear(), undefined, t);

  // ── 2. Scatter pulses on a feature (re)trigger ────────────────────────
  if (outcome.triggeredFreeSpins) {
    outcome.symbols.forEach((column, reel) => {
      column.forEach((symbol, row) => {
        if (symbol !== Symbol.Scatter) return;
        const holder = scene.getSymbolHolder(reel, row);
        tl.to(
          holder.scale,
          { x: '*=1.25', y: '*=1.25', duration: 0.32, ease: 'sine.inOut', yoyo: true, repeat: 3 },
          0.2
        );
      });
    });
  }

  // ── 3. Rollup + tier celebration (parallel with the line cycle) ───────
  if (outcome.totalWin > 0) {
    const config = TIER_CONFIG[winTier(outcome.totalWin, options.bet)];
    const celebration = gsap.timeline();

    if (config.dim > 0) celebration.to(overlay.dim, { alpha: config.dim, duration: 0.25 }, 0);
    if (config.title) {
      celebration.call(() => void (overlay.title.text = config.title), undefined, 0);
      celebration.fromTo(overlay.title, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0);
      celebration.fromTo(
        overlay.title.scale,
        { x: 0.4, y: 0.4 },
        { x: 1, y: 1, duration: 0.5, ease: 'back.out(2)' },
        0
      );
    }

    const counter = { value: 0 };
    const render = () => void (overlay.amount.text = `+${Math.round(counter.value).toLocaleString()}`);
    celebration.call(render, undefined, 0);
    celebration.fromTo(overlay.amount, { alpha: 0 }, { alpha: 1, duration: 0.2 }, 0.1);
    celebration.to(counter, { value: outcome.totalWin, duration: config.rollup, ease: 'power1.out', onUpdate: render }, 0.15);

    if (outcome.triggeredFreeSpins) {
      const tease = options.inFeature ? `+${outcome.freeSpinsCount} FREE SPINS` : 'FREE SPINS!';
      celebration.call(() => void (overlay.sub.text = tease), undefined, 0.3);
      celebration.fromTo(overlay.sub, { alpha: 0 }, { alpha: 1, duration: 0.3 }, 0.3);
    }

    const fadeAt = 0.15 + config.rollup + config.hold;
    celebration.to([overlay.title, overlay.amount, overlay.sub], { alpha: 0, duration: 0.3 }, fadeAt);
    celebration.to(overlay.dim, { alpha: 0, duration: 0.3 }, fadeAt);

    tl.add(celebration, outcome.wins.length > 0 ? 0.35 : 0.1);
  }

  tl.call(() => overlay.reset());
  tl.timeScale(options.turbo ? TURBO_TIME_SCALE : 1);

  return {
    skip: () => tl.progress(1, false),
    setTurbo: (on: boolean) => {
      tl.timeScale(on ? TURBO_TIME_SCALE : 1);
    },
    kill: () => tl.kill(),
  };
}
