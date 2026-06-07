// Permanent (between-run) GEAR system, bought/upgraded with banked gold — the
// Survivor.io meta: 6 equipment slots, each on a 6-tier rarity ladder. Effects
// are in PassiveStat units and stack additively with in-run passives via stats.ts.
import type { PassiveStat } from './schema'
import type { MetaSave } from '../save/SaveSchema'
import { RARITY } from './palette'
import { operatorOf } from './operators'

export interface MetaUpgradeDef {
  id: string
  name: string // the gear slot name (Weapon, Gloves, ...)
  desc: string
  stat: PassiveStat
  perRank: number
  maxRank: number
  baseCost: number
  costGrowth: number
}

// 6 gear slots, each governing one stat (the Survivor.io equipment layout).
export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'gear_weapon', name: 'Weapon', desc: '+6% damage / tier', stat: 'damagePct', perRank: 0.06, maxRank: 5, baseCost: 80, costGrowth: 1.6 },
  { id: 'gear_gloves', name: 'Gloves', desc: '+5% attack speed / tier', stat: 'attackSpeedPct', perRank: 0.05, maxRank: 5, baseCost: 90, costGrowth: 1.6 },
  { id: 'gear_necklace', name: 'Necklace', desc: '+4% crit chance / tier', stat: 'critChance', perRank: 0.04, maxRank: 5, baseCost: 110, costGrowth: 1.7 },
  { id: 'gear_armor', name: 'Body Armor', desc: '+7% max HP / tier', stat: 'maxHpPct', perRank: 0.07, maxRank: 5, baseCost: 80, costGrowth: 1.6 },
  { id: 'gear_belt', name: 'Belt', desc: '+1 armor / tier', stat: 'armor', perRank: 1, maxRank: 5, baseCost: 90, costGrowth: 1.65 },
  { id: 'gear_boots', name: 'Boots', desc: '+4% move speed / tier', stat: 'moveSpeedPct', perRank: 0.04, maxRank: 5, baseCost: 70, costGrowth: 1.55 },
]

// Rarity ladder for a gear slot by tier (rank). Tier 0 = unequipped.
export const GEAR_TIERS = [
  { name: 'Empty', color: RARITY.common },
  { name: 'Green', color: RARITY.uncommon },
  { name: 'Blue', color: RARITY.rare },
  { name: 'Purple', color: RARITY.epic },
  { name: 'Gold', color: RARITY.legendary },
  { name: 'Red', color: RARITY.mythic },
]

export function gearTier(rank: number): { name: string; color: string } {
  return GEAR_TIERS[Math.min(rank, GEAR_TIERS.length - 1)]
}

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
