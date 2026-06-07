// Weapon firing for every pattern. Reads aggregated player stats (damage, attack
// speed, cooldown reduction, +projectiles, area). Projectiles are spawned into
// the pool and resolved by the collision system; aura/strike apply damage
// instantly via damageEnemy.
import { C } from '../../data/balance'
import { TAU } from '../../engine/math'
import { PAL } from '../../data/palette'
import { WEAPONS, weaponLevel } from '../../data/weapons'
import { damageEnemy } from './combat'
import { findNearest, findNearestN } from './target'
import { sfx } from '../../engine/audio/Sfx'
import type { World } from '../World'
import type { WeaponDef, WeaponLevel } from '../../data/schema'
import type { Player, Enemy } from '../entities'

const TARGET_RANGE = 1400
const strikeTargets: Enemy[] = []

export function updateWeapons(world: World, dt: number): void {
  const p = world.player
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i]
    const def = WEAPONS[w.defId]
    if (!def) continue
    const lv = weaponLevel(def, w.level)
    w.cooldownTimer -= dt
    if (w.cooldownTimer > 0) continue
    const cd = Math.max(lv.cooldown * 0.25, (lv.cooldown * p.cooldownMult) / Math.max(0.25, p.attackSpeedMult))
    w.cooldownTimer = cd
    fire(world, def, lv, p)
  }
}

function rollDamage(world: World, base: number, p: Player): { dmg: number; crit: boolean } {
  const crit = world.rng.next() < p.critChance
  return { dmg: base * p.damageMult * (crit ? p.critMult : 1), crit }
}

function fire(world: World, def: WeaponDef, lv: WeaponLevel, p: Player): void {
  sfx.shoot()
  switch (def.pattern) {
    case 'projectile':
      fireProjectile(world, def, lv, p)
      break
    case 'aura':
      fireAura(world, lv, p)
      break
    case 'orbit':
      fireOrbit(world, def, lv, p)
      break
    case 'strike':
      fireStrike(world, lv, p)
      break
    default:
      fireProjectile(world, def, lv, p)
  }
}

function fireProjectile(world: World, def: WeaponDef, lv: WeaponLevel, p: Player): void {
  const target = findNearest(world, p.x, p.y, TARGET_RANGE)
  const baseAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.facingY, p.facingX)
  const count = lv.count + (def.acceptsBonus ? p.projectileBonus : 0)
  const spread = count > 1 ? 0.16 : 0
  for (let i = 0; i < count; i++) {
    if (world.projectiles.count >= C.MAX_PROJECTILES) break
    const offset = (i - (count - 1) / 2) * spread
    const a = baseAngle + offset
    const { dmg, crit } = rollDamage(world, lv.damage, p)
    const q = world.spawnProjectile(
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
    if (def.homing) q.homing = true
  }
}

function fireAura(world: World, lv: WeaponLevel, p: Player): void {
  const radius = lv.area * p.areaMult
  const r2 = radius * radius
  const en = world.enemies
  world.grid.query(p.x, p.y, radius, (id) => {
    const e = en.items[id]
    if (!e || !e.alive || e.hp <= 0) return
    const dx = e.x - p.x
    const dy = e.y - p.y
    if (dx * dx + dy * dy <= r2 + e.radius * e.radius) {
      const { dmg, crit } = rollDamage(world, lv.damage, p)
      damageEnemy(world, e, dmg, crit, dx, dy, lv.knockback)
    }
  })
  // big additive AOE pulse
  world.spawnRing(p.x, p.y, radius, PAL.aoeFire, 0.3)
}

function fireOrbit(world: World, def: WeaponDef, lv: WeaponLevel, p: Player): void {
  const count = lv.count
  const radius = lv.area * p.areaMult
  const life = lv.cooldown * 0.98 // expire just before the next summon
  for (let i = 0; i < count; i++) {
    if (world.projectiles.count >= C.MAX_PROJECTILES) break
    const { dmg, crit } = rollDamage(world, lv.damage, p)
    const q = world.spawnProjectile(p.x, p.y, 0, 0, dmg, lv.pierce, def.projRadius, life, lv.knockback, crit, def.color)
    q.mode = 'orbit'
    q.orbitRadius = radius
    q.orbitSpeed = lv.speed * 0.01
    q.orbitAngle = (i / count) * TAU
    q.rehitTimer = 0
  }
}

function fireStrike(world: World, lv: WeaponLevel, p: Player): void {
  findNearestN(world, p.x, p.y, TARGET_RANGE, lv.count, strikeTargets)
  for (let i = 0; i < strikeTargets.length; i++) {
    const e = strikeTargets[i]
    const { dmg, crit } = rollDamage(world, lv.damage, p)
    damageEnemy(world, e, dmg, crit, e.x - p.x, e.y - p.y, lv.knockback)
    // zap visual: bolt particles + impact ring
    const steps = 7
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      world.spawnParticle(p.x + (e.x - p.x) * t, p.y + (e.y - p.y) * t, 0, 0, 0.12, 3, PAL.zap)
    }
    world.spawnRing(e.x, e.y, e.radius * 2.2, PAL.zap, 0.22)
  }
}
