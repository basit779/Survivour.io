// All drawing. World pass (urban ground + entities + additive VFX) then the
// screen-space HUD/overlays. Art = bright chunky cartoon (thick outline + white
// rim, baked into sprites) on desaturated grey ground; big additive AOE rings.
import { lerp, TAU } from '../../engine/math'
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import { Time } from '../../engine/Time'
import { sprites } from '../../engine/SpriteCache'
import type { Renderer } from '../../engine/Renderer'
import type { World } from '../World'
import type { Enemy, Gem, Particle } from '../entities'
import type { InputManager } from '../../input/InputManager'

const SAFE_TOP = 30
const SAFE_BOTTOM = 26

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export function renderWorld(world: World, r: Renderer, alpha: number): void {
  const g = r.ctx
  const cam = world.camera
  r.beginWorld(cam, alpha)
  const camX = cam.renderX(alpha)
  const camY = cam.renderY(alpha)
  const left = r.worldLeft(camX) - 48
  const right = r.worldRight(camX) + 48
  const top = r.worldTop(camY) - 48
  const bottom = r.worldBottom(camY) + 48

  drawGround(g, r, left, right, top, bottom)

  // gems (crisp, source-over so they read as solid pickups)
  const gm = world.gems
  for (let i = 0; i < gm.count; i++) {
    const e = gm.items[i]
    drawGem(g, lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha), e)
  }

  // enemies
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    const x = lerp(e.prevX, e.x, alpha)
    const y = lerp(e.prevY, e.y, alpha)
    if (x < left || x > right || y < top || y > bottom) continue
    drawEnemy(g, x, y, e, Time.frame)
  }

  // player
  drawPlayer(g, lerp(world.player.prevX, world.player.x, alpha), lerp(world.player.prevY, world.player.y, alpha), world.player.radius, world.player.hurtFlash)

  // projectiles + particles + AOE rings (additive glow)
  g.globalCompositeOperation = 'lighter'
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    if (q.hostile) continue // hostile shots drawn solid below
    drawBullet(g, lerp(q.prevX, q.x, alpha), lerp(q.prevY, q.y, alpha), q.radius, q.color)
  }
  const ps = world.particles
  for (let i = 0; i < ps.count; i++) drawParticle(g, ps.items[i])
  g.globalCompositeOperation = 'source-over'

  // hostile enemy shots (solid, menacing)
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    if (!q.hostile) continue
    const x = lerp(q.prevX, q.x, alpha)
    const y = lerp(q.prevY, q.y, alpha)
    g.fillStyle = PAL.enemyRanged
    g.beginPath(); g.arc(x, y, q.radius + 1.5, 0, TAU); g.fill()
    g.lineWidth = 2; g.strokeStyle = PAL.outline; g.stroke()
  }

  // damage numbers (world space, bold + outlined)
  const dn = world.damageNumbers
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  for (let i = 0; i < dn.count; i++) {
    const d = dn.items[i]
    const t = d.life / d.maxLife
    const a = Math.min(1, t + 0.2)
    const pop = d.crit ? 1 + 0.5 * Math.max(0, t - 0.6) : 1
    const size = (d.crit ? 15 : 10) * pop
    g.globalAlpha = a
    g.font = `${d.crit ? 800 : 700} ${size}px system-ui, sans-serif`
    g.lineWidth = size * 0.34
    g.strokeStyle = PAL.outline
    g.strokeText(d.text, d.x, d.y)
    g.fillStyle = d.color
    g.fillText(d.text, d.x, d.y)
  }
  g.globalAlpha = 1

  r.beginScreen()
}

function drawGround(g: CanvasRenderingContext2D, r: Renderer, left: number, right: number, top: number, bottom: number): void {
  if (sprites.ground) {
    if (!sprites.groundPattern) sprites.groundPattern = g.createPattern(sprites.ground, 'repeat')
    if (sprites.groundPattern) {
      g.fillStyle = sprites.groundPattern
      g.fillRect(left, top, right - left, bottom - top)
    } else {
      g.fillStyle = PAL.groundBase
      g.fillRect(left, top, right - left, bottom - top)
    }
    drawRoadMarkings(g, left, right, top, bottom)
    // arena border (dark curb)
    g.lineWidth = 8 / r.scale
    g.strokeStyle = PAL.outline
    g.strokeRect(0, 0, C.ARENA_W, C.ARENA_H)
    return
  }
  g.fillStyle = PAL.groundBase
  g.fillRect(left, top, right - left, bottom - top)
}

// Faint white dashed lane lines at a coarse world grid -> reads as urban streets.
function drawRoadMarkings(g: CanvasRenderingContext2D, left: number, right: number, top: number, bottom: number): void {
  const LANE = 512
  g.strokeStyle = PAL.roadPaint
  g.lineWidth = 6
  g.setLineDash([34, 30])
  g.beginPath()
  for (let x = Math.floor(left / LANE) * LANE; x <= right; x += LANE) {
    g.moveTo(x, top); g.lineTo(x, bottom)
  }
  for (let y = Math.floor(top / LANE) * LANE; y <= bottom; y += LANE) {
    g.moveTo(left, y); g.lineTo(right, y)
  }
  g.stroke()
  g.setLineDash([])
}

function drawShadow(g: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  g.globalAlpha = 0.26
  g.fillStyle = '#000000'
  g.beginPath()
  g.ellipse(x, y + radius * 0.78, radius * 1.0, radius * 0.44, 0, 0, TAU)
  g.fill()
  g.globalAlpha = 1
}

function drawEnemy(g: CanvasRenderingContext2D, x: number, y: number, e: Enemy, frame: number): void {
  drawShadow(g, x, y, e.radius)
  const spr = sprites.enemy(e.defId)
  if (spr) {
    const drawR = e.radius * 1.55
    const bob = Math.sin(frame * 0.15 + (x + y) * 0.05) * e.radius * 0.06
    g.drawImage(spr.color, x - drawR, y - drawR - bob, drawR * 2, drawR * 2)
    if (e.hitFlash > 0) {
      g.globalAlpha = Math.min(1, e.hitFlash / 0.08)
      g.drawImage(spr.white, x - drawR, y - drawR - bob, drawR * 2, drawR * 2)
      g.globalAlpha = 1
    }
    return
  }
  // fallback: simple circle
  g.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color
  g.beginPath(); g.arc(x, y, e.radius, 0, TAU); g.fill()
  g.lineWidth = 2; g.strokeStyle = PAL.outline; g.stroke()
}

function drawPlayer(g: CanvasRenderingContext2D, x: number, y: number, radius: number, hurt: number): void {
  drawShadow(g, x, y, radius)
  if (sprites.player) {
    const drawR = radius * 2.3
    g.drawImage(sprites.player, x - drawR, y - drawR + radius * 0.5, drawR * 2, drawR * 2)
    if (hurt > 0) {
      g.globalAlpha = Math.min(0.7, hurt / 0.18)
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = '#ff5d73'
      g.beginPath(); g.arc(x, y, radius * 1.6, 0, TAU); g.fill()
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
    }
    return
  }
  g.fillStyle = hurt > 0 ? '#ffffff' : PAL.player
  g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill()
}

function drawBullet(g: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  // soft glow + bright core
  g.fillStyle = color
  g.globalAlpha = 0.5
  g.beginPath(); g.arc(x, y, radius * 1.8, 0, TAU); g.fill()
  g.globalAlpha = 1
  g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill()
}

function drawGem(g: CanvasRenderingContext2D, x: number, y: number, e: Gem): void {
  if (e.kind === 'bomb' || e.kind === 'magnet' || e.kind === 'health') {
    drawItem(g, x, y, e)
    return
  }
  const r = e.radius
  // diamond gem with dark outline + bright facet
  g.beginPath()
  g.moveTo(x, y - r)
  g.lineTo(x + r, y)
  g.lineTo(x, y + r)
  g.lineTo(x - r, y)
  g.closePath()
  g.fillStyle = e.color
  g.fill()
  g.lineWidth = 1.6
  g.strokeStyle = PAL.outline
  g.stroke()
  // facet highlight
  g.fillStyle = 'rgba(255,255,255,0.6)'
  g.beginPath()
  g.moveTo(x, y - r)
  g.lineTo(x + r * 0.5, y - r * 0.1)
  g.lineTo(x, y + r * 0.1)
  g.lineTo(x - r * 0.5, y - r * 0.1)
  g.closePath()
  g.fill()
}

// Field items (bomb / magnet / heal): chunky outlined icons with a pulsing halo.
function drawItem(g: CanvasRenderingContext2D, x: number, y: number, e: Gem): void {
  const r = e.radius
  const pulse = 1 + 0.12 * Math.sin(Time.frame * 0.12)
  // halo
  g.globalAlpha = 0.35 + 0.15 * Math.sin(Time.frame * 0.12)
  g.fillStyle = e.color
  g.beginPath(); g.arc(x, y, r * 1.7 * pulse, 0, TAU); g.fill()
  g.globalAlpha = 1
  // badge
  g.fillStyle = e.color
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill()
  g.lineWidth = 2.5; g.strokeStyle = PAL.outline; g.stroke()
  g.fillStyle = '#ffffff'
  if (e.kind === 'health') {
    // plus
    const t = r * 0.34
    g.fillRect(x - t / 2, y - r * 0.6, t, r * 1.2)
    g.fillRect(x - r * 0.6, y - t / 2, r * 1.2, t)
  } else if (e.kind === 'bomb') {
    // dark bomb core + fuse spark
    g.fillStyle = PAL.outline
    g.beginPath(); g.arc(x, y + r * 0.1, r * 0.5, 0, TAU); g.fill()
    g.strokeStyle = '#ffffff'; g.lineWidth = 2
    g.beginPath(); g.moveTo(x, y - r * 0.4); g.lineTo(x + r * 0.4, y - r * 0.8); g.stroke()
    g.fillStyle = PAL.aoeRim
    g.beginPath(); g.arc(x + r * 0.45, y - r * 0.85, r * 0.22, 0, TAU); g.fill()
  } else {
    // magnet: red horseshoe with light tips
    g.lineWidth = r * 0.42
    g.strokeStyle = '#ffffff'
    g.beginPath(); g.arc(x, y + r * 0.1, r * 0.5, Math.PI * 0.9, Math.PI * 2.1, false); g.stroke()
    g.lineWidth = r * 0.22
    g.strokeStyle = PAL.outline
    g.beginPath(); g.arc(x, y + r * 0.1, r * 0.5, Math.PI * 0.9, Math.PI * 2.1, false); g.stroke()
  }
}

function drawParticle(g: CanvasRenderingContext2D, p: Particle): void {
  const fade = Math.max(0, p.life / p.maxLife)
  if (p.ring) {
    const t = 1 - fade
    const rad = lerp(p.r0, p.r1, t)
    g.globalAlpha = 0.32 * fade
    g.fillStyle = p.color
    g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.fill()
    g.globalAlpha = 0.95 * fade
    g.lineWidth = Math.max(2.5, rad * 0.14)
    g.strokeStyle = PAL.aoeRim
    g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.stroke()
    g.globalAlpha = 1
    return
  }
  g.globalAlpha = fade
  g.fillStyle = p.color
  g.beginPath()
  g.arc(p.x, p.y, p.size, 0, TAU)
  g.fill()
  g.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// HUD / overlays (screen space)
// ---------------------------------------------------------------------------

function boldText(g: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, fill: string, weight = 800, align: CanvasTextAlign = 'center'): void {
  g.font = `${weight} ${size}px system-ui, sans-serif`
  g.textAlign = align
  g.lineJoin = 'round'
  g.lineWidth = Math.max(2, size * 0.2)
  g.strokeStyle = PAL.outline
  g.strokeText(str, x, y)
  g.fillStyle = fill
  g.fillText(str, x, y)
}

export function renderHud(world: World, r: Renderer, input: InputManager, paused: boolean): void {
  const g = r.ctx
  const W = r.viewW
  const H = r.viewH
  const p = world.player
  const run = world.run

  // low-HP vignette
  const hpFrac = p.hp / p.maxHp
  if (hpFrac < 0.3 && run.state === 'playing') {
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, `rgba(255,40,70,${0.42 * (1 - hpFrac / 0.3)})`)
    g.fillStyle = v
    g.fillRect(0, 0, W, H)
  }
  // hurt flash
  if (p.hurtFlash > 0) {
    g.fillStyle = `rgba(255,40,70,${0.32 * (p.hurtFlash / 0.18)})`
    g.fillRect(0, 0, W, H)
  }

  // XP bar (top, full width, gold)
  const xpFrac = Math.min(1, p.xp / p.xpToNext)
  const xpY = SAFE_TOP
  g.fillStyle = 'rgba(0,0,0,0.5)'
  roundRect(g, 8, xpY, W - 16, 12, 6); g.fill()
  if (xpFrac > 0) {
    g.fillStyle = PAL.uiGold
    roundRect(g, 10, xpY + 2, (W - 20) * xpFrac, 8, 4); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.35)'
    roundRect(g, 10, xpY + 2, (W - 20) * xpFrac, 3, 2); g.fill()
  }

  // top row: LV badge (left), timer (center), kills/gold (right)
  const rowY = xpY + 30
  // LV badge
  g.fillStyle = PAL.uiAccent
  roundRect(g, 10, rowY - 11, 56, 22, 8); g.fill()
  g.lineWidth = 2; g.strokeStyle = PAL.outline; g.stroke()
  g.textBaseline = 'middle'
  boldText(g, `LV ${p.level}`, 38, rowY, 13, '#ffffff', 800, 'center')

  boldText(g, formatTime(run.elapsed), W / 2, rowY, 24, '#ffffff', 800, 'center')

  boldText(g, `☠ ${run.kills}`, W - 12, rowY - 6, 14, '#ffffff', 700, 'right')
  boldText(g, `◆ ${run.gold}`, W - 12, rowY + 12, 14, PAL.gold, 700, 'right')

  // boss HP bar (top center, when a boss is alive)
  if (world.boss && world.boss.alive) {
    const b = world.boss
    const bw = W * 0.74
    const bh = 13
    const bx = (W - bw) / 2
    const by = rowY + 22
    g.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(g, bx - 3, by - 3, bw + 6, bh + 6, 7); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(g, bx, by, bw, bh, 5); g.fill()
    g.fillStyle = PAL.uiWarn
    roundRect(g, bx, by, bw * Math.max(0, b.hp / b.maxHp), bh, 5); g.fill()
    g.fillStyle = 'rgba(255,255,255,0.3)'
    roundRect(g, bx, by, bw * Math.max(0, b.hp / b.maxHp), 4, 2); g.fill()
    g.textBaseline = 'top'
    boldText(g, 'THE WARDEN', W / 2, by + bh + 3, 12, '#ffffff', 800, 'center')
  }

  // "ZOMBIES INCOMING" pre-boss warning banner
  if (run.warning > 0 && run.state === 'playing') {
    const blink = 0.55 + 0.45 * Math.sin(Time.frame * 0.35)
    const by = H * 0.26
    const bw = Math.min(W * 0.82, 340)
    g.globalAlpha = blink
    g.fillStyle = '#d11f3a'
    roundRect(g, (W - bw) / 2, by - 22, bw, 44, 10); g.fill()
    g.lineWidth = 3; g.strokeStyle = PAL.outline
    roundRect(g, (W - bw) / 2, by - 22, bw, 44, 10); g.stroke()
    g.globalAlpha = 1
    g.textBaseline = 'middle'
    boldText(g, `⚠ ZOMBIES INCOMING`, W / 2, by, 18, '#ffffff', 900, 'center')
  }

  // HP bar (bottom center, chunky)
  const barW = W * 0.58
  const barH = 20
  const barX = (W - barW) / 2
  const barY = H - SAFE_BOTTOM - barH
  g.fillStyle = 'rgba(0,0,0,0.55)'
  roundRect(g, barX - 3, barY - 3, barW + 6, barH + 6, 9); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(g, barX, barY, barW, barH, 7); g.fill()
  g.fillStyle = hpFrac > 0.3 ? PAL.uiGood : '#ff3040'
  roundRect(g, barX, barY, barW * Math.max(0, hpFrac), barH, 7); g.fill()
  g.fillStyle = 'rgba(255,255,255,0.3)'
  roundRect(g, barX, barY, barW * Math.max(0, hpFrac), 6, 3); g.fill()
  g.textBaseline = 'middle'
  boldText(g, `${Math.ceil(p.hp)} / ${p.maxHp}`, W / 2, barY + barH / 2 + 1, 12, '#ffffff', 800, 'center')

  // joystick visual
  if (input.joystick.active) drawJoystick(g, input)

  // debug fps
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.font = '600 10px monospace'
  g.fillStyle = PAL.uiDim
  g.fillText(`${Time.fps} fps · ${world.enemies.count}e`, 12, rowY + 16)

  if (paused && run.state === 'playing') centerOverlay(g, W, H, 'PAUSED', 'Tap or press P / Esc to resume')
}

function drawJoystick(g: CanvasRenderingContext2D, input: InputManager): void {
  const j = input.joystick
  g.globalAlpha = 0.5
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.beginPath(); g.arc(j.baseX, j.baseY, 56, 0, TAU); g.fill()
  g.lineWidth = 4
  g.strokeStyle = '#ffffff'
  g.beginPath(); g.arc(j.baseX, j.baseY, 56, 0, TAU); g.stroke()
  g.fillStyle = PAL.uiAccent
  g.beginPath(); g.arc(j.knobX, j.knobY, 26, 0, TAU); g.fill()
  g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke()
  g.globalAlpha = 1
}

function centerOverlay(g: CanvasRenderingContext2D, W: number, H: number, title: string, sub: string): void {
  g.fillStyle = 'rgba(20,22,28,0.72)'
  g.fillRect(0, 0, W, H)
  g.textBaseline = 'middle'
  boldText(g, title, W / 2, H / 2 - 16, 40, PAL.uiGold, 900, 'center')
  g.fillStyle = PAL.uiText
  g.textAlign = 'center'
  g.font = '500 15px system-ui, sans-serif'
  g.fillText(sub, W / 2, H / 2 + 26)
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const rr = Math.min(radius, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + rr, y)
  g.arcTo(x + w, y, x + w, y + h, rr)
  g.arcTo(x + w, y + h, x, y + h, rr)
  g.arcTo(x, y + h, x, y, rr)
  g.arcTo(x, y, x + w, y, rr)
  g.closePath()
}

function formatTime(sec: number): string {
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss < 10 ? '0' : ''}${ss}`
}
