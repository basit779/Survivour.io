// Passive items. perLevel values are CUMULATIVE (the value AT that level), so
// stats.ts can read perLevel[level-1] directly without summing.
import type { PassiveDef } from './schema'

export const PASSIVES: Record<string, PassiveDef> = {
  power: {
    id: 'power',
    name: 'Power Cell',
    desc: '+Damage',
    stat: 'damagePct',
    perLevel: [0.1, 0.2, 0.3, 0.42, 0.55],
  },
  haste: {
    id: 'haste',
    name: 'Overclock',
    desc: '+Attack Speed',
    stat: 'attackSpeedPct',
    perLevel: [0.08, 0.16, 0.24, 0.33, 0.42],
  },
  boots: {
    id: 'boots',
    name: 'Sprint Boots',
    desc: '+Move Speed',
    stat: 'moveSpeedPct',
    perLevel: [0.07, 0.14, 0.21, 0.28, 0.36],
  },
  vitality: {
    id: 'vitality',
    name: 'Nano Plating',
    desc: '+Max HP',
    stat: 'maxHpPct',
    perLevel: [0.12, 0.24, 0.36, 0.5, 0.65],
  },
  lodestone: {
    id: 'lodestone',
    name: 'Lodestone',
    desc: '+Pickup Range',
    stat: 'magnetPct',
    perLevel: [0.25, 0.5, 0.8, 1.1, 1.5],
  },
  multishot: {
    id: 'multishot',
    name: 'Split Rounds',
    desc: '+1 Projectile',
    stat: 'projectiles',
    perLevel: [1, 2, 3, 4, 5],
  },
  bigarea: {
    id: 'bigarea',
    name: 'Resonator',
    desc: '+Area',
    stat: 'areaPct',
    perLevel: [0.12, 0.24, 0.38, 0.52, 0.7],
  },
  scope: {
    id: 'scope',
    name: 'Targeting Scope',
    desc: '+Crit Chance',
    stat: 'critChance',
    perLevel: [0.05, 0.1, 0.16, 0.22, 0.3],
  },
  regen: {
    id: 'regen',
    name: 'Repair Kit',
    desc: '+HP Regen',
    stat: 'regen',
    perLevel: [0.6, 1.2, 2, 3, 4.5],
  },
  coolant: {
    id: 'coolant',
    name: 'Coolant',
    desc: '-Cooldowns',
    stat: 'cooldownReductionPct',
    perLevel: [0.06, 0.12, 0.18, 0.25, 0.33],
  },
  guard: {
    id: 'guard',
    name: 'Ablative Guard',
    desc: '+Armor',
    stat: 'armor',
    perLevel: [2, 4, 6, 9, 12],
  },
}

export const PASSIVE_IDS = Object.keys(PASSIVES)
