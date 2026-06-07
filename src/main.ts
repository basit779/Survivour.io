// Boot entry: wire canvas -> Renderer, Input, Engine + SceneManager + Save, then
// start at the main menu.
import { Renderer } from './engine/Renderer'
import { Engine } from './engine/Engine'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './input/InputManager'
import { SaveManager } from './save/SaveManager'
import { audio } from './engine/audio/AudioEngine'
import { music } from './engine/audio/Music'
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

// Unlock + start audio on the first user gesture (mobile autoplay policy).
function unlockAudio(): void {
  audio.init()
  audio.resume()
  music.start()
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
}
window.addEventListener('pointerdown', unlockAudio)
window.addEventListener('keydown', unlockAudio)

// 'M' toggles mute.
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') audio.toggleMute()
})

// Pause + suspend audio when the app/tab is backgrounded; resume on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    engine.timeScale = 0
    audio.suspend()
  } else {
    audio.resume()
  }
})
