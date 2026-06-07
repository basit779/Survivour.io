// WASD / arrow-key movement + pause/restart edges for desktop play & testing.
export class Keyboard {
  private keys = new Set<string>()
  pauseEdge = false
  restartEdge = false
  confirmEdge = false
  /** 0 = none; 1..N = a number key was pressed this frame. */
  pickEdge = 0

  constructor() {
    window.addEventListener('keydown', this.onDown)
    window.addEventListener('keyup', this.onUp)
  }

  private onDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase()
    this.keys.add(k)
    if (k === 'escape' || k === 'p') this.pauseEdge = true
    if (k === 'r') this.restartEdge = true
    if (k === 'enter' || k === ' ') this.confirmEdge = true
    if (k >= '1' && k <= '9') this.pickEdge = Number(k)
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault()
  }

  private onUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase())
  }

  get moveX(): number {
    let x = 0
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1
    return x
  }
  get moveY(): number {
    let y = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1
    return y
  }
}
