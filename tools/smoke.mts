// Headless simulation smoke test: drives the real systems through the same tick
// order as RunScene (minus rendering) for ~60s of gameplay and asserts the
// sim stays finite and actually produces combat (spawns, kills, leveling).
import { World } from '../src/game/World'
import { C } from '../src/data/balance'
import { WEAPON_IDS } from '../src/data/weapons'
import { updatePlayerControl } from '../src/game/systems/player'
import { buildEnemyGrid, updateEnemyAI, updateSpawnDirector } from '../src/game/systems/enemies'
import { updateWeapons } from '../src/game/systems/weapons'
import { updateMovement, updateProjectiles, updateCollisions, updateDeaths } from '../src/game/systems/combat'
import { updatePickups } from '../src/game/systems/progression'
import { snapshotPrev, updateCamera, updateParticles, updateDamageNumbers } from '../src/game/systems/fx'
import { generateChoices, applyChoice } from '../src/game/systems/upgrades'

const world = new World(12345)
world.reset()
// Make the test player tanky so we exercise the full combat loop, not balance.
world.player.maxHp = 1_000_000
world.player.hp = 1_000_000
// Equip every weapon so all fire patterns (projectile/homing/aura/orbit/strike) run.
world.player.weapons = WEAPON_IDS.map((id) => ({ defId: id, level: 3, cooldownTimer: 0, evolved: false }))
// Seed every special enemy behavior so their AI branches are exercised.
world.spawnEnemy('spitter', world.player.x + 200, world.player.y, 1)
world.spawnEnemy('bomber', world.player.x - 180, world.player.y, 1)
world.spawnEnemy('splitter', world.player.x, world.player.y + 200, 1)
world.spawnEnemy('elite_brute', world.player.x, world.player.y - 220, 1)
const testBoss = world.spawnEnemy('boss_warden', world.player.x + 260, world.player.y + 120, 1)
world.boss = testBoss

const input = { moveX: 0, moveY: 0, moveMag: 1, pointerDown: false }

const SECONDS = 60
const TICKS = Math.round(SECONDS / C.FIXED_DT)
let peakEnemies = 0
let peakProjectiles = 0
let nanHit = false

for (let t = 0; t < TICKS; t++) {
  // kite in a slowly rotating direction
  const a = t * 0.01
  input.moveX = Math.cos(a)
  input.moveY = Math.sin(a)

  const w = world
  snapshotPrev(w)
  w.run.elapsed += C.FIXED_DT
  updatePlayerControl(w, input, C.FIXED_DT)
  updateSpawnDirector(w, C.FIXED_DT)
  buildEnemyGrid(w)
  updateEnemyAI(w, C.FIXED_DT)
  updateWeapons(w, C.FIXED_DT)
  updateMovement(w, C.FIXED_DT)
  updateProjectiles(w, C.FIXED_DT)
  updateCollisions(w)
  w.projectiles.sweep()
  updateDeaths(w)
  updatePickups(w, C.FIXED_DT)
  updateCamera(w, C.FIXED_DT)
  updateParticles(w, C.FIXED_DT)
  updateDamageNumbers(w, C.FIXED_DT)

  // auto-resolve any queued level-ups by picking a random offered card
  while (w.run.pendingLevels > 0) {
    const choices = generateChoices(w)
    applyChoice(w, choices[w.rng.int(0, choices.length - 1)])
    w.run.pendingLevels--
  }

  peakEnemies = Math.max(peakEnemies, w.enemies.count)
  peakProjectiles = Math.max(peakProjectiles, w.projectiles.count)
  if (!Number.isFinite(w.player.x) || !Number.isFinite(w.player.y) || !Number.isFinite(w.player.hp)) {
    nanHit = true
    console.error(`NaN detected at tick ${t}`)
    break
  }
}

const p = world.player
console.log('=== Survivor Zero — headless smoke ===')
console.log(`ticks:           ${TICKS} (${SECONDS}s)`)
console.log(`kills:           ${world.run.kills}`)
console.log(`player level:    ${p.level}`)
console.log(`player hp:       ${Math.round(p.hp)}`)
console.log(`weapons owned:   ${p.weapons.map((w) => `${w.defId}@${w.level}`).join(', ')}`)
console.log(`passives owned:  ${p.passives.map((w) => `${w.defId}@${w.level}`).join(', ') || '(none)'}`)
console.log(`damage mult:     ${p.damageMult.toFixed(2)}`)
console.log(`peak enemies:    ${peakEnemies}`)
console.log(`peak projectiles:${peakProjectiles}`)
console.log(`live gems:       ${world.gems.count}`)
console.log(`player pos:      (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`)

const ok = !nanHit && world.run.kills > 0 && peakEnemies > 0 && p.level > 1
console.log(ok ? '\nPASS ✅' : '\nFAIL ❌')
process.exit(ok ? 0 : 1)
