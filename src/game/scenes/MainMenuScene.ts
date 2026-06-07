// Title screen: animated neon backdrop, best-stats + banked gold, tap to play.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { Time } from '../../engine/Time'
import { PAL } from '../../data/palette'
import { RunScene } from './RunScene'

export class MainMenuScene implements Scene {
  constructor(private ctx: AppCtx) {}

  fixedUpdate(): void {
    // static menu
  }

  render(r: Renderer, _alpha: number): void {
    this.ctx.input.update()
    if (this.ctx.input.consumeTap() || this.ctx.input.consumeConfirm()) {
      this.play()
      return
    }

    const g = r.ctx
    const W = r.viewW
    const H = r.viewH
    r.clear(PAL.bg)
    r.beginScreen()

    // drifting grid backdrop
    const cell = 46
    const off = (Time.frame * 0.4) % cell
    g.strokeStyle = PAL.bgGrid
    g.lineWidth = 1
    g.beginPath()
    for (let x = -off; x <= W; x += cell) {
      g.moveTo(x, 0)
      g.lineTo(x, H)
    }
    for (let y = -off; y <= H; y += cell) {
      g.moveTo(0, y)
      g.lineTo(W, y)
    }
    g.stroke()

    // title glow orb
    const cx = W / 2
    const oy = H * 0.32
    const grad = g.createRadialGradient(cx, oy, 0, cx, oy, 120)
    grad.addColorStop(0, 'rgba(63,224,255,0.35)')
    grad.addColorStop(1, 'rgba(63,224,255,0)')
    g.fillStyle = grad
    g.fillRect(cx - 140, oy - 140, 280, 280)

    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = PAL.uiText
    g.font = '900 40px system-ui, sans-serif'
    g.fillText('SURVIVOR ZERO', cx, oy)
    g.fillStyle = PAL.uiDim
    g.font = '500 14px system-ui, sans-serif'
    g.fillText('endless neon horde survival', cx, oy + 34)

    // best stats + banked gold
    const s = this.ctx.save.data
    g.fillStyle = PAL.uiText
    g.font = '600 15px system-ui, sans-serif'
    g.fillText(`Best: ${fmtTime(s.bestTime)}  ·  ${s.bestKills} kills`, cx, H * 0.56)
    g.fillStyle = PAL.gold
    g.fillText(`◆ ${s.totalGold} banked`, cx, H * 0.56 + 26)

    // pulsing prompt
    const pulse = 0.55 + 0.45 * Math.sin(Time.frame * 0.07)
    g.globalAlpha = pulse
    g.fillStyle = PAL.uiAccent
    g.font = '800 22px system-ui, sans-serif'
    g.fillText('TAP TO PLAY', cx, H * 0.74)
    g.globalAlpha = 1
  }

  private play(): void {
    this.ctx.engine.timeScale = 1
    this.ctx.scenes.replaceAll(new RunScene(this.ctx))
  }
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}
