// Weapon registry. Patterns implemented: projectile (incl. homing), aura, orbit,
// strike. Field reuse for non-projectile patterns:
//   aura   -> area = radius, damage = per pulse, cooldown = pulse interval
//   orbit  -> count = orbiters, area = orbit radius, speed = angular (×0.01 rad/s),
//             ttl = orbiter lifetime, knockback on contact
//   strike -> count = targets hit, area = hit/visual radius
import type { WeaponDef } from './schema'
import { PAL } from './palette'

export const WEAPONS: Record<string, WeaponDef> = {
  // Nearest-target shard. Reliable starter.
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

  // Shotgun fan of projectiles in the aim direction.
  fan: {
    id: 'fan',
    name: 'Scatter Gun',
    desc: 'Fires a fan of pellets.',
    pattern: 'projectile',
    targeting: 'nearest',
    acceptsBonus: true,
    ttl: 0.55,
    projRadius: 5,
    color: '#ffb3c1',
    levels: [
      { damage: 7, cooldown: 1.1, count: 4, speed: 560, pierce: 0, area: 0, knockback: 50, duration: 0 },
      { damage: 8, cooldown: 1.05, count: 5, speed: 570, pierce: 0, area: 0, knockback: 50, duration: 0 },
      { damage: 10, cooldown: 1.0, count: 6, speed: 580, pierce: 1, area: 0, knockback: 60, duration: 0 },
      { damage: 12, cooldown: 0.92, count: 7, speed: 600, pierce: 1, area: 0, knockback: 60, duration: 0 },
      { damage: 15, cooldown: 0.85, count: 9, speed: 620, pierce: 2, area: 0, knockback: 70, duration: 0 },
    ],
  },

  // Homing missiles that curve into enemies.
  seeker: {
    id: 'seeker',
    name: 'Seeker Drone',
    desc: 'Launches homing micro-missiles.',
    pattern: 'projectile',
    targeting: 'nearest',
    acceptsBonus: true,
    homing: true,
    ttl: 2.2,
    projRadius: 6,
    color: '#9bff8f',
    levels: [
      { damage: 14, cooldown: 1.3, count: 1, speed: 360, pierce: 0, area: 0, knockback: 40, duration: 0 },
      { damage: 17, cooldown: 1.2, count: 1, speed: 380, pierce: 0, area: 0, knockback: 40, duration: 0 },
      { damage: 20, cooldown: 1.1, count: 2, speed: 400, pierce: 0, area: 0, knockback: 50, duration: 0 },
      { damage: 25, cooldown: 1.0, count: 2, speed: 420, pierce: 1, area: 0, knockback: 50, duration: 0 },
      { damage: 32, cooldown: 0.9, count: 3, speed: 450, pierce: 1, area: 0, knockback: 60, duration: 0 },
    ],
  },

  // Damaging aura that pulses around the player (forcefield).
  forcefield: {
    id: 'forcefield',
    name: 'Force Field',
    desc: 'Pulses damage to nearby enemies.',
    pattern: 'aura',
    targeting: 'self',
    acceptsBonus: false,
    ttl: 0,
    projRadius: 0,
    color: PAL.aura,
    levels: [
      { damage: 8, cooldown: 0.55, count: 0, speed: 0, pierce: 0, area: 70, knockback: 40, duration: 0 },
      { damage: 10, cooldown: 0.52, count: 0, speed: 0, pierce: 0, area: 82, knockback: 45, duration: 0 },
      { damage: 13, cooldown: 0.5, count: 0, speed: 0, pierce: 0, area: 95, knockback: 50, duration: 0 },
      { damage: 16, cooldown: 0.46, count: 0, speed: 0, pierce: 0, area: 110, knockback: 55, duration: 0 },
      { damage: 21, cooldown: 0.42, count: 0, speed: 0, pierce: 0, area: 128, knockback: 65, duration: 0 },
    ],
  },

  // Orbiting blades that circle the player.
  orbital: {
    id: 'orbital',
    name: 'Orbital Blades',
    desc: 'Blades that circle and slice.',
    pattern: 'orbit',
    targeting: 'self',
    acceptsBonus: false,
    ttl: 0,
    projRadius: 9,
    color: '#7afcff',
    // count = blades, area = orbit radius, speed = angular (×0.01 rad/s), ttl = lifetime
    levels: [
      { damage: 12, cooldown: 3.2, count: 2, speed: 220, pierce: 9999, area: 64, knockback: 50, duration: 0, },
      { damage: 15, cooldown: 3.2, count: 2, speed: 240, pierce: 9999, area: 70, knockback: 55, duration: 0 },
      { damage: 18, cooldown: 3.0, count: 3, speed: 250, pierce: 9999, area: 76, knockback: 60, duration: 0 },
      { damage: 22, cooldown: 3.0, count: 4, speed: 260, pierce: 9999, area: 82, knockback: 65, duration: 0 },
      { damage: 28, cooldown: 2.8, count: 5, speed: 280, pierce: 9999, area: 90, knockback: 75, duration: 0 },
    ],
  },

  // Chain lightning: instantly zaps the nearest N enemies.
  zap: {
    id: 'zap',
    name: 'Tesla Coil',
    desc: 'Zaps the nearest enemies.',
    pattern: 'strike',
    targeting: 'nearest',
    acceptsBonus: false,
    ttl: 0,
    projRadius: 0,
    color: '#bdb2ff',
    // count = targets struck, area = visual radius
    levels: [
      { damage: 18, cooldown: 1.2, count: 1, speed: 0, pierce: 0, area: 18, knockback: 30, duration: 0 },
      { damage: 22, cooldown: 1.1, count: 2, speed: 0, pierce: 0, area: 18, knockback: 30, duration: 0 },
      { damage: 27, cooldown: 1.0, count: 2, speed: 0, pierce: 0, area: 20, knockback: 35, duration: 0 },
      { damage: 33, cooldown: 0.95, count: 3, speed: 0, pierce: 0, area: 22, knockback: 40, duration: 0 },
      { damage: 42, cooldown: 0.85, count: 4, speed: 0, pierce: 0, area: 24, knockback: 45, duration: 0 },
    ],
  },
}

export const WEAPON_IDS = Object.keys(WEAPONS)

export function weaponLevel(def: WeaponDef, level: number) {
  return def.levels[Math.min(level, def.levels.length) - 1]
}
