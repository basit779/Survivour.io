// Boot entry. For now this renders a live neon "arena" boot screen to verify the
// full Vite -> Canvas pipeline on device. The real Engine/SceneManager replaces
// this in implementation step 1 (see docs/PROGRESS.md).

import { PAL } from './data/palette'
import { C } from './data/balance'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
const loading = document.getElementById('loading')
if (!canvas) throw new Error('game-canvas not found')

const ctx = canvas.getContext('2d', { alpha: false })
if (!ctx) throw new Error('2d context unavailable')

let viewW = 0
let viewH = 0
let dpr = 1

function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2) // DPR cap 2 (perf)
  viewW = window.innerWidth
  viewH = window.innerHeight
  canvas!.width = Math.floor(viewW * dpr)
  canvas!.height = Math.floor(viewH * dpr)
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
}
resize()
window.addEventListener('resize', resize)

if (loading) loading.style.display = 'none'

// Scrolling parallax grid in world units, scaled to fit-by-width.
const start = performance.now()

function drawGrid(t: number): void {
  const g = ctx!
  const scale = viewW / C.VIEW_WIDTH // px per WU (portrait fit-by-width)
  const cell = 64 // WU
  const px = cell * scale
  // slow drift to prove animation
  const ox = (t * 14 * scale) % px
  const oy = (t * 9 * scale) % px

  g.lineWidth = 1
  g.strokeStyle = PAL.bgGrid
  g.beginPath()
  for (let x = -ox; x <= viewW + px; x += px) {
    g.moveTo(x, 0)
    g.lineTo(x, viewH)
  }
  for (let y = -oy; y <= viewH + px; y += px) {
    g.moveTo(0, y)
    g.lineTo(viewW, y)
  }
  g.stroke()
}

function frame(now: number): void {
  const t = (now - start) / 1000
  const g = ctx!

  // background
  g.fillStyle = PAL.bg
  g.fillRect(0, 0, viewW, viewH)
  drawGrid(t)

  // pulsing player-like core in the center
  const cx = viewW / 2
  const cy = viewH / 2
  const pulse = 1 + Math.sin(t * 2) * 0.08
  const r = 22 * pulse
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3)
  grad.addColorStop(0, PAL.playerCore)
  grad.addColorStop(0.4, PAL.player)
  grad.addColorStop(1, 'rgba(18,169,255,0)')
  g.fillStyle = grad
  g.beginPath()
  g.arc(cx, cy, r * 3, 0, Math.PI * 2)
  g.fill()

  // title
  g.fillStyle = PAL.uiText
  g.textAlign = 'center'
  g.font = '700 34px system-ui, sans-serif'
  g.fillText('SURVIVOR ZERO', cx, cy - 120)
  g.fillStyle = PAL.uiDim
  g.font = '500 14px system-ui, sans-serif'
  g.fillText('build coming together — see docs/PROGRESS.md', cx, cy + 130)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
