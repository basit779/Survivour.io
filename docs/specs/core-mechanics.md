I have authentic mechanics confirmed: ~15-min runs, bosses every 5 min, time-based scaling, primary weapon auto-targets nearest enemy (Kunai-style), Forcefield/aura weapons, contact damage from zombies. Now I'll write the complete implementation-ready spec.

# Core Game Feel, Loop & Physics — Implementation Spec

> Target: HTML5 + TypeScript, Canvas2D, 60 fps on mid-range phones, Capacitor wrap. All art programmatic. This document defines the **deterministic simulation core** that every other subsystem (weapons, enemies, UI, meta) plugs into. Where it says "Survivor.io-style," that reflects the researched behavior of the real game (≈15-min runs, bosses every 5 min, time-scaled difficulty, primary weapon auto-targets nearest enemy, aura/forcefield weapons, contact damage). Names are adapted to avoid trademark issues.

---

## 0. Coordinate System & Units

- **World units (WU):** the simulation's native unit. **1 WU = 1 pixel at zoom 1.0 (reference resolution).**
- **Reference resolution:** design against **1280 × 720 logical pixels** (16:9). The canvas backing store is set to `cssPixels * devicePixelRatio` but **capped at DPR 2.0** on mobile (rendering at DPR 3 is the #1 cause of dropped frames; the visual gain is negligible at arm's length).
- **Player collision radius:** `12 WU`. **Tile/visual scale reference:** an average zombie body ≈ `16 WU` radius.
- **Camera zoom:** fixed `1.0` in v1 (no pinch zoom). Internally render with a `cameraScale = min(viewportW/1280, viewportH/720)` *letterbox-fit* so the player always sees the same amount of world regardless of device, then center. This guarantees fairness across screen sizes (a tall phone does not see more enemies than a wide one along the play axis).
- **Y axis points down** (screen convention). Angles in radians, `0 = +X (right)`, increasing clockwise.

```
World extent: 4000 × 4000 WU "soft arena" (see §4 World Bounds).
Visible world at reference res, zoom 1: 1280 × 720 WU.
```

---

## 1. Main Game Loop

### 1.1 Architecture: Fixed-timestep simulation + interpolated render

Use a **fixed-timestep accumulator** with **render interpolation**. This is non-negotiable for a horde game: collision against thousands of circles and DoT ticks must be frame-rate-independent and deterministic, otherwise the game feels different on a 120 Hz iPad vs a 60 Hz Android, and slow frames cause tunneling (fast enemies passing through the player without a hit).

**Constants:**

| Name | Value | Notes |
|---|---|---|
| `FIXED_DT` | `1/60 s` (`0.016666…`) | Simulation tick. 60 Hz. |
| `MAX_FRAME_DT` | `0.25 s` | Clamp to avoid "spiral of death" after a stall (app backgrounded, GC pause). |
| `MAX_STEPS_PER_FRAME` | `5` | Hard cap on catch-up steps; drop time beyond this. |

### 1.2 The loop

```ts
let accumulator = 0;
let prevTime = performance.now() / 1000;

function frame(nowMs: number) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  let frameDt = now - prevTime;
  prevTime = now;

  if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT; // clamp stalls

  accumulator += frameDt;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    snapshotPrevState();       // copy positions used for interpolation
    simulate(FIXED_DT);        // ALL gameplay logic here, dt is always FIXED_DT
    accumulator -= FIXED_DT;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) accumulator = 0; // shed debt

  const alpha = accumulator / FIXED_DT;  // 0..1 interpolation factor
  render(alpha);
}
requestAnimationFrame(frame);
```

### 1.3 Render interpolation

Each entity that visibly moves stores `prevX, prevY` (written at the top of each sim step, before `simulate`). The renderer draws at:

```
drawX = prevX + (x - prevX) * alpha
drawY = prevY + (y - prevY) * alpha
```

- **Interpolate:** player, enemies, projectiles, camera.
- **Do NOT interpolate:** spawn/death pops, damage numbers, anything event-driven (they snap on the tick they fire).
- **Newly spawned entity:** set `prevX = x, prevY = y` on creation so it doesn't streak from origin.

### 1.4 Keeping 60 fps on mobile (budget & rules)

Frame budget at 60 fps = **16.6 ms**; target **≤ 10 ms** of work to leave headroom for GC and the browser compositor.

| Rule | Why |
|---|---|
| **Cap DPR at 2.0**, render to a single full-screen canvas. | DPR 3 ≈ 2.25× pixel fill cost. |
| **Object pools** for enemies, projectiles, particles, damage numbers, XP gems. Never `new` in the hot loop. | GC pauses cause the exact stutter players notice. |
| **Single Canvas2D context.** Batch by draw type: clear → world geometry → enemies → player → projectiles → particles → UI. | Minimizes `ctx` state changes (the slowest part of Canvas2D). |
| **Avoid per-entity `save()/restore()`, `shadowBlur`, and gradients in the loop.** Pre-bake glow sprites once to offscreen canvases at init; `drawImage` them. | `shadowBlur` is ~10× the cost of `drawImage`. |
| **Cull off-screen entities from rendering** (not from sim) using a margin = `64 WU`. | Don't draw what isn't visible. |
| **Cap simultaneous live entities** (see §6 budgets) and despawn far/old ones. | Hard ceiling on per-frame cost. |
| **Adaptive quality:** track a rolling avg frame time; if > 14 ms for 1 s, drop particle budget by 50% and disable secondary glow. Restore when < 10 ms for 3 s. | Graceful degradation on weak devices. |
| **`alpha: false`, `desynchronized: true`** on `getContext('2d')`. | Skips the alpha compositing pass; lower input-to-photon latency. |

`requestAnimationFrame` naturally throttles to display refresh. On a 120 Hz device, `render` runs at 120 fps but `simulate` still runs 60 Hz — interpolation makes motion smooth. This is the intended behavior.

---

## 2. Player Movement

Top-down, Survivor.io-style: **the player body sprite does not rotate** to face movement (it's a fixed upright character). We *do* track a **facing direction** internally for weapons that need a default aim, but the visible body only flips horizontally (mirror) based on last horizontal input.

### 2.1 Input → desired direction

A normalized **input vector** `inDir ∈ unit circle or zero`:
- **Mobile virtual joystick** (see §2.4): magnitude scales 0→1 with stick deflection, then we treat anything ≥ deadzone as full speed (Survivor.io is digital-feel: you're either moving or not; the analog magnitude is used only for the dead zone, not for variable speed). *Recommended default:* **full speed once past deadzone** (snappier, matches the source game). Optionally expose analog speed as an accessibility toggle.
- **WASD / arrows:** 8-direction, normalized (diagonals not faster).
- **Gamepad left stick:** analog, with `0.20` radial deadzone.

### 2.2 Speed, acceleration, deceleration

| Constant | Value | Notes |
|---|---|---|
| `PLAYER_MAX_SPEED` | `170 WU/s` | Base. Buffable via meta/upgrades. ~13% of screen width/sec — fast enough to kite, slow enough that enemies catch you. |
| `PLAYER_ACCEL` | `1600 WU/s²` | Reaches max speed in ~0.106 s. Snappy. |
| `PLAYER_DECEL` | `2200 WU/s²` | Stops in ~0.077 s. Crisper stop than start (feels responsive). |
| `MOVE_DEADZONE` | `0.18` (stick magnitude) | Below this, treated as no input. |

**Integration (per fixed step, semi-implicit Euler):**

```ts
const targetVx = inDir.x * PLAYER_MAX_SPEED;
const targetVy = inDir.y * PLAYER_MAX_SPEED;

// accel toward target if input, decel toward 0 if no input
const rate = (inDir.lenSq() > 0 ? PLAYER_ACCEL : PLAYER_DECEL) * FIXED_DT;
vx = moveToward(vx, targetVx, rate);
vy = moveToward(vy, targetVy, rate);

x += vx * FIXED_DT;
y += vy * FIXED_DT;
// clamp to world bounds (see §4)

// facing: only for weapon default aim & sprite mirror
if (inDir.lenSq() > 0) facing.set(inDir);   // last nonzero dir persists when idle
if (inDir.x !== 0) spriteFlipX = inDir.x < 0;
```

`moveToward(a, b, maxDelta)` = step `a` toward `b` by at most `maxDelta`.

> **Tuning note:** because accel/decel are very high relative to max speed, the result reads as "near-instant but not robotic." If you want the snappiest possible (pure Survivor.io feel), set both accel/decel to `99999` (instant velocity = `target`). The values above add ~1–2 frames of ramp, which most players read as "good weight." Start with the table; A/B with instant.

### 2.3 No sprite rotation

- Body sprite: upright, mirrored on X by movement. Subtle idle/run bob (sine, 2 Hz, ±2 WU) is a **render-only** effect (don't feed into sim/collision).
- `facing` is a unit vector used as the *fallback* aim for directional weapons when no enemy is in range. Primary weapon ignores it (auto-targets nearest — see §3).

### 2.4 Virtual joystick (mobile)

**Floating/dynamic joystick** (industry standard for this genre — the stick appears where you touch on the left half):

| Constant | Value |
|---|---|
| Active region | Left **60%** of screen (so right-thumb UI/pause never conflicts; movement is left-thumb). |
| `JOY_BASE_RADIUS` | `90 CSS px` |
| `JOY_KNOB_MAX_OFFSET` | `60 CSS px` (stick saturates here = full speed) |
| `JOY_DEADZONE_PX` | `10 CSS px` |
| Multi-touch | Track `touchId`; second finger (right side) reserved for active-skill button(s) / pause. |

Behavior:
1. `touchstart` in active region → record `origin = touch pos`, show base+knob there.
2. `touchmove` → `delta = touch - origin`; `inDir = normalize(delta)`; magnitude = `clamp(len(delta)/JOY_KNOB_MAX_OFFSET, 0,1)`; if `len(delta) < JOY_DEADZONE_PX` → no input.
3. **Re-centering:** if the player drags beyond `JOY_KNOB_MAX_OFFSET`, slide the *base* toward the finger so the stick never gets "stuck" at the rim (origin follows finger keeping max offset). This is what makes mobile kiting feel good.
4. `touchend` → hide stick, `inDir = 0`.

Render the joystick as two pre-baked glowing rings (`drawImage`), not redrawn vector circles.

---

## 3. Auto-Attack Model

All weapons fire **automatically** on **independent per-weapon cooldowns**. The player never taps to attack (only active skills, if any, are tapped). This is the core of the genre.

### 3.1 Weapon instance shape

```ts
interface WeaponInstance {
  defId: string;          // ref to static weapon definition
  level: number;          // 1..maxLevel
  cooldownTimer: number;  // counts DOWN in seconds; fires at <= 0
  // resolved per-level stats (cached, recomputed on level-up):
  cooldown: number;       // seconds between activations
  damage: number;
  range: number;          // WU; 0 or Infinity for some types
  projectileCount: number;
  // type-specific fields…
}
```

**Cooldown handling per fixed step:**
```ts
w.cooldownTimer -= FIXED_DT;
if (w.cooldownTimer <= 0) {
  fireWeapon(w);                 // may emit N projectiles / refresh an aura
  w.cooldownTimer += w.cooldown; // += (not =) preserves overflow → no drift, no FPS dependence
}
```
> Adding instead of assigning prevents cooldowns from rounding to multiples of the frame and keeps high-fire-rate weapons exact.

### 3.2 Target acquisition modes

Weapons declare a `targeting` mode:

| Mode | Behavior | Used by |
|---|---|---|
| `NEAREST` | Acquire the single nearest enemy within `range` (or global if range = ∞). Fire toward it. If none, **skip the activation but reset cooldown to a short retry** (`min(cooldown, 0.2s)`) so it fires immediately when an enemy appears. | **Primary weapon** (the Kunai-style auto-dart), homing shots. |
| `FACING` | Fire in `facing` direction (player's last move dir). Ignores enemies. | Directional guns/shotgun-style weapons (the "manual aim" archetype from the source game). |
| `RANDOM_IN_RANGE` | Pick a random live enemy within range. | Lightning/chain weapons. |
| `AURA` | No target; applies in a radius around the player every tick. | Forcefield/orbit weapons. Cooldown = damage **tick interval** (e.g. `0.5s`). |
| `ORBIT` | Spawns/maintains N satellites circling the player at radius R, angular speed ω; contact-damages enemies with per-enemy hit cooldown. | Guardian/orbiting blades. |

**The PRIMARY weapon (the always-on starter):** mode = `NEAREST`, `range = ∞` (or very large, `1200 WU`), fires `projectileCount` homing/straight darts at the nearest enemy. This matches the researched real-game primary (Kunai auto-aims to the closest enemy; each upgrade adds a dart + damage). Recommended starting stats:

| Level | cooldown (s) | damage | darts |
|---|---|---|---|
| 1 | 1.10 | 12 | 1 |
| 2 | 1.00 | 14 | 1 |
| 3 | 0.95 | 16 | 2 |
| 4 | 0.90 | 18 | 2 |
| 5 | 0.85 | 22 | 3 |

(Full weapon table is the Weapons subsystem's job; this is the contract the loop guarantees.)

### 3.3 Nearest-enemy query (performance-critical)

Run against the **spatial grid** (§5), not a linear scan over all enemies. For `NEAREST` with finite range, search the player's cell and rings of neighbor cells outward until a cell containing an enemy is found, then check that ring + 1 more ring (an enemy in a diagonal-adjacent cell can be closer than one in the current ring). For `range = ∞` primary, cap the search at a sane ring radius (`~8 cells`) and if empty, fall back to a sparse full scan **at most every 4th tick** to avoid worst-case cost when the screen is briefly clear.

Cache the acquired target id for `0.1 s` per weapon so multiple darts in one volley converge on the same enemy (feels intentional) unless it dies.

---

## 4. Camera

Follows the player with smoothing; world scrolls under a near-centered player.

| Constant | Value | Notes |
|---|---|---|
| `CAM_LERP` | `0.12` per **fixed step** | Exponential smoothing toward player. ~Frame-rate independent because it runs in the fixed sim, not render. |
| `CAM_DEADZONE` | `0 WU` (recommended for this genre) | Survivor.io keeps the player dead-center. Optional small deadzone box `24×24 WU` if you want micro-stillness; default off. |
| `CAM_LOOKAHEAD` | `0.10 × velocity` (WU), clamped to `±40 WU` | Tiny lead in movement direction so you see slightly more of where you're going. Set 0 for pure-centered Survivor.io feel. |
| `CAM_MAX_CATCHUP` | `1200 WU/s` | Clamp camera speed so a teleport/dash doesn't whip the view. |

**Update (in fixed sim, so it interpolates cleanly):**
```ts
const targetX = player.x + clamp(player.vx * 0.10, -40, 40);
const targetY = player.y + clamp(player.vy * 0.10, -40, 40);
// deadzone (default 0): only move if outside box
cam.x += (targetX - cam.x) * CAM_LERP;
cam.y += (targetY - cam.y) * CAM_LERP;
// clamp camera speed
clampCameraSpeed(CAM_MAX_CATCHUP, FIXED_DT);
// clamp camera so view stays within world bounds (see below)
```

> Note: `lerp` factor of `0.12/step` at 60 Hz = ~99% catch-up over ~0.6 s. It reads as "slightly floaty, always centered." If you want stiffer, raise to `0.2`. Because it's in the fixed step, the same value gives identical feel on any device.

**World scroll:** render transform each frame:
```
ctx.setTransform(cameraScale,0,0,cameraScale,
   viewportW/2 - camDrawX*cameraScale,
   viewportH/2 - camDrawY*cameraScale);
```
where `camDrawX/Y` are the interpolated camera position (`prev + (cur-prev)*alpha`).

**Background:** infinite-feeling parallax grid drawn programmatically — tile a dark gradient + faint grid lines computed from `cam` modulo cell size (`128 WU`), so it scrolls forever without storing tiles. Add 1 subtle parallax layer (dots) at `0.5×` cam offset for depth.

### World Bounds (§4 continued)

**Recommendation: bounded "soft arena," not infinite.** A `4000 × 4000 WU` arena centered on spawn:
- Player position is **hard-clamped** to `[radius, 4000-radius]`.
- Camera is clamped so the view never shows outside the arena (camera bounds = arena inset by half the visible extent; if arena smaller than view on an axis, lock to center).
- Visually, the arena edge is a glowing "containment wall" / hazard band so the clamp feels diegetic, not like an invisible wall.
- Enemies spawn from a ring **just outside the visible area** but **inside** the arena (see §6.1).

**Why bounded:** infinite worlds make off-screen spawns and the spatial grid unbounded (memory + grid-index math edge cases). 4000² is huge relative to the 1280×720 view (≈ 9.7 view-widths per side) — players never feel the walls in a normal run, but the corner of the arena is a real strategic risk (you can get pinned), which adds depth. If a future mode wants infinite, the grid must switch to a hashed sparse grid; default ships bounded.

---

## 5. Collision & Spatial Partitioning

### 5.1 Uniform grid

A **uniform spatial hash grid** rebuilt every fixed step (cheaper than incremental updates for thousands of fast-moving entities).

| Constant | Value | Notes |
|---|---|---|
| `GRID_CELL` | `64 WU` | ~2× typical enemy diameter. Sweet spot: few entities/cell, few cells/query. |
| Grid dims | `ceil(4000/64) = 63 × 63` cells | Fixed array, index = `cy*63 + cx`. |
| Cell storage | preallocated `Int32Array` buckets or `number[]` pooled per cell, cleared each step | No per-frame allocation. |

**Per step:**
1. `clearGrid()` (reset counts; don't realloc).
2. Insert each enemy into the single cell of its center (`cx = floor(x/64)`, clamp). Player & projectiles are queried *against* the grid; only enemies are inserted (enemies are the thousands).
3. Run queries (weapon targeting §3, player contact §5.3, projectile-vs-enemy in Weapons subsystem) against the 3×3 (or larger) neighborhood.

### 5.2 Circle-vs-circle

All entities are circles. Overlap test (squared distance, no sqrt):
```ts
const dx = a.x-b.x, dy=a.y-b.y;
const rr = (a.r+b.r);
overlap = (dx*dx + dy*dy) <= rr*rr;
```

**Enemy-vs-enemy:** to prevent all enemies stacking into one point (which looks bad and makes a single super-hitbox), apply **cheap separation/flocking**: for each enemy, sample up to `4` nearest neighbors in its cell; if overlapping, push apart by a soft impulse. Cap iterations to keep it O(n). This is the "swarm spreads around you" feel.

| Constant | Value |
|---|---|
| `SEP_PUSH` | `30 WU/s` per overlapping neighbor, capped at `90 WU/s` total |
| `SEP_MAX_NEIGHBORS` | `4` checked per enemy/step |

Enemy↔enemy is **non-blocking** (no hard resolve) — just soft push; they may overlap briefly. This is intentional (lets the horde flow around obstacles/player).

### 5.3 Contact damage from enemies (DoT tick)

Enemies damage the player **on contact, as a ticking DoT**, not a single hit (so standing in a crowd melts you, but brushing past costs little). Combined with player i-frames.

| Constant | Value | Notes |
|---|---|---|
| `CONTACT_TICK` | `0.5 s` | Player takes contact damage at most every 0.5 s while overlapping ≥1 enemy. |
| Damage per tick | `= strongest overlapping enemy's contactDamage` (NOT summed) | Summing all overlapping enemies makes crowds instakill; taking the max keeps it survivable but punishing. Tune: optionally `max + 0.25*sum(others)`. |
| `PLAYER_IFRAME` | `0.5 s` | After taking contact damage, invulnerable to contact for this long. Equals tick interval → clean cadence. Player flashes during i-frames. |
| Projectile/boss-attack hits | separate, **ignore contact i-frames** (use their own short i-frame `0.2 s` per source) | So a boss slam still lands while you're in contact i-frames. |

**Logic per step:**
```ts
player.iframe -= FIXED_DT;
if (player.iframe <= 0) {
  let worst = 0;
  for (enemy in playerNeighborCells) {
    if (circleOverlap(player, enemy)) worst = max(worst, enemy.contactDamage);
  }
  if (worst > 0) {
    applyDamage(player, worst);
    player.iframe = PLAYER_IFRAME;
  }
}
```

**Anti-tunneling for fast enemies:** if an enemy's per-step movement (`speed*FIXED_DT`) can exceed `(player.r + enemy.r)`, do a **swept** check (segment from prevPos→pos vs player circle). With `FIXED_DT = 1/60`, an enemy must exceed `~ (12+16)/0.0167 ≈ 1680 WU/s` to tunnel — far above normal enemy speeds, so sweeping is only needed for dash-attack bosses/special enemies. Flag those with `swept: true`.

### 5.4 Projectile lifetime / pooling

Projectiles are pooled. Each has TTL (`range / speed` seconds or a max-lifetime). On hit or TTL expiry → return to pool. Despawn any entity > `200 WU` outside the arena. XP gems & pickups also pooled with magnet logic (Pickups subsystem) but they live in the same grid for the player-vacuum query.

---

## 6. Difficulty Over Time (run structure)

A run is **time-based**, ~**15 minutes**, with a **boss every 5 minutes** and continuous ramp — matching the researched real game. Survival to the end (or boss kill at 15:00) = win; default mode is **not endless** (an optional Endless mode unlocks post-win and removes the cap, scaling indefinitely).

### 6.1 Spawn director

A global **spawn budget** drives enemy count. Enemies spawn on a **ring** just outside the visible area.

| Constant | Value | Notes |
|---|---|---|
| `SPAWN_RING_MIN` | `view diagonal/2 + 40 WU` (~`750 WU`) | Just off-screen. |
| `SPAWN_RING_MAX` | `+200 WU` beyond min | Random radius in this band. |
| Spawn angle | weighted toward player's movement direction (60% in a ±90° arc ahead, 40% elsewhere) | So the horde appears "in front," classic feel. |
| `MAX_LIVE_ENEMIES` | `300` (mid-range), `450` (high) | Hard cap; adaptive (see §1.4). Director won't exceed it. |
| `MAX_LIVE_PROJECTILES` | `400` | Pool size. |
| `MAX_PARTICLES` | `600` (halved under load) | |

**Spawn rate formula** (enemies attempted per second), time `t` in minutes:
```
baseRate(t) = 6 + 4*t            // 6/s at start → ~66/s by min 15
spawnRate   = baseRate(t) * waveMult(t)
```
Spawn in small **clusters** (3–6 enemies per spawn event) rather than singletons, for readable waves. Stop spawning trash ~5 s before a boss event and during boss intro.

### 6.2 Minute-marker / wave table

The director reads a wave table keyed by minute. Each entry: enemy mix, density multiplier, and special events. Recommended skeleton (Enemies subsystem fills exact enemy IDs):

| Minute | Density `waveMult` | Composition | Event |
|---|---|---|---|
| 0:00–1:00 | 1.0 | Walkers (slow basic) | Onboarding, sparse |
| 1:00–3:00 | 1.4 | Walkers + Runners (fast) | First "swarm" pulse at 2:00 |
| 3:00–5:00 | 1.8 | + Brutes (tanky) | Elite pack at 4:00 |
| **5:00** | — | — | **BOSS 1**, spawns pause | 
| 5:00–8:00 | 2.2 | + Spitters (ranged) | Density up |
| 8:00–10:00 | 2.8 | mixed, more elites | Pincer wave 9:00 |
| **10:00** | — | — | **BOSS 2** (harder) |
| 10:00–14:00 | 3.4 | all types, frequent elites | Continuous pressure |
| 14:00–15:00 | 4.0 | max swarm | "Final push" |
| **15:00** | — | — | **FINAL BOSS** → win on kill |

`waveMult` is interpolated, not stepped, between markers (smooth ramp) except boss pauses.

### 6.3 Enemy stat scaling

Enemy base stats from their definition, scaled by run time. Let `t` = minutes elapsed.

```
hpMult(t)     = 1 + 0.18 * t           // +18%/min → ~3.7× at min 15
dmgMult(t)    = 1 + 0.10 * t           // contact damage ramps slower
speedMult(t)  = 1 + 0.015 * t (cap 1.5)// "faster, tougher zombies over time"
xpValue(t)    = base * (1 + 0.05 * t)   // keeps leveling pace up
```
Apply at **spawn time** (snapshot), don't recompute living enemies each frame. Elites multiply HP×`6`, damage×`1.5`, scale×`1.4`, XP×`8`. Bosses are authored per-fight (own HP bars), not formula-scaled, but pull `dmgMult(t)` for their attacks.

> These curves keep "enemies you one-shot at 1:00 take a full volley by 12:00," which is the intended power-fantasy-then-pressure arc. Tune `hpMult` slope first if runs feel too easy/hard; it's the dominant lever.

### 6.4 Boss timing

Bosses at **5:00, 10:00, 15:00**. On a boss event: stop trash spawns, play a 3 s warning/telegraph, spawn boss from off-screen, resume light trash spawns after boss intro. Killing the final boss at 15:00 = **win screen**. If the player dies any time = **death/run-summary screen**. (Boss attack patterns are the Bosses subsystem.)

---

## 7. Time, Score & Win/Lose

State carried on the run object (all advanced in the fixed sim so they're deterministic):

| Field | Type | Notes |
|---|---|---|
| `elapsed` | seconds (float) | `+= FIXED_DT` each step. Drives all scaling. Display `mm:ss`. |
| `kills` | int | Increment on enemy death. |
| `level` / `xp` | int / float | Player level (XP from gems → level-up choice screen, which **pauses the sim** by halting the accumulator while UI is open). |
| `goldEarned` | int | Meta currency dropped this run. |
| `damageDealt` | float | For run summary. |
| `score` | int | `= floor(elapsed)*10 + kills*5 + level*100 + bossKills*1000`. Used for leaderboards. |

**Win condition:** survive to `elapsed ≥ 900 s` **and** defeat final boss → `WIN`. (If you prefer pure-time win, drop the boss requirement.)
**Lose condition:** `player.hp ≤ 0` → `DEAD`. Show run summary (time, kills, level, gold, score), award meta currency, return to hub.
**Endless mode (unlock):** removes the 900 s cap; after 15:00, spawn a boss every 3 min and let scaling continue (`hpMult` keeps climbing). Score is the goal.

**Pause:** when the app is backgrounded (`visibilitychange`) or the level-up/pause UI opens, **stop accumulating dt** (set `prevTime = now` on resume so no giant catch-up). The `MAX_FRAME_DT` clamp is the safety net if this is missed.

---

## 8. Module/Data Contract Summary (for other subsystems)

```ts
// Entities (pooled, struct-of-fields)
interface Entity { x,y,prevX,prevY,vx,vy:number; r:number; alive:boolean; }
interface Enemy extends Entity { hp,maxHp,contactDamage,speed:number; defId:string;
                                  swept?:boolean; isElite?:boolean; gridNext?:number; }
interface Projectile extends Entity { damage,ttl:number; ownerWeapon:string; pierce:number; }

// World singletons
const world = {
  player, cam:{x,y,prevX,prevY},
  elapsed, kills, level, xp, score, state:'PLAYING'|'WIN'|'DEAD'|'PAUSED',
  enemies:Pool<Enemy>, projectiles:Pool<Projectile>, pickups:Pool<…>, particles:Pool<…>,
  grid:UniformGrid,
};

// Core constants exported for tuning (single source of truth):
export const C = {
  FIXED_DT:1/60, MAX_FRAME_DT:0.25, MAX_STEPS:5,
  PLAYER_MAX_SPEED:170, PLAYER_ACCEL:1600, PLAYER_DECEL:2200, PLAYER_R:12,
  CAM_LERP:0.12, CAM_LOOKAHEAD:0.10, CAM_MAX_CATCHUP:1200,
  GRID_CELL:64, ARENA:4000,
  CONTACT_TICK:0.5, PLAYER_IFRAME:0.5,
  MAX_LIVE_ENEMIES:300, MAX_PROJECTILES:400, MAX_PARTICLES:600,
  SPAWN_RING_MIN:750, SPAWN_RING_BAND:200, RUN_LENGTH:900,
};
```

**Subsystem boundaries:** this core owns the loop, fixed-step ordering, player physics, camera, grid, contact damage, spawn director timing, run state. Weapons/Enemies/Bosses/Pickups/Meta hook in via: (a) reading `C` constants, (b) inserting/querying the grid, (c) the per-step update order below.

**Canonical fixed-step update order (must be stable for determinism):**
1. read input → `inDir`
2. snapshot `prev*` for all interpolated entities
3. player movement integrate + clamp
4. weapon cooldowns → fire (queries grid)
5. projectiles integrate + collide vs enemies (grid)
6. enemies AI/seek + separation integrate
7. rebuild grid (enemies) — *or* rebuild at top of step before queries; pick one and keep it; recommended: rebuild at **start of step (after movement of previous frame)** — i.e. order is: rebuild grid → queries(4,5) → movement(3,6) → next step rebuilds. (Document the chosen order in code; the key is *consistency*.)
8. contact damage + i-frames
9. pickups/XP magnet + level-up trigger
10. spawn director (time, waves, bosses)
11. advance `elapsed`, score, check win/lose
12. cull dead → pools

---

### Key takeaways for the implementer
- **Fixed 60 Hz sim + interpolated render** is the backbone; never put gameplay in the render path.
- **Pool everything; cap DPR at 2; pre-bake glow** — these three decisions are what hold 60 fps on mid-range Android.
- **170 WU/s player, high accel/decel** = the snappy-but-weighty Survivor.io movement.
- **Primary weapon = nearest-enemy auto-dart**, all weapons on independent `+=` cooldowns.
- **Uniform 64 WU grid**, circle collisions, **contact damage as 0.5 s DoT with 0.5 s i-frames** (take the *max* overlapping enemy damage, not the sum).
- **15-min run, bosses at 5/10/15, smooth time-scaled HP/dmg/speed**, bounded 4000² arena, optional endless.

Sources used for authentic mechanics: [Survivor.io skills/weapons (BlueStacks)](https://www.bluestacks.com/blog/game-guides/survivor-io/sio-skills-evolution-guide-en.html), [Inven Global weapon guide](https://www.invenglobal.com/articles/17917/guide-survivorio-tier-list-for-best-weapons), [LDPlayer beginner guide](https://www.ldplayer.net/blog/survivor-io-beginners-guide.html), [Level Winner guide](https://www.levelwinner.com/survivor-io-guide-tips-tricks-strategies-to-slay-hordes-of-zombies-and-save-the-city/), [Jake Gordon — JS game loop](https://jakesgordon.com/writing/javascript-game-foundations-the-game-loop/), [STALKER-X camera (lerp/lookahead reference)](https://github.com/a327ex/STALKER-X).