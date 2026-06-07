// Recompute the player's aggregated stat multipliers from base values + owned
// passives + permanent meta/operator bonuses (player.metaStats). Call after any
// upgrade and at run start. Preserves current HP, topping up by Max HP gained.
import { C } from '../../data/balance'
import { PASSIVES } from '../../data/passives'
import type { Player } from '../entities'
import type { PassiveStat } from '../../data/schema'

interface Acc {
  dmg: number
  atk: number
  ms: number
  hp: number
  mag: number
  area: number
  crit: number
  proj: number
  cdr: number
  regen: number
  armor: number
}

function addStat(acc: Acc, stat: PassiveStat, v: number): void {
  switch (stat) {
    case 'damagePct': acc.dmg += v; break
    case 'attackSpeedPct': acc.atk += v; break
    case 'moveSpeedPct': acc.ms += v; break
    case 'maxHpPct': acc.hp += v; break
    case 'magnetPct': acc.mag += v; break
    case 'areaPct': acc.area += v; break
    case 'critChance': acc.crit += v; break
    case 'projectiles': acc.proj += v; break
    case 'cooldownReductionPct': acc.cdr += v; break
    case 'regen': acc.regen += v; break
    case 'armor': acc.armor += v; break
  }
}

export function recomputeStats(player: Player): void {
  const acc: Acc = { dmg: 0, atk: 0, ms: 0, hp: 0, mag: 0, area: 0, crit: 0, proj: 0, cdr: 0, regen: 0, armor: 0 }

  for (let i = 0; i < player.passives.length; i++) {
    const pi = player.passives[i]
    const def = PASSIVES[pi.defId]
    if (!def) continue
    addStat(acc, def.stat, def.perLevel[Math.min(pi.level, def.perLevel.length) - 1])
  }
  for (const k in player.metaStats) {
    addStat(acc, k as PassiveStat, player.metaStats[k as PassiveStat] ?? 0)
  }

  player.damageMult = 1 + acc.dmg
  player.attackSpeedMult = 1 + acc.atk
  player.moveSpeed = C.PLAYER_MAX_SPEED * (1 + acc.ms)
  player.magnet = C.MAGNET_BASE * (1 + acc.mag)
  player.areaMult = 1 + acc.area
  player.critChance = C.CRIT_CHANCE + acc.crit
  player.projectileBonus = acc.proj
  player.cooldownMult = Math.max(0.25, 1 - acc.cdr)
  player.regen = acc.regen
  player.armor = acc.armor

  const newMax = Math.round(C.PLAYER_BASE_HP * (1 + acc.hp))
  const diff = newMax - player.maxHp
  player.maxHp = newMax
  if (diff > 0) player.hp += diff
  if (player.hp > player.maxHp) player.hp = player.maxHp
}
