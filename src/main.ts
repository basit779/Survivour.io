// Boot entry: wire canvas -> Renderer, Input, Engine + SceneManager + Save, then
// start at the main menu.
import { Renderer } from './engine/Renderer'
import { Engine } from './engine/Engine'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './input/InputManager'
import { SaveManager } from './save/SaveManager'
import { MainMenuScene } from './game/scenes/MainMenuScene'
import type { AppCtx } from './game/AppCtx'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
const loading = document.getElementById('loading')
if (!canvas) throw new Error('game-canvas not found')

const renderer = new Renderer(canvas)
const scenes = new SceneManager()
const input = new InputManager(canvas)
const save = new SaveManager()
const engine = new Engine(renderer, scenes)

const ctx: AppCtx = { input, engine, scenes, save }
scenes.push(new MainMenuScene(ctx))

if (loading) loading.style.display = 'none'
engine.start()

// Pause the active run when the app/tab is backgrounded (mobile lifecycle).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.timeScale = 0
})
