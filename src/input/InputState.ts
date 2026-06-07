// The flat, read-only movement/action state systems consume each tick.
export interface InputState {
  /** Normalized move direction (already deadzoned). */
  moveX: number
  moveY: number
  /** 0 or 1 (digital "full speed past deadzone" feel). */
  moveMag: number
  pointerDown: boolean
}
