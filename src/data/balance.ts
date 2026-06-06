// Single source of truth for core tunables. Sim runs in SECONDS and WORLD UNITS (WU).
// Values reconciled from the design specs' master plan.

export const C = {
  // --- Loop ---
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.25,
  MAX_STEPS: 5,

  // --- Player ---
  PLAYER_MAX_SPEED: 170, // WU/s
  PLAYER_ACCEL: 1600, // WU/s^2
  PLAYER_DECEL: 2200, // WU/s^2
  PLAYER_RADIUS: 14, // WU
  PLAYER_BASE_HP: 100,
  MOVE_DEADZONE: 0.18,

  // --- Camera / view ---
  CAM_LERP: 0.12, // per fixed step
  VIEW_WIDTH: 560, // WU visible across the screen width (portrait, fit-by-width)
  CAM_LOOKAHEAD: 0.1,
  CAM_LOOKAHEAD_CLAMP: 44,
  SHAKE_MAX: 18, // px
  SHAKE_DECAY: 1.6, // trauma/sec

  // --- Arena ---
  ARENA_W: 4000,
  ARENA_H: 4000,
  GRID_CELL: 32,

  // --- Contact damage / i-frames ---
  CONTACT_TICK: 0.5, // enemies deal contact damage every 0.5s of overlap
  IFRAME: 0.4, // player invuln window after taking a hit

  // --- Entity caps ---
  MAX_ENEMIES: 1200,
  MAX_PROJECTILES: 2000,
  MAX_PARTICLES: 1500,
  MAX_GEMS: 600,
  MAX_DAMAGE_NUMBERS: 256,

  // --- Pickups / magnet (WU) ---
  MAGNET_BASE: 95, // base vacuum radius
  MAGNET_HARD: 26, // instant-collect radius
  MAGNET_PULL: 520, // pull speed when inside magnet radius

  // --- Run structure ---
  RUN_LENGTH: 900, // seconds (15 min)
  BOSS_TIMES: [300, 600, 900],

  // --- Combat globals ---
  CRIT_CHANCE: 0.05,
  CRIT_MULT: 1.5,

  // --- Spawn director ---
  SPAWN_RING_MIN: 1.05, // * half view diagonal: just offscreen
  SPAWN_RING_MAX: 1.35,
} as const

// Difficulty scaling sampled at spawn time (snapshot, not live).
export function hpScale(minutes: number, bossSteps: number): number {
  return Math.pow(1.06, minutes) * (1 + 0.25 * bossSteps)
}
export function dmgScale(minutes: number): number {
  return 1 + 0.05 * minutes
}
export function speedScale(minutes: number): number {
  return Math.min(1.18, 1 + 0.012 * minutes)
}

// On-screen soft target enemy count over the run (minutes 0..15).
export function targetEnemyCount(minutes: number): number {
  return Math.min(260, Math.round(30 + minutes * 16))
}
