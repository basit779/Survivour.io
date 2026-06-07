// Level-up choice generation and application. Builds a weighted candidate pool
// (upgrade owned weapon/passive, gain new weapon/passive), samples 3 distinct
// cards, and applies the picked one — then recomputes player stats.
import { WEAPONS } from '../../data/weapons'
import { PASSIVES } from '../../data/passives'
import { RARITY } from '../../data/palette'
import { recomputeStats } from './stats'
import type { World } from '../World'
import type { Choice } from '../../data/schema'

const MAX_WEAPONS = 6
const MAX_PASSIVES = 6

interface Weighted {
  choice: Choice
  weight: number
}

export function generateChoices(world: World): Choice[] {
  const p = world.player
  const pool: Weighted[] = []

  // upgrade owned weapons
  for (const w of p.weapons) {
    const def = WEAPONS[w.defId]
    if (!w.evolved && w.level < def.levels.length) {
      pool.push({
        weight: 60,
        choice: { kind: 'upWeapon', id: w.defId, name: def.name, desc: `Level ${w.level} → ${w.level + 1}`, rarity: rarityForLevel(w.level + 1), toLevel: w.level + 1 },
      })
    }
  }
  // upgrade owned passives
  for (const pi of p.passives) {
    const def = PASSIVES[pi.defId]
    if (pi.level < def.perLevel.length) {
      pool.push({
        weight: 40,
        choice: { kind: 'upPassive', id: pi.defId, name: def.name, desc: `${def.desc} (Lv ${pi.level + 1})`, rarity: rarityForLevel(pi.level + 1), toLevel: pi.level + 1 },
      })
    }
  }
  // new weapons
  if (p.weapons.length < MAX_WEAPONS) {
    for (const id in WEAPONS) {
      if (!p.weapons.some((w) => w.defId === id)) {
        const def = WEAPONS[id]
        pool.push({ weight: 35, choice: { kind: 'newWeapon', id, name: def.name, desc: def.desc, rarity: 'rare', toLevel: 1 } })
      }
    }
  }
  // new passives
  if (p.passives.length < MAX_PASSIVES) {
    for (const id in PASSIVES) {
      if (!p.passives.some((pi) => pi.defId === id)) {
        const def = PASSIVES[id]
        pool.push({ weight: 30, choice: { kind: 'newPassive', id, name: def.name, desc: def.desc, rarity: 'uncommon', toLevel: 1 } })
      }
    }
  }

  const out = sampleDistinct(world, pool, 3)
  if (out.length === 0) return fallbackChoices()
  // top up with fallbacks if the pool is nearly exhausted
  while (out.length < 3) out.push(fallbackChoices()[out.length])
  return out
}

function sampleDistinct(world: World, pool: Weighted[], n: number): Choice[] {
  const items = pool.slice()
  const out: Choice[] = []
  while (out.length < n && items.length > 0) {
    const weights = items.map((w) => w.weight)
    const idx = world.rng.weightedIndex(weights)
    out.push(items[idx].choice)
    items.splice(idx, 1)
  }
  return out
}

function fallbackChoices(): Choice[] {
  return [
    { kind: 'fallback', id: 'heal', name: 'Repair', desc: 'Restore 35% HP', rarity: 'common', toLevel: 0 },
    { kind: 'fallback', id: 'gold', name: 'Salvage', desc: '+60 Gold', rarity: 'common', toLevel: 0 },
    { kind: 'fallback', id: 'heal', name: 'Repair', desc: 'Restore 35% HP', rarity: 'common', toLevel: 0 },
  ]
}

function rarityForLevel(level: number): keyof typeof RARITY {
  if (level >= 5) return 'epic'
  if (level >= 4) return 'rare'
  if (level >= 3) return 'uncommon'
  return 'common'
}

export function applyChoice(world: World, c: Choice): void {
  const p = world.player
  switch (c.kind) {
    case 'upWeapon': {
      const w = p.weapons.find((x) => x.defId === c.id)
      if (w) w.level++
      break
    }
    case 'newWeapon':
      if (!p.weapons.some((w) => w.defId === c.id)) p.weapons.push({ defId: c.id, level: 1, cooldownTimer: 0, evolved: false })
      break
    case 'upPassive': {
      const pi = p.passives.find((x) => x.defId === c.id)
      if (pi) pi.level++
      break
    }
    case 'newPassive':
      if (!p.passives.some((x) => x.defId === c.id)) p.passives.push({ defId: c.id, level: 1 })
      break
    case 'fallback':
      if (c.id === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35)
      else if (c.id === 'gold') world.run.gold += 60
      break
  }
  recomputeStats(p)
}
