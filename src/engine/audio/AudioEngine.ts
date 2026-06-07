// WebAudio engine — 100% synthesized, zero audio files. Lazy-inits on the first
// user gesture (mobile autoplay policy). All sfx route through a rate limiter +
// voice cap so the horde can't blow out the mix. No-ops safely when audio is
// unavailable (e.g. headless tests) so callers never need to guard.

type Bus = 'sfx' | 'music'

export class AudioEngine {
  ctx: AudioContext | null = null
  ready = false
  muted = false

  private master!: GainNode
  private sfxBus!: GainNode
  private musicBus!: GainNode
  private noiseBuffer: AudioBuffer | null = null
  private voices = 0
  private lastPlay: Record<string, number> = {}

  /** Create the audio graph. Call from a user-gesture handler. */
  init(): void {
    if (this.ready) return
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = 0.85
      this.master.connect(ctx.destination)
      this.sfxBus = ctx.createGain()
      this.sfxBus.gain.value = 0.9
      this.sfxBus.connect(this.master)
      this.musicBus = ctx.createGain()
      this.musicBus.gain.value = 0.4
      this.musicBus.connect(this.master)

      // shared 1s white-noise buffer
      const len = ctx.sampleRate
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buf

      this.ready = true
    } catch {
      this.ready = false
    }
  }

  resume(): void {
    this.ctx?.resume().catch(() => {})
  }
  suspend(): void {
    this.ctx?.suspend().catch(() => {})
  }
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }
  toggleMute(): void {
    this.muted = !this.muted
    if (this.ready) this.master.gain.value = this.muted ? 0 : 0.85
  }

  private busNode(bus: Bus): GainNode {
    return bus === 'music' ? this.musicBus : this.sfxBus
  }

  /** Rate limiter: true if `name` hasn't played within `minGap` seconds. */
  canPlay(name: string, minGap: number): boolean {
    if (!this.ready) return false
    const t = this.now()
    const last = this.lastPlay[name] ?? -1
    if (t - last < minGap) return false
    this.lastPlay[name] = t
    return true
  }

  /** One oscillator voice with an attack/decay envelope, optional pitch glide. */
  voice(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; attack?: number; when?: number; glideTo?: number; bus?: Bus } = {},
  ): void {
    if (!this.ready || !this.ctx || this.voices > 18) return
    const ctx = this.ctx
    const t = opts.when ?? ctx.currentTime
    const gain = opts.gain ?? 0.25
    const attack = opts.attack ?? 0.005
    const osc = ctx.createOscillator()
    osc.type = opts.type ?? 'square'
    osc.frequency.setValueAtTime(freq, t)
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.glideTo), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.busNode(opts.bus ?? 'sfx'))
    osc.start(t)
    osc.stop(t + dur + 0.02)
    this.voices++
    osc.onended = () => {
      this.voices--
      g.disconnect()
    }
  }

  /** Filtered noise burst (impacts, explosions, hats). */
  noise(dur: number, opts: { gain?: number; filter?: number; type?: BiquadFilterType; when?: number } = {}): void {
    if (!this.ready || !this.ctx || !this.noiseBuffer || this.voices > 18) return
    const ctx = this.ctx
    const t = opts.when ?? ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = opts.type ?? 'lowpass'
    filter.frequency.value = opts.filter ?? 1200
    const g = ctx.createGain()
    g.gain.setValueAtTime(opts.gain ?? 0.25, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxBus)
    src.start(t)
    src.stop(t + dur)
    this.voices++
    src.onended = () => {
      this.voices--
      g.disconnect()
    }
  }
}

export const audio = new AudioEngine()
