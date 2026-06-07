// Enemy spatial grid, per-behavior steering AI (seek + separation + ranged kite
// + suicide rush + boss volleys), and the wave/boss spawn director.
import { clamp, TAU } from '../../engine/math'
import { C, hpScale, dmgScale, speedScale, targetEnemyCount } from '../../data/balance'
import type { World } from '../World'

/** Rebuild the broad-phase grid from current enemy positions (active indices). */
export function buildEnemyGrid(world: World): void {
  const grid = world.grid
  grid.clear()
  const en = world.enemies
  for (let i = 0; i < en.count; i++) grid.insert(i, en.items[i].x, en.items[i].y)
}

const SEP_WEIGHT = 1.25
const SHOT_COLOR = '#ff5d73'

export function updateEnemyAI(world: World, dt: number): void {
  const p = world.player
  const en = world.enemies
  const grid = world.grid
  if (world.boss && !world.boss.alive) world.boss = null

  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    const dx = p.x - e.x
    const dy = p.y - e.y
    const dl = Math.hypot(dx, dy) || 1
    const toX = dx / dl
    const toY = dy / dl

    // separation (skip for boss — it shoves through)
    let sepX = 0
    let sepY = 0
    if (!e.isBoss) {
      let nn = 0
      const sepR = e.radius + 14
      grid.query(e.x, e.y, sepR, (id) => {
        if (id === i) return
        const o = en.items[id]
        const ox = e.x - o.x
        const oy = e.y - o.y
        const d2 = ox * ox + oy * oy
        const minD = e.radius + o.radius
        if (d2 > 1e-4 && d2 < minD * minD) {
          const d = Math.sqrt(d2)
          sepX += ox / d
          sepY += oy / d
          nn++
        }
      })
      if (nn > 0) {
        sepX = (sepX / nn) * SEP_WEIGHT
        sepY = (sepY / nn) * SEP_WEIGHT
      }
    }

    let mx = toX
    let my = toY
    switch (e.behavior) {
      case 'ranged': {
        // kite: approach if far, retreat if too close, else hold
        if (dl > e.preferRange * 1.1) {
          mx = toX
          my = toY
        } else if (dl < e.preferRange * 0.8) {
          mx = -toX
          my = -toY
        } else {
          mx = -toY // strafe
          my = toX
        }
        e.fireTimer -= dt
        if (e.fireTimer <= 0 && dl < e.preferRange * 1.6) {
          e.fireTimer = e.fireCooldown
          world.spawnHostileShot(e.x, e.y, toX * e.shotSpeed, toY * e.shotSpeed, e.shotDamage, 6, 3.5, SHOT_COLOR)
        }
        break
      }
      case 'suicide': {
        mx = toX
        my = toY
        if (dl < e.explodeRange) e.hp = 0 // detonates in DeathSystem
        break
      }
      case 'boss': {
        mx = toX
        my = toY
        e.fireTimer -= dt
        if (e.fireTimer <= 0) {
          e.fireTimer = e.fireCooldown
          const n = Math.max(1, e.burst)
          const base = world.rng.range(0, TAU)
          for (let k = 0; k < n; k++) {
            const a = base + (k / n) * TAU
            world.spawnHostileShot(e.x, e.y, Math.cos(a) * e.shotSpeed, Math.sin(a) * e.shotSpeed, e.shotDamage, 7, 4, SHOT_COLOR)
          }
        }
        break
      }
      default:
        mx = toX
        my = toY
    }

    let vx = mx + sepX
    let vy = my + sepY
    const vl = Math.hypot(vx, vy) || 1
    e.vx = (vx / vl) * e.speed
    e.vy = (vy / vl) * e.speed
  }
}

// ---------------------------------------------------------------------------
// Spawn director
// ---------------------------------------------------------------------------

export function updateSpawnDirector(world: World, dt: number): void {
  const minutes = world.run.elapsed / 60

  // scheduled bosses at 5/10/15 min
  if (world.bossIndex < C.BOSS_TIMES.length && world.run.elapsed >= C.BOSS_TIMES[world.bossIndex]) {
    spawnBoss(world, minutes)
    world.bossIndex++
  }

  // periodic elite after 2 minutes
  world.eliteTimer -= dt
  if (minutes >= 2 && world.eliteTimer <= 0) {
    world.eliteTimer = 45
    spawnAt(world, 'elite_brute', minutes, 0.95)
  }

  // ambient swarm toward the on-screen target curve
  const target = Math.min(targetEnemyCount(minutes), C.MAX_ENEMIES)
  world.spawnTimer -= dt
  if (world.spawnTimer <= 0 && world.enemies.count < target) {
    world.spawnTimer = 0.35
    const batch = Math.min(8, target - world.enemies.count)
    for (let i = 0; i < batch; i++) spawnAt(world, pickEnemy(world, minutes), minutes, world.rng.range(C.SPAWN_RING_MIN, C.SPAWN_RING_MAX))
  }
}

function spawnAt(world: World, id: string, minutes: number, ringMul: number): void {
  const p = world.player
  const ringR = C.VIEW_WIDTH * 0.5 * ringMul
  const a = world.rng.range(0, TAU)
  const x = clamp(p.x + Math.cos(a) * ringR, 30, C.ARENA_W - 30)
  const y = clamp(p.y + Math.sin(a) * ringR, 30, C.ARENA_H - 30)
  world.spawnEnemy(id, x, y, hpScale(minutes, 0), dmgScale(minutes), speedScale(minutes))
}

function spawnBoss(world: World, minutes: number): void {
  const p = world.player
  const a = world.rng.range(0, TAU)
  const ringR = C.VIEW_WIDTH * 0.55
  const x = clamp(p.x + Math.cos(a) * ringR, 60, C.ARENA_W - 60)
  const y = clamp(p.y + Math.sin(a) * ringR, 60, C.ARENA_H - 60)
  const boss = world.spawnEnemy('boss_warden', x, y, hpScale(minutes, 0) * 0.6, dmgScale(minutes), 1)
  world.boss = boss
  world.camera.addTrauma(0.7)
}

function pickEnemy(world: World, minutes: number): string {
  const r = world.rng.next()
  if (minutes >= 4) {
    if (r < 0.1) return 'splitter'
    if (r < 0.22) return 'bomber'
    if (r < 0.34) return 'spitter'
    if (r < 0.46) return 'brute'
    if (r < 0.66) return 'runner'
    return 'swarmer'
  }
  if (minutes >= 2) {
    if (r < 0.12) return 'bomber'
    if (r < 0.26) return 'spitter'
    if (r < 0.4) return 'brute'
    if (r < 0.62) return 'runner'
    return 'swarmer'
  }
  if (minutes >= 1) {
    if (r < 0.1) return 'brute'
    if (r < 0.4) return 'runner'
    return 'swarmer'
  }
  return r < 0.2 ? 'runner' : 'swarmer'
}
