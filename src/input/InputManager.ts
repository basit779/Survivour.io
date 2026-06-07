// Merges the joystick and keyboard into one InputState each frame. Movement uses
// "last active source wins" (joystick takes over while engaged, else keyboard).
// Action edges (pause/restart/confirm) are latched and consumed once per frame.
import type { InputState } from './InputState'
import { VirtualJoystick } from './VirtualJoystick'
import { Keyboard } from './Keyboard'
import { normalizeInto, scratch } from '../engine/math'

export class InputManager implements InputState {
  moveX = 0
  moveY = 0
  moveMag = 0
  pointerDown = false

  readonly joystick: VirtualJoystick
  readonly keyboard: Keyboard

  constructor(el: HTMLElement) {
    this.joystick = new VirtualJoystick(el)
    this.keyboard = new Keyboard()
  }

  /** Recompute the merged movement vector. Call once per render frame. */
  update(): void {
    if (this.joystick.engaged) {
      this.moveX = this.joystick.dirX
      this.moveY = this.joystick.dirY
      this.moveMag = 1
    } else {
      const len = normalizeInto(this.keyboard.moveX, this.keyboard.moveY, scratch)
      this.moveX = scratch.x
      this.moveY = scratch.y
      this.moveMag = len > 0 ? 1 : 0
    }
    this.pointerDown = this.joystick.active
  }

  consumePause(): boolean {
    const e = this.keyboard.pauseEdge
    this.keyboard.pauseEdge = false
    return e
  }
  consumeRestart(): boolean {
    const e = this.keyboard.restartEdge
    this.keyboard.restartEdge = false
    return e
  }
  consumeConfirm(): boolean {
    const e = this.keyboard.confirmEdge
    this.keyboard.confirmEdge = false
    return e
  }
}
