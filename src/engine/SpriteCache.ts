// Bakes all programmatic art to offscreen canvases ONCE at boot, so the hot
// render loop is just drawImage blits (fast on mobile). Produces detailed
// monster/zombie creatures, a survivor, a textured wasteland ground tile, and
// glow sprites. Structured so a real PNG can replace any baked canvas later.
import { ENEMIES } from '../data/enemies'
import type { EnemyDef } from '../data/schema'

type Canvas = HTMLCanvasElement

function mkCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

// --- color helpers ---
function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
function rgb(r: number, g: number, b: number): string {
  return `rgb(${r | 0},${g | 0},${b | 0})`
}
function shade(hex: string, f: number): string {
  const [r, g, b] = parse(hex)
  if (f >= 0) return rgb(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
  const k = 1 + f
  return rgb(r * k, g * k, b * k)
}

interface EnemySprite {
  color: Canvas
  white: Canvas
}

class SpriteCacheImpl {
  ready = false
  ground: Canvas | null = null
  groundPattern: CanvasPattern | null = null
  player: Canvas | null = null
  private enemies: Record<string, EnemySprite> = {}

  init(): void {
    if (this.ready) return
    try {
      this.ground = this.bakeGround(256)
      this.player = this.bakePlayer()
      for (const id in ENEMIES) this.enemies[id] = this.bakeEnemy(ENEMIES[id])
      this.ready = true
    } catch {
      this.ready = false
    }
  }

  enemy(id: string): EnemySprite | undefined {
    return this.enemies[id]
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------
  private bakeGround(P: number): Canvas {
    const c = mkCanvas(P, P)
    const g = c.getContext('2d')!
    // base
    g.fillStyle = '#0a0e18'
    g.fillRect(0, 0, P, P)
    // subtle plates
    g.strokeStyle = 'rgba(40,55,90,0.25)'
    g.lineWidth = 2
    for (let i = 0; i <= P; i += 64) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, P)
      g.moveTo(0, i)
      g.lineTo(P, i)
      g.stroke()
    }
    // speckle noise (low contrast so seams hide)
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * P
      const y = Math.random() * P
      const v = Math.random()
      g.fillStyle = v > 0.5 ? 'rgba(60,75,110,0.10)' : 'rgba(0,0,0,0.18)'
      g.fillRect(x, y, 2, 2)
    }
    // a few cracks / scorch
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.3)'
      g.lineWidth = 1 + Math.random() * 1.5
      g.beginPath()
      let x = Math.random() * P
      let y = Math.random() * P
      g.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 40
        y += (Math.random() - 0.5) * 40
        g.lineTo(x, y)
      }
      g.stroke()
    }
    return c
  }

  // -------------------------------------------------------------------------
  // Player (survivor)
  // -------------------------------------------------------------------------
  private bakePlayer(): Canvas {
    const P = 96
    const c = mkCanvas(P, P)
    const g = c.getContext('2d')!
    const cx = P / 2
    const cy = P / 2
    const R = P * 0.3
    // outer glow ring
    const glow = g.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.7)
    glow.addColorStop(0, 'rgba(63,224,255,0.5)')
    glow.addColorStop(1, 'rgba(63,224,255,0)')
    g.fillStyle = glow
    g.beginPath()
    g.arc(cx, cy, R * 1.7, 0, Math.PI * 2)
    g.fill()
    // body
    const body = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R)
    body.addColorStop(0, '#eafcff')
    body.addColorStop(0.5, '#3fe0ff')
    body.addColorStop(1, '#1170b8')
    g.fillStyle = body
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#0a3a5c'
    g.lineWidth = P * 0.03
    g.stroke()
    // visor
    g.fillStyle = '#0b2030'
    g.beginPath()
    g.ellipse(cx, cy - R * 0.1, R * 0.55, R * 0.32, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#bff6ff'
    g.beginPath()
    g.ellipse(cx - R * 0.15, cy - R * 0.15, R * 0.18, R * 0.1, -0.4, 0, Math.PI * 2)
    g.fill()
    return c
  }

  // -------------------------------------------------------------------------
  // Enemies (monster/zombie creatures)
  // -------------------------------------------------------------------------
  private bakeEnemy(def: EnemyDef): EnemySprite {
    const P = Math.max(96, Math.min(320, Math.round(def.radius * 8)))
    const c = mkCanvas(P, P)
    const g = c.getContext('2d')!
    this.drawCreature(g, P, def)
    return { color: c, white: this.whiten(c) }
  }

  private whiten(src: Canvas): Canvas {
    const c = mkCanvas(src.width, src.height)
    const g = c.getContext('2d')!
    g.drawImage(src, 0, 0)
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
    return c
  }

  private drawCreature(g: CanvasRenderingContext2D, P: number, def: EnemyDef): void {
    const cx = P / 2
    const cy = P / 2 + P * 0.04
    const R = P * 0.34
    const col = def.color
    const eye = def.glow
    const outline = shade(col, -0.55)
    const style = def.behavior

    // soft drop glow
    const glow = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.5)
    glow.addColorStop(0, this.alpha(eye, 0.25))
    glow.addColorStop(1, this.alpha(eye, 0))
    g.fillStyle = glow
    g.beginPath()
    g.arc(cx, cy, R * 1.5, 0, Math.PI * 2)
    g.fill()

    // body shape per archetype
    let bw = R
    let bh = R * 1.05
    if (style === 'fast') {
      bw = R * 0.78
      bh = R * 1.2
    } else if (style === 'tank' || style === 'boss') {
      bw = R * 1.25
      bh = R * 1.1
    }

    // arms (behind body)
    g.fillStyle = shade(col, -0.2)
    g.strokeStyle = outline
    g.lineWidth = P * 0.025
    for (const sgn of [-1, 1]) {
      g.beginPath()
      g.ellipse(cx + sgn * bw * 0.95, cy + bh * 0.15, bw * 0.32, bh * 0.5, sgn * 0.5, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }

    // body
    const bg = g.createRadialGradient(cx - bw * 0.3, cy - bh * 0.35, bw * 0.2, cx, cy, bh)
    bg.addColorStop(0, shade(col, 0.28))
    bg.addColorStop(0.6, col)
    bg.addColorStop(1, shade(col, -0.35))
    g.fillStyle = bg
    g.beginPath()
    g.ellipse(cx, cy, bw, bh, 0, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = P * 0.03
    g.strokeStyle = outline
    g.stroke()

    // belly seam / scars
    g.strokeStyle = shade(col, -0.45)
    g.lineWidth = P * 0.015
    g.beginPath()
    g.moveTo(cx, cy - bh * 0.5)
    g.lineTo(cx, cy + bh * 0.6)
    g.stroke()

    // head
    const hy = cy - bh * 0.75
    const hr = bw * (style === 'tank' || style === 'boss' ? 0.55 : 0.62)
    const hg = g.createRadialGradient(cx - hr * 0.3, hy - hr * 0.3, hr * 0.2, cx, hy, hr)
    hg.addColorStop(0, shade(col, 0.35))
    hg.addColorStop(1, shade(col, -0.2))
    g.fillStyle = hg
    g.beginPath()
    g.arc(cx, hy, hr, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = P * 0.025
    g.strokeStyle = outline
    g.stroke()

    // horns for boss/elite
    if (style === 'boss' || def.id === 'elite_brute') {
      g.fillStyle = shade(col, -0.3)
      for (const sgn of [-1, 1]) {
        g.beginPath()
        g.moveTo(cx + sgn * hr * 0.7, hy - hr * 0.5)
        g.lineTo(cx + sgn * hr * 1.4, hy - hr * 1.5)
        g.lineTo(cx + sgn * hr * 0.95, hy - hr * 0.35)
        g.closePath()
        g.fill()
        g.stroke()
      }
    }

    // glowing eyes
    const ey = hy - hr * 0.05
    const ex = hr * 0.42
    const er = hr * (style === 'boss' ? 0.3 : 0.24)
    for (const sgn of [-1, 1]) {
      const eg = g.createRadialGradient(cx + sgn * ex, ey, 0, cx + sgn * ex, ey, er * 2)
      eg.addColorStop(0, '#ffffff')
      eg.addColorStop(0.4, eye)
      eg.addColorStop(1, this.alpha(eye, 0))
      g.fillStyle = eg
      g.beginPath()
      g.arc(cx + sgn * ex, ey, er * 2, 0, Math.PI * 2)
      g.fill()
    }

    // mouth for spitter/boss
    if (style === 'ranged' || style === 'boss') {
      g.fillStyle = shade(col, -0.6)
      g.beginPath()
      g.ellipse(cx, hy + hr * 0.45, hr * 0.5, hr * 0.28, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = eye
      for (let i = -1; i <= 1; i++) {
        g.beginPath()
        g.moveTo(cx + i * hr * 0.25, hy + hr * 0.3)
        g.lineTo(cx + i * hr * 0.25 + hr * 0.08, hy + hr * 0.55)
        g.lineTo(cx + i * hr * 0.25 - hr * 0.08, hy + hr * 0.55)
        g.fill()
      }
    }
  }

  private alpha(hex: string, a: number): string {
    const [r, g, b] = parse(hex)
    return `rgba(${r},${g},${b},${a})`
  }
}

export const sprites = new SpriteCacheImpl()
