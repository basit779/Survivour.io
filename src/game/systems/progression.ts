// Pickups (gem magnet + collection) and XP/leveling. The full level-up CARD
// screen arrives in the progression step; for now leveling applies a small
// automatic power bump so progression is felt end-to-end.
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import { xpToNext } from '../../data/levelCurve'
import { sfx } from '../../engine/audio/Sfx'
import { damageEnemy } from './combat'
import type { World } from '../World'
import type { Gem } from '../entities'

export function updatePickups(world: World, dt: number): void {
  const p = world.player
  const gm = world.gems
  const mag2 = p.magnet * p.magnet
  const hard2 = C.MAGNET_HARD * C.MAGNET_HARD
  const special2 = (p.radius + 26) * (p.radius + 26) // walk-over radius for items
  for (let i = 0; i < gm.count; i++) {
    const g = gm.items[i]
    const special = g.kind === 'bomb' || g.kind === 'magnet'
    const dx = p.x - g.x
    const dy = p.y - g.y
    const d2 = dx * dx + dy * dy
    if (!special) {
      if (d2 <= mag2) g.magnetized = true
      if (g.magnetized) {
        const d = Math.sqrt(d2) || 1
        g.x += (dx / d) * C.MAGNET_PULL * dt
        g.y += (dy / d) * C.MAGNET_PULL * dt
      }
    }
    if (d2 <= (special ? special2 : hard2)) {
      collect(world, g)
      g.alive = false
    }
  }
  gm.sweep()
}

function collect(world: World, g: Gem): void {
  const p = world.player
  switch (g.kind) {
    case 'xp':
      gainXp(world, g.value)
      sfx.pickup()
      break
    case 'gold':
      world.run.gold += g.value
      sfx.pickup()
      break
    case 'health':
      p.hp = Math.min(p.maxHp, p.hp + g.value)
      sfx.pickup()
      break
    case 'magnet':
      // vacuum every XP/gold gem on the field
      for (let i = 0; i < world.gems.count; i++) {
        const o = world.gems.items[i]
        if (o.kind === 'xp' || o.kind === 'gold') o.magnetized = true
      }
      world.spawnRing(p.x, p.y, p.magnet * 1.4, PAL.uiAccent, 0.4)
      sfx.levelUp()
      break
    case 'bomb':
      detonateBomb(world)
      break
  }
}

// Screen-clearing bomb: wipes the on-screen trash horde (bosses are immune).
function detonateBomb(world: World): void {
  const p = world.player
  const R = C.VIEW_WIDTH * 1.3
  const R2 = R * R
  const en = world.enemies
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (!e.alive || e.isBoss) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    if (dx * dx + dy * dy <= R2) damageEnemy(world, e, 99999, false, dx, dy, 240)
  }
  world.spawnRing(p.x, p.y, R * 0.85, PAL.aoeRim, 0.6)
  world.spawnRing(p.x, p.y, R * 0.6, PAL.aoeFire, 0.5)
  world.camera.addTrauma(0.85)
  sfx.explode()
}

function gainXp(world: World, amount: number): void {
  const p = world.player
  p.xp += amount
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext
    p.level++
    p.xpToNext = xpToNext(p.level)
    onLevelUp(world)
  }
}

function onLevelUp(world: World): void {
  const p = world.player
  // Queue an upgrade choice; RunScene pushes the LevelUpScene overlay.
  world.run.pendingLevels++
  world.camera.addTrauma(0.14)
  sfx.levelUp()
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2
    world.spawnParticle(p.x, p.y, Math.cos(a) * 170, Math.sin(a) * 170, 0.5, 3, PAL.uiAccent)
  }
}
