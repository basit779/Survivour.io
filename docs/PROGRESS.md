# Progress & Resume Guide

_Last updated: 2026-06-07 (session 2 — PLAYABLE)_

## Where we are

**🎮 The game is PLAYABLE.** Drive a glowing player around a neon arena (touch
joystick / WASD), an auto-targeting weapon fires at the nearest enemy, enemies
swarm with seek+separation flocking, die into XP gems that vacuum to you, you
level up (auto power bumps for now), take contact damage, and can die / win.

**How to run & play:**
```bash
npm run dev      # http://localhost:5173  (or the Network URL on your phone, same WiFi)
npm run smoke    # headless sim + render verification (both PASS)
```
Controls: drag anywhere = move (mobile), WASD/arrows = move, P/Esc = pause,
tap / R / Enter = retry on death.

**Verified this session:** `tsc` clean · `vite build` OK (≈29 KB JS) · 60 s
headless sim PASS (kills, leveling, no NaN) · render smoke PASS (all overlay
states).

### Built in session 2 (the playable core)
- Engine: `Engine` (fixed-timestep + accumulator + timeScale), `Time`, `Scene`/
  `SceneManager`, `Renderer` (DPR-cap, portrait fit-by-width), `Camera` (follow +
  trauma shake).
- Input: `VirtualJoystick` (floating), `Keyboard`, `InputManager`.
- World + entities + object pools + spawn factories.
- Systems: player control, enemy AI (seek+separation) + spawn director, weapons
  (nearest-target projectile), movement, projectiles, collisions, damage, deaths
  + drops, pickups + leveling, camera, particles, damage numbers, render (world +
  HUD + overlays).
- Data: starter weapon (`shard`), 3 enemies (swarmer/runner/brute), XP curve.

### Built in session 2b (the roguelite core)
- **Level-up card screen** (`LevelUpScene`): freezes the battlefield, offers 3
  weighted upgrade cards (new/upgrade weapon, new/upgrade passive, fallbacks),
  pick by tap or number key; queues multiple level-ups.
- **Arsenal**: 6 weapons across patterns — projectile (`shard`/`fan`), homing
  (`seeker`), aura (`forcefield`), orbit (`orbital`), strike/chain (`zap`).
- **11 passives** + `stats.ts` recompute (damage/atkspd/move/HP/magnet/+proj/area/
  crit/regen/cooldown/armor). Armor + regen wired into combat/player.
- Tap + number-key selection input.

### Built in session 2c (enemies + bosses)
- Enemy roster of 9 with real behaviors: chase/fast/tank, **ranged** (kites +
  fires hostile shots), **suicide** (rushes + detonates AoE), **split** (spawns
  splitlings on death), an **elite** (Juggernaut), and a **boss** (The Warden:
  seeks + radial volleys, boss HP bar).
- Hostile projectiles (enemy shots) that damage the player.
- Spawn director: time-phased enemy mix, periodic elites, scheduled bosses at
  5/10/15 min, difficulty scaling (HP/damage/speed) applied at spawn.

### Built in session 2d (game wrapper + persistence)
- **Scene flow**: MainMenu → Run → GameOver → (Retry / Menu). Scenes now share an
  `AppCtx` (input/engine/scenes/save). `SceneManager.replaceAll` for navigation.
- **MainMenuScene**: animated neon title, best time/kills + banked gold, tap to play.
- **GameOverScene**: results summary (time/kills/gold), Retry / Menu buttons.
- **Persistence** (`SaveManager`, localStorage): banks gold + tracks best
  time/kills/runs across sessions.

### Built in session 2e (weapon evolutions)
- The signature mechanic: weapon at Lv5 + its paired passive owned → a near-
  guaranteed **EVOLUTION** card that fuses it into an end-tier evolved weapon.
- 6 evolutions: Shard Storm, Devastator, Drone Swarm, Singularity, Event
  Horizon, Tempest. Evolved weapons never appear as fresh picks / can't re-evolve.

### 🔜 Next (resume here) — continue the milestone ladder
1. **Juice + audio** (steps 9–10): synthesized SFX/music, hitstop, more particle
   polish, screen-shake tuning — the "premium feel" pass.
2. **Full meta shop + characters** (rest of step 8): spend banked gold on permanent
   upgrades; selectable operators.
3. Then ship hardening (step 11): Capacitor native wrap, icons/splash, store builds.

**Original foundation (session 1) below.**

### ✅ Done
- **Decisions locked:** mobile (iOS/Android), programmatic neon art, full vertical slice scope.
- **Toolchain:** Vite + TypeScript (strict) + Capacitor, all configured and installing cleanly.
  - `index.html` is mobile-tuned (safe-area insets, no zoom, no scroll, single canvas).
  - `package.json`, `tsconfig.json`, `vite.config.ts`, `capacitor.config.ts` (appId `com.survivorzero.game`).
  - `.gitignore` / `.gitattributes` in place. Dependencies installed.
- **Engine primitives** (`src/engine/`): `math.ts`, `rng.ts` (seeded mulberry32), `pool.ts` (`Pool` + `SwapPool`), `grid.ts` (uniform spatial hash).
- **Data/type foundation** (`src/data/`): `balance.ts` (all tuning constants `C{}` + difficulty curves), `palette.ts` (neon colors + rarity), `schema.ts` (the shared type contract for weapons/passives/enemies/waves/operators/choices).
- **Design research:** full `docs/MASTER_PLAN.md` (85-file manifest, 11-step build order, reconciled tuning tables) + 6 detailed specs in `docs/specs/`.
- **Git:** connected to `https://github.com/basit779/Survivour.io`, checkpoints pushed to `main`.

### 🎯 Agreed plan for next session
**Go all-in:** build playable core first (~30–40 min), then continue milestone-by-milestone
(enemies/waves → weapons/evolutions → level-up loop → meta → juice/audio), committing + pushing
at each milestone. Full vertical slice est. ~4–5 hrs of work, spread across sessions as needed.

### 🔜 Next (resume here)

Follow the **Implementation Order** in [MASTER_PLAN.md](MASTER_PLAN.md). The foundation covers steps' prerequisites; begin building runtime:

1. **Engine core** — `Engine.ts` (fixed-timestep loop + accumulator + `timeScale`), `Time.ts`, `Scene.ts`, `SceneManager.ts`, `Renderer.ts` (DPR cap 2, portrait fit-by-width), `Camera.ts` (follow + trauma shake), then `main.ts` to boot it. _Milestone: neon arena renders at 60fps with a moving camera._
2. **Player + input** — `InputState`/`InputManager`/`VirtualJoystick`/`Keyboard`, `PlayerControlSystem`, camera follow, parallax grid background. _Milestone: drive a glowing player around the 4000×4000 arena._
3. **Entities + first weapon (PLAYABLE)** — entity classes + object pools, `spawnEnemy`/`spawnProjectile`, `WeaponSystem` (nearest-target), `Collision`/`Damage`/`Death`, `whirl_bat` weapon, dummy enemies. _Milestone: auto-weapon kills seeking enemies — playable end-to-end._
4. Then: full enemy AI + spawn director → full weapons + evolutions → XP/level-up loop → meta/persistence → juice → audio → ship hardening.

## Key decisions already made (so we don't re-litigate)
- **Entity model:** object pools with **stable object references** (not SoA typed arrays). Same zero-alloc-per-frame goal, simpler, and targeting/homing hold live refs (no stale-id problem).
- **Units:** sim in **seconds + world units**; weapon tables authored directly in seconds.
- **Camera:** portrait **fit-by-width**, `VIEW_WIDTH = 560` WU across the screen.
- **Level-up pause:** `timeScale = 0` (battlefield frozen under the cards), not a halted loop.
- **Grid:** single uniform grid, cell size 32.
- **Roster authority:** the weapon-system spec's 10 weapons / 12 passives / 10 evolutions is canonical.
- **Name:** "Survivor Zero" (repo is `Survivour.io`; game title can be rebranded for marketing).

## Open product decision (needs your call later)
- **Monetization:** ship **paid** (all F2P hooks off) or **free-to-play** (energy/ads/double-gold on)? Affects whether Power Cells/ads UI gets built. Defaulting to **paid/premium** until you say otherwise.

## How to run what exists
```bash
npm install
npm run typecheck   # should pass clean
npm run dev         # nothing visual yet until Engine.ts + main.ts exist (step 1)
```
