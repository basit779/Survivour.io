// All drawing. World pass (neon grid + entities + additive glow/particles) then
// the screen-space HUD/overlays. Programmatic art only.
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

  // gems
  const gm = world.gems
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < gm.count; i++) {
    const e = gm.items[i]
    drawGem(g, lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha), e)
  }
  g.globalCompositeOperation = 'source-over'

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

  // projectiles + particles (additive glow)
  g.globalCompositeOperation = 'lighter'
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    const x = lerp(q.prevX, q.x, alpha)
    const y = lerp(q.prevY, q.y, alpha)
    drawGlowDot(g, x, y, q.radius, q.color)
  }
  const ps = world.particles
  for (let i = 0; i < ps.count; i++) drawParticle(g, ps.items[i])
  g.globalCompositeOperation = 'source-over'

  // damage numbers (world space)
  const dn = world.damageNumbers
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < dn.count; i++) {
    const d = dn.items[i]
    const a = Math.min(1, d.life / d.maxLife + 0.2)
    g.globalAlpha = a
    g.fillStyle = d.color
    g.font = `${d.crit ? 700 : 600} ${(d.crit ? 13 : 9)}px system-ui, sans-serif`
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
    }
    g.lineWidth = 6 / r.scale
    g.strokeStyle = PAL.bgGridGlow
    g.strokeRect(0, 0, C.ARENA_W, C.ARENA_H)
    return
  }
  drawGrid(g, r, left, right, top, bottom)
}

function drawGrid(g: CanvasRenderingContext2D, r: Renderer, left: number, right: number, top: number, bottom: number): void {
  const cell = 64
  const x0 = Math.floor(left / cell) * cell
  const y0 = Math.floor(top / cell) * cell
  g.lineWidth = 1 / r.scale
  g.strokeStyle = PAL.bgGrid
  g.beginPath()
  for (let x = x0; x <= right; x += cell) {
    g.moveTo(x, top)
    g.lineTo(x, bottom)
  }
  for (let y = y0; y <= bottom; y += cell) {
    g.moveTo(left, y)
    g.lineTo(right, y)
  }
  g.stroke()
  // arena border
  g.lineWidth = 5 / r.scale
  g.strokeStyle = PAL.bgGridGlow
  g.strokeRect(0, 0, C.ARENA_W, C.ARENA_H)
}

function drawShape(g: CanvasRenderingContext2D, x: number, y: number, radius: number, shape: string): void {
  g.beginPath()
  switch (shape) {
    case 'square':
      g.rect(x - radius, y - radius, radius * 2, radius * 2)
      break
    case 'tri':
      g.moveTo(x, y - radius)
      g.lineTo(x + radius, y + radius)
      g.lineTo(x - radius, y + radius)
      g.closePath()
      break
    case 'diamond':
      g.moveTo(x, y - radius)
      g.lineTo(x + radius, y)
      g.lineTo(x, y + radius)
      g.lineTo(x - radius, y)
      g.closePath()
      break
    case 'hex': {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6
        const px = x + Math.cos(a) * radius
        const py = y + Math.sin(a) * radius
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
      break
    }
    default:
      g.arc(x, y, radius, 0, Math.PI * 2)
  }
}

function drawShadow(g: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  g.globalAlpha = 0.3
  g.fillStyle = '#000000'
  g.beginPath()
  g.ellipse(x, y + radius * 0.72, radius * 0.95, radius * 0.42, 0, 0, TAU)
  g.fill()
  g.globalAlpha = 1
}

function drawEnemy(g: CanvasRenderingContext2D, x: number, y: number, e: Enemy, frame: number): void {
  drawShadow(g, x, y, e.radius)
  const spr = sprites.enemy(e.defId)
  if (spr) {
    const drawR = e.radius * 1.4
    const bob = Math.sin(frame * 0.15 + (x + y) * 0.05) * e.radius * 0.07
    g.drawImage(spr.color, x - drawR, y - drawR - bob, drawR * 2, drawR * 2)
    if (e.hitFlash > 0) {
      g.globalAlpha = Math.min(1, e.hitFlash / 0.08)
      g.drawImage(spr.white, x - drawR, y - drawR - bob, drawR * 2, drawR * 2)
      g.globalAlpha = 1
    }
    return
  }
  // fallback: simple shape
  g.globalAlpha = 0.22
  g.fillStyle = e.glow
  g.beginPath()
  g.arc(x, y, e.radius * 1.5, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
  g.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color
  drawShape(g, x, y, e.radius, e.shape)
  g.fill()
}

function drawPlayer(g: CanvasRenderingContext2D, x: number, y: number, radius: number, hurt: number): void {
  drawShadow(g, x, y, radius)
  if (sprites.player) {
    const drawR = radius * 1.75
    g.drawImage(sprites.player, x - drawR, y - drawR, drawR * 2, drawR * 2)
    if (hurt > 0) {
      g.globalAlpha = Math.min(1, hurt / 0.18)
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.arc(x, y, radius, 0, TAU)
      g.fill()
      g.globalAlpha = 1
    }
    return
  }
  // fallback
  g.globalCompositeOperation = 'lighter'
  drawGlowDot(g, x, y, radius * 1.6, PAL.playerGlow)
  g.globalCompositeOperation = 'source-over'
  g.fillStyle = hurt > 0 ? '#ffffff' : PAL.player
  g.beginPath()
  g.arc(x, y, radius, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = PAL.playerCore
  g.beginPath()
  g.arc(x, y, radius * 0.45, 0, Math.PI * 2)
  g.fill()
}

function drawGlowDot(g: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  g.fillStyle = color
  g.globalAlpha = 0.85
  g.beginPath()
  g.arc(x, y, radius, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
}

function drawGem(g: CanvasRenderingContext2D, x: number, y: number, e: Gem): void {
  g.fillStyle = e.color
  g.globalAlpha = 0.9
  drawShape(g, x, y, e.radius, 'diamond')
  g.fill()
  g.globalAlpha = 1
}

function drawParticle(g: CanvasRenderingContext2D, p: Particle): void {
  const a = Math.max(0, p.life / p.maxLife)
  g.globalAlpha = a
  g.fillStyle = p.color
  g.beginPath()
  g.arc(p.x, p.y, p.size, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// HUD / overlays (screen space)
// ---------------------------------------------------------------------------

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
    v.addColorStop(1, `rgba(255,30,60,${0.4 * (1 - hpFrac / 0.3)})`)
    g.fillStyle = v
    g.fillRect(0, 0, W, H)
  }

  // hurt flash
  if (p.hurtFlash > 0) {
    g.fillStyle = `rgba(255,40,70,${0.35 * (p.hurtFlash / 0.18)})`
    g.fillRect(0, 0, W, H)
  }

  // XP bar (top, full width)
  const xpFrac = Math.min(1, p.xp / p.xpToNext)
  g.fillStyle = 'rgba(255,255,255,0.08)'
  g.fillRect(0, SAFE_TOP, W, 6)
  g.fillStyle = PAL.uiAccent
  g.fillRect(0, SAFE_TOP, W * xpFrac, 6)

  // top row: level (left), timer (center), kills/gold (right)
  g.textBaseline = 'top'
  g.font = '700 15px system-ui, sans-serif'
  g.textAlign = 'left'
  g.fillStyle = PAL.uiAccent
  g.fillText(`LV ${p.level}`, 12, SAFE_TOP + 12)

  g.textAlign = 'center'
  g.fillStyle = PAL.uiText
  g.font = '800 22px system-ui, sans-serif'
  g.fillText(formatTime(run.elapsed), W / 2, SAFE_TOP + 12)

  g.textAlign = 'right'
  g.font = '700 14px system-ui, sans-serif'
  g.fillStyle = PAL.uiText
  g.fillText(`☠ ${run.kills}`, W - 12, SAFE_TOP + 10)
  g.fillStyle = PAL.gold
  g.fillText(`◆ ${run.gold}`, W - 12, SAFE_TOP + 30)

  // boss HP bar (top center, when a boss is alive)
  if (world.boss && world.boss.alive) {
    const b = world.boss
    const bw = W * 0.72
    const bh = 10
    const bx = (W - bw) / 2
    const by = SAFE_TOP + 52
    g.fillStyle = 'rgba(0,0,0,0.5)'
    roundRect(g, bx - 2, by - 2, bw + 4, bh + 4, 5)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.1)'
    roundRect(g, bx, by, bw, bh, 4)
    g.fill()
    g.fillStyle = PAL.enemyBoss
    roundRect(g, bx, by, bw * Math.max(0, b.hp / b.maxHp), bh, 4)
    g.fill()
    g.fillStyle = PAL.uiText
    g.textAlign = 'center'
    g.textBaseline = 'top'
    g.font = '700 11px system-ui, sans-serif'
    g.fillText('THE WARDEN', W / 2, by + bh + 3)
  }

  // HP bar (bottom center)
  const barW = W * 0.56
  const barH = 16
  const barX = (W - barW) / 2
  const barY = H - SAFE_BOTTOM - barH
  g.fillStyle = 'rgba(0,0,0,0.45)'
  roundRect(g, barX - 2, barY - 2, barW + 4, barH + 4, 6)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.1)'
  roundRect(g, barX, barY, barW, barH, 5)
  g.fill()
  g.fillStyle = hpFrac > 0.3 ? PAL.health : '#ff2030'
  roundRect(g, barX, barY, barW * Math.max(0, hpFrac), barH, 5)
  g.fill()
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 11px system-ui, sans-serif'
  g.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, W / 2, barY + barH / 2 + 1)

  // joystick visual
  if (input.joystick.active) drawJoystick(g, input)

  // debug fps
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.font = '600 10px monospace'
  g.fillStyle = PAL.uiDim
  g.fillText(`${Time.fps} fps · ${world.enemies.count}e`, 12, SAFE_TOP + 34)

  // pause overlay (run end is handled by the GameOver scene)
  if (paused && run.state === 'playing') centerOverlay(g, W, H, 'PAUSED', 'Tap or press P / Esc to resume')
}

function drawJoystick(g: CanvasRenderingContext2D, input: InputManager): void {
  const j = input.joystick
  g.globalAlpha = 0.5
  g.strokeStyle = PAL.uiAccent
  g.lineWidth = 3
  g.beginPath()
  g.arc(j.baseX, j.baseY, 56, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = PAL.uiAccent
  g.beginPath()
  g.arc(j.knobX, j.knobY, 26, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
}

function centerOverlay(g: CanvasRenderingContext2D, W: number, H: number, title: string, sub: string): void {
  g.fillStyle = 'rgba(5,6,10,0.72)'
  g.fillRect(0, 0, W, H)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = PAL.uiAccent
  g.font = '800 38px system-ui, sans-serif'
  g.fillText(title, W / 2, H / 2 - 16)
  g.fillStyle = PAL.uiText
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
