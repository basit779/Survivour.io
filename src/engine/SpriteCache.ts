// Bakes all programmatic art to offscreen canvases ONCE at boot, so the hot
// render loop is just drawImage blits. Art direction = Survivor.io-style bright
// chunky cartoon: every sprite has a thick near-black outline AND a white rim
// halo (the signature look), big rounded heads, bold simple shapes.
// See docs/ART_BIBLE.md. Structured so a real PNG can replace any baked canvas.
import { ENEMIES } from '../data/enemies'
import { PAL } from '../data/palette'
import type { EnemyDef } from '../data/schema'

type Canvas = HTMLCanvasElement
type Ctx = CanvasRenderingContext2D
const TAU = Math.PI * 2

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
function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex)
  return `rgba(${r},${g},${b},${a})`
}

interface EnemySprite {
  color: Canvas
  white: Canvas
}

type CreatureKind = 'humanoid' | 'ogre' | 'cyclops' | 'bomb' | 'slime'
interface Look {
  kind: CreatureKind
  body: string
  big?: boolean
  toothy?: boolean
  armored?: boolean
}

function lookFor(def: EnemyDef): Look {
  switch (def.id) {
    case 'spitter':
      return { kind: 'cyclops', body: def.color }
    case 'bomber':
      return { kind: 'bomb', body: def.color }
    case 'splitter':
      return { kind: 'slime', body: def.color, big: true }
    case 'splitling':
      return { kind: 'slime', body: def.color }
    case 'brute':
      return { kind: 'ogre', body: def.color }
    case 'elite_brute':
      return { kind: 'ogre', body: def.color, big: true, armored: true }
    case 'boss_warden':
      return { kind: 'ogre', body: def.color, big: true, toothy: true }
    case 'runner':
      return { kind: 'humanoid', body: def.color }
    default:
      return { kind: 'humanoid', body: def.color }
  }
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
      this.ground = this.bakeGround(512)
      this.player = this.bakeHero()
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
  // Generic helpers
  // -------------------------------------------------------------------------

  /** Bake `draw` to a canvas, then add a white rim halo around the whole shape. */
  private withRim(P: number, draw: (g: Ctx) => void, rim: number): Canvas {
    const art = mkCanvas(P, P)
    draw(art.getContext('2d')!)
    // white silhouette of the art
    const sil = mkCanvas(P, P)
    const sg = sil.getContext('2d')!
    sg.drawImage(art, 0, 0)
    sg.globalCompositeOperation = 'source-in'
    sg.fillStyle = PAL.rim
    sg.fillRect(0, 0, P, P)
    // dilate the silhouette around a ring to build the halo, then art on top
    const out = mkCanvas(P, P)
    const og = out.getContext('2d')!
    const steps = 18
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU
      og.drawImage(sil, Math.cos(a) * rim, Math.sin(a) * rim)
    }
    og.drawImage(art, 0, 0)
    return out
  }

  /** Filled ellipse with a thick near-black outline. */
  private blob(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, ow: number): void {
    g.fillStyle = fill
    g.beginPath()
    g.ellipse(x, y, rx, ry, 0, 0, TAU)
    g.fill()
    g.lineJoin = 'round'
    g.lineWidth = ow
    g.strokeStyle = PAL.outline
    g.stroke()
  }

  private formGrad(g: Ctx, x: number, y: number, r: number, base: string): CanvasGradient {
    const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.15)
    grad.addColorStop(0, shade(base, 0.3))
    grad.addColorStop(0.55, base)
    grad.addColorStop(1, shade(base, -0.28))
    return grad
  }

  /** Cartoon eye: white sclera + dark pupil (offset by look dir) + glint. */
  private eye(g: Ctx, x: number, y: number, r: number, dirY = 0.25, ow = r * 0.4): void {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x, y, r, 0, TAU)
    g.fill()
    g.lineWidth = ow
    g.strokeStyle = PAL.outline
    g.stroke()
    g.fillStyle = PAL.outline
    g.beginPath()
    g.arc(x, y + r * dirY, r * 0.52, 0, TAU)
    g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(x - r * 0.22, y + r * dirY - r * 0.22, r * 0.18, 0, TAU)
    g.fill()
  }

  // -------------------------------------------------------------------------
  // Ground (grey urban asphalt, desaturated so sprites pop)
  // -------------------------------------------------------------------------
  private bakeGround(P: number): Canvas {
    const c = mkCanvas(P, P)
    const g = c.getContext('2d')!
    g.fillStyle = PAL.groundBase
    g.fillRect(0, 0, P, P)
    // big subtle plates with a lit top edge + dark seam
    const cell = 128
    for (let y = 0; y <= P; y += cell) {
      for (let x = 0; x <= P; x += cell) {
        g.fillStyle = (x / cell + y / cell) % 2 === 0 ? alpha('#ffffff', 0.018) : alpha('#000000', 0.05)
        g.fillRect(x, y, cell, cell)
      }
    }
    // expansion-joint seams
    g.strokeStyle = PAL.groundDark
    g.lineWidth = 3
    for (let i = 0; i <= P; i += cell) {
      g.beginPath()
      g.moveTo(i, 0); g.lineTo(i, P)
      g.moveTo(0, i); g.lineTo(P, i)
      g.stroke()
    }
    g.strokeStyle = alpha(PAL.groundLight, 0.5)
    g.lineWidth = 1
    for (let i = 0; i <= P; i += cell) {
      g.beginPath()
      g.moveTo(i + 1, 0); g.lineTo(i + 1, P)
      g.stroke()
    }
    // speckle grit (deterministic-ish via index hash so seams hide)
    for (let i = 0; i < 2600; i++) {
      const x = (i * 73 + (i * i * 13) % 511) % P
      const y = (i * 137 + (i * 7) % 503) % P
      const v = (i * 31) % 100
      g.fillStyle = v > 55 ? alpha('#ffffff', 0.05) : alpha('#000000', 0.07)
      g.fillRect(x, y, 2, 2)
    }
    // a couple of oil stains
    for (let i = 0; i < 4; i++) {
      const x = (i * 211) % P
      const y = (i * 307) % P
      const grad = g.createRadialGradient(x, y, 2, x, y, 46)
      grad.addColorStop(0, alpha('#000000', 0.16))
      grad.addColorStop(1, alpha('#000000', 0))
      g.fillStyle = grad
      g.fillRect(x - 46, y - 46, 92, 92)
    }
    return c
  }

  // -------------------------------------------------------------------------
  // Hero (chunky survivor: blue cap, navy jacket, gun pointing up/forward)
  // -------------------------------------------------------------------------
  private bakeHero(): Canvas {
    const P = 128
    return this.withRim(P, (g) => this.drawHero(g, P), 6)
  }

  private drawHero(g: Ctx, P: number): void {
    const cx = P / 2
    const cy = P * 0.6
    const ow = P * 0.05
    const skin = PAL.heroSkin
    const jacket = PAL.heroJacket

    // legs (small, behind)
    this.blob(g, cx - 12, cy + 26, 9, 11, shade(jacket, -0.25), ow)
    this.blob(g, cx + 12, cy + 26, 9, 11, shade(jacket, -0.25), ow)

    // torso / jacket (compact, so the head dominates — chunky cartoon)
    g.fillStyle = this.formGrad(g, cx, cy + 8, 26, jacket)
    this.roundRectPath(g, cx - 23, cy - 6, 46, 38, 16)
    g.fill()
    g.lineWidth = ow
    g.lineJoin = 'round'
    g.strokeStyle = PAL.outline
    g.stroke()
    // collar + zipper for contrast against the dark jacket
    g.fillStyle = shade(jacket, 0.28)
    this.roundRectPath(g, cx - 12, cy - 8, 24, 9, 5)
    g.fill(); g.lineWidth = ow * 0.7; g.stroke()
    g.strokeStyle = shade(jacket, -0.4)
    g.lineWidth = P * 0.02
    g.beginPath(); g.moveTo(cx, cy - 2); g.lineTo(cx, cy + 28); g.stroke()

    // arms reaching forward to hold the gun
    this.blob(g, cx - 21, cy + 2, 8, 10, jacket, ow)
    this.blob(g, cx + 20, cy, 8, 10, jacket, ow)

    // gun (held across front, barrel pointing up = forward)
    g.save()
    g.translate(cx + 8, cy)
    g.rotate(-0.1)
    g.fillStyle = PAL.heroGun
    g.lineWidth = P * 0.04
    g.lineJoin = 'round'
    g.strokeStyle = PAL.outline
    this.roundRectPath(g, -9, -40, 18, 50, 5)
    g.fill(); g.stroke()
    g.fillStyle = shade(PAL.heroGun, -0.2)
    this.roundRectPath(g, -18, -4, 11, 22, 3)
    g.fill(); g.stroke()
    g.fillStyle = PAL.heroGunAccent
    this.roundRectPath(g, -7, -48, 14, 12, 4)
    g.fill(); g.stroke()
    g.restore()

    // hands gripping
    this.blob(g, cx - 5, cy + 4, 6.5, 6.5, shade(skin, -0.05), ow * 0.8)
    this.blob(g, cx + 13, cy - 4, 6.5, 6.5, shade(skin, -0.05), ow * 0.8)

    // head (big — dominates the silhouette)
    const hr = 27
    const hy = cy - 30
    this.blob(g, cx, hy, hr, hr, this.formGrad(g, cx, hy, hr, skin), ow)
    // eyes
    g.fillStyle = PAL.outline
    g.beginPath(); g.arc(cx - 9, hy + 5, 3.4, 0, TAU); g.fill()
    g.beginPath(); g.arc(cx + 9, hy + 5, 3.4, 0, TAU); g.fill()

    // cap dome (bright blue) — clipped to the head so it caps the top cleanly
    const cap = PAL.heroCap
    g.save()
    g.beginPath(); g.arc(cx, hy, hr, 0, TAU); g.clip()
    g.fillStyle = this.formGrad(g, cx, hy - hr * 0.3, hr, cap)
    g.beginPath(); g.arc(cx, hy - hr * 0.42, hr * 1.05, 0, TAU); g.fill()
    g.restore()
    // cap lower edge outline
    g.lineWidth = ow * 0.9
    g.strokeStyle = PAL.outline
    g.beginPath(); g.ellipse(cx, hy - hr * 0.06, hr * 0.99, hr * 0.55, 0, 0, Math.PI); g.stroke()
    // brim sticking up/forward
    g.fillStyle = shade(cap, -0.12)
    this.roundRectPath(g, cx - 17, hy - hr * 0.1, 34, 9, 4)
    g.fill(); g.lineWidth = ow; g.stroke()
    // cap button + top gloss
    g.fillStyle = shade(cap, 0.4)
    g.beginPath(); g.arc(cx, hy - hr * 0.78, 2.6, 0, TAU); g.fill()
  }

  private roundRectPath(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2)
    g.beginPath()
    g.moveTo(x + rr, y)
    g.arcTo(x + w, y, x + w, y + h, rr)
    g.arcTo(x + w, y + h, x, y + h, rr)
    g.arcTo(x, y + h, x, y, rr)
    g.arcTo(x, y, x + w, y, rr)
    g.closePath()
  }

  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------
  private bakeEnemy(def: EnemyDef): EnemySprite {
    const P = Math.max(96, Math.min(360, Math.round(def.radius * 8)))
    const look = lookFor(def)
    const color = this.withRim(P, (g) => this.drawCreature(g, P, look), Math.max(4, P * 0.05))
    return { color, white: this.whiten(color) }
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

  private drawCreature(g: Ctx, P: number, look: Look): void {
    const ow = Math.max(3, P * 0.045)
    const cx = P / 2
    switch (look.kind) {
      case 'cyclops':
        return this.drawCyclops(g, P, cx, look, ow)
      case 'bomb':
        return this.drawBomb(g, P, cx, look, ow)
      case 'slime':
        return this.drawSlime(g, P, cx, look, ow)
      case 'ogre':
        return this.drawOgre(g, P, cx, look, ow)
      default:
        return this.drawHumanoid(g, P, cx, look, ow)
    }
  }

  // Hunched zombie: torso + head + two forward arms.
  private drawHumanoid(g: Ctx, P: number, cx: number, look: Look, ow: number): void {
    const col = look.body
    const cy = P * 0.54
    const bw = P * 0.2
    const bh = P * 0.24
    // back legs
    this.blob(g, cx - bw * 0.5, cy + bh * 0.9, bw * 0.34, bh * 0.5, shade(col, -0.3), ow)
    this.blob(g, cx + bw * 0.5, cy + bh * 0.9, bw * 0.34, bh * 0.5, shade(col, -0.3), ow)
    // arms reaching forward (down)
    this.blob(g, cx - bw * 1.05, cy + bh * 0.2, bw * 0.32, bh * 0.62, shade(col, -0.12), ow)
    this.blob(g, cx + bw * 1.05, cy + bh * 0.2, bw * 0.32, bh * 0.62, shade(col, -0.12), ow)
    // hands
    this.blob(g, cx - bw * 1.05, cy + bh * 0.85, bw * 0.26, bw * 0.26, shade(col, 0.05), ow * 0.8)
    this.blob(g, cx + bw * 1.05, cy + bh * 0.85, bw * 0.26, bw * 0.26, shade(col, 0.05), ow * 0.8)
    // torso
    this.blob(g, cx, cy, bw, bh, this.formGrad(g, cx, cy, bh, col), ow)
    // torn-shirt seam
    g.strokeStyle = shade(col, -0.4)
    g.lineWidth = P * 0.016
    g.beginPath(); g.moveTo(cx, cy - bh * 0.4); g.lineTo(cx, cy + bh * 0.7); g.stroke()
    // head
    const hy = cy - bh * 0.95
    const hr = bw * 0.95
    this.blob(g, cx, hy, hr, hr, this.formGrad(g, cx, hy, hr, shade(col, 0.08)), ow)
    // eyes
    this.eye(g, cx - hr * 0.4, hy + hr * 0.05, hr * 0.34, 0.3, ow * 0.7)
    this.eye(g, cx + hr * 0.4, hy + hr * 0.05, hr * 0.34, 0.3, ow * 0.7)
    // grimace
    g.strokeStyle = PAL.outline
    g.lineWidth = P * 0.02
    g.beginPath(); g.moveTo(cx - hr * 0.45, hy + hr * 0.6); g.lineTo(cx + hr * 0.45, hy + hr * 0.6); g.stroke()
  }

  // Stocky ogre/brute: heavy brow, small arms, optional teeth (boss) + armor.
  private drawOgre(g: Ctx, P: number, cx: number, look: Look, ow: number): void {
    const col = look.body
    const cy = P * 0.56
    const bw = P * 0.3
    const bh = P * 0.28
    // arms
    this.blob(g, cx - bw * 1.0, cy + bh * 0.1, bw * 0.4, bh * 0.7, shade(col, -0.15), ow)
    this.blob(g, cx + bw * 1.0, cy + bh * 0.1, bw * 0.4, bh * 0.7, shade(col, -0.15), ow)
    // fists
    this.blob(g, cx - bw * 1.05, cy + bh * 0.8, bw * 0.34, bw * 0.34, shade(col, 0.05), ow)
    this.blob(g, cx + bw * 1.05, cy + bh * 0.8, bw * 0.34, bw * 0.34, shade(col, 0.05), ow)
    // body
    this.blob(g, cx, cy, bw, bh, this.formGrad(g, cx, cy, bh, col), ow)
    if (look.armored) {
      g.fillStyle = alpha('#2b2f3a', 0.55)
      this.roundRectPath(g, cx - bw * 0.7, cy - bh * 0.2, bw * 1.4, bh * 0.5, 6)
      g.fill()
      g.lineWidth = ow * 0.6; g.strokeStyle = PAL.outline; g.stroke()
    }
    // head (low-set, wide)
    const hy = cy - bh * 0.85
    const hr = bw * 0.85
    this.blob(g, cx, hy, hr * 1.05, hr * 0.92, this.formGrad(g, cx, hy, hr, shade(col, 0.06)), ow)
    // heavy brow
    g.fillStyle = shade(col, -0.32)
    this.roundRectPath(g, cx - hr * 0.85, hy - hr * 0.45, hr * 1.7, hr * 0.42, 5)
    g.fill()
    g.lineWidth = ow * 0.7; g.strokeStyle = PAL.outline; g.stroke()
    // angry eyes
    this.eye(g, cx - hr * 0.42, hy + hr * 0.02, hr * 0.28, 0.2, ow * 0.6)
    this.eye(g, cx + hr * 0.42, hy + hr * 0.02, hr * 0.28, 0.2, ow * 0.6)
    // mouth
    if (look.toothy) {
      g.fillStyle = shade(col, -0.5)
      this.roundRectPath(g, cx - hr * 0.6, hy + hr * 0.42, hr * 1.2, hr * 0.42, 4)
      g.fill(); g.lineWidth = ow * 0.6; g.strokeStyle = PAL.outline; g.stroke()
      // teeth
      g.fillStyle = '#ffffff'
      const tw = hr * 0.24
      for (let i = 0; i < 4; i++) {
        const tx = cx - hr * 0.52 + i * tw
        this.roundRectPath(g, tx, hy + hr * 0.42, tw * 0.8, hr * 0.22, 2)
        g.fill()
      }
    } else {
      g.strokeStyle = PAL.outline
      g.lineWidth = P * 0.022
      g.beginPath(); g.moveTo(cx - hr * 0.4, hy + hr * 0.55); g.lineTo(cx + hr * 0.4, hy + hr * 0.55); g.stroke()
    }
  }

  // Purple slug with ONE big eye + light-blue bubble spots (the Spitter).
  private drawCyclops(g: Ctx, P: number, cx: number, look: Look, ow: number): void {
    const col = look.body
    const cy = P * 0.6
    const bw = P * 0.26
    const bh = P * 0.3
    // little arms
    this.blob(g, cx - bw * 1.0, cy + bh * 0.15, bw * 0.26, bh * 0.5, shade(col, -0.15), ow)
    this.blob(g, cx + bw * 1.0, cy + bh * 0.15, bw * 0.26, bh * 0.5, shade(col, -0.15), ow)
    // teardrop body (wider at bottom)
    g.fillStyle = this.formGrad(g, cx, cy, bh, col)
    g.beginPath()
    g.moveTo(cx, cy - bh * 1.25)
    g.bezierCurveTo(cx + bw * 1.5, cy - bh * 0.6, cx + bw * 1.15, cy + bh, cx, cy + bh)
    g.bezierCurveTo(cx - bw * 1.15, cy + bh, cx - bw * 1.5, cy - bh * 0.6, cx, cy - bh * 1.25)
    g.closePath()
    g.fill()
    g.lineWidth = ow; g.lineJoin = 'round'; g.strokeStyle = PAL.outline; g.stroke()
    // bubble spots
    g.fillStyle = alpha('#bfe6ff', 0.9)
    g.beginPath(); g.arc(cx - bw * 0.5, cy - bh * 0.6, bw * 0.22, 0, TAU); g.fill()
    g.beginPath(); g.arc(cx + bw * 0.55, cy - bh * 0.3, bw * 0.16, 0, TAU); g.fill()
    g.beginPath(); g.arc(cx + bw * 0.1, cy - bh * 0.85, bw * 0.13, 0, TAU); g.fill()
    // one big eye
    this.eye(g, cx, cy - bh * 0.15, bw * 0.62, 0.25, ow)
  }

  // Round orange bomb-zombie: dark spots, lit fuse, googly eyes.
  private drawBomb(g: Ctx, P: number, cx: number, look: Look, ow: number): void {
    const col = look.body
    const cy = P * 0.56
    const r = P * 0.28
    // tiny feet
    this.blob(g, cx - r * 0.5, cy + r * 0.95, r * 0.24, r * 0.2, shade(col, -0.3), ow * 0.8)
    this.blob(g, cx + r * 0.5, cy + r * 0.95, r * 0.24, r * 0.2, shade(col, -0.3), ow * 0.8)
    // body
    this.blob(g, cx, cy, r, r * 0.98, this.formGrad(g, cx, cy, r, col), ow)
    // dark spots
    g.fillStyle = shade(col, -0.4)
    g.beginPath(); g.arc(cx - r * 0.45, cy + r * 0.35, r * 0.16, 0, TAU); g.fill()
    g.beginPath(); g.arc(cx + r * 0.5, cy - r * 0.1, r * 0.12, 0, TAU); g.fill()
    g.beginPath(); g.arc(cx + r * 0.2, cy + r * 0.5, r * 0.1, 0, TAU); g.fill()
    // fuse + spark
    g.strokeStyle = PAL.outline
    g.lineWidth = P * 0.03
    g.beginPath(); g.moveTo(cx, cy - r * 0.95); g.quadraticCurveTo(cx + r * 0.4, cy - r * 1.4, cx + r * 0.15, cy - r * 1.55); g.stroke()
    g.fillStyle = PAL.aoeRim
    g.beginPath(); g.arc(cx + r * 0.15, cy - r * 1.55, r * 0.16, 0, TAU); g.fill()
    g.fillStyle = PAL.aoeFire
    g.beginPath(); g.arc(cx + r * 0.15, cy - r * 1.55, r * 0.09, 0, TAU); g.fill()
    // googly eyes
    this.eye(g, cx - r * 0.34, cy - r * 0.2, r * 0.28, 0.1, ow * 0.7)
    this.eye(g, cx + r * 0.34, cy - r * 0.2, r * 0.28, 0.1, ow * 0.7)
  }

  // Wobbly translucent slime blob with two big googly eyes + gloss highlight.
  private drawSlime(g: Ctx, P: number, cx: number, look: Look, ow: number): void {
    const col = look.body
    const cy = P * 0.58
    const r = P * (look.big ? 0.3 : 0.26)
    // blobby body (flat bottom)
    g.fillStyle = this.formGrad(g, cx, cy, r, col)
    g.beginPath()
    g.moveTo(cx - r, cy + r * 0.4)
    g.bezierCurveTo(cx - r * 1.05, cy - r * 0.9, cx + r * 1.05, cy - r * 0.9, cx + r, cy + r * 0.4)
    g.quadraticCurveTo(cx + r * 0.6, cy + r * 0.85, cx, cy + r * 0.8)
    g.quadraticCurveTo(cx - r * 0.6, cy + r * 0.85, cx - r, cy + r * 0.4)
    g.closePath()
    g.fill()
    g.lineWidth = ow; g.lineJoin = 'round'; g.strokeStyle = PAL.outline; g.stroke()
    // gloss
    g.fillStyle = alpha('#ffffff', 0.35)
    g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.18, -0.5, 0, TAU); g.fill()
    // eyes
    this.eye(g, cx - r * 0.36, cy - r * 0.05, r * 0.3, 0.2, ow * 0.7)
    this.eye(g, cx + r * 0.36, cy - r * 0.05, r * 0.3, 0.2, ow * 0.7)
  }
}

export const sprites = new SpriteCacheImpl()
