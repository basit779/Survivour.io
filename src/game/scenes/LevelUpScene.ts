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
import { ribbon, text } from '../ui/widgets'
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
    const cardH = 96
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

    g.fillStyle = 'rgba(18,20,26,0.82)'
    g.fillRect(0, 0, W, H)

    const headY = this.rects.length ? this.rects[0].y - 46 : H / 2 - 120
    ribbon(g, W / 2, headY, Math.min(W * 0.7, 280), 'SKILL SELECTION')

    for (let i = 0; i < this.choices.length; i++) {
      this.drawCard(g, this.rects[i], this.choices[i], i + 1)
    }
  }

  private drawCard(g: CanvasRenderingContext2D, rc: Rect, c: Choice, num: number): void {
    const accent = RARITY[(c.rarity as RarityKey) in RARITY ? (c.rarity as RarityKey) : 'common']
    const bandH = 30
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.4)'
    rrect(g, rc.x + 2, rc.y + 4, rc.w, rc.h, 14); g.fill()
    // panel
    g.fillStyle = PAL.uiPanel
    rrect(g, rc.x, rc.y, rc.w, rc.h, 14); g.fill()
    // rarity header band (clipped to the rounded top)
    g.save()
    rrect(g, rc.x, rc.y, rc.w, rc.h, 14); g.clip()
    g.fillStyle = accent
    g.fillRect(rc.x, rc.y, rc.w, bandH)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(rc.x, rc.y, rc.w, bandH * 0.42)
    g.restore()
    // thick border
    g.lineWidth = 3
    g.strokeStyle = PAL.uiPanelBorder
    rrect(g, rc.x, rc.y, rc.w, rc.h, 14); g.stroke()

    // icon tile (left)
    const iconR = 26
    const icx = rc.x + 12 + iconR
    const icy = rc.y + bandH + 22
    g.fillStyle = PAL.uiPanelLight
    rrect(g, icx - iconR, icy - iconR, iconR * 2, iconR * 2, 10); g.fill()
    g.lineWidth = 2.5; g.strokeStyle = accent
    rrect(g, icx - iconR, icy - iconR, iconR * 2, iconR * 2, 10); g.stroke()
    text(g, c.name.slice(0, 1).toUpperCase(), icx, icy, 26, '#ffffff', 900, 'center', true)

    const padX = rc.x + 12 + iconR * 2 + 14
    // header band label (rarity + tag)
    const tag = c.kind === 'newWeapon' || c.kind === 'newPassive' ? 'NEW!' : c.kind === 'fallback' ? '' : `Lv ${c.toLevel}`
    const labelColor = c.rarity === 'common' || c.rarity === 'legendary' ? PAL.outline : '#ffffff'
    text(g, c.rarity.toUpperCase(), rc.x + 12, rc.y + bandH / 2, 12, labelColor, 800, 'left')
    if (tag) text(g, tag, rc.x + rc.w - 14, rc.y + bandH / 2, 13, labelColor, 800, 'right')

    // title + description
    text(g, c.name, padX, rc.y + bandH + 14, 18, '#ffffff', 800, 'left', true)
    g.fillStyle = PAL.uiDim
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.font = '500 13px system-ui, sans-serif'
    g.fillText(c.desc, padX, rc.y + bandH + 38)

    // number chip (bottom-right)
    g.fillStyle = accent
    g.beginPath(); g.arc(rc.x + rc.w - 18, rc.y + rc.h - 16, 11, 0, Math.PI * 2); g.fill()
    g.lineWidth = 2; g.strokeStyle = PAL.uiPanelBorder; g.stroke()
    text(g, `${num}`, rc.x + rc.w - 18, rc.y + rc.h - 16, 12, labelColor === PAL.outline ? PAL.outline : '#ffffff', 800, 'center')
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
