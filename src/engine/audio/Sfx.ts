// Named sound effects, all synthesized. Hot-path sounds (shoot/hit/kill/pickup)
// are rate-limited inside the engine so the swarm can't spam the mix.
import { audio } from './AudioEngine'

export const sfx = {
  shoot(): void {
    if (!audio.canPlay('shoot', 0.05)) return
    audio.voice(680, 0.07, { type: 'square', gain: 0.1, glideTo: 420 })
  },
  hit(): void {
    if (!audio.canPlay('hit', 0.03)) return
    audio.voice(200, 0.05, { type: 'triangle', gain: 0.09 })
  },
  crit(): void {
    if (!audio.canPlay('crit', 0.06)) return
    audio.voice(900, 0.1, { type: 'sawtooth', gain: 0.12, glideTo: 320 })
  },
  enemyDie(): void {
    if (!audio.canPlay('die', 0.04)) return
    audio.noise(0.12, { gain: 0.12, filter: 1400 })
  },
  explode(): void {
    if (!audio.canPlay('explode', 0.05)) return
    audio.noise(0.32, { gain: 0.34, filter: 700 })
    audio.voice(120, 0.3, { type: 'sawtooth', gain: 0.2, glideTo: 50 })
  },
  pickup(): void {
    if (!audio.canPlay('pickup', 0.035)) return
    audio.voice(880, 0.05, { type: 'sine', gain: 0.07, glideTo: 1100 })
  },
  hurt(): void {
    if (!audio.canPlay('hurt', 0.12)) return
    audio.noise(0.2, { gain: 0.22, filter: 500 })
    audio.voice(130, 0.18, { type: 'sawtooth', gain: 0.16, glideTo: 70 })
  },
  levelUp(): void {
    // ascending arpeggio
    const t = audio.now()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    for (let i = 0; i < notes.length; i++) {
      audio.voice(notes[i], 0.18, { type: 'triangle', gain: 0.16, when: t + i * 0.06 })
    }
  },
  bossSpawn(): void {
    const t = audio.now()
    audio.voice(90, 1.1, { type: 'sawtooth', gain: 0.3, glideTo: 40, when: t })
    audio.noise(0.8, { gain: 0.25, filter: 400, when: t })
  },
  bossDie(): void {
    const t = audio.now()
    audio.noise(0.7, { gain: 0.4, filter: 900, when: t })
    audio.voice(220, 0.7, { type: 'sawtooth', gain: 0.25, glideTo: 50, when: t })
    audio.voice(330, 0.5, { type: 'triangle', gain: 0.18, when: t + 0.1 })
  },
  uiTap(): void {
    if (!audio.canPlay('ui', 0.04)) return
    audio.voice(520, 0.05, { type: 'square', gain: 0.1, glideTo: 640 })
  },
}
