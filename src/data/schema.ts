// SHARED DATA CONTRACT — every content/data table and system imports its types
// from here. Pure types + enums (no runtime cost beyond the const objects).
//
// Convention: all durations are in SECONDS, all distances in WORLD UNITS (WU).
// Weapon tables are authored directly in seconds (no ms->s load conversion).

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

/** How a weapon delivers damage. */
export type FirePattern =
  | 'projectile' // travels in a straight line (kunai/shuriken)
  | 'orbit' // circles the player (guardian)
  | 'aura' // damages everything in a radius around the player (forcefield)
  | 'beam' // instant line/laser
  | 'boomerang' // out-and-back
  | 'area' // ground hazard / explosion at a point (molotov)
  | 'strike' // lightning-style instant hit on a target

/** How a weapon chooses what to hit. */
export type Targeting = 'nearest' | 'facing' | 'random' | 'lowestHp' | 'self'

/** Per-level stat row for a weapon. */
export interface WeaponLevel {
  damage: number
  cooldown: number // seconds between activations
  count: number // projectiles / orbiters / strikes per activation
  speed: number // WU/s (projectile-like patterns)
  pierce: number // extra enemies a projectile passes through (0 = stops on first)
  area: number // radius in WU (aura/area/explosion) or hit radius
  knockback: number
  duration: number // seconds the effect persists (aura tick window / area / orbit)
}

export interface WeaponDef {
  id: string
  name: string
  desc: string
  pattern: FirePattern
  targeting: Targeting
  /** Whether global +projectile passives add to this weapon's count. */
  acceptsBonus: boolean
  ttl: number // projectile lifetime (s)
  projRadius: number // projectile collision/visual radius (WU)
  color: string
  /** 5 entries: index 0 = level 1. */
  levels: WeaponLevel[]
  /** Evolution: requires this passive id at level >= 1 while weapon is maxed. */
  evolveWith?: string
  /** Id of the evolved weapon it becomes. */
  evolveInto?: string
}

/** A weapon the player currently owns. */
export interface WeaponInstance {
  defId: string
  level: number // 1..5 (evolved weapons stay at 1)
  cooldownTimer: number // counts down; fires at <= 0
  evolved: boolean
}

// ---------------------------------------------------------------------------
// Passives
// ---------------------------------------------------------------------------

export type PassiveStat =
  | 'damagePct'
  | 'attackSpeedPct'
  | 'moveSpeedPct'
  | 'maxHpPct'
  | 'magnetPct'
  | 'projectiles'
  | 'areaPct'
  | 'critChance'
  | 'regen'
  | 'cooldownReductionPct'
  | 'armor'

export interface PassiveDef {
  id: string
  name: string
  desc: string
  stat: PassiveStat
  /** Cumulative value at each level (index 0 = level 1). */
  perLevel: number[]
}

export interface PassiveInstance {
  defId: string
  level: number
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export type EnemyBehavior =
  | 'chase' // basic seek
  | 'fast' // low hp, high speed
  | 'tank' // high hp, slow
  | 'ranged' // keeps distance, fires
  | 'suicide' // rushes and explodes
  | 'split' // splits into smaller on death
  | 'boss'

export type EnemyShape = 'circle' | 'tri' | 'square' | 'diamond' | 'hex'

export interface EnemyDef {
  id: string
  name: string
  behavior: EnemyBehavior
  hp: number
  speed: number // WU/s
  contact: number // contact damage per tick
  radius: number // WU
  mass: number // affects separation + knockback resistance
  xp: number
  gold: number
  color: string
  glow: string
  shape: EnemyShape
  /** Optional behavior params: explodeRadius, splitInto, fireCooldown, etc. */
  special?: Record<string, number | string>
}

// ---------------------------------------------------------------------------
// Spawn waves
// ---------------------------------------------------------------------------

export interface WavePhase {
  fromSec: number // phase starts at this run time
  /** Weighted enemy mix: enemy id -> spawn weight. */
  mix: Record<string, number>
  /** Optional special event for this phase. */
  event?: 'pincer' | 'swarm' | 'ring'
}

export interface BossSpawn {
  atSec: number
  enemyId: string
}

// ---------------------------------------------------------------------------
// Operators (playable characters)
// ---------------------------------------------------------------------------

export interface OperatorDef {
  id: string
  name: string
  desc: string
  startWeapon: string
  /** Flat/percent base modifiers applied at run start. */
  mods: Partial<Record<PassiveStat, number>>
  unlockCost: number // Scrap
}

// ---------------------------------------------------------------------------
// Level-up choices
// ---------------------------------------------------------------------------

export type ChoiceKind = 'newWeapon' | 'upWeapon' | 'newPassive' | 'upPassive' | 'evolve' | 'fallback'

export interface Choice {
  kind: ChoiceKind
  id: string // weapon/passive id (or fallback type)
  name: string
  desc: string
  rarity: string
  toLevel: number
}
