I have enough authentic grounding from the research: bosses every 5 minutes, minibosses/elites with red auras dropping chests, timer-based everything, swarm/pincer waves, simple "move toward player" AI, ranged enemies leaving toxic gas. This matches the well-known Survivor.io/Vampire Survivors formula. I'll now write the full implementation-ready spec from this foundation plus standard genre design knowledge. No further searches are needed.

Here is the complete specification.

---

# Subsystem Spec: Enemies, AI/Flocking & Spawn Director

**Game:** "Dawn Survivors" (working title) — Survivor.io-style horde survival
**Target:** 60 fps on mid-range phones, 500–2000 active enemies, Canvas2D, TypeScript
**Run length:** 15:00 (900 s), boss at 5:00 / 10:00 / 15:00 (final)

This spec is self-contained. All tunables live in data tables so a designer can rebalance without touching logic.

---

## 0. Conventions & Units

| Quantity | Unit | Notes |
|---|---|---|
| Position | world pixels | 1 logical px; render scaled by DPR |
| Speed | px / second | multiply by `dt` (seconds) each frame |
| Time | seconds (`t`) | run clock starts at 0 |
| HP / damage | abstract points | player base DPS ~ tuned to curve below |
| Radius | px | circle colliders only |

**World/camera:** camera follows player; viewport ~`1280×720` logical at 16:9 letterboxed. "Screen rect" = camera-visible rect. "Spawn ring" = annulus just outside screen.

**Frame contract:** fixed-timestep simulation at 60 Hz (`dt = 1/60`), with an accumulator. Rendering interpolates. All numbers below assume `dt = 0.01667`.

---

## 1. Difficulty Scaling (global multipliers)

Everything ramps with run time `t`. Two master curves drive HP and spawn pressure so individual tables stay readable.

```ts
// Global scalars sampled each second (cache, don't recompute per enemy)
function hpScale(t: number): number {
  // +6% per minute compounding, plus step bumps after each boss
  const minutes = t / 60;
  const base = Math.pow(1.06, minutes);          // ~1.0 -> ~2.4 over 15min
  const bossSteps = Math.floor(t / 300) * 0.25;  // +25% after 5min, +50% after 10min
  return base * (1 + bossSteps);
}

function dmgScale(t: number): number {
  return 1 + (t / 60) * 0.05;   // +5% contact dmg per minute (linear, gentle)
}

function speedScale(t: number): number {
  return Math.min(1.18, 1 + (t / 60) * 0.012);   // caps at +18% so it stays readable
}

// Spawn pressure -> target on-screen enemy count (see Spawn Director §4)
```

Final HP of a spawned enemy = `baseHP * hpScale(t)` (computed once at spawn; do not re-scale live enemies).

---

## 2. Enemy Roster

### 2.1 Shared enemy record shape

```ts
type EnemyKind =
  | 'swarmer' | 'runner' | 'brute' | 'spitter'
  | 'exploder' | 'splitter' | 'shielded' | 'flyer'
  | 'elite_juggernaut' | 'elite_summoner'
  | 'boss_bouncer' | 'boss_devourer' | 'boss_warden';

interface EnemyDef {
  kind: EnemyKind;
  // --- core stats (pre-scale) ---
  baseHP: number;
  speed: number;          // px/s base, before speedScale
  contactDmg: number;     // per "hit tick" (see §2.3)
  radius: number;         // collider + render
  mass: number;           // separation weighting (heavier = pushes lighter aside)
  // --- economy ---
  xp: number;             // gem value (see §6 for gem tier mapping)
  gold: number;           // base gold; 0 = no gold
  // --- behavior ---
  behavior: BehaviorTag;  // 'chase' | 'kite' | 'charge' | 'orbit' | 'suicide' | 'boss'
  flockWeights?: Partial<FlockWeights>; // overrides global
  // --- visual (programmatic) ---
  color: string;          // primary fill
  glow: string;           // glow/aura color
  shape: 'blob'|'diamond'|'hex'|'triangle'|'ring'|'big';
  // --- special params (optional, per kind) ---
  special?: Record<string, number>;
  // --- drops ---
  dropTable: DropTableId;
}
```

### 2.2 The roster (base values @ t=0)

| Kind | baseHP | speed | contactDmg | radius | mass | xp | gold | behavior | Role |
|---|---|---|---|---|---|---|---|---|---|
| **swarmer** (Husk) | 8 | 55 | 6 | 11 | 1.0 | 1 | 0 | chase | Fodder, fills screen |
| **runner** (Stalker) | 5 | 105 | 8 | 9 | 0.8 | 2 | 0 | chase | Fast, flanks player |
| **brute** (Hulk) | 60 | 38 | 16 | 22 | 4.0 | 5 | 1 | chase | Tank, body-blocks |
| **spitter** (Spewer) | 18 | 42 | 5 (contact) | 14 | 1.5 | 4 | 1 | kite | Ranged, toxic puddle |
| **exploder** (Bloater) | 22 | 60 | 4 (contact) | 16 | 1.8 | 3 | 1 | suicide | Detonates near player |
| **splitter** (Cluster) | 30 | 46 | 7 | 18 | 2.2 | 4 | 1 | chase | Splits into 3 swarmers |
| **shielded** (Bulwark) | 26 (+shield) | 44 | 10 | 17 | 2.5 | 5 | 1 | charge | Frontal shield, periodic dash |
| **flyer** (Wisp) | 12 | 70 | 6 | 12 | 0.6 | 3 | 0 | orbit | Ignores separation w/ ground; circles player |
| **elite_juggernaut** (Ravager) | 900 | 50 | 30 | 38 | 12 | 60 | 25 | charge | Mid-run elite |
| **elite_summoner** (Hivemind) | 650 | 30 | 20 | 34 | 10 | 60 | 25 | kite | Mid-run elite, spawns swarmers |
| **boss_bouncer** (Caroma) | 6000 | 34 | 40 | 56 | 50 | 300 | 120 | boss | 5:00 boss |
| **boss_devourer** (Maw) | 14000 | 30 | 55 | 64 | 60 | 600 | 250 | boss | 10:00 boss |
| **boss_warden** (Iron Warden) | 32000 | 26 | 70 | 80 | 80 | 1500 | 600 | boss | 15:00 final boss |

> Names are original to avoid trademark issues; archetypes mirror real Survivor.io (Bouncebloom→Caroma, Devourer→Maw, Steel Ghasher→Iron Warden).

### 2.3 Contact damage model

Contact is **tick-based**, not per-frame, to avoid instant death in a crowd.

- Each enemy has an internal `contactCooldown` (default **0.5 s**).
- When enemy circle overlaps player circle and its cooldown ≤ 0: deal `contactDmg * dmgScale(t)`, reset cooldown to 0.5 s.
- **Global player i-frame:** after taking *any* contact hit, player gets **0.4 s invulnerability** (prevents 10 enemies stacking = instant death). During i-frames, contact ticks are skipped but enemies still push (separation) the player slightly.
- Exploder/boss AOE bypass i-frames partially: they apply on a separate **0.25 s** player i-frame channel (so a boss slam + contact can both land but not machine-gun).

### 2.4 Per-type behavior detail

**swarmer (Husk)** — Pure `seek(player) + separation`. The baseline. ~60% of all spawns.

**runner (Stalker)** — Seek with higher speed; **flank bias**: instead of seeking the player's current position, seeks `player.pos + perpendicular(playerVelocity) * 60` alternating sign per-enemy (set `special.flankSign = ±1` at spawn). Creates pincer feel. Low separation weight (they interpenetrate to rush).

**brute (Hulk)** — Slow seek, very high mass → parts the swarm, body-blocks player escape lanes. No special attack.

**spitter (Spewer)** — `kite` behavior:
```
desiredDist = 280
if dist(player) < 240: flee from player (seek away) 
elif dist(player) > 340: seek player
else: strafe (perp to player) 
Fire every special.fireCd = 2.2s when dist in [180, 420] and has LOS:
  spawn ToxicGlob projectile: speed 220 px/s, travels to player's predicted pos,
  on land (or hit) creates ToxicPuddle: radius 55, lifetime 4s, dmg 5/0.5s tick (scaled).
```
`special = { fireCd: 2.2, projSpeed: 220, puddleR: 55, puddleLife: 4, puddleDmg: 5 }`

**exploder (Bloater)** — `suicide`: seek player faster than swarmer; when `dist(player) < special.fuseRange (40)` OR on death, start **0.6 s fuse** (flashes red, scale pulses), then detonate:
```
AOE radius 70, dmg 28 * dmgScale(t) to player (uses 0.25s AOE i-frame channel),
knockback 140px on player. Also damages OTHER enemies? No (keep simple) — only player.
```
`special = { fuseRange: 40, fuseTime: 0.6, aoeR: 70, aoeDmg: 28, knockback: 140 }`
Edge case: if killed by player while fusing, it **still detonates** (telegraphed risk). If killed before fuse, no explosion.

**splitter (Cluster)** — Normal chase. On death (HP≤0), if `special.generation === 0`, spawn **3 swarmers** at radius 20 around death point, each at 60% baseHP-scaled, with `generation=1` (children never re-split). Children inherit current `hpScale` snapshot. Cap: never spawn children if global enemy count ≥ hard cap (§4.4); instead just die.
`special = { children: 3, childHPMul: 0.6, generation: 0 }`

**shielded (Bulwark)** — Has a **frontal shield arc** (180° facing its movement direction). Damage rules:
- Hits landing within the shield arc are reduced **70%** (`dmg *= 0.3`).
- Hits from behind = full damage.
- The `shield` is also a literal HP pool: `shieldHP = 30 * hpScale(t)`. While `shieldHP > 0`, frontal reduction applies; once shield depleted, it's a normal enemy.
- `charge` behavior: every **3.5 s**, telegraph 0.5 s (shield glows), then **dash** toward player at 2.4× speed for 0.6 s. During dash, contactDmg ×1.5.
`special = { shieldHP: 30, frontReduce: 0.3, dashCd: 3.5, dashTele: 0.5, dashDur: 0.6, dashMul: 2.4 }`

**flyer (Wisp)** — `orbit`: targets a point on a ring around the player (`orbitR = 130`), drifting inward slowly (`-8 px/s` to ring radius). **Excluded from ground separation** (flag `noSeparation` but still has light flyer-flyer separation, weight 0.4). Visually rendered with a drop-shadow offset to read as "flying." Makes weaving dangerous.
`special = { orbitR: 130, orbitSpeed: 70, inwardCreep: 8 }`

### 2.5 Elites (mid-run minibosses)

Elites have a **red aura ring**, larger scale, an HP bar, and **guarantee a chest drop**. See spawn timers §4.5.

**elite_juggernaut (Ravager)** — `charge` mega-version of shielded.
- Telegraphed line-charge every **2.8 s**: 0.7 s wind-up (rotates to face player, ground-line VFX), then dashes full-screen-width at **320 px/s** for 1.0 s, leaving a brief damaging trail (dmg 12/0.3s tick).
- Between charges, slow seek. Immune to knockback. 
- On death: chest + 6 XP gems (large).

**elite_summoner (Hivemind)** — `kite`, keeps distance ~300.
- Every **3.0 s**, spawns **4 swarmers** in an arc facing player (respects hard cap).
- Every **6.0 s**, fires a **5-shot spread** of slow orbs (speed 160, dmg 14, no puddle).
- Has a **0.3 damage-reduction** while it has ≥1 living summoned child (encourages clearing adds first). Track `childCount`.
- On death: chest + summoned children become "frenzied" (×1.3 speed for 3 s) as a parting gift / threat.

### 2.6 Bosses

Bosses have multi-phase HP gates, an on-screen HP bar, screen-shake on big attacks, and **clear the spawn ring of fodder** for ~3 s on spawn (dramatic entrance) before resuming normal spawns at reduced rate during the fight.

#### boss_bouncer (Caroma) — appears **5:00**
HP 6000 (×hpScale at spawn ≈ ×1.34 → ~8040). 3 phases by HP %.

| Phase | HP range | Behavior |
|---|---|---|
| P1 | 100–66% | Slow seek. Every 3 s lobs **3 bouncing orbs** (speed 240, bounce off screen edges up to 3 times, dmg 24, radius 14, lifetime 5 s). |
| P2 | 66–33% | Adds **ring-burst**: every 6 s emits 12 orbs radially (speed 200, dmg 20). Move speed ×1.2. |
| P3 | 33–0% | **Enrage**: orb lobs every 1.8 s (4 orbs), ring-burst every 4 s (16 orbs), continuous slow seek. Aura flashes. |

Transition: 0.8 s invuln + shockwave (knockback player 180px) at each phase gate.
On death: 1 big chest + 12 large XP gems + gold burst + **magnet pickup guaranteed**.

#### boss_devourer (Maw) — appears **10:00**
HP 14000 (×hpScale ≈ ×1.8 at t=600 → ~25200). 3 phases.

| Phase | HP range | Behavior |
|---|---|---|
| P1 | 100–60% | Seek + **lunge bite**: every 4 s telegraph 0.6 s, lunge 380px toward player (dmg 50, cone). |
| P2 | 60–30% | **Vacuum pull**: channels 2 s, pulling player toward it at 120 px/s (player can resist by moving away — net slow), then **shockwave** (dmg 45, radius 160). Lunge continues every 5 s. |
| P3 | 30–0% | **Summon + spew**: spawns 6 exploders every 5 s; leaves toxic puddles in a moving trail (puddle every 0.5 s along its path, like spitter puddles). Move ×1.15. |

On death: 2 chests + 16 large gems + bomb pickup guaranteed.

#### boss_warden (Iron Warden) — appears **15:00** (final / run end)
HP 32000 (×hpScale ≈ ×2.4 → ~76800). 4 phases. This is the climactic check.

| Phase | HP range | Behavior |
|---|---|---|
| P1 | 100–75% | Seek + **rocket barrage**: every 3 s fires 6 homing rockets (speed 180, turn 90°/s, dmg 40, expire 4 s). |
| P2 | 75–50% | Deploys **2 spinning laser arms**: rotating beams (length 320, sweep 60°/s, dmg 30/0.4s tick). Barrage continues at 4 s. |
| P3 | 50–25% | **Adds wave**: on entry spawn 1 elite_juggernaut + 10 runners. Warden does **ground-slam** every 4 s (radius 200, dmg 60, telegraph 0.7 s expanding ring). |
| P4 | 25–0% | **Final enrage**: all of the above at reduced cooldowns (barrage 2 s / slam 3 s / lasers sweep 90°/s). Screen tint red. |

Each phase gate: 1.0 s invuln + clear all boss projectiles + shockwave.
On death (run win): mega-chest + 30 large gems + full gold dump + victory state.

---

## 3. Steering / Flocking

### 3.1 Forces & weights

Each enemy computes a steering acceleration as a weighted sum, then we **clamp to max force**, integrate velocity, clamp to max speed, integrate position.

```ts
interface FlockWeights {
  seek: number;        // toward target
  separation: number;  // push off neighbors
  avoidance: number;   // soft local collision (look-ahead)
  cohesion: number;    // (usually 0 — we DON'T want clumping into one blob)
  damping: number;     // velocity damping toward steered dir
}

const GLOBAL_WEIGHTS: FlockWeights = {
  seek: 1.0,
  separation: 1.6,   // dominant near-field so they don't stack
  avoidance: 0.5,
  cohesion: 0.0,
  damping: 0.85,
};
```

**Seek** (arrive-style, no overshoot jitter):
```
toTarget = target - pos
desired = normalize(toTarget) * maxSpeed
steer_seek = desired - vel
```

**Separation** (inverse-distance, mass-weighted) — only over neighbors within `sepRadius = radius * 2.2`:
```
acc = (0,0)
for n in neighbors within sepRadius:
    d = pos - n.pos
    dist = max(len(d), 0.001)
    overlap = (radius + n.radius) - dist
    if overlap > 0:                       // actually intersecting -> hard push
        push = normalize(d) * overlap * 8.0 * (n.mass / mass)
        acc += push
    else:                                  // soft personal-space push
        falloff = 1 - dist / sepRadius
        acc += normalize(d) * falloff * 30 * (n.mass / mass)
steer_sep = acc
```
Mass ratio means a swarmer gets shoved aside by a brute, not vice-versa. Cap neighbor iteration at **8 nearest** (see §3.3) to bound cost.

**Avoidance** (cheap look-ahead, optional, skip under heavy load): probe a point `pos + vel_dir * radius*1.5`; if it falls inside a high-mass neighbor (brute/elite/boss), add a lateral push perpendicular to vel. Only run avoidance against **big** enemies (mass ≥ 4) to keep it O(few).

**Integration:**
```
steer = seek*w.seek + sep*w.separation + avoid*w.avoidance
steer = clampLen(steer, MAX_FORCE)        // MAX_FORCE = 900 px/s^2 (typical)
vel  += steer * dt
vel   = clampLen(vel, maxSpeed)
vel  *= 1 - (1 - w.damping) * (dt*60)     // frame-rate-independent damping
pos  += vel * dt
```

### 3.2 Per-kind weight overrides

| Kind | seek | separation | notes |
|---|---|---|---|
| swarmer | 1.0 | 1.6 | default |
| runner | 1.2 | 0.7 | low sep → they interpenetrate to rush/flank |
| brute | 0.9 | 2.2 | high sep + high mass → parts the crowd |
| spitter | 1.0 | 1.4 | kite logic overrides seek target |
| exploder | 1.3 | 0.9 | beelines player |
| splitter | 1.0 | 1.5 | — |
| shielded | 1.0 | 1.6 | dash overrides during charge |
| flyer | 1.1 | 0.4 (flyer-only) | excluded from ground separation |
| elites/bosses | 1.0 | 0.3 | mostly seek; their mass parts everything |

### 3.3 Spatial grid (the core perf structure)

Uniform grid hashing. Cell size = **~2× median enemy radius ≈ 24 px** (tunable; pick so avg ≤ ~4 enemies/cell).

```ts
class SpatialGrid {
  cell = 24;
  cols: number; rows: number;
  buckets: Int32Array;     // head index per cell (linked-list head), -1 empty
  next: Int32Array;        // next index per enemy (intrusive linked list)
  // rebuild each frame: O(n)
  clear() { buckets.fill(-1); }
  insert(i, x, y) {
    const c = cellIndex(x, y);
    next[i] = buckets[c];
    buckets[c] = i;
  }
  // query 3x3 neighborhood around (x,y), call cb for each, early-out at maxN
  queryNeighbors(x, y, cb, maxN) { /* iterate 9 cells, walk linked lists */ }
}
```

- **Rebuild every frame** (O(n), no per-frame allocation — use preallocated typed arrays sized to hard cap).
- Separation queries the **3×3** cells around the enemy; collect up to **8** nearest, sort by dist only if >8 found (partial selection, not full sort).
- Player-targeting & weapon collision also reuse this grid.

### 3.4 Throughput budget for 500–2000 enemies

Tactics, layered:

1. **Structure-of-Arrays (SoA), no per-enemy objects in the hot loop.**
   Store `posX, posY, velX, velY, hp, kind, radius, mass, flags…` as parallel typed arrays. Iterate by index. This is the single biggest 60fps enabler.

2. **Object pooling.** Preallocate to **hard cap = 2200** slots. Spawning = pop free index; death = push to free list + clear flags. **Zero GC in steady state.**

3. **Staggered AI ("AI LOD").** Not every enemy steers every frame.
   - Each enemy has `aiPhase = i % AI_STRIDE`. Full steering recompute runs when `(frameCount + aiPhase) % AI_STRIDE === 0`; other frames it **coasts** on last velocity (still integrates position + separation-lite).
   - `AI_STRIDE` adapts to load: 1 (≤400 enemies), 2 (≤900), 3 (≤1400), 4 (>1400). Bosses/elites always stride 1.
   - Separation is the perceptually critical force → run a **cheap separation every frame** (3×3, cap 6 neighbors) but the expensive seek/avoidance on stride. Coasting enemies still get nudged apart.

4. **Off-screen culling/recycling.**
   - Enemies beyond **cullRadius = max(viewportDiagonal/2 + 220, 900) px** from player are candidates for recycling.
   - A culled enemy is **despawned (returned to pool) if it has wandered to `cullRadius * 1.6`** AND is not an elite/boss AND has full-ish HP (don't recycle a nearly-dead enemy the player damaged — feels bad). Recycled enemies are re-spawned by the director on the active side. This keeps active processed count near the on-screen target.
   - Off-screen-but-within-cull enemies still simulate (so the swarm is "there" when you turn) but with `AI_STRIDE` forced ≥3 and **no rendering**.

5. **Render culling.** Only draw enemies whose circle intersects the screen rect (grid makes this trivial: query cells overlapping screen). Batch by shape/color to minimize Canvas2D state changes; use a single `Path2D` per shape-color group where possible.

6. **Fixed sim timestep + accumulator**, max 3 sub-steps per frame to avoid spiral-of-death on a hitch; drop to interpolated render if behind.

**Rough budget @ 60fps (16.6 ms), 1200 enemies, mid phone:**
grid rebuild ~0.4 ms · separation (every frame, cap6) ~3.5 ms · seek/avoid (strided ⅓) ~1.8 ms · integrate+contact ~1.0 ms · render (≤~400 on screen) ~4–6 ms · weapons/particles remainder. Headroom maintained by raising AI_STRIDE and lowering on-screen target if frame time creeps >15 ms (adaptive — see §4.4).

---

## 4. Spawn Director

### 4.1 Concept

The director maintains a **target concurrent on-screen enemy count** that ramps over the run, plus a **spawn budget** spent on weighted enemy types per the current "phase" of the wave schedule. It spawns from an **off-screen ring**, fires scripted **swarm/pincer events**, schedules **elite timers**, and triggers **bosses at fixed minutes**.

### 4.2 Off-screen ring spawn

```ts
function spawnPosition(player, camera): {x:number,y:number} {
  // ring just outside the visible rect
  const inner = halfDiag(camera) + 40;     // ~ (w/2,h/2) magnitude + margin
  const outer = inner + 140;
  const ang = Math.random() * Math.PI * 2;
  const r = inner + Math.random() * (outer - inner);
  return { x: player.x + Math.cos(ang) * r, y: player.y + Math.sin(ang) * r };
}
```
- Spawns are biased: **65%** uniformly around the ring, **35%** in the **arc ahead of player movement** (player.vel direction ± 50°) so pressure builds where they're heading.
- Pincer events override angle (see §4.6).

### 4.3 Target count curve

```ts
function targetOnScreen(t: number): number {
  // smooth ramp 30 -> ~220, with surge bumps right before bosses
  const minutes = t / 60;
  let base = 30 + minutes * 14;            // 30 @0m ... ~240 @15m
  // pre-boss surge in the 30s before each 5-min mark
  const toBoss = 300 - (t % 300);
  if (toBoss < 30) base *= 1.35;
  return Math.min(260, base);
}
```
Each director tick (every **0.25 s**), spawn enough to approach target:
```
deficit = targetOnScreen(t) - activeNonEliteCount
spawnThisTick = clamp(round(deficit * 0.5), 0, maxPerTick(t))
maxPerTick: 6 @0m ramping to 22 @15m
```
Spawned types chosen by the **current phase weight table** (§4.5).

### 4.4 Caps & adaptive governor

- **Soft cap** = `targetOnScreen(t)` (drives spawning).
- **Hard cap = 2200** total slots. Never exceed (splitter children, summoner adds, and events all respect it).
- **Adaptive perf governor:** track rolling avg frame time. If avg > 15.5 ms for 1 s → reduce soft cap by 10% and bump AI_STRIDE; if < 11 ms for 2 s → restore. This guarantees framerate over raw count on weak devices, gracefully.

### 4.5 Wave schedule — minute-by-minute table

Phases define the **type-weight mix** and event overlays. Director picks types via weighted random from the active phase. `target` column is the on-screen goal (from curve, rounded). Boss rows pause normal spawning surge and reduce ambient spawns to ~40% during the fight.

| Time (min:sec) | Phase | Target on-screen | Type weights (relative) | Events / Notes |
|---|---|---|---|---|
| 0:00–1:00 | Intro | 30→44 | swarmer 90, runner 10 | Gentle. No specials. |
| 1:00–2:00 | Build | 44→58 | swarmer 75, runner 20, exploder 5 | First exploders appear (telegraph training). |
| 2:00–3:00 | Mix | 58→72 | swarmer 60, runner 22, exploder 8, spitter 10 | **Pincer event @2:30** (2 lines, 24 runners). |
| 3:00–4:00 | Pressure | 72→86 | swarmer 50, runner 22, exploder 8, spitter 10, brute 5, splitter 5 | Brutes introduced. |
| 4:00–4:30 | Pre-boss surge | 86→120 | swarmer 55, runner 25, exploder 10, spitter 10 | **Swarm event @4:15** (ring rush, 60 swarmers). |
| **5:00** | **BOSS: Caroma** | ambient 50 | swarmer 80, runner 20 | Boss spawns; ring cleared 3 s; ambient at 40%. |
| 5:00–6:30 | Aftermath | 90→105 | swarmer 45, runner 20, spitter 12, exploder 8, brute 8, splitter 7 | Resume after boss death. **Elite @6:00**. |
| 6:30–8:00 | Hardening | 105→125 | swarmer 35, runner 22, spitter 12, exploder 10, brute 10, splitter 6, shielded 5 | Shielded introduced. **Pincer @7:00**. |
| 8:00–9:30 | Flyers | 125→145 | swarmer 30, runner 20, spitter 12, exploder 10, brute 10, splitter 6, shielded 7, flyer 5 | Flyers introduced. **Elite @8:30**. |
| 9:30–10:00 | Pre-boss surge | 145→175 | swarmer 40, runner 25, exploder 12, spitter 12, brute 11 | **Swarm event @9:40** (double ring rush, 90). |
| **10:00** | **BOSS: Maw** | ambient 60 | swarmer 70, runner 20, exploder 10 | Ring cleared 3 s; ambient 40%. |
| 10:00–12:00 | Onslaught | 150→185 | swarmer 28, runner 20, spitter 12, exploder 12, brute 10, splitter 6, shielded 7, flyer 5 | **Elite @11:00 + @11:45** (double). |
| 12:00–14:00 | Chaos | 185→220 | swarmer 25, runner 22, spitter 12, exploder 13, brute 10, splitter 6, shielded 7, flyer 5 | **Pincer @12:30, Swarm @13:30**. |
| 14:00–15:00 | Final surge | 220→260 | swarmer 30, runner 25, exploder 15, spitter 12, brute 10, shielded 8 | Continuous high pressure. |
| **15:00** | **BOSS: Iron Warden** (final) | ambient 70 | swarmer 60, runner 25, exploder 15 | Final boss; win on kill. |

```ts
interface WavePhase {
  startT: number; endT: number;
  target?: (t:number)=>number;       // defaults to global curve
  weights: Partial<Record<EnemyKind, number>>;
  ambientMul?: number;               // during boss fights = 0.4
}
```

### 4.6 Events

**Pincer event** — two opposing arcs spawn simultaneously, converging:
```
count N (e.g. 24), split 50/50.
Group A angle = playerVelAngle (ahead), Group B = + PI (behind).
Each group spawned in a tight ±18° arc on the ring over 0.8 s.
Type: mostly runners (flank behavior makes them sweep around).
```

**Swarm event (ring rush)** — a near-complete ring of swarmers spawns and collapses inward:
```
count N (e.g. 60-90) evenly around full 360° ring over 1.2 s.
Type: swarmer (+ a few exploders sprinkled at 10%).
Telegraph: 0.6s red ring flash at spawn radius before they appear (fairness).
```

**Both events respect hard cap** and are additive to ambient (they don't pause ambient, raising momentary pressure). Events have a **cooldown floor of 60 s** between any two events so they don't overlap into unfair walls.

### 4.7 Elite timer

- Independent timer firing at the scheduled minutes in the table (6:00, 8:30, 11:00, 11:45 …).
- Elite type chosen 50/50 juggernaut vs summoner (avoid same type twice in a row).
- Spawns from ring **on the side the player is facing**, with a **1.0 s warning marker** (off-screen red arrow indicator pointing to spawn).
- Only **one elite alive at a time** except the scripted 11:45 double (allow 2).

### 4.8 Boss trigger

- Hard-scheduled at `t = 300, 600, 900`.
- On trigger: set director to `bossActive`, `ambientMul = 0.4`, clear ring fodder over 3 s (despawn off-screen non-elites), play entrance, spawn boss from a fixed cardinal edge with full-screen telegraph.
- Ambient spawning continues at 40% (gives the player gems/feed for weapons during the fight, classic Survivor.io feel).
- On boss death: `ambientMul = 1`, resume schedule, brief 5 s calm (target ×0.6) as a breather + loot-grab window.

---

## 5. Spawn weighting helper

```ts
function pickType(weights: Record<string, number>): EnemyKind {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) { r -= weights[k]; if (r <= 0) return k as EnemyKind; }
  return 'swarmer';
}
```
Cache the weight total per phase (recompute only on phase change).

---

## 6. Death & Drop Logic

### 6.1 XP gem tiers

Gems are colored by value; the magnet/pickup radius vacuums them. Map an enemy's `xp` to gems so the screen isn't flooded — **roll up** to fewer, higher-tier gems.

| Gem tier | Color | Value | Render |
|---|---|---|---|
| small | cyan | 1 | tiny diamond |
| medium | green | 5 | diamond |
| large | blue | 20 | glowing diamond |
| huge | purple | 100 | big pulsing diamond |

Conversion from enemy `xp` → gems (greedy, fewest gems):
```ts
function gemsFor(xp: number): {tier:string,count:number}[] {
  const out = [];
  let v = xp;
  for (const [tier, val] of [['huge',100],['large',20],['medium',5],['small',1]] as const) {
    const c = Math.floor(v / val); if (c) { out.push({tier, count:c}); v -= c*val; }
  }
  return out;
}
```
Cap gems-per-death at **6 physical drops**; if more, merge remainder into the highest already-dropped tier (prevents 100 gems from one boss). Drops scatter in a small radius (8–24 px) around death point with slight outward impulse.

### 6.2 Gold

- Enemy drops `gold` value as **gold coins** (value 1 each, rolled up to coins of 1/5/20 like gems) **only with probability `goldDropChance`**:
  - swarmer/runner/flyer: gold=0 → never.
  - others (gold≥1): **35%** chance to drop their gold value.
  - elites: **100%**. bosses: **100%** (big dump).

### 6.3 Pickup drop table

Beyond gems/gold, enemies can drop **utility pickups**. Defined per `dropTableId`. Roll once per death.

| Pickup | Effect | Render |
|---|---|---|
| chest | Opens reward UI (weapon/upgrade roll); pauses briefly | gold box, glow |
| health | Restores 25% max HP | red cross |
| magnet | Vacuums **all** on-screen gems to player instantly | blue horseshoe |
| bomb | Damages all on-screen enemies for `200 + 8*minutes` | orange sphere |
| freeze | Freezes all enemies 1.5 s (slow to 0, no contact) | white snowflake |

```ts
type DropTableId = 'none'|'common'|'special'|'elite'|'boss';

const DROP_TABLES: Record<DropTableId, {pickup:string, chance:number}[]> = {
  none:    [],
  common:  [ // swarmer/runner/flyer/exploder
    {pickup:'health', chance:0.004},
    {pickup:'magnet', chance:0.002},
  ],
  special: [ // spitter/brute/splitter/shielded
    {pickup:'health', chance:0.012},
    {pickup:'magnet', chance:0.006},
    {pickup:'bomb',   chance:0.004},
    {pickup:'freeze', chance:0.003},
    {pickup:'chest',  chance:0.005},
  ],
  elite:   [ {pickup:'chest', chance:1.0}, {pickup:'magnet', chance:0.5} ], // chest guaranteed
  boss:    [ {pickup:'chest', chance:1.0}, {pickup:'magnet', chance:1.0},
             {pickup:'bomb', chance:1.0}, {pickup:'health', chance:1.0} ],
};
```
Rules:
- Roll each row independently; at most **one** consumable (health/magnet/bomb/freeze) per common/special death — if multiple succeed, keep the rarest.
- Chest from `special` and guaranteed from elite/boss.
- **Pity timer:** if no health pickup has dropped in **45 s** and player HP < 40%, force-elevate next `common` death's health chance to 5% until one drops.
- Pickups **do not despawn** quickly (lifetime 60 s, then blink + expire) except gems which follow magnet rules. Gold/gems can be culled if off-screen > cullRadius for >20 s (return to pool).

### 6.4 Drop assignment per kind

| Kind | dropTable |
|---|---|
| swarmer, runner, flyer, exploder | common |
| spitter, brute, splitter, shielded | special |
| elite_* | elite |
| boss_* | boss |

---

## 7. Enemy lifecycle state machine

```
SPAWNING (0.15s scale-in, no contact) 
   -> ACTIVE (full sim, contact, drops on death) 
   -> DYING (0.12s death VFX, collider off, spawns drops at frame 0) 
   -> FREE (pooled)
Special: FUSING (exploder), CHARGING (shielded/elite), PHASE_GATE (boss invuln).
```
- During SPAWNING, separation is active (so they don't all stack at one ring point) but seek is at 50% and contact is off.
- Death drops are spawned at the **start** of DYING so they appear under the corpse VFX.

---

## 8. Edge cases / fairness rules (must-implement)

1. **No instant death:** player i-frames (§2.3) + AOE on separate channel guarantee survivability in dense crowds.
2. **Telegraphs always precede burst damage:** exploder fuse, shielded dash, elite charge, boss attacks, swarm/pincer events — all have ≥0.5 s visible warning.
3. **Off-screen enemies can't damage** the player except bosses' tracked projectiles (which are always on-screen by design).
4. **Splitter cap respect:** never spawn children past hard cap.
5. **Summoner add cap:** a single summoner may have at most **12** living children at once.
6. **Spawn never on top of player:** ring guarantees min distance = halfDiag+40 (off-screen).
7. **Boss/elite never recycled** by the culler.
8. **Knockback immunity** for brutes (partial: 30%), elites, bosses (full) so crowd-control weapons don't trivialize them.
9. **Deterministic option:** seed the RNG (xorshift) so runs can be replayed/debugged; director and drops draw from the same seeded stream.
10. **Frame-spike safety:** cap sim sub-steps at 3; if behind, skip director ticks (not sim) to recover.

---

## 9. Quick-reference TS data table (copy-paste seed)

```ts
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  swarmer:  {kind:'swarmer', baseHP:8,  speed:55, contactDmg:6, radius:11, mass:1.0, xp:1, gold:0, behavior:'chase',  color:'#7cba5a', glow:'#a6e07d', shape:'blob',     dropTable:'common'},
  runner:   {kind:'runner',  baseHP:5,  speed:105,contactDmg:8, radius:9,  mass:0.8, xp:2, gold:0, behavior:'chase',  color:'#d96b4a', glow:'#ffb38a', shape:'triangle', dropTable:'common', special:{flankSign:1}},
  brute:    {kind:'brute',   baseHP:60, speed:38, contactDmg:16,radius:22, mass:4.0, xp:5, gold:1, behavior:'chase',  color:'#8a6b9e', glow:'#c89ed8', shape:'hex',      dropTable:'special'},
  spitter:  {kind:'spitter', baseHP:18, speed:42, contactDmg:5, radius:14, mass:1.5, xp:4, gold:1, behavior:'kite',   color:'#5ab0a0', glow:'#9ff0df', shape:'diamond',  dropTable:'special', special:{fireCd:2.2,projSpeed:220,puddleR:55,puddleLife:4,puddleDmg:5}},
  exploder: {kind:'exploder',baseHP:22, speed:60, contactDmg:4, radius:16, mass:1.8, xp:3, gold:1, behavior:'suicide',color:'#d94f4f', glow:'#ff9090', shape:'blob',     dropTable:'common',  special:{fuseRange:40,fuseTime:0.6,aoeR:70,aoeDmg:28,knockback:140}},
  splitter: {kind:'splitter',baseHP:30, speed:46, contactDmg:7, radius:18, mass:2.2, xp:4, gold:1, behavior:'chase',  color:'#b0a04a', glow:'#ece08a', shape:'hex',      dropTable:'special', special:{children:3,childHPMul:0.6,generation:0}},
  shielded: {kind:'shielded',baseHP:26, speed:44, contactDmg:10,radius:17, mass:2.5, xp:5, gold:1, behavior:'charge', color:'#6a7fa0', glow:'#a6c0e0', shape:'hex',      dropTable:'special', special:{shieldHP:30,frontReduce:0.3,dashCd:3.5,dashTele:0.5,dashDur:0.6,dashMul:2.4}},
  flyer:    {kind:'flyer',   baseHP:12, speed:70, contactDmg:6, radius:12, mass:0.6, xp:3, gold:0, behavior:'orbit',  color:'#c0c0e8', glow:'#ffffff', shape:'ring',     dropTable:'common',  special:{orbitR:130,orbitSpeed:70,inwardCreep:8}},
  elite_juggernaut:{kind:'elite_juggernaut',baseHP:900,speed:50,contactDmg:30,radius:38,mass:12,xp:60,gold:25,behavior:'charge',color:'#e05050',glow:'#ff3030',shape:'big',dropTable:'elite',special:{chargeCd:2.8,tele:0.7,dashSpeed:320,dashDur:1.0,trailDmg:12}},
  elite_summoner:  {kind:'elite_summoner',  baseHP:650,speed:30,contactDmg:20,radius:34,mass:10,xp:60,gold:25,behavior:'kite',  color:'#9050e0',glow:'#c030ff',shape:'big',dropTable:'elite',special:{summonCd:3.0,summonN:4,spreadCd:6.0,maxChildren:12,drWithChildren:0.3}},
  boss_bouncer:    {kind:'boss_bouncer',baseHP:6000, speed:34,contactDmg:40,radius:56,mass:50,xp:300, gold:120,behavior:'boss',color:'#e0a030',glow:'#ffd060',shape:'big',dropTable:'boss'},
  boss_devourer:   {kind:'boss_devourer',baseHP:14000,speed:30,contactDmg:55,radius:64,mass:60,xp:600, gold:250,behavior:'boss',color:'#a02030',glow:'#ff4060',shape:'big',dropTable:'boss'},
  boss_warden:     {kind:'boss_warden', baseHP:32000,speed:26,contactDmg:70,radius:80,mass:80,xp:1500,gold:600,behavior:'boss',color:'#606878',glow:'#a0d0ff',shape:'big',dropTable:'boss'},
};
```

---

## 10. Implementation checklist (build order)

1. SoA enemy pool (typed arrays, 2200 slots) + spawn/free lists.
2. Spatial grid (24 px) rebuilt per frame.
3. Steering: seek + separation (mass-weighted) → integrate. Tune weights to §3.1.
4. AI LOD stride governor + adaptive perf governor.
5. Contact damage with i-frames; off-screen culling/recycling.
6. Spawn director: target curve + ring spawn + phase weight tables.
7. Per-kind behaviors (kite/suicide/charge/orbit/split) + telegraphs.
8. Events (pincer/swarm) + elite timer + boss triggers/phases.
9. Drops: gem tiers, gold, pickup tables, pity timer.
10. Render culling + shape/color batching for Canvas2D.

All numbers above are starting values tuned to the Survivor.io feel (boss-every-5-min, red-aura elites that drop chests, timer-driven escalation, simple "move toward player" AI elevated by separation flocking) and are safe to ship-then-tune.

**Sources:**
- [Survivor.io guide – Pocket Gamer](https://www.pocketgamer.com/survivor-io/guide/)
- [Survivor.io Guide: Tips, Tricks & Strategies – Level Winner](https://www.levelwinner.com/survivor-io-guide-tips-tricks-strategies-to-slay-hordes-of-zombies-and-save-the-city/)
- [How to clear chapters 1-10 in Survivor.io – Pro Game Guides](https://progameguides.com/survivor-io/how-to-clear-chapters-1-10-in-survivor-io/)
- [Survivor!.io Full Boss Guide – WriterParty](https://writerparty.com/party/survivor-io-full-boss-guide-how-to-beat-every-boss/)
- [Enemies – Vampire Survivors Wiki (genre reference)](https://vampire-survivors.fandom.com/wiki/Enemies)