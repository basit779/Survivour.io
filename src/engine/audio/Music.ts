// Procedural music: a lookahead step sequencer (~124 BPM, A-minor) layering a
// bass root, a sub pulse, an arp, and a hat. Subtle, loops forever, zero files.
import { audio } from './AudioEngine'

const BPM = 124
const ROOTS = [110, 87.31, 130.81, 98.0] // A2 · F2 · C3 · G2 (one per 4 steps)
const ARP = [220, 261.63, 329.63, 392, 440] // A minor-ish

class MusicGen {
  private timer: number | undefined
  private step = 0
  private nextTime = 0

  start(): void {
    if (!audio.ready || this.timer !== undefined) return
    this.step = 0
    this.nextTime = audio.now() + 0.1
    this.timer = window.setInterval(() => this.tick(), 25)
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private tick(): void {
    if (!audio.ready || !audio.ctx) return
    const eighth = 60 / BPM / 2
    while (this.nextTime < audio.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += eighth
      this.step = (this.step + 1) % 16
    }
  }

  private playStep(step: number, time: number): void {
    const root = ROOTS[Math.floor(step / 4) % ROOTS.length]
    if (step % 4 === 0) audio.voice(root, 0.34, { type: 'triangle', gain: 0.22, when: time, bus: 'music' })
    if (step % 2 === 0) audio.voice(root * 2, 0.12, { type: 'sine', gain: 0.05, when: time, bus: 'music' })
    if (step % 2 === 1) audio.voice(ARP[step % ARP.length], 0.14, { type: 'square', gain: 0.035, when: time, bus: 'music' })
    audio.noise(0.03, { gain: 0.025, filter: 8000, type: 'highpass', when: time })
  }
}

export const music = new MusicGen()
