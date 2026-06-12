/**
 * Common contract for every GSAP-driven sequence (spin, win presentation,
 * feature transitions). One motion authority means these three operations
 * cover all playback control:
 *   skip     → timeline.progress(1)  (quick-stop / skip presentation)
 *   setTurbo → timeline.timeScale(...)
 *   kill     → discard without completing (unmount/teardown)
 */
export interface MotionHandle {
  skip: () => void;
  setTurbo: (on: boolean) => void;
  kill: () => void;
}

export const TURBO_TIME_SCALE = 2.5;
