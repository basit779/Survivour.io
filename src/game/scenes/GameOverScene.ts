// Run results overlay: banks gold + updates bests on enter, shows the summary,
// and offers Retry / Menu. Renders over the frozen battlefield (RunScene beneath).
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import type { World } from '../World'
import type { RunScene } from './RunScene'
import { MainMenuScene } from './MainMenuScene'
import { PAL } from '../../data/palette'
import { sfx } from '../../engine/audio/Sfx'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export class GameOverScene implements Scene {
  private retryRect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  private menuRect: Rect = { x: 0, y: 0, w: 0, h: 0 }

  constructor(
    private ctx: AppCtx,
    private world: World,
    private run: RunScene,
  ) {}

  enter(): void {
    this.ctx.engine.timeScale = 1
    const r = this.world.run
    this.ctx.save.recordRun(r.elapsed, r.kills, r.gold)
  }

  fixedUpdate(): void {
    // static overlay
  }

  render(r: Renderer, _alpha: number): void {
    this.ctx.input.update()
    this.layout(r)
    this.handleInput()
    this.draw(r)
  }

  private layout(r: Renderer): void {
    const W = r.viewW
    const H = r.viewH
    const bw = Math.min(W * 0.38, 200)
    const bh = 52
    const gap = 16
    const y = H * 0.7
    this.retryRect = { x: W / 2 - bw - gap / 2, y, w: bw, h: bh }
    this.menuRect = { x: W / 2 + gap / 2, y, w: bw, h: bh }
  }

  private handleInput(): void {
    if (this.ctx.input.consumeRestart() || this.ctx.input.consumeConfirm()) {
      this.doRetry()
      return
    }
    if (this.ctx.input.consumePause()) {
      this.doMenu()
      return
    }
    if (this.ctx.input.consumeTap()) {
      const tx = this.ctx.input.tapX
      const ty = this.ctx.input.tapY
      if (hit(this.retryRect, tx, ty)) this.doRetry()
      else if (hit(this.menuRect, tx, ty)) this.doMenu()
    }
  }

  private doRetry(): void {
    sfx.uiTap()
    this.ctx.scenes.pop()
    this.run.restart()
  }

  private doMenu(): void {
    sfx.uiTap()
    this.ctx.scenes.replaceAll(new MainMenuScene(this.ctx))
  }

  private draw(r: Renderer): void {
    const g = r.ctx
    const W = r.viewW
    const H = r.viewH
    const run = this.world.run
    const win = run.state === 'win'

    g.fillStyle = 'rgba(5,6,10,0.82)'
    g.fillRect(0, 0, W, H)

    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = win ? PAL.uiAccent : PAL.uiWarn
    g.font = '900 40px system-ui, sans-serif'
    g.fillText(win ? 'YOU SURVIVED!' : 'YOU DIED', W / 2, H * 0.3)

    g.fillStyle = PAL.uiText
    g.font = '600 17px system-ui, sans-serif'
    const cy = H * 0.45
    g.fillText(`Time  ${fmtTime(run.elapsed)}`, W / 2, cy)
    g.fillText(`Kills  ${run.kills}`, W / 2, cy + 28)
    g.fillStyle = PAL.gold
    g.fillText(`◆ ${run.gold} banked`, W / 2, cy + 56)

    button(g, this.retryRect, 'RETRY', PAL.uiAccent)
    button(g, this.menuRect, 'MENU', PAL.uiDim)
  }
}

function hit(rc: Rect, x: number, y: number): boolean {
  return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h
}

function button(g: CanvasRenderingContext2D, rc: Rect, label: string, accent: string): void {
  g.fillStyle = 'rgba(20,26,44,0.96)'
  rrect(g, rc.x, rc.y, rc.w, rc.h, 10)
  g.fill()
  g.strokeStyle = accent
  g.lineWidth = 2
  rrect(g, rc.x, rc.y, rc.w, rc.h, 10)
  g.stroke()
  g.fillStyle = accent
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 18px system-ui, sans-serif'
  g.fillText(label, rc.x + rc.w / 2, rc.y + rc.h / 2)
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

function fmtTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}
