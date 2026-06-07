// The game itself: owns a World, drives the fixed system order each tick, renders
// the world + HUD, and handles pause / tap-to-retry.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { InputManager } from '../../input/InputManager'
import type { Engine } from '../../engine/Engine'
import { C } from '../../data/balance'
import { PAL } from '../../data/palette'
import { World } from '../World'
import { updatePlayerControl } from '../systems/player'
import { buildEnemyGrid, updateEnemyAI, updateSpawnDirector } from '../systems/enemies'
import { updateWeapons } from '../systems/weapons'
import { updateMovement, updateProjectiles, updateCollisions, updateDeaths } from '../systems/combat'
import { updatePickups } from '../systems/progression'
import { snapshotPrev, updateCamera, updateParticles, updateDamageNumbers } from '../systems/fx'
import { renderWorld, renderHud } from '../systems/render'

export class RunScene implements Scene {
  readonly world: World
  private prevPointer = false

  constructor(
    private input: InputManager,
    private engine: Engine,
    seed?: number,
  ) {
    this.world = new World(seed)
    this.world.reset()
  }

  fixedUpdate(dt: number): void {
    const w = this.world
    if (w.run.state !== 'playing') return

    snapshotPrev(w)
    w.run.elapsed += dt
    updatePlayerControl(w, this.input, dt)
    updateSpawnDirector(w, dt)
    buildEnemyGrid(w)
    updateEnemyAI(w)
    updateWeapons(w, dt)
    updateMovement(w, dt)
    updateProjectiles(w, dt)
    updateCollisions(w)
    w.projectiles.sweep()
    updateDeaths(w)
    updatePickups(w, dt)
    updateCamera(w, dt)
    updateParticles(w, dt)
    updateDamageNumbers(w, dt)

    if (w.run.elapsed >= C.RUN_LENGTH) w.run.state = 'win'
  }

  render(r: Renderer, alpha: number): void {
    this.input.update()
    const run = this.world.run
    const justPressed = this.input.pointerDown && !this.prevPointer

    if (run.state !== 'playing') {
      if (justPressed || this.input.consumeRestart() || this.input.consumeConfirm()) {
        this.world.reset()
        this.engine.timeScale = 1
      }
    } else {
      if (this.input.consumePause()) this.engine.timeScale = this.engine.timeScale > 0 ? 0 : 1
      else if (this.engine.timeScale === 0 && justPressed) this.engine.timeScale = 1
    }
    this.prevPointer = this.input.pointerDown

    r.clear(PAL.bg)
    renderWorld(this.world, r, alpha)
    renderHud(this.world, r, this.input, this.engine.timeScale === 0)
  }
}
