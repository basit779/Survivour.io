// The beating heart: a fixed-timestep accumulator loop with render
// interpolation. Gameplay always advances in C.FIXED_DT steps (deterministic,
// tunnel-free); rendering happens once per animation frame with an interpolation
// factor. timeScale gates simulation time (0 = pause / used for hitstop & the
// level-up freeze) without stopping rendering.
import { C } from '../data/balance'
import { Time } from './Time'
import type { Renderer } from './Renderer'
import type { SceneManager } from './SceneManager'

export class Engine {
  timeScale = 1
  private acc = 0
  private prev = 0
  private running = false
  private fpsAccum = 0
  private fpsFrames = 0

  constructor(
    private renderer: Renderer,
    private scenes: SceneManager,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.prev = performance.now() / 1000
    requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
  }

  private frame = (nowMs: number): void => {
    if (!this.running) return
    requestAnimationFrame(this.frame)

    const now = nowMs / 1000
    let frameDt = now - this.prev
    this.prev = now
    if (frameDt > C.MAX_FRAME_DT) frameDt = C.MAX_FRAME_DT

    // FPS tracking (smoothed once per ~0.5s)
    this.fpsAccum += frameDt
    this.fpsFrames++
    if (this.fpsAccum >= 0.5) {
      Time.fps = Math.round(this.fpsFrames / this.fpsAccum)
      this.fpsAccum = 0
      this.fpsFrames = 0
    }

    this.acc += frameDt * this.timeScale

    let steps = 0
    while (this.acc >= C.FIXED_DT && steps < C.MAX_STEPS) {
      this.scenes.fixedUpdate(C.FIXED_DT)
      this.acc -= C.FIXED_DT
      steps++
    }
    if (steps === C.MAX_STEPS) this.acc = 0 // shed accumulated debt after a stall

    Time.alpha = this.timeScale > 0 ? this.acc / C.FIXED_DT : 0
    Time.frame++
    this.scenes.render(this.renderer, Time.alpha)
  }
}
