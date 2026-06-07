// Floating on-screen joystick. Touch (or click-drag) anywhere: the base appears
// where the finger lands and the knob follows. Past the deadzone the player
// moves at full speed (digital feel, matching the genre). Screen-space pixels.
import { len } from '../engine/math'

const MAX_RADIUS = 70 // px from base to full deflection
const DEADZONE = 0.18

export class VirtualJoystick {
  active = false
  baseX = 0
  baseY = 0
  knobX = 0
  knobY = 0
  dirX = 0
  dirY = 0
  mag = 0 // 0..1, for drawing

  private pointerId = -1

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', this.onDown, { passive: false })
    el.addEventListener('pointermove', this.onMove, { passive: false })
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onUp)
    el.addEventListener('pointerleave', this.onUp)
  }

  private onDown = (e: PointerEvent): void => {
    if (this.active) return
    e.preventDefault()
    this.pointerId = e.pointerId
    this.active = true
    this.baseX = this.knobX = e.clientX
    this.baseY = this.knobY = e.clientY
    this.dirX = 0
    this.dirY = 0
    this.mag = 0
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return
    e.preventDefault()
    let dx = e.clientX - this.baseX
    let dy = e.clientY - this.baseY
    const l = len(dx, dy)
    if (l > MAX_RADIUS) {
      // re-center the base toward the knob so the stick "follows" the finger
      this.baseX = e.clientX - (dx / l) * MAX_RADIUS
      this.baseY = e.clientY - (dy / l) * MAX_RADIUS
      dx = e.clientX - this.baseX
      dy = e.clientY - this.baseY
    }
    this.knobX = e.clientX
    this.knobY = e.clientY
    const nl = len(dx, dy)
    this.mag = Math.min(nl / MAX_RADIUS, 1)
    if (nl > 1e-3 && this.mag >= DEADZONE) {
      this.dirX = dx / nl
      this.dirY = dy / nl
    } else {
      this.dirX = 0
      this.dirY = 0
    }
  }

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return
    this.active = false
    this.pointerId = -1
    this.dirX = 0
    this.dirY = 0
    this.mag = 0
  }

  get engaged(): boolean {
    return this.active && (this.dirX !== 0 || this.dirY !== 0)
  }
}
