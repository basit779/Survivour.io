// Title screen: animated neon backdrop, best stats + banked gold, selected hero,
// and PLAY / UPGRADES / HEROES buttons.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { Time } from '../../engine/Time'
import { PAL } from '../../data/palette'
import { operatorOf } from '../../data/operators'
import { sfx } from '../../engine/audio/Sfx'
import { Rect, hit, button, text, fmtTime } from '../ui/widgets'
import { RunScene } from './RunScene'
import { MetaShopScene } from './MetaShopScene'
import { CharacterSelectScene } from './CharacterSelectScene'

export class MainMenuScene implements Scene {
  private playBtn: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private shopBtn: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private heroBtn: Rect = { x: 0, y: 0, w: 0, h: 0 }

  constructor(private ctx: AppCtx) {}

  fixedUpdate(): void {}

  render(r: Renderer, _alpha: number): void {
    this.ctx.input.update()
    this.layout(r)
    this.handleInput()
    this.draw(r)
  }

  private layout(r: Renderer): void {
    const W = r.viewW
    const H = r.viewH
    const w = Math.min(W * 0.7, 320)
    const x = (W - w) / 2
    this.playBtn = { x, y: H * 0.62, w, h: 62 }
    const halfW = (w - 12) / 2
    this.shopBtn = { x, y: H * 0.62 + 74, w: halfW, h: 50 }
    this.heroBtn = { x: x + halfW + 12, y: H * 0.62 + 74, w: halfW, h: 50 }
  }

  private handleInput(): void {
    if (this.ctx.input.consumeConfirm()) {
      this.play()
      return
    }
    if (!this.ctx.input.consumeTap()) return
    const tx = this.ctx.input.tapX
    const ty = this.ctx.input.tapY
    if (hit(this.playBtn, tx, ty)) this.play()
    else if (hit(this.shopBtn, tx, ty)) this.openShop()
    else if (hit(this.heroBtn, tx, ty)) this.openHeroes()
  }

  private play(): void {
    sfx.uiTap()
    this.ctx.engine.timeScale = 1
    this.ctx.scenes.replaceAll(new RunScene(this.ctx))
  }
  private openShop(): void {
    sfx.uiTap()
    this.ctx.scenes.replaceAll(new MetaShopScene(this.ctx))
  }
  private openHeroes(): void {
    sfx.uiTap()
    this.ctx.scenes.replaceAll(new CharacterSelectScene(this.ctx))
  }

  private draw(r: Renderer): void {
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

    // glow orb behind title
    const cx = W / 2
    const oy = H * 0.26
    const grad = g.createRadialGradient(cx, oy, 0, cx, oy, 130)
    grad.addColorStop(0, 'rgba(63,224,255,0.32)')
    grad.addColorStop(1, 'rgba(63,224,255,0)')
    g.fillStyle = grad
    g.fillRect(cx - 150, oy - 150, 300, 300)

    text(g, 'SURVIVOR ZERO', cx, oy, 40, PAL.uiText, 900, 'center')
    text(g, 'endless neon horde survival', cx, oy + 32, 14, PAL.uiDim, 500, 'center')

    const s = this.ctx.save.data
    text(g, `Best ${fmtTime(s.bestTime)} · ${s.bestKills} kills`, cx, H * 0.46, 15, PAL.uiText, 600, 'center')
    text(g, `◆ ${s.totalGold} banked`, cx, H * 0.46 + 24, 15, PAL.gold, 700, 'center')
    text(g, `Hero: ${operatorOf(s.selectedOperator).name}`, cx, H * 0.46 + 48, 14, PAL.uiAccent, 600, 'center')

    const pulse = 0.7 + 0.3 * Math.sin(Time.frame * 0.07)
    g.globalAlpha = pulse
    button(g, this.playBtn, 'PLAY', PAL.uiAccent)
    g.globalAlpha = 1
    button(g, this.shopBtn, 'UPGRADES', PAL.uiText)
    button(g, this.heroBtn, 'HEROES', PAL.uiText)
  }
}
