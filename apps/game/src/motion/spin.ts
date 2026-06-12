import gsap from 'gsap';
import type { Symbol } from '@slots/engine';
import type { ReelView } from '../pixi/scene';
import { TURBO_TIME_SCALE, type MotionHandle } from './types';

/**
 * Spin choreography. Each reel scrolls a fixed number of cells: a short
 * accelerating ramp, a constant-speed run, then a deceleration that lands
 * exactly on the engine's final symbols, finished with a settle bounce.
 * Reels run longer left to right, giving the classic staggered stop.
 *
 * Scatter anticipation: when a reel could complete the free-spins trigger
 * (two scatters already visible to its left), it brakes hard and crawls
 * the last cells before landing — the tension beat players expect. Later
 * reels pad their run so the stop order is always left to right.
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
const MIN_STAGGER = STAGGER_CELLS / SPEED; // minimum gap between reel stops

// Anticipation tail: brake from full speed, crawl, then a short landing.
const ANT_BRAKE_CELLS = 2;
const ANT_BRAKE_DURATION = 0.27;
const ANT_CRAWL_CELLS = 3;
const ANT_CRAWL_DURATION = 1.0;
const ANT_LAND_CELLS = 1;
const ANT_LAND_DURATION = 0.5;

interface Segment {
  cells: number;
  duration: number;
  ease: string;
}

/** Scroll segments after the constant-speed run. */
function tailSegments(anticipate: boolean): Segment[] {
  if (!anticipate) {
    // power2.out (cubic) initial slope is 3× its average speed, which
    // matches SPEED when covering LAND_CELLS in 3×(LAND_CELLS/SPEED) —
    // no jerk at the handoff from the constant-speed run.
    return [{ cells: LAND_CELLS, duration: (LAND_CELLS / SPEED) * 3, ease: 'power2.out' }];
  }
  return [
    { cells: ANT_BRAKE_CELLS, duration: ANT_BRAKE_DURATION, ease: 'power2.out' },
    { cells: ANT_CRAWL_CELLS, duration: ANT_CRAWL_DURATION, ease: 'sine.inOut' },
    { cells: ANT_LAND_CELLS, duration: ANT_LAND_DURATION, ease: 'power2.out' },
  ];
}

export interface SpinOptions {
  reels: ReelView[];
  /** Final visible grid, [reel][row], from the resolved SpinOutcome. */
  finalGrid: readonly (readonly Symbol[])[];
  /** Per-reel anticipation flags (see features.ts computeAnticipation). */
  anticipation?: readonly boolean[];
  turbo: boolean;
  onComplete: () => void;
}

export function playSpin(options: SpinOptions): MotionHandle {
  const tl = gsap.timeline({ onComplete: options.onComplete });

  let prevStop = 0;
  options.reels.forEach((reel, i) => {
    const anticipate = options.anticipation?.[i] ?? false;
    const ramp: Segment = { cells: RAMP_CELLS, duration: (RAMP_CELLS / SPEED) * 2, ease: 'power2.in' };
    const tail = tailSegments(anticipate);
    const tailCells = tail.reduce((sum, s) => sum + s.cells, 0);
    const tailDuration = tail.reduce((sum, s) => sum + s.duration, 0);

    // Constant-speed run length, padded so this reel stops at least
    // MIN_STAGGER after the previous one (anticipation stretches time,
    // so cell counts alone no longer guarantee the stop order).
    let runCells = Math.max(2, BASE_CELLS + i * STAGGER_CELLS - RAMP_CELLS - tailCells);
    let stopAt = ramp.duration + runCells / SPEED + tailDuration;
    if (i > 0 && stopAt < prevStop + MIN_STAGGER) {
      const padCells = Math.ceil((prevStop + MIN_STAGGER - stopAt) * SPEED);
      runCells += padCells;
      stopAt += padCells / SPEED;
    }
    prevStop = stopAt;

    const segments: Segment[] = [ramp, { cells: runCells, duration: runCells / SPEED, ease: 'none' }, ...tail];
    const total = RAMP_CELLS + runCells + tailCells;
    reel.beginSpin(options.finalGrid[i]!, total);

    const scroll = { cells: 0 };
    const apply = () => reel.setScroll(scroll.cells);

    const sub = gsap.timeline();
    let target = 0;
    for (const seg of segments) {
      target += seg.cells;
      sub.to(scroll, { cells: target, duration: seg.duration, ease: seg.ease, onUpdate: apply });
    }
    sub
      .to(reel.inner, { y: () => reel.cellSize * 0.08, duration: 0.08, ease: 'power1.out' })
      .to(reel.inner, { y: 0, duration: 0.25, ease: 'back.out(2.5)' });

    tl.add(sub, 0);
  });

  tl.timeScale(options.turbo ? TURBO_TIME_SCALE : 1);

  return {
    skip: () => {
      tl.progress(1, false); // jump to end, firing updates/completion
      for (const reel of options.reels) reel.finishSpin(); // idempotent safety
    },
    setTurbo: (on: boolean) => {
      tl.timeScale(on ? TURBO_TIME_SCALE : 1);
    },
    kill: () => tl.kill(),
  };
}
