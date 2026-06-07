// Persistence via localStorage (works in the browser and inside the Capacitor
// webview). Swappable for @capacitor/preferences later without touching callers.
import { defaultSave, SAVE_VERSION } from './SaveSchema'
import type { MetaSave } from './SaveSchema'

const KEY = 'survivorzero_save_v1'

export class SaveManager {
  data: MetaSave

  constructor() {
    this.data = this.load()
  }

  private load(): MetaSave {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MetaSave>
        return { ...defaultSave(), ...parsed, version: SAVE_VERSION }
      }
    } catch {
      // ignore corrupt/unavailable storage
    }
    return defaultSave()
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data))
    } catch {
      // storage unavailable (private mode, etc.) — fail silently
    }
  }

  /** Record a finished run: bank gold and update bests. */
  recordRun(time: number, kills: number, gold: number): void {
    const d = this.data
    d.runs++
    d.totalGold += gold
    if (time > d.bestTime) d.bestTime = time
    if (kills > d.bestKills) d.bestKills = kills
    this.save()
  }
}
