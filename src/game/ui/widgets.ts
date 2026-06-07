// Shared canvas UI helpers — Survivor.io bold style: chunky rounded slate panels
// with thick dark borders, filled buttons with top gloss + white outlined labels,
// and gold ribbon banners for headers.
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

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Slate panel with thick dark border + subtle top highlight. */
export function panel(g: CanvasRenderingContext2D, rc: Rect, accent: string, filled = false): void {
  // drop shadow
  g.fillStyle = 'rgba(0,0,0,0.35)'
  rrect(g, rc.x + 2, rc.y + 4, rc.w, rc.h, 14)
  g.fill()
  g.fillStyle = filled ? accent : PAL.uiPanel
  rrect(g, rc.x, rc.y, rc.w, rc.h, 14)
  g.fill()
  // top gloss
  g.fillStyle = 'rgba(255,255,255,0.07)'
  rrect(g, rc.x + 3, rc.y + 3, rc.w - 6, rc.h * 0.4, 11)
  g.fill()
  // thick border
  g.lineWidth = 3
  g.strokeStyle = PAL.uiPanelBorder
  rrect(g, rc.x, rc.y, rc.w, rc.h, 14)
  g.stroke()
}

/** Chunky filled button. `accent` is the fill; label auto-contrasts + is outlined. */
export function button(g: CanvasRenderingContext2D, rc: Rect, label: string, accent: string, enabled = true): void {
  g.globalAlpha = enabled ? 1 : 0.45
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.4)'
  rrect(g, rc.x + 2, rc.y + 5, rc.w, rc.h, 14)
  g.fill()
  // base (darker accent for a 3D lip)
  g.fillStyle = shade(accent, -0.35)
  rrect(g, rc.x, rc.y, rc.w, rc.h, 14)
  g.fill()
  // face
  g.fillStyle = accent
  rrect(g, rc.x, rc.y, rc.w, rc.h - 5, 13)
  g.fill()
  // gloss
  g.fillStyle = 'rgba(255,255,255,0.22)'
  rrect(g, rc.x + 4, rc.y + 3, rc.w - 8, rc.h * 0.36, 9)
  g.fill()
  // border
  g.lineWidth = 3
  g.strokeStyle = PAL.uiPanelBorder
  rrect(g, rc.x, rc.y, rc.w, rc.h, 14)
  g.stroke()
  // label
  const labelColor = luminance(accent) > 0.62 ? PAL.outline : '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '800 17px system-ui, sans-serif'
  if (labelColor === '#ffffff') {
    g.lineJoin = 'round'
    g.lineWidth = 3.5
    g.strokeStyle = PAL.outline
    g.strokeText(label, rc.x + rc.w / 2, rc.y + rc.h / 2 - 2)
  }
  g.fillStyle = labelColor
  g.fillText(label, rc.x + rc.w / 2, rc.y + rc.h / 2 - 2)
  g.globalAlpha = 1
}

export function text(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string = PAL.uiText, weight = 600, align: CanvasTextAlign = 'left', outline = false): void {
  g.textAlign = align
  g.textBaseline = 'middle'
  g.font = `${weight} ${size}px system-ui, sans-serif`
  if (outline) {
    g.lineJoin = 'round'
    g.lineWidth = Math.max(2, size * 0.2)
    g.strokeStyle = PAL.outline
    g.strokeText(str, x, y)
  }
  g.fillStyle = color
  g.fillText(str, x, y)
}

/** Gold ribbon banner header with notched ends + white outlined label. */
export function ribbon(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, label: string): void {
  const h = 38
  const x = cx - w / 2
  const y = cy - h / 2
  const notch = 12
  // shadow
  g.fillStyle = 'rgba(0,0,0,0.35)'
  ribbonPath(g, x + 2, y + 4, w, h, notch); g.fill()
  // body
  g.fillStyle = PAL.uiGold
  ribbonPath(g, x, y, w, h, notch); g.fill()
  g.lineWidth = 3
  g.strokeStyle = PAL.uiGoldDark
  ribbonPath(g, x, y, w, h, notch); g.stroke()
  // gloss
  g.fillStyle = 'rgba(255,255,255,0.25)'
  ribbonPath(g, x + 4, y + 3, w - 8, h * 0.4, notch); g.fill()
  text(g, label, cx, cy, 18, '#ffffff', 900, 'center', true)
}

function ribbonPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, notch: number): void {
  g.beginPath()
  g.moveTo(x + notch, y)
  g.lineTo(x + w - notch, y)
  g.lineTo(x + w, y + h / 2)
  g.lineTo(x + w - notch, y + h)
  g.lineTo(x + notch, y + h)
  g.lineTo(x, y + h / 2)
  g.closePath()
}

function shade(hex: string, f: number): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return hex
  let r = parseInt(h.slice(0, 2), 16)
  let g = parseInt(h.slice(2, 4), 16)
  let b = parseInt(h.slice(4, 6), 16)
  if (f >= 0) {
    r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f
  } else {
    const k = 1 + f; r *= k; g *= k; b *= k
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}
