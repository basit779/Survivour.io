I now have a complete, authoritative picture of Survivor.io's weapons, passives, and all evolution recipes. I have enough to write the full implementation-ready spec. Let me compose it.

---

# Weapons & Evolutions — Implementation-Ready Specification

> **Game:** "Horde Survivor" (working title) — Survivor.io-style bullet-heaven roguelite.
> **Renderer:** Canvas2D, target 60fps on mid-range phones.
> **Scope of this doc:** Weapon roster, passive items, evolution recipes, targeting rules, and drop-in TypeScript data tables.
>
> Names below are **renamed** from the real Survivor.io to avoid trademark issues. The real-world reference is noted in comments for the developer's mental model only.

---

## 0. Conventions, Units & Core Formulas

### 0.1 Units

| Quantity | Unit | Notes |
|---|---|---|
| Distance / radius / speed | game pixels (px) at design res | Design res: **720×1280** logical. Scale to device. |
| Time / cooldown | milliseconds (ms) | Fixed-step sim at 60Hz (16.667ms). |
| `cooldown` | ms between activations | Lower = faster. |
| `damage` | HP per hit | Pre-multiplier base value. |
| `speed` (projectile) | px/second | |
| `area` / `radius` | px | A weapon with `area: 90` has 90px effect radius. |
| `pierce` | int | Number of enemies a projectile passes *through* before despawning. `pierce: 2` = hits 3 enemies. `-1` = infinite. |
| `knockback` | px impulse | Applied to enemy along hit normal, decays over 150ms. |
| `duration` | ms | For lingering effects (auras, fire pools, beams). |

### 0.2 Damage pipeline (apply in this exact order)

```
finalDamage =
  weaponBaseDamage[level]
  * (1 + player.damagePct)          // from passives + evolutions
  * (isCrit ? player.critMultiplier : 1)
  * weapon.damageTypeMultiplier      // usually 1; some weapons set this
  * (1 - enemy.damageReductionPct)   // bosses/elites only
```

- **Cooldown** scales: `effectiveCooldown = baseCooldown[level] * (1 - player.cooldownReductionPct)`. Clamp to a floor of `baseCooldown * 0.25` (so cooldown reduction never goes below 25% of base).
- **Area** scales: `effectiveArea = baseArea[level] * (1 + player.areaPct)`.
- **Projectile count** adds: `effectiveCount = baseCount[level] + player.bonusProjectiles` (only weapons flagged `acceptsBonusProjectiles: true`).
- **Crit:** `isCrit = rand() < player.critChance`. Default `critChance: 0.05`, `critMultiplier: 1.5`.
- **Knockback** is ignored by enemies flagged `knockbackImmune` (bosses, big elites).

### 0.3 Tick model (important for auras/beams/orbits)

Continuous-contact weapons (auras, orbiting bodies, fire pools, beams) do **not** deal damage every frame. They use a **per-enemy hit cooldown** (`tickRate`, in ms). When an enemy is inside the effect, it can be damaged once per `tickRate` window. Store `lastHitTime` per (enemy, weaponInstance) pair.

### 0.4 Leveling

- Each weapon/passive has **5 levels** (Lv1 acquire + 4 upgrades). Real game uses "stars"; we use levels.
- A run allows **6 active weapon slots** and **6 passive slots** (matches Survivor.io's 6+6).
- At **Lv5** ("max"), a weapon becomes **eligible to evolve** if its paired passive is also owned (any level ≥1; Survivor.io requires the passive simply be present). On the next level-up choice (or instantly on the level-up that maxes it), offer the **EVO** option.

---

## 1. Weapon Roster (10 weapons)

Each weapon below lists: pattern, targeting, base behavior, the **per-level stat table**, and config flags. Patterns enum:

```ts
type FirePattern =
  | "projectile"   // discrete shots that travel
  | "aura"         // persistent radius around player
  | "orbit"        // bodies revolving around player
  | "melee-arc"    // swing sweep in front/around player
  | "area"         // thrown/dropped AoE (pool, explosion)
  | "beam"         // continuous ray
  | "boomerang";   // out-and-back projectile

type Targeting =
  | "nearest"        // closest enemy
  | "random"         // random enemy on screen
  | "random-weighted"// random, weighted toward bosses/elites
  | "aim-facing"     // direction player faces / last-moved
  | "spread"         // fan around facing
  | "lowest-hp"
  | "highest-hp"
  | "none";          // player-centric, no target needed
```

---

### W1 — **Whirl Bat** *(ref: Baseball Bat)*

Melee swing that sweeps an arc in front of the player. Bread-and-butter starter, knockback-heavy.

- **Pattern:** `melee-arc` · **Targeting:** `aim-facing` (centers the swing on the nearest enemy's direction if one is within 220px, else faces movement direction).
- **Behavior:** Each activation performs `swings` sweeps in quick succession (`swingInterval: 90ms`). A swing is a `arcDegrees`-wide cone of length `area`. All enemies in the cone take damage once and are knocked back. Strong knockback is its identity.

| Lv | damage | cooldown(ms) | arcDegrees | area(px) | swings | knockback |
|----|--------|--------------|-----------|----------|--------|-----------|
| 1  | 22     | 1100         | 120       | 150      | 1      | 60        |
| 2  | 30     | 1050         | 130       | 160      | 1      | 65        |
| 3  | 40     | 1000         | 140       | 175      | 2      | 70        |
| 4  | 52     | 950          | 150       | 190      | 2      | 80        |
| 5  | 68     | 900          | 160       | 205      | 3      | 90        |

```ts
flags: { acceptsBonusProjectiles: false, canCrit: true }
```

---

### W2 — **Shadow Fang** *(ref: Kunai)*

Single high-damage piercing blade fired at the toughest target. Anti-boss/anti-elite.

- **Pattern:** `projectile` · **Targeting:** `highest-hp` (ties → nearest).
- **Behavior:** Fires `count` blades in rapid burst (`burstInterval: 70ms`) each toward the current highest-HP enemy. High pierce, fast, low spread. Designed to delete big enemies.

| Lv | damage | cooldown(ms) | count | speed | pierce | area(px) | knockback |
|----|--------|--------------|-------|-------|--------|----------|-----------|
| 1  | 30     | 900          | 1     | 700   | 2      | 14       | 10        |
| 2  | 38     | 850          | 1     | 740   | 3      | 14       | 10        |
| 3  | 46     | 800          | 2     | 780   | 3      | 16       | 12        |
| 4  | 58     | 760          | 2     | 820   | 4      | 16       | 12        |
| 5  | 74     | 720          | 3     | 860   | 5      | 18       | 15        |

```ts
flags: { acceptsBonusProjectiles: true, canCrit: true }
```

---

### W3 — **Storm Coil** *(ref: Lightning Emitter)*

Random-strike chain lightning. Auto-focuses bosses (all bolts target the boss when one is present — a defining real-game behavior).

- **Pattern:** `projectile` (instant-hit strike, no travel) · **Targeting:** `random-weighted` → **if any boss/elite on screen, ALL bolts target it.**
- **Behavior:** Spawns `bolts` independent strikes. Each strike instantly damages its target in a small `area` (splash) and chains to `chainCount` nearby enemies for `chainFalloff` reduced damage. Render as a jagged glowing polyline + flash.

| Lv | damage | cooldown(ms) | bolts | area(px) | chainCount | chainFalloff |
|----|--------|--------------|-------|----------|-----------|--------------|
| 1  | 26     | 1300         | 1     | 40       | 0         | —            |
| 2  | 32     | 1250         | 2     | 45       | 1         | 0.7          |
| 3  | 40     | 1200         | 3     | 50       | 1         | 0.7          |
| 4  | 50     | 1150         | 4     | 55       | 2         | 0.65         |
| 5  | 64     | 1100         | 5     | 60       | 2         | 0.6          |

```ts
flags: { acceptsBonusProjectiles: true, canCrit: true, bossPriority: true }
```

---

### W4 — **Aegis Ring** *(ref: Forcefield Device)*

Persistent damaging aura around the player. Defensive crowd-control.

- **Pattern:** `aura` · **Targeting:** `none` (player-centric).
- **Behavior:** A ring of radius `area`. Any enemy inside takes `damage` once per `tickRate`, with light continuous knockback (`knockback` applied each tick, pushes enemies out of the ring). Always on (cooldown is the tick window conceptually, but modeled via `tickRate`).

| Lv | damage | tickRate(ms) | area(px) | knockback |
|----|--------|--------------|----------|-----------|
| 1  | 10     | 500          | 70       | 8         |
| 2  | 13     | 480          | 82       | 9         |
| 3  | 17     | 460          | 95       | 10        |
| 4  | 22     | 440          | 110      | 12        |
| 5  | 28     | 420          | 128      | 14        |

```ts
flags: { acceptsBonusProjectiles: false, canCrit: false, persistent: true }
// cooldown field unused; uses tickRate. damagePct & areaPct still apply.
```

---

### W5 — **Sky Drones** *(ref: Type-A/Type-B Drone)*

Drones that orbit the player and rain homing missiles. (We implement as **one weapon line**; the evolution "Annihilator" represents the real game's two-drone fusion.)

- **Pattern:** `orbit` + spawns `projectile` · **Targeting:** missiles use `nearest`.
- **Behavior:** `droneCount` drones orbit at radius 60px, period 2000ms. Every `cooldown` ms, each drone fires `missilesPerVolley` homing missiles at nearby enemies. Missiles explode in `area` on impact.

| Lv | damage | cooldown(ms) | droneCount | missilesPerVolley | speed | area(px) | pierce |
|----|--------|--------------|-----------|-------------------|-------|----------|--------|
| 1  | 14     | 1000         | 1         | 1                 | 480   | 35       | 0      |
| 2  | 18     | 950          | 1         | 2                 | 500   | 38       | 0      |
| 3  | 22     | 900          | 2         | 2                 | 520   | 42       | 0      |
| 4  | 28     | 850          | 2         | 3                 | 540   | 46       | 1      |
| 5  | 36     | 800          | 2         | 3                 | 560   | 52       | 1      |

```ts
flags: { acceptsBonusProjectiles: true /* +1 missile/volley */, canCrit: true, homing: true }
```

---

### W6 — **Inferno Flask** *(ref: Molotov)*

Thrown bottle that creates a burning ground pool. Sustained AoE / zone control.

- **Pattern:** `area` (thrown projectile → ground DoT pool) · **Targeting:** `random-weighted` landing point (lands on a random on-screen enemy cluster; bias toward densest cluster within 300px).
- **Behavior:** Throws `flasks` bottles in an arc. On landing, each spawns a fire pool of radius `area` lasting `duration` ms, dealing `damage` per `tickRate` to enemies inside.

| Lv | damage | cooldown(ms) | flasks | area(px) | duration(ms) | tickRate(ms) |
|----|--------|--------------|--------|----------|--------------|--------------|
| 1  | 9      | 2400         | 1      | 75       | 2500         | 400          |
| 2  | 12     | 2300         | 1      | 85       | 2800         | 380          |
| 3  | 15     | 2200         | 2      | 95       | 3000         | 360          |
| 4  | 19     | 2100         | 2      | 108      | 3300         | 340          |
| 5  | 24     | 2000         | 3      | 122      | 3600         | 320          |

```ts
flags: { acceptsBonusProjectiles: true /* +1 flask */, canCrit: false, groundPool: true }
```

---

### W7 — **Ricochet Disc** *(ref: Durian / bouncing spiked ball)*

Spiked projectile that bounces around the play area, hitting everything it touches. High uptime AoE.

- **Pattern:** `projectile` (bouncing) · **Targeting:** `aim-facing` initial direction, then physics-bounce off screen edges.
- **Behavior:** Launches `discs` discs. Each bounces off screen bounds for `lifetime` ms, dealing `damage` on each enemy contact with a per-enemy `tickRate` so a single disc can re-hit. Knockback on contact.

| Lv | damage | cooldown(ms) | discs | speed | area(px) | lifetime(ms) | tickRate(ms) | knockback |
|----|--------|--------------|-------|-------|----------|--------------|--------------|-----------|
| 1  | 18     | 2000         | 1     | 360   | 22       | 4000         | 300          | 20        |
| 2  | 23     | 1950         | 1     | 380   | 24       | 4500         | 300          | 22        |
| 3  | 29     | 1900         | 2     | 400   | 26       | 5000         | 280          | 24        |
| 4  | 37     | 1850         | 2     | 420   | 28       | 5500         | 280          | 26        |
| 5  | 47     | 1800         | 3     | 440   | 30       | 6000         | 260          | 30        |

```ts
flags: { acceptsBonusProjectiles: true, canCrit: true, bounces: true }
```

---

### W8 — **Pulse Lance** *(ref: Laser Launcher)*

Continuous rotating/aimed beam. High single-target & line DPS.

- **Pattern:** `beam` · **Targeting:** `nearest` (beam locks to nearest enemy; re-acquires each `cooldown` window). Beam persists `beamDuration`, then off until next cooldown.
- **Behavior:** Fires a beam of length `range`, width `width`. Every enemy in the beam takes `damage` per `tickRate`. Pierces all (it's a beam). When active, slowly tracks toward the locked target.

| Lv | damage | cooldown(ms) | beamDuration(ms) | range(px) | width(px) | tickRate(ms) |
|----|--------|--------------|------------------|-----------|-----------|--------------|
| 1  | 12     | 2200         | 800              | 360       | 24        | 150          |
| 2  | 15     | 2100         | 900              | 400       | 28        | 150          |
| 3  | 19     | 2000         | 1000             | 440       | 32        | 140          |
| 4  | 24     | 1900         | 1100             | 480       | 38        | 140          |
| 5  | 31     | 1800         | 1300             | 520       | 44        | 130          |

```ts
flags: { acceptsBonusProjectiles: false, canCrit: true, beam: true }
```

---

### W9 — **Return Blade** *(ref: Boomerang)*

Out-and-back projectile that hits on both legs of the trip.

- **Pattern:** `boomerang` · **Targeting:** `nearest` (throws toward nearest; returns to player's current position).
- **Behavior:** Throws `blades` boomerangs sequentially (`throwInterval: 120ms`). Each travels out to `range`, then curves back to the player. Pierces and can hit the same enemy on outbound and return (separate hit windows). Spinning visual.

| Lv | damage | cooldown(ms) | blades | speed | range(px) | pierce | area(px) |
|----|--------|--------------|--------|-------|-----------|--------|----------|
| 1  | 16     | 1400         | 1      | 520   | 240       | 3      | 18       |
| 2  | 21     | 1350         | 1      | 540   | 260       | 4      | 18       |
| 3  | 27     | 1300         | 2      | 560   | 280       | 4      | 20       |
| 4  | 34     | 1250         | 2      | 580   | 300       | 5      | 22       |
| 5  | 44     | 1200         | 3      | 600   | 320       | -1     | 24       |

```ts
flags: { acceptsBonusProjectiles: true, canCrit: true, boomerang: true }
```

---

### W10 — **Scatter Gun** *(ref: Shotgun)*

Spread of pellets fired in the facing direction. Burst frontal damage.

- **Pattern:** `projectile` (spread) · **Targeting:** `spread` around `aim-facing` (faces nearest enemy within 400px, else movement direction).
- **Behavior:** Fires `pellets` in a `spreadDegrees` fan. Pellets are short-range (`lifetime`), fast, low pierce. Damage falls off after `range` (×0.5).

| Lv | damage | cooldown(ms) | pellets | spreadDegrees | speed | range(px) | pierce | knockback |
|----|--------|--------------|---------|---------------|-------|-----------|--------|-----------|
| 1  | 11     | 1200         | 4       | 40            | 640   | 220       | 0      | 15        |
| 2  | 14     | 1150         | 5       | 42            | 660   | 240       | 0      | 16        |
| 3  | 18     | 1100         | 6       | 45            | 680   | 260       | 1      | 18        |
| 4  | 23     | 1050         | 7       | 48            | 700   | 280       | 1      | 20        |
| 5  | 29     | 1000         | 9       | 52            | 720   | 300       | 1      | 24        |

```ts
flags: { acceptsBonusProjectiles: true, canCrit: true, falloff: true }
```

---

### 1.1 Weapon roster summary

| ID | Name | Ref | Pattern | Targeting | Role | EVO partner passive |
|----|------|-----|---------|-----------|------|----|
| `whirl_bat` | Whirl Bat | Baseball Bat | melee-arc | aim-facing | knockback/CC | `gym_manual` |
| `shadow_fang` | Shadow Fang | Kunai | projectile | highest-hp | anti-boss | `ninja_scroll` |
| `storm_coil` | Storm Coil | Lightning Emitter | strike | random/boss | boss-focus AoE | `power_cell` |
| `aegis_ring` | Aegis Ring | Forcefield | aura | none | defensive CC | `energy_tonic` |
| `sky_drones` | Sky Drones | Drones | orbit+proj | nearest | sustained DPS | (dual-line: see EVO) |
| `inferno_flask` | Inferno Flask | Molotov | area DoT | weighted | zone control | `oil_pact` |
| `ricochet_disc` | Ricochet Disc | Durian | bounce proj | aim+physics | room-clear | `he_fuel` |
| `pulse_lance` | Pulse Lance | Laser Launcher | beam | nearest | single-target | `power_cell` |
| `return_blade` | Return Blade | Boomerang | boomerang | nearest | poke/AoE | `super_magnet` |
| `scatter_gun` | Scatter Gun | Shotgun | spread proj | spread/facing | frontal burst | `hp_rounds` |

---

## 2. Passive Items (12 passives)

Passives have 5 levels. Values are **cumulative final values at that level** (not deltas). Multiple passives stack additively into the player's aggregate stats unless noted.

| ID | Name | Ref | Stat affected | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|----|------|-----|---------------|-----|-----|-----|-----|-----|
| `combat_drug` | Combat Stim | (Atk) | `damagePct` | +8% | +16% | +24% | +32% | +42% |
| `power_cell` | Power Cell | Energy Cube | `cooldownReductionPct` | +5% | +10% | +15% | +20% | +25% |
| `sneakers` | Sprint Soles | Sneakers | `moveSpeedPct` | +6% | +12% | +18% | +24% | +30% |
| `gym_manual` | Gym Manual | Fitness Guide | `maxHpPct` | +10% | +20% | +30% | +42% | +55% |
| `super_magnet` | Mag-Field | Hi-Power Magnet | `pickupRadiusPct` | +25% | +50% | +80% | +115% | +160% |
| `he_fuel` | HE Fuel | HE Fuel | `areaPct` | +8% | +16% | +24% | +32% | +40% |
| `hp_rounds` | HP Rounds | Hi-Power Bullet | `critDamagePct` (adds to critMultiplier) | +0.15 | +0.30 | +0.45 | +0.60 | +0.80 |
| `scope` | Precision Scope | Hi-Power Scope | `critChance` | +4% | +8% | +12% | +16% | +22% |
| `energy_tonic` | Energy Tonic | Energy Drink | `regenPerSec` (HP/s) | 0.5 | 1.0 | 1.5 | 2.2 | 3.0 |
| `oil_pact` | Oil Pact | Oil Bonds | `burnDmgPct` (DoT weapons only) | +10% | +20% | +30% | +42% | +55% |
| `ninja_scroll` | Ninja Scroll | Koga Scroll | `projectileSpeedPct` + `bonusProjectiles` | +10%/+0 | +20%/+0 | +30%/+1 | +40%/+1 | +50%/+1 |
| `ammo_drum` | Ammo Drum | Ammo Thruster | `attackSpeedPct` (separate CDR pool for projectile weapons) | +6% | +12% | +18% | +25% | +33% |

> **Stat aggregation rules:**
> - `damagePct`, `moveSpeedPct`, `areaPct`, `critChance`, `cooldownReductionPct`, `attackSpeedPct`, `pickupRadiusPct` → **additive** across all sources, then applied multiplicatively in the pipeline.
> - `critMultiplier = 1.5 + sum(critDamagePct)`.
> - `maxHpPct` → applied to base maxHP; current HP scales proportionally on level-up.
> - `bonusProjectiles` → integer added only to weapons with `acceptsBonusProjectiles: true`.
> - `attackSpeedPct` and `cooldownReductionPct` are **distinct pools**; effective cooldown for projectile weapons = `base * (1 - cdr) * (1 - atkSpd)`, clamped to `base*0.25`. Non-projectile weapons ignore `attackSpeedPct`.
> - `burnDmgPct` only multiplies weapons flagged `groundPool: true` (Inferno Flask + its EVO).

---

## 3. Evolution System

### 3.1 Rules

1. A weapon must be **Lv5 (max)**.
2. Its **paired passive** must be owned at **Lv ≥ 1** (Survivor.io requires presence, not max — keep it forgiving).
3. When both conditions hold, the **EVO** card is injected into the next level-up choice pool with high priority (weight ×3). Selecting it **replaces** the base weapon instance with the evolved weapon (frees nothing; same slot).
4. Evolved weapons are **fixed at one power tier** (no further levels) but **benefit from all global passives** (damagePct, areaPct, CDR, etc.). They are dramatically stronger than Lv5 base.
5. **Sky Drones** is the dual-input exception: it evolves when **Lv5** AND the player owns **any 2nd projectile/orbit weapon at Lv ≥ 3** (represents the Type-A + Type-B fusion). We simplify to: Sky Drones Lv5 + `power_cell` Lv≥1 → Annihilator. (Pick one rule; documented both.)

### 3.2 Evolution recipe table

| Base weapon | + Passive | = Evolved weapon | Ref evolution |
|---|---|---|---|
| `whirl_bat` | `gym_manual` | **Cyclone Bat** | Lucille |
| `shadow_fang` | `ninja_scroll` | **Spectre Shuriken** | Spirit Shuriken |
| `storm_coil` | `power_cell` | **Tempest Cell** | Supercell |
| `aegis_ring` | `energy_tonic` | **Pressure Aegis** | Pressure Forcefield |
| `sky_drones` | `power_cell` | **Annihilator** | Destroyer |
| `inferno_flask` | `oil_pact` | **Fuel Drum** | Fuel Barrel |
| `ricochet_disc` | `he_fuel` | **Spike Storm** | Caltrops |
| `pulse_lance` | `power_cell` | **Death Ray** | Death Ray |
| `return_blade` | `super_magnet` | **Mag Dart** | Magnetic Dart |
| `scatter_gun` | `hp_rounds` | **Gatling Storm** | Gatling Gun |

> Note: `power_cell` is the partner for three weapons (Storm Coil, Sky Drones, Pulse Lance) — matching the real game where Energy Cube is shared. Only **one** evolution triggers per (weapon, passive); owning power_cell enables all three if their weapons are maxed.

### 3.3 Evolved weapon stats & behavior

All evolved weapons benefit from global passives. Values below are the **fixed base** for the evolved form.

---

**EVO1 — Cyclone Bat** *(Whirl Bat + Gym Manual → Lucille)*
Swing becomes a **full 360° spin** around the player, hitting everything, with massive knockback.
```ts
{ pattern: "melee-arc", targeting: "none",
  damage: 110, cooldown: 700, arcDegrees: 360, area: 230, swings: 2,
  swingInterval: 110, knockback: 130, flags: { canCrit: true } }
```

**EVO2 — Spectre Shuriken** *(Shadow Fang + Ninja Scroll → Spirit Shuriken)*
Homing shuriken that **seeks** targets, infinite-ish pierce, fires a fat volley.
```ts
{ pattern: "projectile", targeting: "homing-nearest",
  damage: 90, cooldown: 600, count: 5, burstInterval: 60,
  speed: 760, pierce: 8, area: 22, homing: true, turnRate: 6 /*rad/s*/,
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

**EVO3 — Tempest Cell** *(Storm Coil + Power Cell → Supercell)*
Many bolts every cooldown, big chains, persistent boss focus, plus a **periodic AoE shockwave** centered on player.
```ts
{ pattern: "strike", targeting: "random-weighted", bossPriority: true,
  damage: 70, cooldown: 700, bolts: 8, area: 70, chainCount: 3, chainFalloff: 0.7,
  shockwave: { everyMs: 700, radius: 200, damage: 40 },
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

**EVO4 — Pressure Aegis** *(Aegis Ring + Energy Tonic → Pressure Forcefield)*
Larger, harder-hitting ring **plus** an outward pulse that periodically blasts enemies away with big damage.
```ts
{ pattern: "aura", targeting: "none", persistent: true,
  damage: 55, tickRate: 280, area: 165, knockback: 22,
  pulse: { everyMs: 1500, radius: 260, damage: 90, knockback: 200 },
  flags: { canCrit: true } }
```

**EVO5 — Annihilator** *(Sky Drones + Power Cell → Destroyer)*
Single powerful drone orbiting fast, firing **missiles in all directions** continuously.
```ts
{ pattern: "orbit", targeting: "all-directions",
  damage: 60, cooldown: 350, droneCount: 1, missilesPerVolley: 8,
  spreadDegrees: 360, speed: 600, area: 70, pierce: 2, homing: false,
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

**EVO6 — Fuel Drum** *(Inferno Flask + Oil Pact → Fuel Barrel)*
Drops a **massive persistent burning zone** that follows near the player, huge tick damage.
```ts
{ pattern: "area", targeting: "self-centered", groundPool: true,
  damage: 38, cooldown: 1500, flasks: 1, area: 200, duration: 2500, tickRate: 250,
  followPlayer: true,
  flags: { acceptsBonusProjectiles: false, canCrit: false } }
```

**EVO7 — Spike Storm** *(Ricochet Disc + HE Fuel → Caltrops)*
Bouncing discs that **also emit radial spike bursts** as they travel.
```ts
{ pattern: "projectile", targeting: "aim-facing", bounces: true,
  damage: 55, cooldown: 1500, discs: 3, speed: 460, area: 34, lifetime: 6000,
  tickRate: 240, knockback: 30,
  spikeBurst: { everyMs: 500, count: 6, spikeDamage: 25, spikeSpeed: 380, spikeArea: 16 },
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

**EVO8 — Death Ray** *(Pulse Lance + Power Cell → Death Ray)*
Beam **rotates 360° continuously** (always on), sweeping the screen.
```ts
{ pattern: "beam", targeting: "rotating", beam: true,
  damage: 30, cooldown: 0 /*always on*/, beamDuration: -1, range: 560, width: 50,
  tickRate: 120, rotationSpeed: 1.4 /*rad/s*/,
  flags: { canCrit: true } }
```

**EVO9 — Mag Dart** *(Return Blade + Mag-Field → Magnetic Dart)*
Boomerangs that **pull enemies in** (magnetic) and never expire, ping-ponging between targets.
```ts
{ pattern: "boomerang", targeting: "nearest", boomerang: true,
  damage: 75, cooldown: 900, blades: 3, throwInterval: 100, speed: 640,
  range: 360, pierce: -1, area: 28,
  magnetPull: 140 /*px impulse toward dart*/,
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

**EVO10 — Gatling Storm** *(Scatter Gun + HP Rounds → Gatling Gun)*
Becomes a **continuous machine-gun stream** — no reload, very low cooldown, tight spread, high crit.
```ts
{ pattern: "projectile", targeting: "spread", falloff: false,
  damage: 24, cooldown: 120 /*near-continuous*/, pellets: 2, spreadDegrees: 18,
  speed: 820, range: 420, pierce: 1, knockback: 8,
  flags: { acceptsBonusProjectiles: true, canCrit: true } }
```

---

## 4. Targeting Rules (per pattern, exact)

| Targeting | Algorithm |
|---|---|
| `nearest` | Min Euclidean distance from player to any alive on-screen enemy. Recompute per activation. |
| `highest-hp` | Max `currentHp`; tie → nearest. (Shadow Fang) |
| `lowest-hp` | Min `currentHp`; tie → nearest. |
| `random` | Uniform pick among on-screen enemies. |
| `random-weighted` | Weight = `1 + (isElite?4:0) + (isBoss?20:0)`. Pick weighted-random. |
| `bossPriority` flag | If any enemy `isBoss` exists, override target selection to that boss for ALL projectiles this activation (Storm Coil / Tempest Cell). |
| `aim-facing` | Direction = toward nearest enemy within `lockRange` (default 400px); else `player.facingDir` (last non-zero joystick vector, persisted). |
| `spread` | Center on `aim-facing` direction; distribute `pellets` evenly across `spreadDegrees`. |
| `homing` / `homing-nearest` | Spawn toward nearest; each frame steer velocity toward nearest target by up to `turnRate` rad/s. Re-target if current target dies. |
| `all-directions` | Distribute projectiles evenly across 360° from player (Annihilator). |
| `rotating` | Beam angle advances by `rotationSpeed * dt` each frame (Death Ray). |
| `self-centered` / `none` | No target; effect centered on player. |
| `weighted landing` (Inferno) | Sample 8 candidate enemies, pick the one with most neighbors within 120px (densest cluster). |

**Empty-screen fallback:** If a weapon needs a target and none exists, weapons with `aim-facing`/`spread`/`all-directions`/`none` still fire (using facing/360). Pure target-seekers (`nearest`/`highest-hp`/`random`) **skip the activation but do not consume cooldown** (re-check next frame).

---

## 5. Drop-in TypeScript Registry

```ts
// ===== types.ts =====
export type FirePattern =
  | "projectile" | "aura" | "orbit" | "melee-arc"
  | "area" | "beam" | "boomerang" | "strike";

export type Targeting =
  | "nearest" | "highest-hp" | "lowest-hp" | "random"
  | "random-weighted" | "aim-facing" | "spread" | "homing-nearest"
  | "all-directions" | "rotating" | "self-centered" | "none";

export interface WeaponLevel {
  damage: number;
  cooldown?: number;     // ms; omit for persistent/aura (uses tickRate)
  count?: number;        // projectiles/bolts/pellets/discs/blades/flasks
  speed?: number;        // px/s
  pierce?: number;       // -1 infinite
  area?: number;         // px radius / arc length
  knockback?: number;
  // pattern-specific
  arcDegrees?: number; swings?: number; swingInterval?: number;
  bolts?: number; chainCount?: number; chainFalloff?: number;
  droneCount?: number; missilesPerVolley?: number;
  flasks?: number; duration?: number; tickRate?: number;
  discs?: number; lifetime?: number;
  beamDuration?: number; range?: number; width?: number;
  pellets?: number; spreadDegrees?: number;
  blades?: number; throwInterval?: number; burstInterval?: number;
}

export interface WeaponFlags {
  acceptsBonusProjectiles?: boolean;
  canCrit?: boolean;
  persistent?: boolean;
  homing?: boolean;
  bounces?: boolean;
  boomerang?: boolean;
  beam?: boolean;
  groundPool?: boolean;
  falloff?: boolean;
  bossPriority?: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  pattern: FirePattern;
  targeting: Targeting;
  flags: WeaponFlags;
  levels: WeaponLevel[];           // length 5 (base) or 1 (evolved)
  evolvesWith?: string;            // passive id
  evolvesInto?: string;            // evolved weapon id
  isEvolved?: boolean;
}

export type PassiveStat =
  | "damagePct" | "cooldownReductionPct" | "moveSpeedPct" | "maxHpPct"
  | "pickupRadiusPct" | "areaPct" | "critDamagePct" | "critChance"
  | "regenPerSec" | "burnDmgPct" | "projectileSpeedPct"
  | "bonusProjectiles" | "attackSpeedPct";

export interface PassiveDef {
  id: string;
  name: string;
  stats: Partial<Record<PassiveStat, number>>[]; // length 5, cumulative
}

// ===== weapons.ts =====
export const WEAPONS: Record<string, WeaponDef> = {
  whirl_bat: {
    id: "whirl_bat", name: "Whirl Bat", pattern: "melee-arc",
    targeting: "aim-facing", flags: { canCrit: true },
    evolvesWith: "gym_manual", evolvesInto: "cyclone_bat",
    levels: [
      { damage:22, cooldown:1100, arcDegrees:120, area:150, swings:1, swingInterval:90, knockback:60 },
      { damage:30, cooldown:1050, arcDegrees:130, area:160, swings:1, swingInterval:90, knockback:65 },
      { damage:40, cooldown:1000, arcDegrees:140, area:175, swings:2, swingInterval:90, knockback:70 },
      { damage:52, cooldown:950,  arcDegrees:150, area:190, swings:2, swingInterval:90, knockback:80 },
      { damage:68, cooldown:900,  arcDegrees:160, area:205, swings:3, swingInterval:90, knockback:90 },
    ],
  },
  shadow_fang: {
    id:"shadow_fang", name:"Shadow Fang", pattern:"projectile",
    targeting:"highest-hp", flags:{ acceptsBonusProjectiles:true, canCrit:true },
    evolvesWith:"ninja_scroll", evolvesInto:"spectre_shuriken",
    levels:[
      { damage:30, cooldown:900, count:1, speed:700, pierce:2, area:14, knockback:10, burstInterval:70 },
      { damage:38, cooldown:850, count:1, speed:740, pierce:3, area:14, knockback:10, burstInterval:70 },
      { damage:46, cooldown:800, count:2, speed:780, pierce:3, area:16, knockback:12, burstInterval:70 },
      { damage:58, cooldown:760, count:2, speed:820, pierce:4, area:16, knockback:12, burstInterval:70 },
      { damage:74, cooldown:720, count:3, speed:860, pierce:5, area:18, knockback:15, burstInterval:70 },
    ],
  },
  storm_coil: {
    id:"storm_coil", name:"Storm Coil", pattern:"strike",
    targeting:"random-weighted", flags:{ acceptsBonusProjectiles:true, canCrit:true, bossPriority:true },
    evolvesWith:"power_cell", evolvesInto:"tempest_cell",
    levels:[
      { damage:26, cooldown:1300, bolts:1, area:40, chainCount:0 },
      { damage:32, cooldown:1250, bolts:2, area:45, chainCount:1, chainFalloff:0.7 },
      { damage:40, cooldown:1200, bolts:3, area:50, chainCount:1, chainFalloff:0.7 },
      { damage:50, cooldown:1150, bolts:4, area:55, chainCount:2, chainFalloff:0.65 },
      { damage:64, cooldown:1100, bolts:5, area:60, chainCount:2, chainFalloff:0.6 },
    ],
  },
  aegis_ring: {
    id:"aegis_ring", name:"Aegis Ring", pattern:"aura",
    targeting:"none", flags:{ persistent:true },
    evolvesWith:"energy_tonic", evolvesInto:"pressure_aegis",
    levels:[
      { damage:10, tickRate:500, area:70,  knockback:8 },
      { damage:13, tickRate:480, area:82,  knockback:9 },
      { damage:17, tickRate:460, area:95,  knockback:10 },
      { damage:22, tickRate:440, area:110, knockback:12 },
      { damage:28, tickRate:420, area:128, knockback:14 },
    ],
  },
  sky_drones: {
    id:"sky_drones", name:"Sky Drones", pattern:"orbit",
    targeting:"nearest", flags:{ acceptsBonusProjectiles:true, canCrit:true, homing:true },
    evolvesWith:"power_cell", evolvesInto:"annihilator",
    levels:[
      { damage:14, cooldown:1000, droneCount:1, missilesPerVolley:1, speed:480, area:35, pierce:0 },
      { damage:18, cooldown:950,  droneCount:1, missilesPerVolley:2, speed:500, area:38, pierce:0 },
      { damage:22, cooldown:900,  droneCount:2, missilesPerVolley:2, speed:520, area:42, pierce:0 },
      { damage:28, cooldown:850,  droneCount:2, missilesPerVolley:3, speed:540, area:46, pierce:1 },
      { damage:36, cooldown:800,  droneCount:2, missilesPerVolley:3, speed:560, area:52, pierce:1 },
    ],
  },
  inferno_flask: {
    id:"inferno_flask", name:"Inferno Flask", pattern:"area",
    targeting:"random-weighted", flags:{ acceptsBonusProjectiles:true, groundPool:true },
    evolvesWith:"oil_pact", evolvesInto:"fuel_drum",
    levels:[
      { damage:9,  cooldown:2400, flasks:1, area:75,  duration:2500, tickRate:400 },
      { damage:12, cooldown:2300, flasks:1, area:85,  duration:2800, tickRate:380 },
      { damage:15, cooldown:2200, flasks:2, area:95,  duration:3000, tickRate:360 },
      { damage:19, cooldown:2100, flasks:2, area:108, duration:3300, tickRate:340 },
      { damage:24, cooldown:2000, flasks:3, area:122, duration:3600, tickRate:320 },
    ],
  },
  ricochet_disc: {
    id:"ricochet_disc", name:"Ricochet Disc", pattern:"projectile",
    targeting:"aim-facing", flags:{ acceptsBonusProjectiles:true, canCrit:true, bounces:true },
    evolvesWith:"he_fuel", evolvesInto:"spike_storm",
    levels:[
      { damage:18, cooldown:2000, discs:1, speed:360, area:22, lifetime:4000, tickRate:300, knockback:20 },
      { damage:23, cooldown:1950, discs:1, speed:380, area:24, lifetime:4500, tickRate:300, knockback:22 },
      { damage:29, cooldown:1900, discs:2, speed:400, area:26, lifetime:5000, tickRate:280, knockback:24 },
      { damage:37, cooldown:1850, discs:2, speed:420, area:28, lifetime:5500, tickRate:280, knockback:26 },
      { damage:47, cooldown:1800, discs:3, speed:440, area:30, lifetime:6000, tickRate:260, knockback:30 },
    ],
  },
  pulse_lance: {
    id:"pulse_lance", name:"Pulse Lance", pattern:"beam",
    targeting:"nearest", flags:{ canCrit:true, beam:true },
    evolvesWith:"power_cell", evolvesInto:"death_ray",
    levels:[
      { damage:12, cooldown:2200, beamDuration:800,  range:360, width:24, tickRate:150 },
      { damage:15, cooldown:2100, beamDuration:900,  range:400, width:28, tickRate:150 },
      { damage:19, cooldown:2000, beamDuration:1000, range:440, width:32, tickRate:140 },
      { damage:24, cooldown:1900, beamDuration:1100, range:480, width:38, tickRate:140 },
      { damage:31, cooldown:1800, beamDuration:1300, range:520, width:44, tickRate:130 },
    ],
  },
  return_blade: {
    id:"return_blade", name:"Return Blade", pattern:"boomerang",
    targeting:"nearest", flags:{ acceptsBonusProjectiles:true, canCrit:true, boomerang:true },
    evolvesWith:"super_magnet", evolvesInto:"mag_dart",
    levels:[
      { damage:16, cooldown:1400, blades:1, speed:520, range:240, pierce:3,  area:18, throwInterval:120 },
      { damage:21, cooldown:1350, blades:1, speed:540, range:260, pierce:4,  area:18, throwInterval:120 },
      { damage:27, cooldown:1300, blades:2, speed:560, range:280, pierce:4,  area:20, throwInterval:120 },
      { damage:34, cooldown:1250, blades:2, speed:580, range:300, pierce:5,  area:22, throwInterval:120 },
      { damage:44, cooldown:1200, blades:3, speed:600, range:320, pierce:-1, area:24, throwInterval:120 },
    ],
  },
  scatter_gun: {
    id:"scatter_gun", name:"Scatter Gun", pattern:"projectile",
    targeting:"spread", flags:{ acceptsBonusProjectiles:true, canCrit:true, falloff:true },
    evolvesWith:"hp_rounds", evolvesInto:"gatling_storm",
    levels:[
      { damage:11, cooldown:1200, pellets:4, spreadDegrees:40, speed:640, range:220, pierce:0, knockback:15, lifetime:400 },
      { damage:14, cooldown:1150, pellets:5, spreadDegrees:42, speed:660, range:240, pierce:0, knockback:16, lifetime:420 },
      { damage:18, cooldown:1100, pellets:6, spreadDegrees:45, speed:680, range:260, pierce:1, knockback:18, lifetime:440 },
      { damage:23, cooldown:1050, pellets:7, spreadDegrees:48, speed:700, range:280, pierce:1, knockback:20, lifetime:460 },
      { damage:29, cooldown:1000, pellets:9, spreadDegrees:52, speed:720, range:300, pierce:1, knockback:24, lifetime:480 },
    ],
  },
};

// ===== evolved.ts (single-level, isEvolved) =====
export const EVOLVED: Record<string, WeaponDef> = {
  cyclone_bat:     { id:"cyclone_bat", name:"Cyclone Bat", pattern:"melee-arc", targeting:"none", isEvolved:true, flags:{canCrit:true},
    levels:[{ damage:110, cooldown:700, arcDegrees:360, area:230, swings:2, swingInterval:110, knockback:130 }] },
  spectre_shuriken:{ id:"spectre_shuriken", name:"Spectre Shuriken", pattern:"projectile", targeting:"homing-nearest", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true,homing:true},
    levels:[{ damage:90, cooldown:600, count:5, speed:760, pierce:8, area:22, burstInterval:60 }] },
  tempest_cell:    { id:"tempest_cell", name:"Tempest Cell", pattern:"strike", targeting:"random-weighted", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true,bossPriority:true},
    levels:[{ damage:70, cooldown:700, bolts:8, area:70, chainCount:3, chainFalloff:0.7 }] },
  pressure_aegis:  { id:"pressure_aegis", name:"Pressure Aegis", pattern:"aura", targeting:"none", isEvolved:true, flags:{persistent:true,canCrit:true},
    levels:[{ damage:55, tickRate:280, area:165, knockback:22 }] },
  annihilator:     { id:"annihilator", name:"Annihilator", pattern:"orbit", targeting:"all-directions", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true},
    levels:[{ damage:60, cooldown:350, droneCount:1, missilesPerVolley:8, spreadDegrees:360, speed:600, area:70, pierce:2 }] },
  fuel_drum:       { id:"fuel_drum", name:"Fuel Drum", pattern:"area", targeting:"self-centered", isEvolved:true, flags:{groundPool:true},
    levels:[{ damage:38, cooldown:1500, flasks:1, area:200, duration:2500, tickRate:250 }] },
  spike_storm:     { id:"spike_storm", name:"Spike Storm", pattern:"projectile", targeting:"aim-facing", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true,bounces:true},
    levels:[{ damage:55, cooldown:1500, discs:3, speed:460, area:34, lifetime:6000, tickRate:240, knockback:30 }] },
  death_ray:       { id:"death_ray", name:"Death Ray", pattern:"beam", targeting:"rotating", isEvolved:true, flags:{beam:true,canCrit:true},
    levels:[{ damage:30, cooldown:0, beamDuration:-1, range:560, width:50, tickRate:120 }] },
  mag_dart:        { id:"mag_dart", name:"Mag Dart", pattern:"boomerang", targeting:"nearest", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true,boomerang:true},
    levels:[{ damage:75, cooldown:900, blades:3, speed:640, range:360, pierce:-1, area:28, throwInterval:100 }] },
  gatling_storm:   { id:"gatling_storm", name:"Gatling Storm", pattern:"projectile", targeting:"spread", isEvolved:true, flags:{acceptsBonusProjectiles:true,canCrit:true},
    levels:[{ damage:24, cooldown:120, pellets:2, spreadDegrees:18, speed:820, range:420, pierce:1, knockback:8 }] },
};

// ===== passives.ts =====
export const PASSIVES: Record<string, PassiveDef> = {
  combat_drug:  { id:"combat_drug", name:"Combat Stim",
    stats:[{damagePct:0.08},{damagePct:0.16},{damagePct:0.24},{damagePct:0.32},{damagePct:0.42}] },
  power_cell:   { id:"power_cell", name:"Power Cell",
    stats:[{cooldownReductionPct:0.05},{cooldownReductionPct:0.10},{cooldownReductionPct:0.15},{cooldownReductionPct:0.20},{cooldownReductionPct:0.25}] },
  sneakers:     { id:"sneakers", name:"Sprint Soles",
    stats:[{moveSpeedPct:0.06},{moveSpeedPct:0.12},{moveSpeedPct:0.18},{moveSpeedPct:0.24},{moveSpeedPct:0.30}] },
  gym_manual:   { id:"gym_manual", name:"Gym Manual",
    stats:[{maxHpPct:0.10},{maxHpPct:0.20},{maxHpPct:0.30},{maxHpPct:0.42},{maxHpPct:0.55}] },
  super_magnet: { id:"super_magnet", name:"Mag-Field",
    stats:[{pickupRadiusPct:0.25},{pickupRadiusPct:0.50},{pickupRadiusPct:0.80},{pickupRadiusPct:1.15},{pickupRadiusPct:1.60}] },
  he_fuel:      { id:"he_fuel", name:"HE Fuel",
    stats:[{areaPct:0.08},{areaPct:0.16},{areaPct:0.24},{areaPct:0.32},{areaPct:0.40}] },
  hp_rounds:    { id:"hp_rounds", name:"HP Rounds",
    stats:[{critDamagePct:0.15},{critDamagePct:0.30},{critDamagePct:0.45},{critDamagePct:0.60},{critDamagePct:0.80}] },
  scope:        { id:"scope", name:"Precision Scope",
    stats:[{critChance:0.04},{critChance:0.08},{critChance:0.12},{critChance:0.16},{critChance:0.22}] },
  energy_tonic: { id:"energy_tonic", name:"Energy Tonic",
    stats:[{regenPerSec:0.5},{regenPerSec:1.0},{regenPerSec:1.5},{regenPerSec:2.2},{regenPerSec:3.0}] },
  oil_pact:     { id:"oil_pact", name:"Oil Pact",
    stats:[{burnDmgPct:0.10},{burnDmgPct:0.20},{burnDmgPct:0.30},{burnDmgPct:0.42},{burnDmgPct:0.55}] },
  ninja_scroll: { id:"ninja_scroll", name:"Ninja Scroll",
    stats:[{projectileSpeedPct:0.10,bonusProjectiles:0},{projectileSpeedPct:0.20,bonusProjectiles:0},{projectileSpeedPct:0.30,bonusProjectiles:1},{projectileSpeedPct:0.40,bonusProjectiles:1},{projectileSpeedPct:0.50,bonusProjectiles:1}] },
  ammo_drum:    { id:"ammo_drum", name:"Ammo Drum",
    stats:[{attackSpeedPct:0.06},{attackSpeedPct:0.12},{attackSpeedPct:0.18},{attackSpeedPct:0.25},{attackSpeedPct:0.33}] },
};

// ===== evolution recipe map =====
export const EVO_RECIPES: { base:string; passive:string; result:string }[] = [
  { base:"whirl_bat",     passive:"gym_manual",   result:"cyclone_bat" },
  { base:"shadow_fang",   passive:"ninja_scroll", result:"spectre_shuriken" },
  { base:"storm_coil",    passive:"power_cell",   result:"tempest_cell" },
  { base:"aegis_ring",    passive:"energy_tonic", result:"pressure_aegis" },
  { base:"sky_drones",    passive:"power_cell",   result:"annihilator" },
  { base:"inferno_flask", passive:"oil_pact",     result:"fuel_drum" },
  { base:"ricochet_disc", passive:"he_fuel",      result:"spike_storm" },
  { base:"pulse_lance",   passive:"power_cell",   result:"death_ray" },
  { base:"return_blade",  passive:"super_magnet", result:"mag_dart" },
  { base:"scatter_gun",   passive:"hp_rounds",    result:"gatling_storm" },
];
```

---

## 6. Edge Cases & Implementation Notes

1. **Cooldown floor:** never let `effectiveCooldown < base*0.25`. For Gatling Storm (base 120ms) this floors at 30ms — keep it. Cap total fired projectiles globally at ~400 on screen to protect 60fps; if exceeded, oldest projectiles despawn first.
2. **Pierce + tick collision:** A piercing projectile must keep a `hitSet` of enemy IDs it has already damaged so it doesn't multi-hit the same enemy in one pass. Bouncing/orbit/aura/beam weapons use per-enemy `tickRate` instead of a hitSet.
3. **Boomerang double-hit:** outbound and return are separate hit windows — clear the `hitSet` at the apex (when it starts returning).
4. **Knockback immunity:** bosses set `knockbackImmune:true`; skip impulse but still apply damage.
5. **bossPriority override** only applies when `enemy.isBoss === true` (not elites). Elites only raise weight in `random-weighted`.
6. **Bonus projectiles** apply once per activation, not per burst sub-shot (e.g. Shadow Fang `count` increases, not `burstInterval` repeats).
7. **Area scaling** for melee-arc scales `area` (length) but **not** `arcDegrees`. For auras/pools it scales radius. Beam scales `width` and `range` both by `(1+areaPct)`.
8. **Evolution offering:** when offered and player declines (picks something else), keep offering the EVO every subsequent level-up (don't lose the chance). Once taken, remove base+EVO from future pools.
9. **Empty pool:** if all weapons/passives are maxed and no EVO is available, offer a "Refund / +1 small gold" filler card (standard bullet-heaven fallback).
10. **Performance:** auras/beams/orbits should use squared-distance checks (avoid `sqrt`); strikes (Storm Coil) are instant (no projectile pooling). Particle/glow rendering is the FPS risk on Canvas2D — cap glow blur usage; pre-render projectile sprites to offscreen canvases once.
11. **Targeting cost:** cache the "nearest enemy" query per frame and share it across all weapons that need it (single spatial-grid query), rather than per-weapon scans.
12. **Initial loadout:** Survivor.io starts you with one weapon. Default starter = `whirl_bat` (well-rounded, knockback gives breathing room). First 3 level-up choices should bias toward offering a second damage weapon.

---

## Sources

- [SurvivorIO Wiki — Weapon Skill Evolution Guide](https://survivorio.fandom.com/wiki/Weapon_Skill_Evolution_Guide)
- [MrGuider — Survivor.io Skills Guide (weapon/supplies/evolution)](https://www.mrguider.org/articles/survivor-io-skills-guide/)
- [BlueStacks — Survivor.io Skills & Evolution Guide](https://www.bluestacks.com/blog/game-guides/survivor-io/sio-skills-evolution-guide-en.html)
- [WriterParty — Full Evolution List and Evo Guide](https://writerparty.com/party/survivor-io-full-evolution-list-and-evo-guide/)
- [Gamer Digest — Survivor.io Weapon Evolutions](https://gamerdigest.com/survivor-io-weapon-evolutions/)
- [AppGamer — Best Weapons Tier List](https://www.appgamer.com/survivorio/best-weapons-tier-list)