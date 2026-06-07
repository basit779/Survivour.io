// Permanent (between-run) upgrade tree, bought with banked gold. Effects are in
// PassiveStat units and stack additively with in-run passives via stats.ts.
import type { PassiveStat } from './schema'
import type { MetaSave } from '../save/SaveSchema'
import { operatorOf } from './operators'

export interface MetaUpgradeDef {
  id: string
  name: string
  desc: string
  stat: PassiveStat
  perRank: number
  maxRank: number
  baseCost: number
  costGrowth: number
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'might', name: 'Might', desc: '+5% damage / rank', stat: 'damagePct', perRank: 0.05, maxRank: 5, baseCost: 80, costGrowth: 1.6 },
  { id: 'vigor', name: 'Vigor', desc: '+6% max HP / rank', stat: 'maxHpPct', perRank: 0.06, maxRank: 5, baseCost: 70, costGrowth: 1.6 },
  { id: 'swift', name: 'Swiftness', desc: '+4% move / rank', stat: 'moveSpeedPct', perRank: 0.04, maxRank: 5, baseCost: 60, costGrowth: 1.6 },
  { id: 'haste', name: 'Haste', desc: '+4% attack speed / rank', stat: 'attackSpeedPct', perRank: 0.04, maxRank: 5, baseCost: 90, costGrowth: 1.7 },
  { id: 'magnet', name: 'Magnetism', desc: '+15% pickup range / rank', stat: 'magnetPct', perRank: 0.15, maxRank: 5, baseCost: 50, costGrowth: 1.5 },
  { id: 'plating', name: 'Plating', desc: '+1 armor / rank', stat: 'armor', perRank: 1, maxRank: 5, baseCost: 90, costGrowth: 1.7 },
  { id: 'mend', name: 'Regeneration', desc: '+0.4 HP/s regen / rank', stat: 'regen', perRank: 0.4, maxRank: 5, baseCost: 70, costGrowth: 1.6 },
]

export function metaCost(def: MetaUpgradeDef, rank: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, rank))
}

/** Aggregate permanent-upgrade ranks + selected operator mods into a stat map. */
export function aggregateMetaStats(save: MetaSave): Partial<Record<PassiveStat, number>> {
  const map: Partial<Record<PassiveStat, number>> = {}
  for (const def of META_UPGRADES) {
    const rank = save.metaUpgrades[def.id] ?? 0
    if (rank > 0) map[def.stat] = (map[def.stat] ?? 0) + def.perRank * rank
  }
  const op = operatorOf(save.selectedOperator)
  for (const k in op.mods) {
    const stat = k as PassiveStat
    map[stat] = (map[stat] ?? 0) + (op.mods[stat] ?? 0)
  }
  return map
}
