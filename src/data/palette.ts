// Neon/arcade art direction. Single source of color truth, consumed by the
// renderer and (later) the SpriteCache. All art is drawn programmatically.

export const PAL = {
  // Background
  bg: '#05060a',
  bgGrid: '#101a33',
  bgGridGlow: '#1b2b52',
  vignette: 'rgba(0,0,0,0.55)',

  // Player
  player: '#3fe0ff',
  playerCore: '#eafcff',
  playerGlow: '#12a9ff',

  // Enemies (by archetype)
  enemySwarmer: '#ff476f',
  enemyRunner: '#ff9f1c',
  enemyBrute: '#b14bff',
  enemyRanged: '#4be0a4',
  enemySuicide: '#ffd23f',
  enemyBoss: '#ff3860',
  enemyGlow: '#ff2e63',

  // Projectiles / weapons
  projectile: '#ffe66d',
  projectileGlow: '#ffb703',
  beam: '#7afcff',
  aura: 'rgba(63,224,255,0.18)',

  // Pickups
  xpGem: '#7CFFB2',
  xpGemGlow: '#27e08a',
  xpGemBig: '#7ad0ff',
  gold: '#ffd75e',
  health: '#ff5d73',

  // Damage numbers
  dmg: '#ffffff',
  dmgCrit: '#ffd23f',
  heal: '#7CFFB2',

  // UI accents
  uiAccent: '#3fe0ff',
  uiWarn: '#ff476f',
  uiText: '#dfe9ff',
  uiDim: '#7f8db0',
} as const

// Rarity colors for level-up cards (7-tier, used later by the upgrade UI).
export const RARITY = {
  common: '#9fb0d0',
  uncommon: '#5ee08a',
  rare: '#3fa9ff',
  epic: '#b14bff',
  legendary: '#ffb703',
  mythic: '#ff476f',
  evolved: '#7afcff',
} as const

export type RarityKey = keyof typeof RARITY
