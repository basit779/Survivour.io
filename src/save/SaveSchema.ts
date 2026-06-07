// Persisted meta-progression shape. Kept tiny for now (best stats + banked gold);
// the permanent-upgrade shop / unlocks extend this in the meta step.
export const SAVE_VERSION = 1

export interface MetaSave {
  version: number
  bestTime: number // seconds survived (best run)
  bestKills: number
  totalGold: number // banked across all runs
  runs: number
}

export function defaultSave(): MetaSave {
  return { version: SAVE_VERSION, bestTime: 0, bestKills: 0, totalGold: 0, runs: 0 }
}
