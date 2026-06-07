// Recompute the player's aggregated stat multipliers from base values + owned
// passives. Call after any upgrade and at run start. Keeps current HP, topping it
// up by any Max HP gained.
import { C } from '../../data/balance'
import { PASSIVES } from '../../data/passives'
import type { Player } from '../entities'

export function recomputeStats(player: Player): void {
  let dmgPct = 0
  let atkPct = 0
  let msPct = 0
  let hpPct = 0
  let magPct = 0
  let areaPct = 0
  let critFlat = 0
  let projFlat = 0
  let cdrPct = 0
  let regenFlat = 0
  let armorFlat = 0

  for (let i = 0; i < player.passives.length; i++) {
    const pi = player.passives[i]
    const def = PASSIVES[pi.defId]
    if (!def) continue
    const v = def.perLevel[Math.min(pi.level, def.perLevel.length) - 1]
    switch (def.stat) {
      case 'damagePct': dmgPct += v; break
      case 'attackSpeedPct': atkPct += v; break
      case 'moveSpeedPct': msPct += v; break
      case 'maxHpPct': hpPct += v; break
      case 'magnetPct': magPct += v; break
      case 'areaPct': areaPct += v; break
      case 'critChance': critFlat += v; break
      case 'projectiles': projFlat += v; break
      case 'cooldownReductionPct': cdrPct += v; break
      case 'regen': regenFlat += v; break
      case 'armor': armorFlat += v; break
    }
  }

  player.damageMult = 1 + dmgPct
  player.attackSpeedMult = 1 + atkPct
  player.moveSpeed = C.PLAYER_MAX_SPEED * (1 + msPct)
  player.magnet = C.MAGNET_BASE * (1 + magPct)
  player.areaMult = 1 + areaPct
  player.critChance = C.CRIT_CHANCE + critFlat
  player.projectileBonus = projFlat
  player.cooldownMult = Math.max(0.25, 1 - cdrPct)
  player.regen = regenFlat
  player.armor = armorFlat

  const newMax = Math.round(C.PLAYER_BASE_HP * (1 + hpPct))
  const diff = newMax - player.maxHp
  player.maxHp = newMax
  if (diff > 0) player.hp += diff
  if (player.hp > player.maxHp) player.hp = player.maxHp
}
