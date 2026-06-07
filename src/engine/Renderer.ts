// Canvas/DPI management + camera transform. Single full-screen canvas, DPR
// capped at 2 for mobile fill-rate. World space uses a portrait "fit-by-width"
// projection: a fixed number of world units (C.VIEW_WIDTH) always spans the
// screen width; taller phones simply see more vertical world.
import { C } from '../data/balance'
import type { Camera } from './Camera'

export class Renderer {
  ctx: CanvasRenderingContext2D
  viewW = 0 // CSS px
  viewH = 0
  dpr = 1
  scale = 1 // px per world unit

  constructor(public canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.viewW = window.innerWidth
    this.viewH = window.innerHeight
    this.canvas.width = Math.max(1, Math.floor(this.viewW * this.dpr))
    this.canvas.height = Math.max(1, Math.floor(this.viewH * this.dpr))
    this.scale = this.viewW / C.VIEW_WIDTH
  }

  /** Fill the whole screen (clears the previous frame). */
  clear(color: string): void {
    const g = this.ctx
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.fillStyle = color
    g.fillRect(0, 0, this.viewW, this.viewH)
  }

  /** Enter world space: subsequent draws are in world units, centered on camera. */
  beginWorld(cam: Camera, alpha: number): void {
    const g = this.ctx
    const camX = cam.renderX(alpha)
    const camY = cam.renderY(alpha)
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    g.translate(this.viewW / 2 + cam.shakeX(), this.viewH / 2 + cam.shakeY())
    g.scale(this.scale, this.scale)
    g.translate(-camX, -camY)
  }

  /** Back to screen space for HUD/overlay drawing. */
  beginScreen(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Visible world rect (for culling), given an interpolated camera position. */
  worldLeft(camX: number): number {
    return camX - this.viewW / 2 / this.scale
  }
  worldTop(camY: number): number {
    return camY - this.viewH / 2 / this.scale
  }
  worldRight(camX: number): number {
    return camX + this.viewW / 2 / this.scale
  }
  worldBottom(camY: number): number {
    return camY + this.viewH / 2 / this.scale
  }
}
