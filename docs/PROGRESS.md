# Progress & Resume Guide

_Last updated: 2026-06-06 (end of session 1)_

## Where we are

**Foundation complete. Gameplay implementation is next.**

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
