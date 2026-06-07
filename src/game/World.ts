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
import { Player, Enemy, Projectile, Gem, Particle, DamageNumber } from './entities'
import type { GemKind } from './entities'

export class RunState {
  elapsed = 0
  kills = 0
  gold = 0
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

  constructor(seed?: number) {
    this.rng = new RNG(seed)
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
    p.weapons = [{ defId: 'shard', level: 1, cooldownTimer: 0, evolved: false }]

    this.run.elapsed = 0
    this.run.kills = 0
    this.run.gold = 0
    this.run.state = 'playing'
    this.spawnTimer = 0

    this.camera.setImmediate(p.x, p.y)
    this.camera.trauma = 0
  }

  // --- Spawn factories (all reuse pooled objects) ---

  spawnEnemy(defId: string, x: number, y: number, hpScale: number): Enemy {
    const e = this.enemies.spawn()
    const def = ENEMIES[defId]
    e.defId = defId
    e.behavior = def.behavior
    e.maxHp = def.hp * hpScale
    e.hp = e.maxHp
    e.radius = def.radius
    e.mass = def.mass
    e.speed = def.speed
    e.contact = def.contact
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
    return e
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
  ): void {
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
  }

  spawnGem(x: number, y: number, value: number, kind: GemKind): void {
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
