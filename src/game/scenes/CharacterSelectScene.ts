// Operator (character) select: pick an unlocked operator, or unlock one with
// banked gold. Each has a distinct starting weapon + permanent mods.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { MainMenuScene } from './MainMenuScene'
import { OPERATOR_IDS, OPERATORS } from '../../data/operators'
import { PAL } from '../../data/palette'
import { sfx } from '../../engine/audio/Sfx'
import { Rect, hit, panel, button, text } from '../ui/widgets'

export class CharacterSelectScene implements Scene {
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
    const rowH = 66
    const gap = 10
    const w = Math.min(W * 0.9, 460)
    const x = (W - w) / 2
    this.rows = OPERATOR_IDS.map((_, i) => ({ x, y: top + i * (rowH + gap), w, h: rowH }))
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
      if (hit(this.rows[i], tx, ty)) this.pick(OPERATOR_IDS[i])
    }
  }

  private pick(id: string): void {
    const save = this.ctx.save.data
    if (save.operatorsUnlocked.includes(id)) {
      save.selectedOperator = id
      this.ctx.save.save()
      sfx.uiTap()
      return
    }
    // unlock
    const cost = OPERATORS[id].unlockCost
    if (save.totalGold >= cost) {
      save.totalGold -= cost
      save.operatorsUnlocked.push(id)
      save.selectedOperator = id
      this.ctx.save.save()
      sfx.levelUp()
    }
  }

  private goBack(): void {
    sfx.uiTap()
    this.ctx.scenes.replaceAll(new MainMenuScene(this.ctx))
  }

  private draw(r: Renderer): void {
    const g = r.ctx
    const W = r.viewW
    const save = this.ctx.save.data
    r.clear(PAL.bg)
    r.beginScreen()

    button(g, this.back, '‹ BACK', PAL.uiAccent)
    text(g, 'HEROES', W / 2, 32, 26, PAL.uiAccent, 800, 'center', true)
    text(g, `◆ ${save.totalGold}`, W / 2, 70, 16, PAL.gold, 700, 'center', true)

    for (let i = 0; i < OPERATOR_IDS.length; i++) {
      const id = OPERATOR_IDS[i]
      const op = OPERATORS[id]
      const rc = this.rows[i]
      const unlocked = save.operatorsUnlocked.includes(id)
      const selected = save.selectedOperator === id
      const accent = selected ? PAL.uiAccent : unlocked ? PAL.uiText : PAL.uiWarn
      panel(g, rc, accent, selected)
      const tColor = selected ? PAL.bg : PAL.uiText
      text(g, op.name, rc.x + 16, rc.y + 22, 18, tColor, 800)
      text(g, op.desc, rc.x + 16, rc.y + 45, 12.5, selected ? PAL.bg : PAL.uiDim, 500)
      const tag = selected ? 'SELECTED' : unlocked ? 'SELECT' : `◆ ${op.unlockCost}`
      text(g, tag, rc.x + rc.w - 16, rc.y + rc.h / 2, 14, selected ? PAL.bg : unlocked ? PAL.uiAccent : PAL.gold, 700, 'right')
    }
  }
}
