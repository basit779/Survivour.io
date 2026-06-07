// Persisted meta-progression shape.
export const SAVE_VERSION = 1

export interface MetaSave {
  version: number
  bestTime: number // seconds survived (best run)
  bestKills: number
  totalGold: number // banked, spendable in the shop
  runs: number
  /** Permanent-upgrade ranks, keyed by upgrade id. */
  metaUpgrades: Record<string, number>
  /** Unlocked operator ids. */
  operatorsUnlocked: string[]
  selectedOperator: string
}

export function defaultSave(): MetaSave {
  return {
    version: SAVE_VERSION,
    bestTime: 0,
    bestKills: 0,
    totalGold: 0,
    runs: 0,
    metaUpgrades: {},
    operatorsUnlocked: ['recruit'],
    selectedOperator: 'recruit',
  }
}
