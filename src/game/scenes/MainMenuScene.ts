// Title screen: animated neon backdrop, best stats + banked gold, selected hero,
// and PLAY / UPGRADES / HEROES buttons.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { Time } from '../../engine/Time'
import { PAL } from '../../data/palette'
import { sprites } from '../../engine/SpriteCache'
import { operatorOf } from '../../data/operators'
import { sfx } from '../../engine/audio/Sfx'
import { Rect, hit, button, text, ribbon, fmtTime } from '../ui/widgets'
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
    r.beginScreen()

    // sky->ground vertical gradient backdrop
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#2c3140')
    bg.addColorStop(0.55, '#262a33')
    bg.addColorStop(1, PAL.groundDark)
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)
    // drifting dot field
    const cell = 40
    const off = (Time.frame * 0.3) % cell
    g.fillStyle = 'rgba(255,255,255,0.04)'
    for (let y = -off; y <= H; y += cell) {
      for (let x = -off; x <= W; x += cell) {
        g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill()
      }
    }

    const cx = W / 2
    const oy = H * 0.2

    // title: gold "SURVIVOR" + ".io"-style tag
    text(g, 'SURVIVOR', cx, oy, 46, PAL.uiGold, 900, 'center', true)
    text(g, 'ZERO', cx, oy + 40, 30, '#ffffff', 900, 'center', true)

    // hero mascot
    if (sprites.player) {
      const bob = Math.sin(Time.frame * 0.05) * 6
      const size = Math.min(W * 0.5, 200)
      g.drawImage(sprites.player, cx - size / 2, H * 0.32 + bob, size, size)
    }

    const s = this.ctx.save.data
    text(g, `Best ${fmtTime(s.bestTime)} · ${s.bestKills} kills`, cx, H * 0.54, 15, PAL.uiText, 700, 'center', true)
    ribbon(g, cx, H * 0.585, 180, `${s.totalGold} GOLD`)
    text(g, `Hero: ${operatorOf(s.selectedOperator).name}`, cx, H * 0.585 + 34, 14, PAL.uiDim, 600, 'center')

    const pulse = 0.85 + 0.15 * Math.sin(Time.frame * 0.07)
    g.globalAlpha = pulse
    button(g, this.playBtn, 'PLAY', PAL.uiGood)
    g.globalAlpha = 1
    button(g, this.shopBtn, 'GEAR', PAL.uiAccent)
    button(g, this.heroBtn, 'HEROES', PAL.uiGold)
  }
}
