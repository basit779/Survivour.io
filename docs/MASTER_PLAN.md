# Survivor Zero — Master Implementation Plan

> Auto-generated from the design+research workflow synthesis.

## Summary

Survivor Zero is a Survivor.io-style mobile bullet-heaven roguelite: Vite + TypeScript + Canvas2D wrapped in Capacitor (iOS/Android), all art programmatic and all audio synthesized (zero binary assets). The simulation is a deterministic fixed-timestep core (60 Hz, accumulator, render interpolation) with a seeded PRNG, data-driven content tables, and a strict zero-allocation hot loop backed by Struct-of-Arrays (SoA) typed-array pools. A run is ~15 minutes with bosses at 5:00/10:00/15:00, time-scaled difficulty, ~300 on-screen enemies (pool cap 1200), an auto-targeting nearest-enemy primary weapon, aura/orbit/boomerang/beam weapons, weapon Lv5 + paired passive evolutions, 3-choice level-ups, and a between-runs meta layer (Scrap/Cores currencies, permanent upgrade tree, operators). A scaffold already exists in the working directory (name "Survivor Zero", single canvas, and four engine primitives: math.ts, rng.ts mulberry32, pool.ts, grid.ts), so the plan builds on that rather than starting from scratch.

The six subsystem specs are largely complementary but conflicted on units, naming, entity-model representation, grid cell size, i-frame durations, entity caps, and weapon rosters. This master plan reconciles them with a single source of truth per domain: tech-architecture owns the folder tree, loop, pools, render pipeline, scenes, and the shared data/schema.ts contract; core-mechanics owns physics, camera, collision, contact damage, the spawn-director timing, and run state; enemy-ai-spawn owns the enemy roster/AI/flocking/spawn tables and drops; weapon-system owns the 10-weapon + 12-passive + 10-evolution data tables and targeting/damage pipeline; progression-meta owns XP curve, level-up choice generation, economy, save schema, and monetization; juice-art-audio owns the palette, draw recipes, particle system, juice (shake/flash/hitstop), HUD/DOM, and synthesized SFX/music. Where specs disagree, the plan picks one canonical value and records the rest under Open Decisions.

Architecturally the game is one world canvas (full-clear redraw each frame) plus a DOM/CSS overlay for chrome (menus, HUD bars, level-up cards) — matching the existing index.html single-canvas scaffold and the juice spec, with the tech spec's optional second overlay canvas deferred. Entities use SoA typed-array pools (enemies via stable free-list, everything else via dense swap-remove) which requires refactoring the existing object-based SwapPool. Systems run in a fixed, documented order each tick for determinism. The build ships from one codebase to both stores via Capacitor; DPR is capped at 2 and an adaptive quality controller steps DPR/particles/glow down under sustained frame-time pressure to hold 60 fps on mid-range phones. The recommended build order front-loads a runnable "player moving in an arena with one auto-weapon killing dummy enemies" milestone, then layers spawning, full weapons, progression, meta, and finally juice/audio polish.

## File Manifest (85 files)

| Path | Purpose |
|---|---|
| `index.html` | EXISTS. Single #game-canvas + DOM overlay root + safe-area CSS vars + no-zoom viewport. Keep; add #ui-overlay div for DOM chrome (HUD/menus) above canvas. |
| `package.json` | EXISTS (name survivor-zero). Add deps @capacitor/haptics, @capacitor/splash-screen; devDep @capacitor/assets; add lint/assets scripts. |
| `tsconfig.json` | EXISTS. strict on, ES2020, bundler resolution. Keep. Note: noUncheckedIndexedAccess intentionally OFF for typed-array ergonomics. |
| `vite.config.ts` | EXISTS. base:'./' (critical for Capacitor file://), es2020 target, single chunk. Keep; consider sourcemap:true for dev profiling. |
| `capacitor.config.ts` | EXISTS. appId com.survivorzero.game, webDir dist, dark statusbar overlay. Add SplashScreen plugin config (launchShowDuration 600). |
| `.eslintrc.cjs` | NEW. Layering rules (no-restricted-imports) + no-restricted-syntax banning `new` in systems/ hot files; enforces data/->nothing, engine/->engine/ only. |
| `src/main.ts` | NEW. Sole top-level side-effect file. Grabs canvas, constructs GameApp/Engine, starts RAF loop, hides #loading. |
| `src/engine/math.ts` | EXISTS. clamp/lerp/damp/dist2/angle/easing/normalizeInto + scratch vec. Reuse as-is. |
| `src/engine/rng.ts` | EXISTS. Mulberry32 seeded RNG (next/range/int/chance/pick/weightedIndex) + global rng. Reuse for deterministic runs. |
| `src/engine/pool.ts` | EXISTS but object-based. REFACTOR/REPURPOSE: keep generic Pool<T> for rare objects; the SoA hot pools live in entities/stores.ts. Add index-based Pool (dense swap-remove returning moved index) and FreeListPool (stable ids) per tech spec. |
| `src/engine/grid.ts` | EXISTS (array-bucket, recenterable). Reuse; standardize cellSize=32 (reconciled from core 64 / enemy 24 / tech 64). Used for enemy targeting, collision, separation, pickup vacuum. |
| `src/engine/Engine.ts` | NEW. Owns RAF loop, fixed-timestep accumulator (FIXED_DT 1/60, MAX_STEPS 5, MAX_FRAME_DT 0.25), timeScale (pause/hitstop/slowmo), adaptive-quality controller, calls scene fixedUpdate/update/render(alpha). |
| `src/engine/Time.ts` | NEW. dt, fixedDt, alpha, elapsed, frameCount, timeScale; rolling avg frame time for adaptive quality. |
| `src/engine/Scene.ts` | NEW. Scene interface { enter; exit; update(dt); fixedUpdate(fdt); render(ctx,alpha); onInput }. |
| `src/engine/SceneManager.ts` | NEW. Stack-based scene machine (push/pop/replace) so LevelUp/Pause overlay-pause RunScene while it still renders beneath; 200ms cross-fade. |
| `src/engine/Renderer.ts` | NEW. Canvas/DPI setup (DPR cap 2, imageSmoothing per art), resize+safe-area, camera transform apply/reset, full-clear strategy, fit-by-width portrait viewport (narrow axis shows fixed world height). |
| `src/engine/Camera.ts` | NEW. Follow player (CAM_LERP 0.12/step), optional lookahead, max-catchup clamp, world<->screen, trauma-based shake (applied to world transform only, never HUD), clamp to arena bounds. |
| `src/engine/SpriteCache.ts` | NEW. Bakes all programmatic art (glow+body, hit-flash white silhouettes, gems, particle glow sprite x4 tints, icons) to offscreen canvases/ImageBitmaps once at boot; runtime is drawImage blits only. |
| `src/engine/EventBus.ts` | NEW. Tiny typed pub/sub for NON-hot events (levelup, death milestones, pickup, boss-spawn) feeding juice/audio/haptics. |
| `src/engine/audio/AudioEngine.ts` | NEW. WebAudio graph: master->compressor->destination, sfxBus + musicBus gains, unlock-on-first-gesture, suspend on background, ducking, voice cap 16, settings sliders (perceptual gain=x^2). |
| `src/engine/audio/Synth.ts` | NEW. Oscillator/noise/ADSR helpers, shared 1s white-noise buffer, one-shot voice allocation with cap + per-sound rate limit (30-40ms). |
| `src/engine/audio/Sfx.ts` | NEW. Named SFX recipes: shoot, plasma, hit, crit, enemyDie, explode, levelUp, pickup, heal, playerHurt, bossSpawn, heartbeat, uiTap/confirm (synth params per juice spec §5.2). |
| `src/engine/audio/MusicGen.ts` | NEW. Lookahead step sequencer (25ms tick, 100ms ahead, 128 BPM Am), layers bass/kick/hat/snare/arp/pad, adaptive intensity by threat & boss, low-HP muffle, hit ducking, per-scene mood. |
| `src/input/InputManager.ts` | NEW. Merges joystick/keyboard/gamepad into one flat InputState each frame; movement = last-active source wins, action edges OR-combined. |
| `src/input/InputState.ts` | NEW. Flat readonly struct systems consume: moveX/Y, moveMagnitude, dash/pause/confirm edges, pointer x/y/down. |
| `src/input/VirtualJoystick.ts` | NEW. Floating stick on left 60% of screen, deadzone, max radius, base re-centering when dragged past rim, multi-touch via pointerId, full-speed-past-deadzone (digital feel). |
| `src/input/Keyboard.ts` | NEW. WASD/arrows->unit move, Space dash, Esc pause, Enter confirm, debug keys (~, 1-9 spawn). |
| `src/input/Gamepad.ts` | NEW. Poll navigator.getGamepads each frame, left stick (0.15-0.20 radial deadzone), A confirm/B dash/Start pause. |
| `src/game/GameApp.ts` | NEW. Top-level orchestrator: owns SceneManager, AudioEngine, InputManager, SaveManager, Settings; wires visibilitychange pause + audio suspend. |
| `src/game/World.ts` | NEW. Container of all SoA stores + systems + grid + run state for one active run; allocates pools once; reset()/dispose() reuses arrays. |
| `src/game/RunConfig.ts` | NEW. Per-run params: operator id, seed (URL ?seed=), chapter/biome, difficulty ref, god-mode flag. |
| `src/game/RunState.ts` | NEW. Live run state: elapsed, kills, level, xp, xpToNext, gold(scrap), damageDealt, bossKills, score, state PLAYING\|WIN\|DEAD\|PAUSED (core spec §7). |
| `src/game/scenes/BootScene.ts` | NEW. Bake SpriteCache, load save, defer audio init until first touch, brief logo, -> MainMenu. |
| `src/game/scenes/MainMenuScene.ts` | NEW. Play/Shop/Settings, animated neon background (DOM overlay). |
| `src/game/scenes/CharacterSelectScene.ts` | NEW. Pick operator + see starting weapon & meta stats. |
| `src/game/scenes/RunScene.ts` | NEW. THE GAME. Owns a World, drives fixedUpdate system order (core §8), renders world, spawns HUD, handles pause/levelup overlay push. |
| `src/game/scenes/LevelUpScene.ts` | NEW. Overlay (pauses RunScene via timeScale 0): 3-4 upgrade cards, reroll/banish, evolve priority, fallback cards (progression §2). |
| `src/game/scenes/ChestScene.ts` | NEW. Elite/boss chest reward (1/3/5 upgrades), Golden auto-evolve; can ship in v1.1. |
| `src/game/scenes/GameOverScene.ts` | NEW. Results (time/kills/level/gold/score, per-weapon dmg bars, count-up), award scrap, double-gold hook, Retry/Menu. |
| `src/game/scenes/MetaShopScene.ts` | NEW. Permanent upgrade tree, operator unlocks; spends Scrap/Cores (progression §5). |
| `src/game/entities/stores.ts` | NEW. CORE DATA-ORIENTED FILE. All SoA component typed arrays preallocated to caps: enemies(1200, FreeListPool), projectiles(2000), particles(1000-3000 adaptive), gems(600), damageNumbers(256), plus ground pools/auras/beams scratch. Hard budget ~0.5MB. |
| `src/game/entities/Player.ts` | NEW. Singleton struct (not pooled): pos/vel/prev, hp/maxHp, r=14, level/xp, moveSpeed, crit, magnetRadius, iframe timers, equipped weapon instances (level+cooldownTimer), cached aggregated passive multipliers. |
| `src/game/entities/spawnEnemy.ts` | NEW. Factory: alloc enemy slot, fill from ENEMY_DEFS row, snapshot hp/dmg/speed scaling at spawn time, set prevX=x. |
| `src/game/entities/spawnProjectile.ts` | NEW. Factory: alloc projectile, set from weapon emission (pos/vel/damage/pierce/flags/spriteId/ttl). |
| `src/game/entities/spawnParticle.ts` | NEW. Burst/single particle emitters per juice §3.3 (respects particleScale degradation). |
| `src/game/entities/spawnGem.ts` | NEW. XP gem/gold/pickup drop with tier rollup (fewest gems, cap 6 per death), small outward scatter impulse. |
| `src/game/entities/spawnDamageNumber.ts` | NEW. Pooled float-up popup, crit/heal/DoT variants, per-enemy stacking to avoid overlap. |
| `src/game/systems/PlayerControlSystem.ts` | NEW. InputState->player velocity (accel 1600/decel 2200/max 170 WU/s + moveSpeedPct), facing, sprite flip, optional dash. |
| `src/game/systems/WeaponSystem.ts` | NEW. Tick per-weapon cooldownTimer (-=FIXED_DT, +=cooldown on fire), resolve targeting via shared nearest-enemy grid query, emit projectiles/auras/orbits/beams per WEAPONS table & damage pipeline. |
| `src/game/systems/EnemyAISystem.ts` | NEW. SoA steering: seek+separation(mass-weighted)+avoidance, per-kind behaviors (chase/kite/charge/orbit/suicide/split/boss), AI LOD stride governor, telegraphs. |
| `src/game/systems/MovementSystem.ts` | NEW. Integrate pos from vel (player/enemies/projectiles/gems) at FIXED_DT; clamp player+camera to 4000x4000 arena; write prev for interpolated entities. |
| `src/game/systems/SpawnDirector.ts` | NEW. Target on-screen count curve, off-screen ring spawn (movement-biased), wave phase weight tables, pincer/swarm events, elite timers, boss triggers at 300/600/900s, hard cap respect. |
| `src/game/systems/ProjectileSystem.ts` | NEW. TTL/lifetime, homing retarget, pierce hitSet, boomerang apex hitSet clear, bounce off bounds, off-arena cull, return to pool. |
| `src/game/systems/CollisionSystem.ts` | NEW. Grid broad-phase + circle narrow tests: proj<->enemy, enemy<->player contact, gem<->player; swept check for flagged fast/dash enemies; queue hits. |
| `src/game/systems/DamageSystem.ts` | NEW. Resolve hit queue: damage pipeline (base*damagePct*crit*typeMult*(1-DR)), crit roll, knockback (mass-scaled, immune flag), status apply, shield arc reduction, spawn damage numbers, queue deaths, accumulate damageDealt. |
| `src/game/systems/DeathSystem.ts` | NEW. Resolve death queue: splitter children, summoner cleanup, drops (gems/gold/pickups via DROP_TABLES + pity timer), kill count, death FX/particles, free slot. |
| `src/game/systems/PickupSystem.ts` | NEW. Magnet attraction (radius 70*scale, snap ease), XP accrual with remainder carry, gold, health/magnet/bomb/freeze/chest effects. |
| `src/game/systems/ProgressionSystem.ts` | NEW. XP->level piecewise curve, queue level-ups (FIFO), push LevelUpScene, apply chosen upgrade, recompute cached player multipliers. |
| `src/game/systems/EvolutionSystem.ts` | NEW. Detect weapon Lv5 + paired passive>=1, inject EVO card high-weight, perform in-slot replacement with EVOLVED def, mark evolved (no further levels). |
| `src/game/systems/StatusEffectSystem.ts` | NEW. Burn/slow/freeze/poison timers on enemies (SoA statusMask/statusT/slowMul); DoT ticks; freeze pickup global slow. |
| `src/game/systems/CameraSystem.ts` | NEW. Record follow target each fixed step (interpolated in render), trauma decay, shake sampling from value-noise. |
| `src/game/systems/ParticleSystem.ts` | NEW. Integrate+fade SoA particles, gravity/drag per type, adaptive particleScale, caps (smoke 60, ring 4). |
| `src/game/systems/DamageNumberSystem.ts` | NEW. Float-up + fade pooled numbers, merge/cap at ~40, cached small-int strings. |
| `src/game/systems/RenderSystem.ts` | NEW. Reads all stores, draws back-to-front in 5 passes (bg/grid -> shadows+bodies+gems -> additive glow/proj/particles -> dmg numbers -> HUD), batches by composite op, culls off-screen. |
| `src/game/ui/Hud.ts` | NEW. Drives DOM HUD chrome (HP/XP bars via transform scaleX, timer<=10Hz, level badge, kills/gold chips, weapon/passive tray with level pips, boss HP bar) throttled, no layout thrash. |
| `src/game/ui/UpgradeCard.ts` | NEW. Level-up card model+render: icon, name, rarity accent, Lv n->n+1, effect delta, NEW! ribbon, selection juice. |
| `src/game/ui/JoystickView.ts` | NEW. Canvas-drawn floating joystick visual (two pre-baked glow rings) on world/overlay layer. |
| `src/game/ui/dom/overlay.ts` | NEW. Manages positioned DOM layer over canvas for menu/shop/settings/gameover screens; show/hide per scene; safe-area insets. |
| `src/game/ui/dom/styles.css` | NEW. Menu/HUD/card CSS, neon theme, safe-area-inset padding, will-change transform on bar fills, >=44px touch targets. |
| `src/game/ui/format.ts` | NEW. Number formatting (1.2K/3.4M) and mm:ss time. |
| `src/data/schema.ts` | NEW. SHARED CONTRACT. All interfaces: WeaponDef/WeaponLevel/WeaponFlags, FirePattern/Targeting enums, PassiveDef/PassiveStat, EnemyDef/EnemyKind, WavePhase, OperatorDef, MetaUpgradeDef, DropTable, GemTier, Rarity(7-tier). Every team imports from here. |
| `src/data/balance.ts` | NEW. Single source of truth for core tunables C{} (FIXED_DT, player speed/accel/decel/r, cam, grid cell, arena, contact tick/iframe, caps, spawn ring, run length) + JUICE{} block (shake/trauma/hitflash/knockback/hitstop/dmgNum/gem/particles/audio). |
| `src/data/weapons.ts` | NEW. WEAPONS record: 10 base weapons (whirl_bat..scatter_gun) with 5-level stat tables, flags, evolvesWith/Into (weapon-system spec §5). |
| `src/data/evolved.ts` | NEW. EVOLVED record: 10 single-level evolved weapons (cyclone_bat..gatling_storm) with special behaviors (shockwave/pulse/spikeBurst/rotating). |
| `src/data/passives.ts` | NEW. PASSIVES record: 12 passives (combat_drug, power_cell, sneakers, gym_manual, super_magnet, he_fuel, hp_rounds, scope, energy_tonic, oil_pact, ninja_scroll, ammo_drum) cumulative per-level stats. |
| `src/data/evolutions.ts` | NEW. EVO_RECIPES array: {base, passive, result} x10 mapping (note power_cell partners 3 weapons). |
| `src/data/enemies.ts` | NEW. ENEMY_DEFS record: 13 kinds (swarmer..boss_warden) with baseHP/speed/contactDmg/radius/mass/xp/gold/behavior/color/glow/shape/dropTable/special (enemy-spec §9). |
| `src/data/waves.ts` | NEW. Wave phase schedule (minute-by-minute type weights, target curve, events, boss rows) + difficulty scaling curves (hpScale/dmgScale/speedScale) (enemy-spec §1,§4.5). |
| `src/data/operators.ts` | NEW. OPERATORS: Recruit/Vanguard/Striker/Scout/Pyro/Tempest/Nyx with start weapon, unique passive, base mods, unlock costs (progression §5.3). |
| `src/data/levelCurve.ts` | NEW. xpToNext(level) piecewise formula + XP shard values (1/5/20) + gem tier rollup helper (progression §1.2,§8). |
| `src/data/meta.ts` | NEW. Permanent upgrade tree (13 meta_* upgrades: base/growth/ranks/effect), shop prices, energy/double-gold config (progression §5.2,§8). |
| `src/data/palette.ts` | NEW. Named colors/gradients/glow specs, per-biome tints, rarity colors (juice §1.1) — single art source consumed by SpriteCache. |
| `src/save/SaveManager.ts` | NEW. Versioned save via @capacitor/preferences (localStorage fallback), debounced writes + on pause/resume/run-end, migrate chain, clamp/repair corrupt values, keep save_v1_bak, lazy Power Cells regen (progression §6). |
| `src/save/SaveSchema.ts` | NEW. MetaSave shape: version, currencies (scrap/cores/powerCells), metaUpgrades ranks, operators unlocked/selected, cosmetics, progress, lifetime stats, monetization flags, settings (progression §6.2). |
| `src/types/global.d.ts` | NEW. Ambient types: webkitAudioContext, Capacitor globals. |

## Implementation Order

1. 1. Boot + loop skeleton: main.ts, Engine.ts (fixed-timestep+accumulator+timeScale), Time.ts, Scene.ts, SceneManager.ts, Renderer.ts (DPR cap, portrait fit-by-width, full clear). Reuse existing math/rng/grid. Milestone: blank neon arena renders at 60fps with a moving camera.
2. 2. Player + input: InputState/InputManager/VirtualJoystick/Keyboard, PlayerControlSystem, Camera follow, parallax grid background (palette.ts minimal). Milestone: drive a glowing player around the bounded 4000x4000 arena on phone + desktop.
3. 3. Entity core (SoA): data/schema.ts contract, entities/stores.ts (enemy FreeListPool + projectile/particle/gem dense pools), repurpose pool.ts. spawnEnemy/spawnProjectile factories. Milestone: spawn dummy enemies that seek the player (basic seek only).
4. 4. First weapon + collision + damage: data/balance.ts (C{}), data/weapons.ts (just whirl_bat + shadow_fang to start), WeaponSystem (NEAREST targeting via grid), ProjectileSystem, CollisionSystem, DamageSystem, DeathSystem (kill + free slot), basic damage numbers. Milestone: auto-weapon kills seeking enemies — the game is now PLAYABLE end-to-end.
5. 5. Enemy AI + spawn director: full EnemyAISystem (seek+separation+per-kind behaviors), data/enemies.ts (all 13), data/waves.ts, SpawnDirector (ring spawn, target curve, phase weights, events, boss triggers), StatusEffectSystem, contact damage + i-frames. Milestone: survive escalating waves with the 5/10/15-min boss cadence.
6. 6. Full weapons + evolutions: complete data/weapons.ts (all 10), data/passives.ts (12), data/evolved.ts + data/evolutions.ts; finish all FirePatterns (aura/orbit/area/beam/boomerang/strike) and Targeting modes in WeaponSystem; EvolutionSystem. Milestone: full combat sandbox with evolutions firing.
7. 7. Progression + level-up loop: data/levelCurve.ts, ProgressionSystem (XP curve + queued level-ups), PickupSystem (gem magnet/XP/gold/consumables), LevelUpScene + UpgradeCard (3-card gen, reroll/banish, evolve priority, fallback), RunState/score, win/lose -> GameOverScene. Milestone: complete single-run roguelite loop start to win/death.
8. 8. Meta layer + persistence: save/SaveSchema + SaveManager (Capacitor Preferences), data/meta.ts + data/operators.ts, MainMenu/CharacterSelect/MetaShop scenes, currency banking, permanent upgrades, operator unlocks. Milestone: progression persists across runs; meta upgrades affect run-start stats.
9. 9. Juice + art polish: SpriteCache baking, full palette/draw recipes, ParticleSystem + spawnParticle, juice (trauma shake, hit-flash, knockback, hitstop, squash/stretch, level-up flash, low-HP vignette, gem vacuum), DamageNumberSystem polish, RenderSystem multi-pass additive, HUD/DOM chrome + styles.css. Milestone: 'premium feel' — the screenshot-worthy build.
10. 10. Audio: AudioEngine/Synth/Sfx/MusicGen, EventBus wiring of juice events -> SFX/haptics, adaptive music intensity, ducking, settings sliders. Milestone: fully synthesized soundscape, zero audio files.
11. 11. Adaptive quality + ship hardening: adaptive-quality controller (DPR/particle/glow tiers), perf governor (AI stride + soft cap), .eslintrc layering/no-alloc lint, Capacitor native wrap (icons/splash, portrait lock), perf verification (0 alloc/frame, p95<=16.6ms), store builds. Milestone: shippable .aab/.ipa holding 60fps on mid-range phones.

## Key Tuning Constants

- Loop: FIXED_DT=1/60s, MAX_FRAME_DT=0.25s, MAX_STEPS=5; render interpolation alpha=accumulator/FIXED_DT; timeScale gates gameplay dt (0=pause, used for hitstop/slowmo) but not HUD/overlay animation
- Player: maxSpeed 170 WU/s, accel 1600, decel 2200, collision r=14 (juice value; core said 12), move full-speed-past-deadzone; magnet base radius 70px*(canvasW/1080), hard-collect 28px
- Camera: CAM_LERP 0.12/step, lookahead 0.10*vel clamp +-40, max-catchup 1200 WU/s, deadzone 0 (player centered); shake = trauma^2, maxOffset 18px, decay 1.6/s, value-noise (never Math.random), applied to world transform only
- Arena bounded 4000x4000 WU; grid cell 32 (reconciled from core 64 / enemy 24 / tech 64) — single uniform grid rebuilt each fixed step
- Contact damage: tick-based DoT, take MAX overlapping enemy contactDmg (not sum), contactTick 0.5s, player i-frame 0.4s (reconciled from core 0.5 / enemy 0.4); AOE/boss attacks on separate 0.25s i-frame channel
- Enemy caps: hard pool 1200, soft on-screen target curve 30 -> ~260 (clamp), maxPerTick 6->22; projectiles cap 2000, particles 600-3000 adaptive, gems 600, damageNumbers 256
- Difficulty scaling at spawn time (snapshot, not live): hpScale ~1.06^min * (1 + 0.25*bossSteps), dmgScale 1+0.05*min, speedScale min(1.18, 1+0.012*min); elites HPx6-ish per roster, bosses authored HP
- Run structure: 900s, bosses at 300/600/900s (Caroma 6000 / Maw 14000 / Iron Warden 32000 base HP), win on final boss kill, lose on hp<=0; smooth waveMult ramp 1.0->4.0
- Weapons: 6 active + 6 passive slots, weapons 5 levels, starter=whirl_bat; cooldown floor = base*0.25; effectiveCooldown = base*(1-cdr)*(1-atkSpd); crit base 5% / mult 1.5; bonusProjectiles only on acceptsBonusProjectiles weapons; primary auto-targets NEAREST (range ~1200/inf)
- Damage pipeline order: base[lvl] * (1+damagePct) * (isCrit?critMult:1) * weapon.typeMult * (1-enemyDR); auras/beams/orbits/pools use per-enemy tickRate (no per-frame), piercing projectiles use hitSet
- Evolution: weapon Lv5 + paired passive Lv>=1 -> EVO card weight 1000 (near-guaranteed); evolved = single fixed tier, still benefits from global passives; power_cell partners 3 weapons (storm_coil/sky_drones/pulse_lance)
- XP curve: xpToNext = lvl<=20: 5+(lvl-1)*6; <=40: 119+(lvl-20)*13; else 379+(lvl-40)*22 (round); first level-up at 5 XP; target ~level 45-60 per run; XP shard values 1/5/20; gem rollup max 6 drops/death
- Level-up: 3 cards (4 with meta), 2 rerolls + 1 banish default; weights evolve 1000 / upWeapon 60(+10/lvl) / upAugment 40 / newWeapon 35(x1.5 early) / newAugment 30; fallback Scrap+50/Heal30%/Surge+3% when pool exhausted
- Economy: runScrap = collected * (1+oilPact) * (1+metaScrap) * stageClear(1.0/1.5) * doubleGold(1/2); meta tree full ~380-400k Scrap (~30-50 runs); Power Cells regen 1/6min cap 6 (F2P only, off in paid build)
- Juice: hitstop brute-death 60ms/bigExpl 70ms/bossDeath 180ms (cap 120ms per 1s window); hit-flash 0.08s; NO screen shake on per-hit (only kills/explosions/player-damage); knockback base 90 / explosion 220, mass-scaled, bosses immune; low-HP vignette below 30% HP
- Render/audio: DPR cap 2 (adaptive 2.0->1.5->1.25 under sustained <55fps); two-pass additive glow (lighter) with baked halo+core sprites (no per-entity shadowBlur except player/boss); audio 128 BPM Am, master 0.8 / sfx 0.9 / music 0.45, voice cap 16, sfx min gap 30ms, gain=slider^2

## Build & Ship Steps

1. npm i (deps already mostly installed); add: npm i @capacitor/haptics @capacitor/splash-screen && npm i -D @capacitor/assets
2. Add npm scripts: "lint": "eslint src --ext .ts", "assets": "capacitor-assets generate", plus existing dev/build/preview/cap:sync
3. Development loop: npm run dev -> open in Chrome DevTools Device Toolbar (touch + DPR emulation); use ?seed=12345&chapter=2&god=1 URL params for reproducible balance runs; debug overlay (~) shows fps/pool counts/hitboxes
4. Typecheck gate before every build: npm run build runs `tsc --noEmit && vite build` -> outputs dist/ (single chunk, base './')
5. One-time native wrap: npm run build && npx cap add android && npx cap add ios && npm run assets (generate icons/splash) — android/ and ios/ are gitignored per existing .gitignore (commit decision is an open item)
6. Per web change: npm run cap:sync (build + cap sync copies dist into native + updates plugins)
7. Android ship: npm run cap:android -> set signing -> Generate Signed Bundle (.aab); set android:screenOrientation=portrait in AndroidManifest.xml
8. iOS ship: npm run cap:ios (macOS+Xcode) -> set team/bundle id/signing -> Archive -> App Store Connect; Device Orientation = Portrait only
9. Perf verification before ship: Chrome perf Allocation Sampling must show flat (0 bytes/frame) allocation line during steady-state play; p95 frame <=16.6ms, 0 frames >33ms after warmup; JS gzip <250KB; 0 audio/image asset bytes

## Open Decisions

- Game name: code/scaffold says 'Survivor Zero' (appId com.survivorzero.game) while specs propose Horde/Dawn/Wasteland/NEON Survivor. DECIDED here: keep 'Survivor Zero' (matches existing config); update only if marketing requires.
- Reference resolution / units: core+enemy+tech use 1280x720 landscape-ish design units; weapon-system uses 720x1280 portrait; juice uses 390x844 portrait. The game is portrait (Capacitor locks portrait). DECISION NEEDED: pick one canonical design resolution for UI scaling — recommend juice's 390x844 for UI (uiScale clamp 0.85-1.4) and a fit-by-width world camera (fixed world height on narrow axis). Confirm weapon px values were authored at 720-wide and scale consistently.
- Time units in weapon data: weapon-system + juice express cooldowns/durations in MILLISECONDS; core/enemy express in SECONDS. DECISION: store weapon data in ms (as written) and divide by 1000 at load into the seconds-based sim, OR convert tables to seconds. Recommend a single load-time conversion so sim stays in seconds.
- Entity representation: tech/core/enemy mandate SoA typed arrays; the existing pool.ts is object-based SwapPool. Plan adopts SoA (entities/stores.ts) and repurposes pool.ts. CONFIRM willingness to refactor/replace the existing object SwapPool (low risk, file barely used yet).
- Grid cell size: core/tech=64, enemy=24 (for separation). Plan reconciles to a single grid at 32. If enemy separation feels stacky or targeting feels coarse, decide between two grids (24 for separation, 64 for targeting) vs tuning the single 32 grid.
- Canvas layering: tech wants 2 canvases (world + overlay) + DOM; juice + existing index.html use 1 canvas + DOM overlay. Plan ships 1 world canvas + DOM chrome (joystick stays on canvas). Revisit adding a second overlay canvas only if DOM card animations underperform.
- Weapon roster authority: weapon-system spec (10 weapons / 12 passives / 10 evos, fully tabled) is canonical; progression-meta lists a different 16-weapon set (shuriken/boomerang/brick/drill/...) and tech-arch yet other names (Shuriken Storm/Aether Edge/Singularity). DECISION: use weapon-system's 10 as the shipping roster; treat meta's 16 and tech's names as superseded flavor. Note meta's mine/soccer 'evolve at Lv5 alone' rule is dropped (all evos need a passive).
- Sky Drones evolution rule: weapon-system gives two options (Lv5 + power_cell, OR Lv5 + any 2nd projectile/orbit weapon Lv>=3). DECISION: ship the simpler 'Lv5 + power_cell' rule for consistency with the EVO_RECIPES table.
- Contact i-frame value: 0.5s (core) vs 0.4s (enemy). Plan uses 0.4s. Confirm vs the 0.5s contact tick cadence (core wanted iframe==tick for clean cadence); if 0.4s feels off-beat, revert to 0.5.
- Difficulty curve overlap: core §6.3 (hpMult 1+0.18*t linear) vs enemy §1 (hpScale 1.06^min compounding + boss steps). DECISION: use enemy-ai-spawn curves (it owns enemies). Confirm the combined power curve vs weapon DPS feels right in playtest.
- Pause sim while level-up open: core halts the accumulator; tech/juice set timeScale=0 with render continuing. DECISION: use timeScale=0 (renders frozen battlefield under cards) — confirm this is preferred over fully halting the loop.
- Monetization mode: progression-meta supports paid (all hooks off) vs F2P (energy/ads on) via one config flag. DECISION NEEDED from product: ship paid or F2P first; affects whether Power Cells/ads UI is built in v1.

