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
    evolveWith: 'multishot',
    evolveInto: 'shard_storm',
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
    evolveWith: 'power',
    evolveInto: 'devastator',
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
    evolveWith: 'haste',
    evolveInto: 'swarm_drones',
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
    evolveWith: 'bigarea',
    evolveInto: 'singularity',
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
    evolveWith: 'power',
    evolveInto: 'event_horizon',
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
    evolveWith: 'scope',
    evolveInto: 'tempest',
    // count = targets struck, area = visual radius
    levels: [
      { damage: 18, cooldown: 1.2, count: 1, speed: 0, pierce: 0, area: 18, knockback: 30, duration: 0 },
      { damage: 22, cooldown: 1.1, count: 2, speed: 0, pierce: 0, area: 18, knockback: 30, duration: 0 },
      { damage: 27, cooldown: 1.0, count: 2, speed: 0, pierce: 0, area: 20, knockback: 35, duration: 0 },
      { damage: 33, cooldown: 0.95, count: 3, speed: 0, pierce: 0, area: 22, knockback: 40, duration: 0 },
      { damage: 42, cooldown: 0.85, count: 4, speed: 0, pierce: 0, area: 24, knockback: 45, duration: 0 },
    ],
  },

  // Lobbed firebomb: detonates AOE blasts in the densest crowds (crowd-clear).
  molotov: {
    id: 'molotov',
    name: 'Firebomb',
    desc: 'Lobs explosives into the densest crowds.',
    pattern: 'area',
    targeting: 'nearest',
    acceptsBonus: false,
    ttl: 0,
    projRadius: 0,
    color: '#ff7a18',
    evolveWith: 'coolant',
    evolveInto: 'inferno',
    // count = blast points, area = blast radius
    levels: [
      { damage: 16, cooldown: 1.6, count: 1, speed: 0, pierce: 0, area: 80, knockback: 60, duration: 0 },
      { damage: 20, cooldown: 1.5, count: 1, speed: 0, pierce: 0, area: 92, knockback: 65, duration: 0 },
      { damage: 26, cooldown: 1.4, count: 2, speed: 0, pierce: 0, area: 104, knockback: 70, duration: 0 },
      { damage: 33, cooldown: 1.3, count: 2, speed: 0, pierce: 0, area: 118, knockback: 80, duration: 0 },
      { damage: 44, cooldown: 1.15, count: 3, speed: 0, pierce: 0, area: 135, knockback: 90, duration: 0 },
    ],
  },

  // ---- Evolved weapons (single-tier, end-game power spikes) ----
  inferno: {
    id: 'inferno', name: 'Inferno', desc: 'Blankets the field in roaring fire.',
    pattern: 'area', targeting: 'nearest', acceptsBonus: false, isEvolved: true,
    ttl: 0, projRadius: 0, color: '#ff5a1a',
    levels: [{ damage: 60, cooldown: 0.8, count: 4, speed: 0, pierce: 0, area: 160, knockback: 100, duration: 0 }],
  },
  shard_storm: {
    id: 'shard_storm', name: 'Shard Storm', desc: 'A relentless storm of piercing shards.',
    pattern: 'projectile', targeting: 'nearest', acceptsBonus: true, isEvolved: true,
    ttl: 1.6, projRadius: 7, color: '#fff3a0',
    levels: [{ damage: 44, cooldown: 0.4, count: 6, speed: 720, pierce: 4, area: 0, knockback: 110, duration: 0 }],
  },
  devastator: {
    id: 'devastator', name: 'Devastator', desc: 'A devastating wall of shot.',
    pattern: 'projectile', targeting: 'nearest', acceptsBonus: true, isEvolved: true,
    ttl: 0.6, projRadius: 6, color: '#ff7d9c',
    levels: [{ damage: 26, cooldown: 0.7, count: 14, speed: 700, pierce: 3, area: 0, knockback: 90, duration: 0 }],
  },
  swarm_drones: {
    id: 'swarm_drones', name: 'Drone Swarm', desc: 'A swarm of relentless homing drones.',
    pattern: 'projectile', targeting: 'nearest', acceptsBonus: true, homing: true, isEvolved: true,
    ttl: 2.6, projRadius: 7, color: '#c6ff8f',
    levels: [{ damage: 34, cooldown: 0.5, count: 6, speed: 480, pierce: 1, area: 0, knockback: 70, duration: 0 }],
  },
  singularity: {
    id: 'singularity', name: 'Singularity', desc: 'A massive crushing field.',
    pattern: 'aura', targeting: 'self', acceptsBonus: false, isEvolved: true,
    ttl: 0, projRadius: 0, color: PAL.aura,
    levels: [{ damage: 36, cooldown: 0.34, count: 0, speed: 0, pierce: 0, area: 180, knockback: 100, duration: 0 }],
  },
  event_horizon: {
    id: 'event_horizon', name: 'Event Horizon', desc: 'A ring of unstoppable blades.',
    pattern: 'orbit', targeting: 'self', acceptsBonus: false, isEvolved: true,
    ttl: 0, projRadius: 11, color: '#a6fcff',
    levels: [{ damage: 44, cooldown: 2.4, count: 7, speed: 320, pierce: 9999, area: 108, knockback: 90, duration: 0 }],
  },
  tempest: {
    id: 'tempest', name: 'Tempest', desc: 'A storm of chained lightning.',
    pattern: 'strike', targeting: 'nearest', acceptsBonus: false, isEvolved: true,
    ttl: 0, projRadius: 0, color: '#d6c9ff',
    levels: [{ damage: 64, cooldown: 0.6, count: 6, speed: 0, pierce: 0, area: 26, knockback: 50, duration: 0 }],
  },
}

export const WEAPON_IDS = Object.keys(WEAPONS)
/** Base (non-evolved) weapons — the only ones offered as fresh picks. */
export const BASE_WEAPON_IDS = WEAPON_IDS.filter((id) => !WEAPONS[id].isEvolved)

export function weaponLevel(def: WeaponDef, level: number) {
  return def.levels[Math.min(level, def.levels.length) - 1]
}
