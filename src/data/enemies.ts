// Enemy registry. (Starter roster for the playable milestone — the full 13-kind
// roster, elites and bosses land in the enemy-AI/spawn step.)
import type { EnemyDef } from './schema'
import { PAL } from './palette'

export const ENEMIES: Record<string, EnemyDef> = {
  swarmer: {
    id: 'swarmer',
    name: 'Swarmer',
    behavior: 'chase',
    hp: 14,
    speed: 60,
    contact: 7,
    radius: 12,
    mass: 1,
    xp: 1,
    gold: 1,
    color: PAL.enemySwarmer,
    glow: PAL.enemyGlow,
    shape: 'circle',
  },
  runner: {
    id: 'runner',
    name: 'Runner',
    behavior: 'fast',
    hp: 9,
    speed: 116,
    contact: 6,
    radius: 10,
    mass: 0.8,
    xp: 1,
    gold: 1,
    color: PAL.enemyRunner,
    glow: PAL.enemyRunner,
    shape: 'tri',
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    behavior: 'tank',
    hp: 90,
    speed: 42,
    contact: 16,
    radius: 21,
    mass: 3.2,
    xp: 5,
    gold: 4,
    color: PAL.enemyBrute,
    glow: PAL.enemyBrute,
    shape: 'square',
  },
}

export const ENEMY_IDS = Object.keys(ENEMIES)
