import gsap from 'gsap';
import type { Symbol } from '@slots/engine';
import type { ReelView } from '../pixi/scene';

/**
 * Spin choreography. Each reel scrolls a fixed number of cells: a short
 * accelerating ramp, a constant-speed run, then a deceleration that lands
 * exactly on the engine's final symbols, finished with a settle bounce.
 * Reels run longer left to right, giving the classic staggered stop.
 *
 * One GSAP timeline owns the whole spin, so:
 *   turbo      = timeline.timeScale(...)
 *   quick-stop = timeline.progress(1)
 */
const SPEED = 22; // cells per second during the constant-speed run
const RAMP_CELLS = 2;
const LAND_CELLS = 4;
const BASE_CELLS = 18;
const STAGGER_CELLS = 7; // extra cells per reel → later stop
const TURBO_TIME_SCALE = 2.5;

export interface SpinHandle {
  quickStop: () => void;
  setTurbo: (on: boolean) => void;
  kill: () => void;
}

export interface SpinOptions {
  reels: ReelView[];
  /** Final visible grid, [reel][row], from the resolved SpinOutcome. */
  finalGrid: readonly (readonly Symbol[])[];
  turbo: boolean;
  onComplete: () => void;
}

export function playSpin(options: SpinOptions): SpinHandle {
  const tl = gsap.timeline({ onComplete: options.onComplete });

  options.reels.forEach((reel, i) => {
    const total = BASE_CELLS + i * STAGGER_CELLS;
    reel.beginSpin(options.finalGrid[i]!, total);

    const scroll = { cells: 0 };
    const apply = () => reel.setScroll(scroll.cells);

    const sub = gsap.timeline();
    sub
      .to(scroll, {
        cells: RAMP_CELLS,
        duration: (RAMP_CELLS / SPEED) * 2,
        ease: 'power2.in',
        onUpdate: apply,
      })
      .to(scroll, {
        cells: total - LAND_CELLS,
        duration: (total - LAND_CELLS - RAMP_CELLS) / SPEED,
        ease: 'none',
        onUpdate: apply,
      })
      // power2.out's initial slope is 3× its average speed, which matches
      // SPEED when covering LAND_CELLS in 3×(LAND_CELLS/SPEED) — no jerk
      // at the handoff from the constant-speed run.
      .to(scroll, {
        cells: total,
        duration: (LAND_CELLS / SPEED) * 3,
        ease: 'power2.out',
        onUpdate: apply,
      })
      .to(reel.inner, { y: () => reel.cellSize * 0.08, duration: 0.08, ease: 'power1.out' })
      .to(reel.inner, { y: 0, duration: 0.25, ease: 'back.out(2.5)' });

    tl.add(sub, 0);
  });

  tl.timeScale(options.turbo ? TURBO_TIME_SCALE : 1);

  return {
    quickStop: () => {
      tl.progress(1, false); // jump to end, firing updates/completion
      for (const reel of options.reels) reel.finishSpin(); // idempotent safety
    },
    setTurbo: (on: boolean) => {
      tl.timeScale(on ? TURBO_TIME_SCALE : 1);
    },
    kill: () => tl.kill(),
  };
}
