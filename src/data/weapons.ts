// Weapon registry. (Starter set for the playable milestone — the full 10-weapon
// roster + evolutions land in the weapons/evolutions step.)
import type { WeaponDef } from './schema'
import { PAL } from './palette'

export const WEAPONS: Record<string, WeaponDef> = {
  // Auto-targets the nearest enemy and fires a fast shard. Gains projectiles &
  // pierce as it levels. The reliable bread-and-butter starter.
  shard: {
    id: 'shard',
    name: 'Shard Thrower',
    desc: 'Hurls a shard at the nearest enemy.',
    pattern: 'projectile',
    targeting: 'nearest',
    acceptsBonus: true,
    ttl: 1.4,
    projRadius: 6,
    color: PAL.projectile,
    levels: [
      { damage: 12, cooldown: 0.9, count: 1, speed: 520, pierce: 0, area: 0, knockback: 60, duration: 0 },
      { damage: 15, cooldown: 0.82, count: 1, speed: 540, pierce: 0, area: 0, knockback: 60, duration: 0 },
      { damage: 18, cooldown: 0.74, count: 2, speed: 560, pierce: 1, area: 0, knockback: 70, duration: 0 },
      { damage: 23, cooldown: 0.66, count: 2, speed: 580, pierce: 1, area: 0, knockback: 80, duration: 0 },
      { damage: 30, cooldown: 0.58, count: 3, speed: 620, pierce: 2, area: 0, knockback: 90, duration: 0 },
    ],
  },
}

export function weaponLevel(def: WeaponDef, level: number) {
  return def.levels[Math.min(level, def.levels.length) - 1]
}
