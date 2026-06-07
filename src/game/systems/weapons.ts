// Weapon firing: tick each owned weapon's cooldown and emit its attack. Starter
// build supports the nearest-target projectile pattern; more patterns are added
// in the full-weapons step.
import { C } from '../../data/balance'
import { WEAPONS, weaponLevel } from '../../data/weapons'
import type { World } from '../World'
import type { WeaponDef, WeaponLevel } from '../../data/schema'
import type { Player } from '../entities'
import type { Enemy } from '../entities'

const TARGET_RANGE = 1400

export function updateWeapons(world: World, dt: number): void {
  const p = world.player
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i]
    const def = WEAPONS[w.defId]
    if (!def) continue
    const lv = weaponLevel(def, w.level)
    w.cooldownTimer -= dt
    if (w.cooldownTimer > 0) continue
    const cd = lv.cooldown / Math.max(0.25, p.attackSpeedMult)
    w.cooldownTimer = cd
    fire(world, def, lv, p)
  }
}

function fire(world: World, def: WeaponDef, lv: WeaponLevel, p: Player): void {
  if (def.pattern === 'projectile') {
    const target = findNearest(world, p.x, p.y, TARGET_RANGE)
    const baseAngle = target
      ? Math.atan2(target.y - p.y, target.x - p.x)
      : Math.atan2(p.facingY, p.facingX)
    const count = lv.count
    const spread = 0.16
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread
      const a = baseAngle + offset
      const crit = world.rng.next() < p.critChance
      const dmg = lv.damage * p.damageMult * (crit ? p.critMult : 1)
      if (world.projectiles.count >= C.MAX_PROJECTILES) break
      world.spawnProjectile(
        p.x,
        p.y,
        Math.cos(a) * lv.speed,
        Math.sin(a) * lv.speed,
        dmg,
        lv.pierce,
        def.projRadius,
        def.ttl,
        lv.knockback,
        crit,
        def.color,
      )
    }
  }
}

export function findNearest(world: World, x: number, y: number, maxRange: number): Enemy | null {
  const en = world.enemies
  let best = -1
  let bestD2 = maxRange * maxRange
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]
    if (e.hp <= 0) continue
    const dx = e.x - x
    const dy = e.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return best >= 0 ? en.items[best] : null
}
