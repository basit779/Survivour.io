// Shared app-wide services handed to every scene, so scenes can navigate and
// read input/save without threading many constructor args.
import type { InputManager } from '../input/InputManager'
import type { Engine } from '../engine/Engine'
import type { SceneManager } from '../engine/SceneManager'
import type { SaveManager } from '../save/SaveManager'

export interface AppCtx {
  input: InputManager
  engine: Engine
  scenes: SceneManager
  save: SaveManager
}
