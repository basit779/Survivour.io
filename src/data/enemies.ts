// Enemy registry. `special` carries per-behavior params read into the Enemy at
// spawn: fireCooldown/shotDamage/shotSpeed/preferRange (ranged & boss),
// explodeRadius/explodeDamage/explodeRange (suicide), splitInto/childId (split),
// burst (boss radial volley count).
// `color` = body fill (bright cartoon), `glow` = death-splat/particle accent.
import type { EnemyDef } from './schema'
import { PAL } from './palette'

export const ENEMIES: Record<string, EnemyDef> = {
  swarmer: {
    id: 'swarmer', name: 'Swarmer', behavior: 'chase',
    hp: 14, speed: 52, contact: 7, radius: 12, mass: 1, xp: 1, gold: 1,
    color: PAL.enemySwarmer, glow: '#5a8a2e', shape: 'circle',
  },
  runner: {
    id: 'runner', name: 'Runner', behavior: 'fast',
    hp: 9, speed: 104, contact: 6, radius: 10, mass: 0.8, xp: 1, gold: 1,
    color: PAL.enemyRunner, glow: '#8a7050', shape: 'tri',
  },
  brute: {
    id: 'brute', name: 'Brute', behavior: 'tank',
    hp: 90, speed: 42, contact: 16, radius: 21, mass: 3.2, xp: 5, gold: 4,
    color: PAL.enemyBrute, glow: '#3f7a2c', shape: 'square',
  },
  spitter: {
    id: 'spitter', name: 'Spitter', behavior: 'ranged',
    hp: 26, speed: 56, contact: 5, radius: 13, mass: 1.2, xp: 3, gold: 2,
    color: PAL.enemyRanged, glow: '#6a2e9c', shape: 'diamond',
    special: { fireCooldown: 1.9, shotDamage: 9, shotSpeed: 240, preferRange: 270 },
  },
  bomber: {
    id: 'bomber', name: 'Bomber', behavior: 'suicide',
    hp: 18, speed: 98, contact: 0, radius: 12, mass: 1, xp: 2, gold: 2,
    color: PAL.enemySuicide, glow: '#ff9030', shape: 'hex',
    special: { explodeRadius: 74, explodeDamage: 26, explodeRange: 34 },
  },
  splitter: {
    id: 'splitter', name: 'Splitter', behavior: 'split',
    hp: 44, speed: 50, contact: 9, radius: 17, mass: 2.2, xp: 4, gold: 3,
    color: '#26c6da', glow: '#1a8a9c', shape: 'square',
    special: { splitInto: 3, childId: 'splitling' },
  },
  splitling: {
    id: 'splitling', name: 'Splitling', behavior: 'chase',
    hp: 8, speed: 82, contact: 5, radius: 8, mass: 0.6, xp: 1, gold: 1,
    color: '#80deea', glow: '#26c6da', shape: 'circle',
  },
  elite_brute: {
    id: 'elite_brute', name: 'Juggernaut', behavior: 'tank',
    hp: 420, speed: 48, contact: 24, radius: 30, mass: 6, xp: 30, gold: 20,
    color: '#e8623a', glow: '#b03a1e', shape: 'hex',
  },
  boss_warden: {
    id: 'boss_warden', name: 'The Warden', behavior: 'boss',
    hp: 6000, speed: 38, contact: 30, radius: 46, mass: 50, xp: 200, gold: 150,
    color: PAL.enemyBoss, glow: '#ffe066', shape: 'hex',
    special: { fireCooldown: 2.6, shotDamage: 14, shotSpeed: 220, burst: 16 },
  },
}

export const ENEMY_IDS = Object.keys(ENEMIES)
