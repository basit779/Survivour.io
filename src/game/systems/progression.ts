// Pickups (gem magnet + collection) and XP/leveling. The full level-up CARD
// screen arrives in the progression step; for now leveling applies a small
// automatic power bump so progression is felt end-to-end.
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import { xpToNext } from '../../data/levelCurve'
import type { World } from '../World'
import type { Gem } from '../entities'

export function updatePickups(world: World, dt: number): void {
  const p = world.player
  const gm = world.gems
  const mag2 = p.magnet * p.magnet
  const hard2 = C.MAGNET_HARD * C.MAGNET_HARD
  for (let i = 0; i < gm.count; i++) {
    const g = gm.items[i]
    const dx = p.x - g.x
    const dy = p.y - g.y
    const d2 = dx * dx + dy * dy
    if (d2 <= mag2) g.magnetized = true
    if (g.magnetized) {
      const d = Math.sqrt(d2) || 1
      g.x += (dx / d) * C.MAGNET_PULL * dt
      g.y += (dy / d) * C.MAGNET_PULL * dt
    }
    if (d2 <= hard2) {
      collect(world, g)
      g.alive = false
    }
  }
  gm.sweep()
}

function collect(world: World, g: Gem): void {
  const p = world.player
  if (g.kind === 'xp') gainXp(world, g.value)
  else if (g.kind === 'gold') world.run.gold += g.value
  else if (g.kind === 'health') p.hp = Math.min(p.maxHp, p.hp + g.value)
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
  // Placeholder auto-progression (replaced by the upgrade-card screen later).
  p.maxHp += 4
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25)
  p.damageMult += 0.05
  p.attackSpeedMult += 0.015
  if (p.level % 4 === 0 && p.weapons[0].level < 5) p.weapons[0].level++
  world.camera.addTrauma(0.14)
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2
    world.spawnParticle(p.x, p.y, Math.cos(a) * 170, Math.sin(a) * 170, 0.5, 3, PAL.uiAccent)
  }
}
