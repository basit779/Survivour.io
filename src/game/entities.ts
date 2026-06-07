// Entity structs. The player is a singleton; everything else is pooled and
// carries an `alive` flag for the SwapPool. Moving entities keep prevX/prevY so
// the renderer can interpolate between sim ticks.
import { C } from '../data/balance'
import type { EnemyBehavior, EnemyShape, WeaponInstance, PassiveInstance, PassiveStat } from '../data/schema'

export class Player {
  alive = true
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  vx = 0
  vy = 0
  facingX = 1
  facingY = 0

  hp: number = C.PLAYER_BASE_HP
  maxHp: number = C.PLAYER_BASE_HP
  radius: number = C.PLAYER_RADIUS

  level = 1
  xp = 0
  xpToNext = 5

  // Aggregated stat multipliers (recomputed when upgrades change).
  moveSpeed: number = C.PLAYER_MAX_SPEED
  magnet: number = C.MAGNET_BASE
  damageMult = 1
  areaMult = 1
  attackSpeedMult = 1
  critChance: number = C.CRIT_CHANCE
  critMult: number = C.CRIT_MULT
  projectileBonus = 0
  cooldownMult = 1 // 1 = no reduction; lower = faster
  regen = 0 // hp/sec
  armor = 0 // flat contact-damage reduction

  iframe = 0
  hurtFlash = 0

  weapons: WeaponInstance[] = []
  passives: PassiveInstance[] = []
  /** Permanent (meta + operator) stat bonuses, applied every recompute. */
  metaStats: Partial<Record<PassiveStat, number>> = {}
}

export class Enemy {
  alive = false
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  vx = 0
  vy = 0
  hp = 1
  maxHp = 1
  radius = 12
  mass = 1
  speed = 60
  contact = 5
  xp = 1
  gold = 1
  defId = 'swarmer'
  behavior: EnemyBehavior = 'chase'
  color = '#fff'
  glow = '#fff'
  shape: EnemyShape = 'circle'
  hitFlash = 0
  // behavior params (filled from EnemyDef.special at spawn)
  fireTimer = 0
  fireCooldown = 0
  shotDamage = 0
  shotSpeed = 0
  preferRange = 0
  explodeRadius = 0
  explodeDamage = 0
  explodeRange = 0
  splitInto = 0
  childId = ''
  burst = 0
  isBoss = false
}

export class Projectile {
  alive = false
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  vx = 0
  vy = 0
  damage = 0
  pierceLeft = 0
  radius = 6
  ttl = 1
  knockback = 0
  crit = false
  color = '#fff'
  /** Hostile projectiles (from enemies) damage the player instead of enemies. */
  hostile = false
  /** Enemies already hit (pierce dedup); reused, cleared on spawn. */
  hitList: Enemy[] = []
  // Movement modes for non-linear weapons.
  mode: 'linear' | 'orbit' = 'linear'
  homing = false
  orbitAngle = 0
  orbitRadius = 0
  orbitSpeed = 0
  rehitTimer = 0 // orbit weapons clear hitList on this interval to re-hit
}

export type GemKind = 'xp' | 'gold' | 'health'

export class Gem {
  alive = false
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  vx = 0
  vy = 0
  value = 1
  radius = 5
  kind: GemKind = 'xp'
  color = '#fff'
  magnetized = false
}

export class Particle {
  alive = false
  x = 0
  y = 0
  vx = 0
  vy = 0
  life = 0
  maxLife = 1
  size = 2
  color = '#fff'
  drag = 3
  // Expanding AOE shockwave (big punchy explosion/aura visual). When true the
  // renderer draws a filled+stroked additive ring growing r0 -> r1 over life.
  ring = false
  r0 = 0
  r1 = 0
}

export class DamageNumber {
  alive = false
  x = 0
  y = 0
  vy = -46
  life = 0
  maxLife = 0.75
  text = ''
  color = '#fff'
  crit = false
}
