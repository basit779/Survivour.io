// Boot entry: wire canvas -> Renderer, Input, Engine + SceneManager, then run.
import { Renderer } from './engine/Renderer'
import { Engine } from './engine/Engine'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './input/InputManager'
import { RunScene } from './game/scenes/RunScene'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
const loading = document.getElementById('loading')
if (!canvas) throw new Error('game-canvas not found')

const seedParam = new URLSearchParams(location.search).get('seed')
const seed = seedParam ? Number(seedParam) >>> 0 : undefined

const renderer = new Renderer(canvas)
const input = new InputManager(canvas)
const scenes = new SceneManager()
const engine = new Engine(renderer, scenes)

scenes.push(new RunScene(input, engine, seed))

if (loading) loading.style.display = 'none'
engine.start()

// Pause when the app/tab is backgrounded (mobile lifecycle).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.timeScale = 0
})
