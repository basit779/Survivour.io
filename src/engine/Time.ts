// Shared frame-timing state, written by the Engine each frame and read by
// scenes/renderer (e.g. for the debug FPS readout and render interpolation).
import { C } from '../data/balance'

export const Time = {
  /** Interpolation factor 0..1 between the previous and current sim tick. */
  alpha: 0,
  fixedDt: C.FIXED_DT,
  /** Smoothed frames-per-second for the debug overlay. */
  fps: 60,
  /** Total frames rendered. */
  frame: 0,
}
