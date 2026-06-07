// A Scene is one screen/mode of the game (menu, run, level-up overlay, ...).
import type { Renderer } from './Renderer'

export interface Scene {
  /** Called when pushed onto the scene stack. */
  enter?(): void
  /** Called when popped off the stack. */
  exit?(): void
  /** Fixed-timestep gameplay update. dt is always C.FIXED_DT. */
  fixedUpdate(dt: number): void
  /** Render with interpolation factor alpha (0..1). */
  render(r: Renderer, alpha: number): void
}
