// Survivor.io-style art direction: bright chunky cartoon on a desaturated grey
// urban ground, thick near-black outlines + white rims, big punchy AOE VFX, bold
// gold/slate UI. Grounded in the real game's screenshots (see docs/ART_BIBLE.md).
// Single source of color truth, consumed by the renderer + SpriteCache.

export const PAL = {
  // Background / ground (muted grey urban so sprites + VFX pop)
  bg: '#23262c', // outside the arena / letterbox
  groundBase: '#5b6068',
  groundLight: '#6b7079',
  groundDark: '#474c54',
  roadPaint: 'rgba(232,234,240,0.42)',
  bgGrid: '#4a4f57',
  bgGridGlow: '#3a3f47',
  vignette: 'rgba(0,0,0,0.45)',

  // Shared art tokens
  outline: '#15171c', // thick near-black outline on every sprite
  rim: '#ffffff', // white halo separating sprites from ground

  // Player (chunky survivor: blue cap, navy jacket, skin, dark gun)
  player: '#3d8de0',
  playerCore: '#eaf4ff',
  playerGlow: '#2b3a5e',
  heroCap: '#3d8de0',
  heroJacket: '#2b3a5e',
  heroSkin: '#f1c79b',
  heroGun: '#3a3f47',
  heroGunAccent: '#e0503a',

  // Enemies (bright, saturated, color-coded cartoon zombies)
  enemySwarmer: '#8bc34a',
  enemyRunner: '#b89b72',
  enemyBrute: '#6aa84f',
  enemyRanged: '#9c4dcc',
  enemySuicide: '#ff7043',
  enemyBoss: '#5e9c3f',
  enemyGlow: '#ffe066',

  // Projectiles / weapons
  projectile: '#ffe066',
  projectileGlow: '#ffb703',
  beam: '#9fd0ff',
  aura: 'rgba(255,140,40,0.20)',

  // VFX (big additive AOE fire)
  aoeFire: '#ff7a18',
  aoeRim: '#ffd24a',
  zap: '#9fd0ff',

  // Pickups
  xpGem: '#7ee37a',
  xpGemGlow: '#27e08a',
  xpGemBig: '#56b8ff',
  gold: '#ffcb3d',
  health: '#ff5d73',

  // Damage numbers
  dmg: '#ffffff',
  dmgCrit: '#ffd23f',
  heal: '#7ee37a',

  // UI
  uiPanel: '#2b2f3a',
  uiPanelLight: '#3a3f4d',
  uiPanelBorder: '#15171c',
  uiAccent: '#3d9bf0',
  uiGood: '#7cc242',
  uiGold: '#ffc02e',
  uiGoldDark: '#d68f1e',
  uiWarn: '#ff5470',
  uiText: '#ffffff',
  uiDim: '#b8c0d0',
} as const

// Rarity colors for level-up cards (7-tier).
export const RARITY = {
  common: '#b6bcc8',
  uncommon: '#7cc242',
  rare: '#3d9bf0',
  epic: '#b15be0',
  legendary: '#ffb02e',
  mythic: '#ff5470',
  evolved: '#34e0e0',
} as const

export type RarityKey = keyof typeof RARITY
