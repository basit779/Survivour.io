// Permanent-upgrade shop: spend banked gold on stat upgrades. Tap a row to buy
// the next rank. Persists immediately.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { MainMenuScene } from './MainMenuScene'
import { META_UPGRADES, metaCost, gearTier } from '../../data/meta'
import { PAL } from '../../data/palette'
import { sfx } from '../../engine/audio/Sfx'
import { Rect, hit, button, text, rrect } from '../ui/widgets'

export class MetaShopScene implements Scene {
  private rows: Rect[] = []
  private back: Rect = { x: 0, y: 0, w: 0, h: 0 }

  constructor(private ctx: AppCtx) {}

  fixedUpdate(): void {}

  render(r: Renderer): void {
    this.ctx.input.update()
    this.layout(r)
    this.handleInput()
    this.draw(r)
  }

  private layout(r: Renderer): void {
    const W = r.viewW
    const top = 100
    const rowH = 60
    const gap = 10
    const w = Math.min(W * 0.9, 460)
    const x = (W - w) / 2
    this.rows = META_UPGRADES.map((_, i) => ({ x, y: top + i * (rowH + gap), w, h: rowH }))
    this.back = { x: 12, y: 12, w: 96, h: 42 }
  }

  private handleInput(): void {
    if (this.ctx.input.consumePause()) {
      this.goBack()
      return
    }
    if (!this.ctx.input.consumeTap()) return
    const tx = this.ctx.input.tapX
    const ty = this.ctx.input.tapY
    if (hit(this.back, tx, ty)) {
      this.goBack()
      return
    }
    for (let i = 0; i < this.rows.length; i++) {
      if (hit(this.rows[i], tx, ty)) this.buy(i)
    }
  }

  private buy(i: number): void {
    const def = META_UPGRADES[i]
    const save = this.ctx.save.data
    const rank = save.metaUpgrades[def.id] ?? 0
    if (rank >= def.maxRank) return
    const cost = metaCost(def, rank)
    if (save.totalGold < cost) return
    save.totalGold -= cost
    save.metaUpgrades[def.id] = rank + 1
    this.ctx.save.save()
    sfx.uiTap()
  }

  private goBack(): void {
    sfx.uiTap()
    this.ctx.scenes.replaceAll(new MainMenuScene(this.ctx))
  }

  private draw(r: Renderer): void {
    const g = r.ctx
    const W = r.viewW
    r.clear(PAL.bg)
    r.beginScreen()

    button(g, this.back, '‹ BACK', PAL.uiAccent)
    text(g, 'GEAR', W / 2, 32, 26, PAL.uiAccent, 800, 'center', true)
    text(g, `◆ ${this.ctx.save.data.totalGold}`, W / 2, 70, 16, PAL.gold, 700, 'center', true)

    for (let i = 0; i < META_UPGRADES.length; i++) {
      const def = META_UPGRADES[i]
      const rc = this.rows[i]
      const rank = this.ctx.save.data.metaUpgrades[def.id] ?? 0
      const maxed = rank >= def.maxRank
      const cost = metaCost(def, rank)
      const afford = this.ctx.save.data.totalGold >= cost
      const tier = gearTier(rank)

      // card
      g.fillStyle = 'rgba(0,0,0,0.4)'
      rrect(g, rc.x + 2, rc.y + 4, rc.w, rc.h, 12); g.fill()
      g.fillStyle = PAL.uiPanel
      rrect(g, rc.x, rc.y, rc.w, rc.h, 12); g.fill()
      g.lineWidth = 3
      g.strokeStyle = tier.color
      rrect(g, rc.x, rc.y, rc.w, rc.h, 12); g.stroke()

      // rarity-tinted icon tile with the slot initial
      const s = rc.h - 16
      const ix = rc.x + 8
      const iy = rc.y + 8
      g.fillStyle = PAL.uiPanelLight
      rrect(g, ix, iy, s, s, 9); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = tier.color
      rrect(g, ix, iy, s, s, 9); g.stroke()
      text(g, def.name.slice(0, 1), ix + s / 2, iy + s / 2, 22, tier.color, 900, 'center', true)

      const tx = ix + s + 14
      text(g, def.name, tx, rc.y + 20, 17, '#ffffff', 800)
      text(g, def.desc, tx, rc.y + 42, 12.5, PAL.uiDim, 500)
      // tier label + cost (right side)
      text(g, maxed ? 'MAX TIER' : `${tier.name} · ${rank}/${def.maxRank}`, rc.x + rc.w - 14, rc.y + 20, 13, tier.color, 800, 'right')
      text(g, maxed ? '★' : `◆ ${cost}`, rc.x + rc.w - 14, rc.y + 44, 15, maxed ? PAL.uiGold : afford ? PAL.gold : PAL.uiWarn, 800, 'right')
    }
  }
}
