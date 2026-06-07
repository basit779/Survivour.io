// Permanent-upgrade shop: spend banked gold on stat upgrades. Tap a row to buy
// the next rank. Persists immediately.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { MainMenuScene } from './MainMenuScene'
import { META_UPGRADES, metaCost } from '../../data/meta'
import { PAL } from '../../data/palette'
import { sfx } from '../../engine/audio/Sfx'
import { Rect, hit, panel, button, text } from '../ui/widgets'

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
    const top = 96
    const rowH = 60
    const gap = 10
    const w = Math.min(W * 0.9, 460)
    const x = (W - w) / 2
    this.rows = META_UPGRADES.map((_, i) => ({ x, y: top + i * (rowH + gap), w, h: rowH }))
    this.back = { x: W / 2 - 70, y: top + META_UPGRADES.length * (rowH + gap) + 12, w: 140, h: 46 }
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

    text(g, 'UPGRADES', W / 2, 44, 28, PAL.uiAccent, 800, 'center')
    text(g, `◆ ${this.ctx.save.data.totalGold}`, W / 2, 72, 16, PAL.gold, 700, 'center')

    for (let i = 0; i < META_UPGRADES.length; i++) {
      const def = META_UPGRADES[i]
      const rc = this.rows[i]
      const rank = this.ctx.save.data.metaUpgrades[def.id] ?? 0
      const maxed = rank >= def.maxRank
      const cost = metaCost(def, rank)
      const afford = this.ctx.save.data.totalGold >= cost
      panel(g, rc, maxed ? PAL.uiDim : afford ? PAL.uiAccent : PAL.uiWarn)
      text(g, def.name, rc.x + 16, rc.y + 20, 17, PAL.uiText, 800)
      text(g, def.desc, rc.x + 16, rc.y + 42, 13, PAL.uiDim, 500)
      // rank pips
      text(g, `${rank}/${def.maxRank}`, rc.x + rc.w - 70, rc.y + 20, 14, PAL.uiText, 700, 'right')
      text(g, maxed ? 'MAX' : `◆ ${cost}`, rc.x + rc.w - 16, rc.y + 42, 14, maxed ? PAL.uiDim : afford ? PAL.gold : PAL.uiWarn, 700, 'right')
    }

    button(g, this.back, 'BACK', PAL.uiAccent)
  }
}
