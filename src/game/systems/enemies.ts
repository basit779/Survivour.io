// Enemy spatial grid, steering AI (seek + separation), and the spawn director.
import { clamp } from '../../engine/math'
import { C, hpScale, targetEnemyCount } from '../../data/balance'
import type { World } from '../World'

/** Rebuild the broad-phase grid from current enemy positions (active indices). */
export function buildEnemyGrid(world: World): void {
  const grid = world.grid
  grid.clear()
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    grid.insert(i, e.x, e.y)
  }
}

const SEP_WEIGHT = 1.25

/** Seek the player with local separation so the swarm doesn't fully overlap. */
export function updateEnemyAI(world: World): void {
  const p = world.player
  const en = world.enemies
  const grid = world.grid
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    // seek
    const dx = p.x - e.x
    const dy = p.y - e.y
    const dl = Math.hypot(dx, dy) || 1
    let sx = dx / dl
    let sy = dy / dl
    // separation from nearby enemies
    let px = 0
    let py = 0
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
        px += ox / d
        py += oy / d
        nn++
      }
    })
    if (nn > 0) {
      sx += (px / nn) * SEP_WEIGHT
      sy += (py / nn) * SEP_WEIGHT
    }
    const sl = Math.hypot(sx, sy) || 1
    e.vx = (sx / sl) * e.speed
    e.vy = (sy / sl) * e.speed
  }
}

/** Time-based spawn director: keep the on-screen count near the target curve. */
export function updateSpawnDirector(world: World, dt: number): void {
  const minutes = world.run.elapsed / 60
  const target = Math.min(targetEnemyCount(minutes), C.MAX_ENEMIES)
  world.spawnTimer -= dt
  if (world.spawnTimer <= 0 && world.enemies.count < target) {
    world.spawnTimer = 0.35
    const batch = Math.min(6, target - world.enemies.count)
    for (let i = 0; i < batch; i++) spawnFromRing(world, minutes)
  }
}

function spawnFromRing(world: World, minutes: number): void {
  const p = world.player
  const ringR = C.VIEW_WIDTH * 0.5 * world.rng.range(C.SPAWN_RING_MIN, C.SPAWN_RING_MAX)
  const a = world.rng.range(0, Math.PI * 2)
  const x = clamp(p.x + Math.cos(a) * ringR, 30, C.ARENA_W - 30)
  const y = clamp(p.y + Math.sin(a) * ringR, 30, C.ARENA_H - 30)
  world.spawnEnemy(pickEnemy(world, minutes), x, y, hpScale(minutes, 0))
}

function pickEnemy(world: World, minutes: number): string {
  const r = world.rng.next()
  if (minutes > 3 && r < 0.12) return 'brute'
  if (minutes > 1 && r < 0.38) return 'runner'
  return 'swarmer'
}
