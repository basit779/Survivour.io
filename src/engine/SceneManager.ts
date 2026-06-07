// Stack-based scene machine. Overlays (level-up, pause) push on top of the run
// scene, which keeps rendering beneath them. Only the top scene receives
// fixedUpdate; all scenes in the stack render bottom-to-top.
import type { Scene } from './Scene'
import type { Renderer } from './Renderer'

export class SceneManager {
  private stack: Scene[] = []

  push(scene: Scene): void {
    this.stack.push(scene)
    scene.enter?.()
  }

  pop(): void {
    const scene = this.stack.pop()
    scene?.exit?.()
  }

  replace(scene: Scene): void {
    this.pop()
    this.push(scene)
  }

  /** Clear the entire stack and start fresh with one scene. */
  replaceAll(scene: Scene): void {
    while (this.stack.length) this.pop()
    this.push(scene)
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1]
  }

  fixedUpdate(dt: number): void {
    this.top?.fixedUpdate(dt)
  }

  render(r: Renderer, alpha: number): void {
    for (let i = 0; i < this.stack.length; i++) {
      this.stack[i].render(r, alpha)
    }
  }
}
