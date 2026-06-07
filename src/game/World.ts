// Holds all simulation state for one active run: the player, pooled entities, the
// spatial grid, camera, RNG and run state. Pools are allocated once and reused
// across runs via reset() (zero steady-state allocation).
import { SwapPool } from '../engine/pool'
import { SpatialGrid } from '../engine/grid'
import { Camera } from '../engine/Camera'
import { RNG } from '../engine/rng'
import { C } from '../data/balance'
import { PAL } from '../data/palette'
import { ENEMIES } from '../data/enemies'
import { xpToNext } from '../data/levelCurve'
import { aggregateMetaStats } from '../data/meta'
import { operatorOf } from '../data/operators'
import { Player, Enemy, Projectile, Gem, Particle, DamageNumber } from './entities'
import type { GemKind } from './entities'
import { recomputeStats } from './systems/stats'
import type { MetaSave } from '../save/SaveSchema'
import type { PassiveStat } from '../data/schema'

export class RunState {
  elapsed = 0
  kills = 0
  gold = 0
  pendingLevels = 0
  state: 'playing' | 'dead' | 'win' = 'playing'
}

export class World {
  player = new Player()
  enemies = new SwapPool<Enemy>(() => new Enemy())
  projectiles = new SwapPool<Projectile>(() => new Projectile())
  gems = new SwapPool<Gem>(() => new Gem())
  particles = new SwapPool<Particle>(() => new Particle())
  damageNumbers = new SwapPool<DamageNumber>(() => new DamageNumber())
  grid = new SpatialGrid(C.ARENA_W, C.ARENA_H, C.GRID_CELL)
  camera = new Camera()
  rng: RNG
  run = new RunState()
  spawnTimer = 0
  eliteTimer = 0
  /** Index into C.BOSS_TIMES of the next boss to spawn. */
  bossIndex = 0
  /** Currently-alive boss (for the boss HP bar), or null. */
  boss: Enemy | null = null

  /** Permanent meta + operator bonuses applied each run (set via configure). */
  metaStats: Partial<Record<PassiveStat, number>> = {}
  startWeapon = 'shard'

  constructor(seed?: number) {
    this.rng = new RNG(seed)
  }

  /** Read meta-progression from the save so reset() applies it. */
  configure(save: MetaSave): void {
    this.metaStats = aggregateMetaStats(save)
    this.startWeapon = operatorOf(save.selectedOperator).startWeapon
  }

  /** (Re)initialize for a fresh run. */
  reset(): void {
    this.enemies.clear()
    this.projectiles.clear()
    this.gems.clear()
    this.particles.clear()
    this.damageNumbers.clear()

    const p = this.player
    p.x = p.prevX = C.ARENA_W / 2
    p.y = p.prevY = C.ARENA_H / 2
    p.vx = p.vy = 0
    p.facingX = 1
    p.facingY = 0
    p.maxHp = C.PLAYER_BASE_HP
    p.hp = p.maxHp
    p.level = 1
    p.xp = 0
    p.xpToNext = xpToNext(1)
    p.moveSpeed = C.PLAYER_MAX_SPEED
    p.magnet = C.MAGNET_BASE
    p.damageMult = 1
    p.areaMult = 1
    p.attackSpeedMult = 1
    p.critChance = C.CRIT_CHANCE
    p.critMult = C.CRIT_MULT
    p.iframe = 0
    p.hurtFlash = 0
    p.weapons = [{ defId: this.startWeapon, level: 1, cooldownTimer: 0, evolved: false }]
    p.passives = []
    p.metaStats = this.metaStats
    recomputeStats(p)
    p.hp = p.maxHp

    this.run.elapsed = 0
    this.run.kills = 0
    this.run.gold = 0
    this.run.pendingLevels = 0
    this.run.state = 'playing'
    this.spawnTimer = 0
    this.eliteTimer = 0
    this.bossIndex = 0
    this.boss = null

    this.camera.setImmediate(p.x, p.y)
    this.camera.trauma = 0
  }

  // --- Spawn factories (all reuse pooled objects) ---

  spawnEnemy(defId: string, x: number, y: number, hpMul: number, dmgMul = 1, speedMul = 1): Enemy {
    const e = this.enemies.spawn()
    const def = ENEMIES[defId]
    e.defId = defId
    e.behavior = def.behavior
    e.maxHp = def.hp * hpMul
    e.hp = e.maxHp
    e.radius = def.radius
    e.mass = def.mass
    e.speed = def.speed * speedMul
    e.contact = def.contact * dmgMul
    e.xp = def.xp
    e.gold = def.gold
    e.color = def.color
    e.glow = def.glow
    e.shape = def.shape
    e.x = x
    e.y = y
    e.prevX = x
    e.prevY = y
    e.vx = 0
    e.vy = 0
    e.hitFlash = 0
    e.isBoss = def.behavior === 'boss'

    // behavior params
    const sp = def.special
    e.fireCooldown = numOf(sp, 'fireCooldown')
    e.shotDamage = numOf(sp, 'shotDamage') * dmgMul
    e.shotSpeed = numOf(sp, 'shotSpeed')
    e.preferRange = numOf(sp, 'preferRange')
    e.explodeRadius = numOf(sp, 'explodeRadius')
    e.explodeDamage = numOf(sp, 'explodeDamage') * dmgMul
    e.explodeRange = numOf(sp, 'explodeRange')
    e.splitInto = numOf(sp, 'splitInto')
    e.childId = strOf(sp, 'childId')
    e.burst = numOf(sp, 'burst')
    e.fireTimer = e.fireCooldown > 0 ? this.rng.range(0, e.fireCooldown) : 0
    return e
  }

  /** Enemy projectile that damages the player. */
  spawnHostileShot(x: number, y: number, vx: number, vy: number, damage: number, radius: number, ttl: number, color: string): void {
    if (this.projectiles.count >= C.MAX_PROJECTILES) return
    const q = this.spawnProjectile(x, y, vx, vy, damage, 0, radius, ttl, 0, false, color)
    q.hostile = true
  }

  spawnProjectile(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    pierce: number,
    radius: number,
    ttl: number,
    knockback: number,
    crit: boolean,
    color: string,
  ): Projectile {
    const q = this.projectiles.spawn()
    q.x = x
    q.y = y
    q.prevX = x
    q.prevY = y
    q.vx = vx
    q.vy = vy
    q.damage = damage
    q.pierceLeft = pierce
    q.radius = radius
    q.ttl = ttl
    q.knockback = knockback
    q.crit = crit
    q.color = color
    q.hitList.length = 0
    // reset non-linear modes (set by caller if needed)
    q.hostile = false
    q.mode = 'linear'
    q.homing = false
    q.orbitAngle = 0
    q.orbitRadius = 0
    q.orbitSpeed = 0
    q.rehitTimer = 0
    return q
  }

  spawnGem(x: number, y: number, value: number, kind: GemKind): void {
    if (this.gems.count >= C.MAX_GEMS) return
    const g = this.gems.spawn()
    const a = this.rng.range(0, Math.PI * 2)
    const sp = this.rng.range(40, 95)
    g.x = x
    g.y = y
    g.prevX = x
    g.prevY = y
    g.vx = Math.cos(a) * sp
    g.vy = Math.sin(a) * sp
    g.value = value
    g.kind = kind
    g.magnetized = false
    g.color = kind === 'xp' ? PAL.xpGem : kind === 'gold' ? PAL.gold : PAL.health
    g.radius = kind === 'xp' ? 5 : 6
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    if (this.particles.count >= C.MAX_PARTICLES) return
    const pt = this.particles.spawn()
    pt.x = x
    pt.y = y
    pt.vx = vx
    pt.vy = vy
    pt.life = life
    pt.maxLife = life
    pt.size = size
    pt.color = color
    pt.drag = 3
  }

  spawnDamageNumber(x: number, y: number, text: string, color: string, crit: boolean): void {
    if (this.damageNumbers.count >= C.MAX_DAMAGE_NUMBERS) return
    const d = this.damageNumbers.spawn()
    d.x = x
    d.y = y
    d.vy = -46
    d.life = 0.75
    d.maxLife = 0.75
    d.text = text
    d.color = color
    d.crit = crit
  }
}

function numOf(sp: Record<string, number | string> | undefined, key: string): number {
  if (!sp) return 0
  const v = sp[key]
  return typeof v === 'number' ? v : 0
}

function strOf(sp: Record<string, number | string> | undefined, key: string): string {
  if (!sp) return ''
  const v = sp[key]
  return typeof v === 'string' ? v : ''
}
