// Per-tick bookkeeping: snapshot previous positions (for render interpolation),
// camera follow + shake decay, particle integration, damage-number float/fade.
import { lerp } from '../../engine/math'
import { C } from '../../data/balance'
import type { World } from '../World'

/** Copy current -> prev for every interpolated entity, at the top of each tick. */
export function snapshotPrev(world: World): void {
  const p = world.player
  p.prevX = p.x
  p.prevY = p.y
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    en.items[i].prevX = en.items[i].x
    en.items[i].prevY = en.items[i].y
  }
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    pr.items[i].prevX = pr.items[i].x
    pr.items[i].prevY = pr.items[i].y
  }
  const gm = world.gems
  for (let i = 0; i < gm.count; i++) {
    gm.items[i].prevX = gm.items[i].x
    gm.items[i].prevY = gm.items[i].y
  }
  world.camera.snapshotPrev()
}

export function updateCamera(world: World, dt: number): void {
  const cam = world.camera
  const p = world.player
  const tx = p.x + p.vx * C.CAM_LOOKAHEAD
  const ty = p.y + p.vy * C.CAM_LOOKAHEAD
  cam.x = lerp(cam.x, tx, C.CAM_LERP)
  cam.y = lerp(cam.y, ty, C.CAM_LERP)
  cam.decay(dt)
}

export function updateParticles(world: World, dt: number): void {
  const ps = world.particles
  for (let i = 0; i < ps.count; i++) {
    const pt = ps.items[i]
    pt.life -= dt
    if (pt.life <= 0) {
      pt.alive = false
      continue
    }
    const d = Math.exp(-pt.drag * dt)
    pt.vx *= d
    pt.vy *= d
    pt.x += pt.vx * dt
    pt.y += pt.vy * dt
  }
  ps.sweep()
}

export function updateDamageNumbers(world: World, dt: number): void {
  const dn = world.damageNumbers
  for (let i = 0; i < dn.count; i++) {
    const d = dn.items[i]
    d.life -= dt
    if (d.life <= 0) {
      d.alive = false
      continue
    }
    d.y += d.vy * dt
    d.vy *= Math.exp(-3 * dt)
  }
  dn.sweep()
}
