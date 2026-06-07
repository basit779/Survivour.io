// Playable characters. Each has a distinct starting weapon and flat stat mods
// (in PassiveStat units), plus an unlock cost in gold.
import type { OperatorDef } from './schema'

export const OPERATORS: Record<string, OperatorDef> = {
  recruit: {
    id: 'recruit',
    name: 'Recruit',
    desc: 'Balanced all-rounder.',
    startWeapon: 'shard',
    mods: {},
    unlockCost: 0,
  },
  striker: {
    id: 'striker',
    name: 'Striker',
    desc: '+15% damage. Starts with Scatter Gun.',
    startWeapon: 'fan',
    mods: { damagePct: 0.15 },
    unlockCost: 300,
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    desc: '+25% HP, +3 armor. Starts with Force Field.',
    startWeapon: 'forcefield',
    mods: { maxHpPct: 0.25, armor: 3 },
    unlockCost: 500,
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    desc: '+15% move, +50% pickup range. Starts with Seeker Drone.',
    startWeapon: 'seeker',
    mods: { moveSpeedPct: 0.15, magnetPct: 0.5 },
    unlockCost: 400,
  },
}

export const OPERATOR_IDS = Object.keys(OPERATORS)

export function operatorOf(id: string): OperatorDef {
  return OPERATORS[id] ?? OPERATORS.recruit
}
