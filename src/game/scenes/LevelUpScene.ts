// Level-up overlay: freezes the battlefield (timeScale 0) and presents upgrade
// cards. Pick via tap or number keys. Pops itself when chosen; if more level-ups
// are queued, RunScene immediately pushes a fresh one.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import type { World } from '../World'
import type { Choice } from '../../data/schema'
import { PAL, RARITY } from '../../data/palette'
import type { RarityKey } from '../../data/palette'
import { generateChoices, applyChoice } from '../systems/upgrades'
import { sfx } from '../../engine/audio/Sfx'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export class LevelUpScene implements Scene {
  private choices: Choice[]
  private rects: Rect[] = []

  constructor(
    private ctx: AppCtx,
    private world: World,
  ) {
    this.choices = generateChoices(world)
  }

  enter(): void {
    this.ctx.engine.timeScale = 0
  }

  fixedUpdate(): void {
    // overlay is static; battlefield is frozen via timeScale 0
  }

  render(r: Renderer, _alpha: number): void {
    this.layout(r)
    this.handleInput()
    this.draw(r)
  }

  private layout(r: Renderer): void {
    const W = r.viewW
    const H = r.viewH
    const cardW = Math.min(W * 0.86, 440)
    const cardH = 88
    const gap = 16
    const total = this.choices.length * cardH + (this.choices.length - 1) * gap
    const startY = (H - total) / 2 + 20
    const x = (W - cardW) / 2
    this.rects.length = 0
    for (let i = 0; i < this.choices.length; i++) {
      this.rects.push({ x, y: startY + i * (cardH + gap), w: cardW, h: cardH })
    }
  }

  private handleInput(): void {
    const pick = this.ctx.input.consumePick()
    if (pick >= 1 && pick <= this.choices.length) {
      this.select(pick - 1)
      return
    }
    if (this.ctx.input.consumeTap()) {
      const tx = this.ctx.input.tapX
      const ty = this.ctx.input.tapY
      for (let i = 0; i < this.rects.length; i++) {
        const rc = this.rects[i]
        if (tx >= rc.x && tx <= rc.x + rc.w && ty >= rc.y && ty <= rc.y + rc.h) {
          this.select(i)
          return
        }
      }
    }
  }

  private select(i: number): void {
    sfx.uiTap()
    applyChoice(this.world, this.choices[i])
    this.world.run.pendingLevels = Math.max(0, this.world.run.pendingLevels - 1)
    this.ctx.scenes.pop()
    if (this.world.run.pendingLevels <= 0) this.ctx.engine.timeScale = 1
  }

  private draw(r: Renderer): void {
    const g = r.ctx
    const W = r.viewW
    const H = r.viewH

    g.fillStyle = 'rgba(5,6,10,0.78)'
    g.fillRect(0, 0, W, H)

    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = PAL.uiAccent
    g.font = '800 30px system-ui, sans-serif'
    g.fillText('LEVEL UP', W / 2, this.rects.length ? this.rects[0].y - 44 : H / 2 - 120)

    for (let i = 0; i < this.choices.length; i++) {
      this.drawCard(g, this.rects[i], this.choices[i], i + 1)
    }
  }

  private drawCard(g: CanvasRenderingContext2D, rc: Rect, c: Choice, num: number): void {
    const accent = RARITY[(c.rarity as RarityKey) in RARITY ? (c.rarity as RarityKey) : 'common']
    // panel
    g.fillStyle = 'rgba(20,26,44,0.96)'
    rrect(g, rc.x, rc.y, rc.w, rc.h, 12)
    g.fill()
    // rarity edge
    g.fillStyle = accent
    rrect(g, rc.x, rc.y, 6, rc.h, 3)
    g.fill()
    // border
    g.strokeStyle = accent
    g.lineWidth = 1.5
    g.globalAlpha = 0.8
    rrect(g, rc.x, rc.y, rc.w, rc.h, 12)
    g.stroke()
    g.globalAlpha = 1

    const padX = rc.x + 22
    // number chip
    g.fillStyle = accent
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.font = '700 12px system-ui, sans-serif'
    g.fillText(`${num}`, rc.x + 12, rc.y + 8)

    // title
    g.fillStyle = PAL.uiText
    g.font = '800 19px system-ui, sans-serif'
    g.fillText(c.name, padX, rc.y + 16)

    // tag (NEW / Lv)
    const tag = c.kind === 'newWeapon' || c.kind === 'newPassive' ? 'NEW!' : c.kind === 'fallback' ? '' : `Lv ${c.toLevel}`
    if (tag) {
      g.fillStyle = accent
      g.font = '700 13px system-ui, sans-serif'
      g.textAlign = 'right'
      g.fillText(tag, rc.x + rc.w - 16, rc.y + 18)
      g.textAlign = 'left'
    }

    // description
    g.fillStyle = PAL.uiDim
    g.font = '500 14px system-ui, sans-serif'
    g.fillText(c.desc, padX, rc.y + 50)
  }
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
