// Tiny shared canvas UI helpers for menus/shop/character select.
import { PAL } from '../../data/palette'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function hit(rc: Rect, x: number, y: number): boolean {
  return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h
}

export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function panel(g: CanvasRenderingContext2D, rc: Rect, accent: string, filled = false): void {
  g.fillStyle = filled ? accent : 'rgba(20,26,44,0.96)'
  rrect(g, rc.x, rc.y, rc.w, rc.h, 10)
  g.fill()
  g.strokeStyle = accent
  g.lineWidth = 2
  g.globalAlpha = filled ? 1 : 0.85
  rrect(g, rc.x, rc.y, rc.w, rc.h, 10)
  g.stroke()
  g.globalAlpha = 1
}

export function button(g: CanvasRenderingContext2D, rc: Rect, label: string, accent: string, enabled = true): void {
  g.globalAlpha = enabled ? 1 : 0.4
  panel(g, rc, accent)
  g.fillStyle = accent
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 16px system-ui, sans-serif'
  g.fillText(label, rc.x + rc.w / 2, rc.y + rc.h / 2)
  g.globalAlpha = 1
}

export function text(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string = PAL.uiText, weight = 600, align: CanvasTextAlign = 'left'): void {
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = 'middle'
  g.font = `${weight} ${size}px system-ui, sans-serif`
  g.fillText(str, x, y)
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}
