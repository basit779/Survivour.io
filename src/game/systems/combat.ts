// Movement integration (enemies/projectiles/gems — the player integrates in its
// own control system), projectile lifetime, broad-phase collisions, damage
// application, and death resolution with drops/particles.
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import type { World } from '../World'
import type { Enemy } from '../entities'

export function updateMovement(world: World, dt: number): void {
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    e.x += e.vx * dt
    e.y += e.vy * dt
    if (e.hitFlash > 0) e.hitFlash -= dt
  }
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    q.x += q.vx * dt
    q.y += q.vy * dt
  }
  const gm = world.gems
  const drag = Math.exp(-4 * dt)
  for (let i = 0; i < gm.count; i++) {
    const g = gm.items[i]
    if (!g.magnetized) {
      g.x += g.vx * dt
      g.y += g.vy * dt
      g.vx *= drag
      g.vy *= drag
    }
  }
}

export function updateProjectiles(world: World, dt: number): void {
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    q.ttl -= dt
    if (q.ttl <= 0 || q.x < -60 || q.y < -60 || q.x > C.ARENA_W + 60 || q.y > C.ARENA_H + 60) {
      q.alive = false
    }
  }
  pr.sweep()
}

export function updateCollisions(world: World): void {
  const pr = world.projectiles
  const en = world.enemies
  const grid = world.grid
  const p = world.player

  // projectile -> enemy
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    if (!q.alive) continue
    grid.query(q.x, q.y, q.radius + 36, (id) => {
      if (!q.alive) return
      const e = en.items[id]
      if (!e || !e.alive || e.hp <= 0) return
      if (q.hitList.indexOf(e) >= 0) return
      const dx = e.x - q.x
      const dy = e.y - q.y
      const rr = e.radius + q.radius
      if (dx * dx + dy * dy <= rr * rr) {
        damageEnemy(world, e, q.damage, q.crit, q.vx, q.vy, q.knockback)
        q.hitList.push(e)
        if (q.pierceLeft <= 0) q.alive = false
        else q.pierceLeft--
      }
    })
  }

  // enemy -> player contact (take the MAX overlapping contact, gated by i-frames)
  if (p.iframe <= 0) {
    let maxContact = 0
    grid.query(p.x, p.y, p.radius + 44, (id) => {
      const e = en.items[id]
      if (!e || !e.alive) return
      const dx = e.x - p.x
      const dy = e.y - p.y
      const rr = e.radius + p.radius
      if (dx * dx + dy * dy <= rr * rr && e.contact > maxContact) maxContact = e.contact
    })
    if (maxContact > 0) damagePlayer(world, maxContact)
  }
}

export function damageEnemy(
  world: World,
  e: Enemy,
  amount: number,
  crit: boolean,
  dirX: number,
  dirY: number,
  knockback: number,
): void {
  e.hp -= amount
  e.hitFlash = 0.08
  const l = Math.hypot(dirX, dirY) || 1
  const kb = (knockback / Math.max(0.4, e.mass)) * 0.05
  e.x += (dirX / l) * kb
  e.y += (dirY / l) * kb
  world.spawnDamageNumber(e.x, e.y - e.radius, Math.round(amount).toString(), crit ? PAL.dmgCrit : PAL.dmg, crit)
  if (crit) world.camera.addTrauma(0.05)
}

export function damagePlayer(world: World, amount: number): void {
  const p = world.player
  if (p.iframe > 0) return
  p.hp -= amount
  p.iframe = C.IFRAME
  p.hurtFlash = 0.18
  world.camera.addTrauma(0.32)
  if (p.hp <= 0) {
    p.hp = 0
    world.run.state = 'dead'
  }
}

export function updateDeaths(world: World): void {
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (e.hp <= 0 && e.alive) {
      world.run.kills++
      world.spawnGem(e.x, e.y, e.xp, 'xp')
      if (world.rng.next() < 0.12) world.spawnGem(e.x, e.y, e.gold, 'gold')
      const n = e.radius > 16 ? 12 : 6
      for (let k = 0; k < n; k++) {
        const a = world.rng.range(0, Math.PI * 2)
        const sp = world.rng.range(50, 160)
        world.spawnParticle(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.22, 0.5), world.rng.range(2, 4), e.glow)
      }
      if (e.radius > 16) world.camera.addTrauma(0.12)
      e.alive = false
    }
  }
  en.sweep()
}
