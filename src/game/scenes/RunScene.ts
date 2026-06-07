// The game itself: owns a World, drives the fixed system order each tick, renders
// the world + HUD, handles pause, pushes the level-up overlay, and hands off to
// the GameOver scene when the run ends.
import type { Scene } from '../../engine/Scene'
import type { Renderer } from '../../engine/Renderer'
import type { AppCtx } from '../AppCtx'
import { LevelUpScene } from './LevelUpScene'
import { GameOverScene } from './GameOverScene'
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
  private endedHandled = false

  constructor(
    private ctx: AppCtx,
    seed?: number,
  ) {
    this.world = new World(seed)
    this.world.reset()
  }

  /** Called by GameOver "Retry" to restart in place. */
  restart(): void {
    this.world.reset()
    this.endedHandled = false
    this.ctx.engine.timeScale = 1
  }

  fixedUpdate(dt: number): void {
    const w = this.world
    if (w.run.state !== 'playing') return

    snapshotPrev(w)
    w.run.elapsed += dt
    updatePlayerControl(w, this.ctx.input, dt)
    updateSpawnDirector(w, dt)
    buildEnemyGrid(w)
    updateEnemyAI(w, dt)
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
    this.ctx.input.update()
    const run = this.world.run
    const isTop = this.ctx.scenes.top === this

    if (isTop) {
      if (run.state === 'playing') {
        const justPressed = this.ctx.input.pointerDown && !this.prevPointer
        if (this.ctx.input.consumePause()) this.ctx.engine.timeScale = this.ctx.engine.timeScale > 0 ? 0 : 1
        else if (this.ctx.engine.timeScale === 0 && justPressed) this.ctx.engine.timeScale = 1
        if (run.pendingLevels > 0) this.ctx.scenes.push(new LevelUpScene(this.ctx, this.world))
      } else if (!this.endedHandled) {
        this.endedHandled = true
        this.ctx.engine.timeScale = 1
        this.ctx.scenes.push(new GameOverScene(this.ctx, this.world, this))
      }
    }
    this.prevPointer = this.ctx.input.pointerDown

    r.clear(PAL.bg)
    renderWorld(this.world, r, alpha)
    renderHud(this.world, r, this.ctx.input, this.ctx.engine.timeScale === 0)
  }
}
