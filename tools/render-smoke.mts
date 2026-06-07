// Render smoke test: exercises render.ts against a stubbed Canvas2D context so we
// catch runtime errors in the draw code without a real browser. Covers the world
// pass, the HUD, and every overlay branch (playing / paused / dead / win).
import { World } from '../src/game/World'
import { renderWorld, renderHud } from '../src/game/systems/render'
import { LevelUpScene } from '../src/game/scenes/LevelUpScene'

// A permissive Canvas2D stub: every method is a no-op; gradient creators return
// an object with addColorStop.
const ctx: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
        return () => ({ addColorStop() {} })
      }
      return () => undefined
    },
    set() {
      return true
    },
  },
)

const renderer: any = {
  ctx,
  scale: 2,
  viewW: 400,
  viewH: 800,
  beginWorld() {},
  beginScreen() {},
  worldLeft: (camX: number) => camX - 200,
  worldTop: (camY: number) => camY - 400,
  worldRight: (camX: number) => camX + 200,
  worldBottom: (camY: number) => camY + 400,
}

const input: any = { joystick: { active: true, baseX: 100, baseY: 600, knobX: 130, knobY: 580 } }

const world = new World(99)
world.reset()
// Populate some of everything.
for (let i = 0; i < 60; i++) world.spawnEnemy(i % 3 === 0 ? 'brute' : i % 3 === 1 ? 'runner' : 'swarmer', world.player.x + (i - 30) * 6, world.player.y + (i % 7) * 9, 1)
for (let i = 0; i < 10; i++) world.spawnProjectile(world.player.x, world.player.y, 100, 50, 12, 1, 6, 1, 60, i % 2 === 0, '#ffe66d')
for (let i = 0; i < 6; i++) world.spawnHostileShot(world.player.x + i * 12, world.player.y - 40, -20, 30, 8, 6, 3, '#ff5d73')
const rsBoss = world.spawnEnemy('boss_warden', world.player.x + 120, world.player.y - 80, 1)
world.boss = rsBoss
for (let i = 0; i < 20; i++) world.spawnGem(world.player.x + i * 4, world.player.y, 1, 'xp')
for (let i = 0; i < 30; i++) world.spawnParticle(world.player.x, world.player.y, i, -i, 0.5, 3, '#fff')
world.spawnDamageNumber(world.player.x, world.player.y, '123', '#fff', true)
world.player.hp = 20 // trigger low-HP vignette
world.player.hurtFlash = 0.1

let failed = false
function tryRender(label: string, state: 'playing' | 'dead' | 'win', paused: boolean): void {
  world.run.state = state
  try {
    renderWorld(world, renderer, 0.5)
    renderHud(world, renderer, input, paused)
    console.log(`  ${label}: ok`)
  } catch (e) {
    failed = true
    console.error(`  ${label}: THREW`, e)
  }
}

console.log('=== render smoke ===')
tryRender('playing', 'playing', false)
tryRender('paused', 'playing', true)
tryRender('dead', 'dead', false)
tryRender('win', 'win', false)

// LevelUpScene overlay
world.run.state = 'playing'
const engineStub: any = { timeScale: 1 }
const scenesStub: any = { pop() {}, top: null }
const luInput: any = { consumePick: () => 0, consumeTap: () => false, tapX: 0, tapY: 0 }
try {
  const lu = new LevelUpScene(world, luInput, engineStub, scenesStub)
  lu.enter()
  lu.render(renderer, 0)
  console.log('  levelup: ok')
} catch (e) {
  failed = true
  console.error('  levelup: THREW', e)
}

console.log(failed ? '\nFAIL ❌' : '\nPASS ✅')
process.exit(failed ? 1 : 0)
