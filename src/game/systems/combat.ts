// Movement integration (enemies/projectiles/gems — the player integrates in its
// own control system), projectile lifetime, broad-phase collisions, damage
// application, and death resolution with drops/particles.
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import { angleDelta, clamp } from '../../engine/math'
import { findNearest } from './target'
import { sfx } from '../../engine/audio/Sfx'
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
  const pl = world.player
  const pr = world.projectiles
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    if (q.mode === 'orbit') {
      q.orbitAngle += q.orbitSpeed * dt
      q.x = pl.x + Math.cos(q.orbitAngle) * q.orbitRadius
      q.y = pl.y + Math.sin(q.orbitAngle) * q.orbitRadius
      q.rehitTimer -= dt
      if (q.rehitTimer <= 0) {
        q.hitList.length = 0
        q.rehitTimer = 0.3
      }
    } else {
      q.x += q.vx * dt
      q.y += q.vy * dt
    }
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
    if (q.homing) {
      const t = findNearest(world, q.x, q.y, 520)
      if (t) {
        const sp = Math.hypot(q.vx, q.vy) || 1
        const cur = Math.atan2(q.vy, q.vx)
        const desired = Math.atan2(t.y - q.y, t.x - q.x)
        const na = cur + clamp(angleDelta(cur, desired), -7 * dt, 7 * dt)
        q.vx = Math.cos(na) * sp
        q.vy = Math.sin(na) * sp
      }
    }
    q.ttl -= dt
    if (q.mode !== 'orbit' && (q.ttl <= 0 || q.x < -60 || q.y < -60 || q.x > C.ARENA_W + 60 || q.y > C.ARENA_H + 60)) {
      q.alive = false
    } else if (q.ttl <= 0) {
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
    if (!q.alive || q.hostile) continue
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

  // hostile projectile -> player
  for (let i = 0; i < pr.count; i++) {
    const q = pr.items[i]
    if (!q.alive || !q.hostile) continue
    const dx = q.x - p.x
    const dy = q.y - p.y
    const rr = p.radius + q.radius
    if (dx * dx + dy * dy <= rr * rr) {
      damagePlayer(world, q.damage)
      q.alive = false
    }
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
  if (crit) {
    world.camera.addTrauma(0.05)
    sfx.crit()
  } else {
    sfx.hit()
  }
}

export function damagePlayer(world: World, amount: number): void {
  const p = world.player
  if (p.iframe > 0) return
  p.hp -= Math.max(1, amount - p.armor)
  p.iframe = C.IFRAME
  p.hurtFlash = 0.18
  world.camera.addTrauma(0.32)
  sfx.hurt()
  if (p.hp <= 0) {
    p.hp = 0
    world.run.state = 'dead'
  }
}

export function updateDeaths(world: World): void {
  const en = world.enemies
  const p = world.player
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (e.hp > 0 || !e.alive) continue
    world.run.kills++

    // suicide detonation: AoE damage + burst
    if (e.behavior === 'suicide' && e.explodeRadius > 0) {
      const dx = p.x - e.x
      const dy = p.y - e.y
      const rr = e.explodeRadius + p.radius
      if (dx * dx + dy * dy <= rr * rr) damagePlayer(world, e.explodeDamage)
      world.camera.addTrauma(0.18)
      sfx.explode()
      world.spawnRing(e.x, e.y, e.explodeRadius, PAL.aoeFire, 0.42)
      for (let k = 0; k < 18; k++) {
        const a = world.rng.range(0, Math.PI * 2)
        const sp = world.rng.range(90, 240)
        world.spawnParticle(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.25, 0.55), world.rng.range(2.5, 4.5), e.glow)
      }
    }

    // splitter: spawn children
    if (e.behavior === 'split' && e.splitInto > 0 && e.childId) {
      for (let k = 0; k < e.splitInto; k++) {
        const a = (k / e.splitInto) * Math.PI * 2
        world.spawnEnemy(e.childId, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, 1)
      }
    }

    // drops
    if (e.isBoss) {
      world.spawnGem(e.x, e.y, e.xp, 'xp')
      for (let k = 0; k < 10; k++) {
        world.spawnGem(e.x + world.rng.range(-30, 30), e.y + world.rng.range(-30, 30), Math.ceil(e.gold / 10), 'gold')
      }
      world.spawnGem(e.x, e.y, Math.round(p.maxHp * 0.3), 'health')
      world.camera.addTrauma(0.6)
      world.spawnRing(e.x, e.y, e.radius * 4.5, PAL.aoeFire, 0.7)
      world.spawnRing(e.x, e.y, e.radius * 3, PAL.aoeRim, 0.5)
      world.boss = null
      sfx.bossDie()
    } else {
      world.spawnGem(e.x, e.y, e.xp, 'xp')
      if (world.rng.next() < 0.12) world.spawnGem(e.x, e.y, e.gold, 'gold')
      if (e.behavior !== 'suicide') sfx.enemyDie()
    }

    const n = e.radius > 16 ? 12 : 6
    for (let k = 0; k < n; k++) {
      const a = world.rng.range(0, Math.PI * 2)
      const sp = world.rng.range(50, 160)
      world.spawnParticle(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp, world.rng.range(0.22, 0.5), world.rng.range(2, 4), e.glow)
    }
    if (e.radius > 16 && !e.isBoss) {
      world.camera.addTrauma(0.12)
      world.spawnRing(e.x, e.y, e.radius * 2.2, e.glow, 0.34)
    }
    e.alive = false
  }
  en.sweep()
}
