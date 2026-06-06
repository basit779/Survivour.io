I have enough authentic source material on Survivor.io's core mechanics (16 active weapons + 13 passives, evolution = weapon L5 + required passive, max 6 active/6 passive skills, 3 choices on level-up, chests give 1/3/5 skills, XP green gems, gold/HP/magnet/bomb pickups, character roster with starting passives, gem-based revives/unlocks). This is enough to design a complete, authentic, sellable spec. I'll now write the full implementation-ready specification.

# Progression, Level-Up Loop, Economy & Meta-Progression — Implementation Spec

This subsystem is the monetizable/sellable backbone. It is adapted from Survivor.io's loop (16 active weapons + 13 passives, evolution = weapon Lv5 + paired passive, 3 choices per level-up, chests grant 1/3/5 upgrades, max 6 active / 6 passive skills, green XP gems + gold/HP/magnet/bomb pickups, gem-gated revives & character unlocks) with renamed assets to avoid trademark issues. All names below are original.

---

## 0. Naming Map (Survivor.io → Our game)

| Survivor.io | Ours |
|---|---|
| Active skill (weapon) | **Weapon** |
| Passive support skill | **Augment** |
| EXP green crystal | **XP Shard** |
| Coins (soft) | **Scrap (gold)** |
| Gems (hard) | **Cores** |
| Energy | **Power Cells** |
| Survivor/character | **Operator** |

> Terminology used throughout this doc: `Weapon`, `Augment`, `XP Shard`, `Scrap`, `Cores`, `Power Cells`, `Operator`.

---

## 1. XP & Leveling

### 1.1 XP Shard pickups (in-run)

Enemies drop XP Shards on death. There are 3 visual tiers (color + glow size). Pickup is by magnet radius collision (see 1.4).

| Tier | Color (programmatic) | XP value | Drop source |
|---|---|---|---|
| Minor | `#39ff88` (green, small glow) | **1** | Trash mobs (white/normal) |
| Major | `#33b1ff` (blue, medium glow) | **5** | Tanky/fast mobs, elites' minor drop |
| Super | `#c06bff` (purple, large pulsing glow) | **20** | Elites, bosses, chest-spawned |

Drop rules:
- Normal mob: 1× Minor (value 1).
- Elite mob: 1× Super (20) + 2× Minor.
- Boss: 5× Super (100) on death.
- **XP gain multiplier** from Augment "Field Manual" and meta upgrades applies at pickup: `gainedXP = floor(shardValue * (1 + xpBonusPct))`.
- Edge case: if `xpBonusPct` produces fractional results, floor per-shard but accumulate a `xpRemainder` float and add `floor(remainder)` whenever it crosses 1.0, so bonuses aren't silently lost.

### 1.2 XP-to-next-level curve

Survivor-style games use a near-linear-with-slow-acceleration curve so the player levels fast early (lots of dopamine) and the cadence stretches out late. Use a piecewise quadratic-ish formula:

```
xpToNext(level)  // XP required to go FROM `level` TO `level+1`, level starts at 1
  if level <= 20:   base = 5 + (level - 1) * 6          // linear ramp
  else if <= 40:    base = 119 + (level - 20) * 13       // steeper
  else:             base = 379 + (level - 40) * 22       // late game
return round(base)
```

This yields fast early levels (first level-up at ~5 XP = a handful of trash kills) and a smooth stretch. First 30 levels (cumulative = total XP to reach that level from start):

| Lvl | xpToNext | Cumulative | Lvl | xpToNext | Cumulative |
|----:|---------:|-----------:|----:|---------:|-----------:|
| 1 | 5 | 0 | 16 | 95 | 770 |
| 2 | 11 | 5 | 17 | 101 | 865 |
| 3 | 17 | 16 | 18 | 107 | 966 |
| 4 | 23 | 33 | 19 | 113 | 1073 |
| 5 | 29 | 56 | 20 | 119 | 1186 |
| 6 | 35 | 85 | 21 | 132 | 1305 |
| 7 | 41 | 120 | 22 | 145 | 1437 |
| 8 | 47 | 161 | 23 | 158 | 1582 |
| 9 | 53 | 208 | 24 | 171 | 1740 |
| 10 | 59 | 261 | 25 | 184 | 1911 |
| 11 | 65 | 320 | 26 | 197 | 2095 |
| 12 | 71 | 385 | 27 | 210 | 2292 |
| 13 | 77 | 456 | 28 | 223 | 2502 |
| 14 | 83 | 533 | 29 | 236 | 2725 |
| 15 | 89 | 622 | 30 | 249 | 2961 |

A typical 15-minute run should reach **level ~45–60** with default XP rates; tune mob spawn density (Spawn subsystem) so the player hits ~6 level-ups in the first 2 minutes.

### 1.3 Level-up trigger & overflow

- On pickup: `currentXP += gainedXP`. While `currentXP >= xpToNext(level)`: subtract, `level++`, push **one** pending level-up choice onto a queue.
- Multiple level-ups from one big pickup (chest/boss) are **queued**, presented sequentially. Game is paused while any choice screen is open.
- The XP bar (top of screen) shows `currentXP / xpToNext(level)` and the level number.

### 1.4 Pickup magnet radius

- Base magnet radius: **70 px** (at reference 1080-wide portrait canvas; scale with `canvasWidth/1080`).
- Augment "Magna-Field" and meta upgrades multiply it: `radius = 70 * (1 + magnetBonusPct)`.
- Magnetized behavior: when a pickup is within radius, it accelerates toward the player. Velocity: `v = lerp(120, 900, t)` px/s where `t` ramps 0→1 over 0.25 s after capture (ease-in so they "snap").
- Hard collect radius (always collects regardless of magnet): **28 px** (player body radius + margin).
- **Magnet pickup item** (the in-run bomb-style consumable, see 3.2) pulls ALL on-screen XP Shards instantly regardless of radius.
- Edge case: cap simultaneous magnetized shards at 400; beyond that, oldest shards auto-collect to avoid GC churn on mid-range phones.

---

## 2. Level-Up Choice Screen

### 2.1 Presentation

- Pauses game. Shows **3 cards** by default; meta upgrade "Wider Picks" or certain Operators bump to **4 cards**.
- Each card shows: icon (programmatic), name, type tag (NEW WEAPON / NEW AUGMENT / UPGRADE / EVOLVE), current→next level, and one-line effect delta.
- Bottom bar buttons: **Reroll** (↻) and **Banish** (✕), each with a remaining-count badge.

### 2.2 Candidate pool & generation rules

Player loadout limits (Survivor.io-accurate): **max 6 Weapons, max 6 Augments.**

Build the candidate list each time a choice is shown:

1. **Upgrade existing weapon**: any owned weapon with `level < 5` → option "Upgrade {name} Lv{n}→{n+1}".
2. **Evolve weapon**: any owned weapon at `level == 5` whose paired Augment is owned at `level >= 1` AND not yet evolved → option "EVOLVE → {evoName}" (see 5.3). This is **weighted very high** so players see their payoff.
3. **New weapon**: if `ownedWeapons < 6`, each not-owned weapon → option "New: {name}".
4. **Upgrade existing augment**: any owned augment with `level < 5` → option.
5. **New augment**: if `ownedAugments < 6`, each not-owned augment → option.

Each candidate gets a base weight, then is sampled **without replacement** until the screen has N cards (3 or 4).

### 2.3 Weighting table

| Candidate type | Base weight | Notes |
|---|---:|---|
| Evolve available | **1000** | Near-guaranteed to appear when possible (acts as priority) |
| Upgrade owned weapon (Lv<5) | 60 | +10 per level already owned, to push weapons toward Lv5 |
| Upgrade owned augment (Lv<5) | 40 | |
| New weapon (slots free) | 35 | ×1.5 if `ownedWeapons < 3` (encourage breadth early) |
| New augment (slots free) | 30 | ×1.5 if a Lv5 weapon lacks its evo augment (steer toward evo) |

Generation algorithm:

```
function buildChoices(n):
  pool = collectCandidates()              // each {item, type, weight}
  picked = []
  # 1. Force evolve(s) first if present (cap 1 evolve card unless 2+ ready)
  for evo in pool.evolves: picked.add(evo); if picked.size==n: return picked
  # 2. Weighted sample without replacement from remaining
  remaining = pool minus picked
  while picked.size < n and remaining not empty:
     choice = weightedRandom(remaining)
     picked.add(choice); remaining.remove(choice)
  # 3. Pad with fallback if pool exhausted (see 2.5)
  while picked.size < n: picked.add(fallbackOption())
  return shuffle(picked)
```

De-dup rule: never show the same item twice; never show "New weapon X" and "Upgrade weapon X" simultaneously (can't both be valid anyway).

### 2.4 Reroll & Banish

- **Reroll**: discards the current 3–4 cards and regenerates from the pool (the banished items stay banished for the rest of the run). Default count per run: **2** (raise via meta upgrade, max +3 = 5 total). A reroll can also be bought in-run for **30 Cores** once free rerolls are spent (optional monetization, see §7).
- **Banish**: permanently removes a specific item from this run's pool (good for dumping a weapon you don't want). Default count: **1** per run (meta upgrade adds up to +2).
- Banished items are excluded from all future generation this run. If banishing empties the pool below N cards, fallback fills (§2.5).
- Edge case: Reroll is disabled (greyed) if the entire remaining pool has ≤ current card count (nothing new to show).

### 2.5 Fallback when everything is maxed (Survivor.io-accurate)

When the pool yields fewer than N real options (all weapons Lv5/evolved, all augments Lv5, slots full), pad with fallback cards drawn from this table (each independently rolled):

| Fallback card | Effect | Weight |
|---|---|---:|
| **Scrap Cache** | +50 Scrap immediately (counts toward end-of-run gold) | 50 |
| **Field Repair** | Heal 30% of max HP | 35 |
| **Power Surge** | +3% damage for rest of run (stacks, no cap) | 15 |

At full max-out, the level-up screen still always shows N cards so the player keeps getting rewards (gold/heal) — exactly Survivor.io behavior. Healing fallback weight increases to 60 if player is below 50% HP (mercy weighting).

---

## 3. In-Run Pickups (non-XP)

Dropped by enemies (low chance), chests, and timed map spawns. All use the same magnet/collect logic except where noted.

### 3.1 Drop sources & rates

| Pickup | Drop chance | Source | Magnetizable? |
|---|---|---|---|
| Scrap (gold coin) | 12% per normal mob; 100% elites (×3) | mobs | Yes |
| HP Potion | 2% per mob; in chest pool | mobs, chest | Yes |
| Magnet | timed: 1 guaranteed every 90 s of run; 0.5% mob | map, mob | No (auto on touch) |
| Bomb (screen nuke) | timed: 1 guaranteed every 120 s; 0.5% mob | map, mob | No |
| Chest | 100% from each elite kill; bosses always drop a Golden Chest | elite/boss | Walk-over to open |

### 3.2 Pickup effects

- **Scrap**: +1 Scrap each (elite drops are worth 5). Scrap accumulates to the run total and is banked at run end (×meta multipliers, §6).
- **HP Potion**: heal **25% of max HP** (flat min 40 HP). Overheal discarded.
- **Magnet**: instantly pulls every XP Shard and Scrap on screen to the player (ignores radius). Big satisfying sweep.
- **Bomb (nuke)**: deals **damage = 80% of current max enemy HP on screen, capped, + flat 9999** to all non-boss enemies on screen; bosses take a flat **5% of their max HP**. Screen-flash + shockwave particle. Cooldown-free (it's a consumable).
- **Chest (multi-upgrade)**: opening grants **1, 3, or 5** simultaneous upgrades (Survivor.io-accurate), each resolved through the level-up generation logic (auto-applied, not chosen, except Golden chests which present choices). Roll:

| Chest type | 1 upgrade | 3 upgrades | 5 upgrades | Source |
|---|---:|---:|---:|---|
| Wooden (elite) | 70% | 25% | 5% | elite kill |
| Golden (boss) | 0% | 40% | 60% | boss kill |

- Golden chest **auto-applies evolution** if any owned Lv5 weapon has its paired augment (Survivor.io behavior): the evolve consumes one of the chest's upgrade rolls and is guaranteed first.
- Edge case: if a chest's upgrade count exceeds available pool options, leftover rolls convert to fallback (Scrap/heal, §2.5).

---

## 4. Weapons & Augments Data (for evolution pairing)

This subsystem only needs the **identity, level cap, and evolution pairing** of weapons/augments for generation logic; full combat numbers are owned by the Weapons subsystem. Provided here as the canonical data-table shape and pairing map.

### 4.1 Weapon table shape

```ts
interface WeaponDef {
  id: string;            // "shuriken"
  name: string;          // "Shuriken Volley"
  maxLevel: 5;
  evolvesTo: string|null;      // "spirit_shuriken"
  evoAugmentId: string|null;   // "ninja_codex"  (must be owned Lv>=1)
  startWeaponForOperators: string[]; // operator ids that start with this
}
```

### 4.2 Canonical weapon → evolution → required augment map (renamed)

| Weapon (id) | Evolution | Required Augment (id) |
|---|---|---|
| Shuriken Volley (`shuriken`) | Spirit Shuriken | Ninja Codex (`ninja_codex`) |
| Boomerang Disc (`boomerang`) | Orbit Cutter | Power Magnet (`power_magnet`) |
| Throwing Brick (`brick`) | Meteor Brick | Fitness Plan (`fitness_plan`) |
| Drill Bolt (`drill`) | Piercer Drill | Ammo Booster (`ammo_booster`) |
| Recon Drones (`drones`) | Drone Swarm | Energy Core (`energy_core`) |
| Spike Durian (`durian`) | Cluster Durian | HE Charge (`he_charge`) |
| Bulwark Field (`forcefield`) | Aegis Field | Stim Drink (`stim_drink`) |
| Orbit Guardians (`guardian`) | Sentinel Halo | Exo Brace (`exo_brace`) |
| Beam Lance (`laser`) | Photon Lance | Energy Core (`energy_core`) |
| Arc Coil (`lightning`) | Storm Coil | Energy Core (`energy_core`) |
| Proximity Mine (`mine`) | Cluster Mines | — (no augment; evolves at Lv5 alone) |
| Firebomb (`molotov`) | Inferno Bomb | Oil Bond (`oil_bond`) |
| Rocket Pod (`rpg`) | Hydra Rockets | HE Charge (`he_charge`) |
| Plasma Ball (`soccer`) | Chaos Sphere | — (evolves at Lv5 alone) |
| Void Orb (`void`) | Null Nova | Ninja Codex (`ninja_codex`) |
| Light Saber Drone (`lightblade`) | Eternal Edge | Ronin Plate (`ronin_plate`) |

### 4.3 Augment table (effect per level, Lv1–Lv5)

```ts
interface AugmentDef { id; name; maxLevel:5; stat:string; perLevel:number[]; }
```

| Augment (id) | Stat affected | Lv1 / Lv2 / Lv3 / Lv4 / Lv5 |
|---|---|---|
| Hi-Power Rounds (`hi_power`) | +Damage % | 10 / 20 / 30 / 40 / 50 |
| Field Manual (`field_manual`) | +XP gain % | 8 / 16 / 24 / 32 / 40 |
| Ronin Plate (`ronin_plate`) | Damage reduction % | 10 / 20 / 30 / 40 / 50 |
| Sprint Boots (`sprint_boots`) | +Move speed % & DR % | 10 / 20 / 30 / 40 / 50 |
| Stim Drink (`stim_drink`) | Heal %HP / 5s | 1 / 2 / 3 / 4 / 5 |
| Oil Bond (`oil_bond`) | +Scrap gain % | 8 / 16 / 24 / 32 / 40 |
| Power Magnet (`power_magnet`) | +Pickup range % | 100 / 200 / 300 / 400 / 500 |
| Ammo Booster (`ammo_booster`) | +Projectile speed % | 10 / 20 / 30 / 40 / 50 |
| Energy Core (`energy_core`) | Cooldown reduction % | 8 / 16 / 24 / 32 / 40 |
| Exo Brace (`exo_brace`) | +Effect duration % | 10 / 20 / 30 / 40 / 50 |
| Fitness Plan (`fitness_plan`) | +Max HP % | 20 / 40 / 60 / 80 / 100 |
| HE Charge (`he_charge`) | +Weapon range/AoE % | 10 / 20 / 30 / 40 / 50 |
| Ninja Codex (`ninja_codex`) | +Crit chance % | 5 / 10 / 15 / 20 / 25 |

### 4.4 Evolution rules (runtime)

- Condition: weapon at `level == 5` AND (`evoAugmentId == null` OR augment owned `level >= 1`).
- On evolve: weapon replaced in-place by its evolution (keeps its slot; evolution does not consume a new weapon slot). Evolved weapons have a single super-powered tier (no further leveling).
- A weapon can only evolve once. Evolved weapons are excluded from upgrade/new pools.

---

## 5. Meta-Progression (between runs)

### 5.1 Currencies

| Currency | Type | Earned from | Spent on |
|---|---|---|---|
| **Scrap** | Soft | per-run total (banked at run end) | Permanent Upgrade shop, Operator unlock (shard path) |
| **Cores** | Hard | small free trickle (daily/quests/first-clear), IAP | Operator unlock (instant), revives, reroll-buy, cosmetics, energy refill |
| **Power Cells** | Energy | regen over time / refill | starting a run (optional F2P gate — see §7; can be disabled for a paid game) |

End-of-run Scrap formula:
```
runScrap = floor( collectedScrap
                  * (1 + oilBondAugmentPct)        // in-run augment
                  * (1 + metaScrapBonusPct)        // permanent upgrade
                  * stageClearBonus                // 1.0 survive, 1.5 boss-kill clear
                  * doubleGoldMultiplier )         // 1 or 2 (ad/IAP, §7)
```

### 5.2 Permanent Upgrade Shop tree (spent in Scrap)

Each upgrade has N ranks; cost scales geometrically. Cost of rank `r` (1-indexed):
```
cost(r) = round( base * growth^(r-1) )
```

| Upgrade (id) | Effect / rank | Ranks | base | growth | Total Scrap (all ranks) |
|---|---|---:|---:|---:|---:|
| `meta_hp` Vitality | +5% max HP | 10 | 200 | 1.35 | ~36k |
| `meta_dmg` Firepower | +3% damage | 10 | 250 | 1.40 | ~58k |
| `meta_atkspd` Reflexes | +2% attack speed (CDR) | 8 | 300 | 1.40 | ~45k |
| `meta_movespd` Agility | +2% move speed | 6 | 250 | 1.40 | ~14k |
| `meta_pickup` Magnetism | +8% pickup range | 6 | 200 | 1.35 | ~7k |
| `meta_xp` Insight | +4% XP gain | 6 | 300 | 1.40 | ~17k |
| `meta_scrap` Salvager | +5% Scrap gain | 8 | 250 | 1.35 | ~16k |
| `meta_armor` Plating | +2% damage reduction | 8 | 350 | 1.45 | ~70k |
| `meta_revive` Second Wind | +1 free revive (in-run) | 2 | 5000 | 3.0 | 20k |
| `meta_startlvl` Head Start | starting weapon begins at Lv+1 | 4 | 2000 | 2.2 | ~38k |
| `meta_reroll` Strategist | +1 reroll/run | 3 | 1500 | 2.0 | ~10.5k |
| `meta_banish` Purge | +1 banish/run | 2 | 2000 | 2.5 | 7k |
| `meta_crit` Precision | +2% crit chance | 6 | 400 | 1.45 | ~24k |

Effect application: all `meta_*` bonuses are summed into the player's run-start stat block (additive percentages within a category, multiplicative across categories with in-run augments). Example: `effectiveMaxHP = baseHP * (1 + metaHpPct + operatorHpPct) * (1 + fitnessPlanPct)`.

Design intent: full tree ≈ **380k–400k Scrap**, ~30–50 runs of steady play — long enough to sustain retention, short enough to feel rewarding. Tune `growth` if your run economy differs.

### 5.3 Operator (character) roster

Each Operator has a distinct starting weapon, a unique passive, and base-stat tweaks. Starter is free.

```ts
interface OperatorDef {
  id; name;
  unlockScrap:number|null;   // shard/scrap path (null = not buyable w/ scrap)
  unlockCores:number|null;   // instant hard-currency path
  startWeaponId:string;
  uniquePassive:{ desc:string; apply:(stats)=>void };
  baseStatMods:{ hp?:number; dmg?:number; spd?:number; ... }; // multipliers
}
```

| Operator | Start weapon | Unique passive | Base mods | Unlock |
|---|---|---|---|---|
| **Recruit** (default) | Shuriken Volley | +3% all stats | — | Free |
| **Vanguard** | Bulwark Field | +15% max HP, -5% move spd | hp×1.15 | 30k Scrap or 800 Cores |
| **Striker** | Drill Bolt | +12% damage, +1 starting reroll | dmg×1.12 | 50k Scrap or 1200 Cores |
| **Scout** | Boomerang Disc | +60% base pickup range, +8% move spd | spd×1.08 | 40k Scrap or 1000 Cores |
| **Pyro** | Firebomb | +20% AoE size, burn dmg +25% | — | 70k Scrap or 1500 Cores |
| **Tempest** | Arc Coil | Chain lightning +1 target; +10% CDR | — | 100k Scrap or 2000 Cores |
| **Nyx** (premium) | Void Orb | +15% crit, +15% crit dmg; starts with Ninja Codex Lv1 | — | Cores only: 3000 |

Operators are unlockable via either path (Scrap grind OR Cores skip). The premium Operator (Nyx) is Cores-only as a soft monetization anchor — but is **not** strictly stronger, only a different playstyle, to stay ethical.

---

## 6. Save Format & Persistence

Use **Capacitor Preferences** on device (key/value, survives app updates) with a **localStorage** fallback for web/dev. Single JSON blob under key `save_v1`. Write debounced (≤1 write/2 s) and always on `pause`/`resume`/run-end. Keep a `version` field for migrations.

### 6.1 What to persist (and what NOT)

Persist: currencies, owned/unlocked permanent state, settings, stats, daily/monetization timers.
Do **NOT** persist transient in-run state (current weapons, HP, position, XP) — runs are not resumable mid-fight (Survivor.io behavior). Optionally persist a single "run-in-progress snapshot" only if you want crash-resume; keep it separate (`run_resume_v1`) and clear on run end.

### 6.2 Save schema shape

```jsonc
{
  "version": 1,
  "createdAt": 1717632000000,
  "updatedAt": 1717632000000,
  "currencies": {
    "scrap": 12450,
    "cores": 360,
    "powerCells": 5,           // current energy
    "powerCellsMax": 6,
    "powerCellsLastRegenTs": 1717632000000
  },
  "metaUpgrades": {            // id -> rank owned (0 = none)
    "meta_hp": 4, "meta_dmg": 3, "meta_atkspd": 0, "meta_movespd": 1,
    "meta_pickup": 2, "meta_xp": 1, "meta_scrap": 3, "meta_armor": 0,
    "meta_revive": 0, "meta_startlvl": 1, "meta_reroll": 1,
    "meta_banish": 0, "meta_crit": 0
  },
  "operators": {
    "unlocked": ["recruit", "scout"],
    "selected": "scout"
  },
  "cosmetics": {
    "owned": ["skin_recruit_default", "trail_neon"],
    "equipped": { "skin": "skin_recruit_default", "trail": "trail_neon" }
  },
  "progress": {
    "highestStageCleared": 3,
    "stagesUnlocked": 4,
    "firstClearRewardsClaimed": ["stage1", "stage2", "stage3"]
  },
  "stats": {                   // lifetime, for achievements/UI
    "totalRuns": 28,
    "totalKills": 154200,
    "totalScrapEarned": 410500,
    "bestSurvivalTimeSec": 902,
    "bestLevelReached": 57,
    "bossesKilled": 14
  },
  "monetization": {
    "removeAds": false,
    "battlePassTier": 0,
    "battlePassPremium": false,
    "dailyAdGoldUsed": 0,        // resets daily
    "dailyAdGoldCap": 5,
    "lastDailyResetTs": 1717632000000,
    "doubleGoldOwned": false     // permanent IAP
  },
  "settings": {
    "sfxVol": 0.8, "musicVol": 0.6, "haptics": true,
    "joystickSide": "left", "damageNumbers": true,
    "autoAim": true, "lowFxMode": false
  }
}
```

### 6.3 Persistence API contract

```ts
SaveManager.load(): Promise<Save>      // returns defaults if absent; runs migrations
SaveManager.save(): Promise<void>      // debounced flush of in-memory Save
SaveManager.patch(partial): void       // shallow-merge + mark dirty
SaveManager.migrate(raw): Save         // version-by-version upgrade chain
SaveManager.reset(): Promise<void>     // wipe (settings → defaults)
```

- Migrations: switch on `raw.version`, apply transforms cumulatively, set to current `version`. Never throw on unknown keys (forward-compat).
- Integrity: validate currency fields are finite non-negative ints on load; clamp/repair corrupt values rather than crash. Optionally store a lightweight checksum to detect tampering for leaderboards (don't hard-block offline play).
- Power Cells regen computed lazily on load: `regen = floor((now - lastRegenTs)/REGEN_MS)`; add up to max; advance `lastRegenTs`. `REGEN_MS = 6 min`.

---

## 7. Monetization Hooks (optional, ethical, F2P or paid)

Designed so the game can ship as **paid (all hooks off)** or **F2P (hooks on)** via a single config flag. None are pay-to-win gates on content; all are convenience/cosmetic/optional accelerators.

| Hook | Mechanic | Ethical guardrail |
|---|---|---|
| **Remove Ads / Premium ($)** | One-time IAP; disables all ad prompts, grants Double Gold permanently. Natural "paid version" bundle. | Pure convenience; no power locked behind it. |
| **Cosmetics (Cores/$)** | Operator skins, projectile colors, XP-shard/trail VFX, death effects. Programmatic palettes/glow swaps — cheap to make. | Zero stat impact. The main F2P revenue. |
| **Revive (Cores or ad)** | On death, offer revive: first revive watch-ad-or-pay 100 Cores; cost doubles per revive in a run (100→200→400). Free `meta_revive` revives consumed first. | Capped per run (max 3 paid). Run still ends if declined — no nagging. |
| **Double Gold (ad or IAP)** | End-of-run "watch ad to 2× Scrap" button, or permanent IAP. | Optional, end-of-run only, not interruptive. |
| **Reroll/Banish buy (Cores)** | After free rerolls spent, buy a reroll for 30 Cores in level-up screen. | Free rerolls (2+) always available first. |
| **Energy / Power Cells (F2P only)** | Each run costs 1 Power Cell; regen 1 per 6 min, max 6. Refill 6 for 60 Cores or 1 ad. | **Disabled entirely in paid build.** In F2P, generous cap + ad refills keep it non-coercive. Boss/event runs can be free. |
| **Battle Pass (seasonal, $)** | Free + Premium track; rewards Scrap, Cores, cosmetics, an Operator skin. XP from playing runs. | All gameplay rewards also reachable F2P on free track (slower). |
| **Daily ad gold** | Watch up to 5 ads/day for Scrap bundles (`dailyAdGoldCap`). | Hard daily cap; fully optional. |

Config flag:
```ts
const MONETIZATION = {
  mode: "f2p",            // "paid" disables: energy, ads; grants doubleGold
  energyEnabled: true,
  adsEnabled: true,
  reviveBaseCost: 100, reviveMaxPerRun: 3,
  rerollBuyCost: 30,
  dailyAdGoldCap: 5, dailyAdGoldReward: 300
};
```

---

## 8. Tuning Constants Summary (single source of truth)

```ts
export const PROGRESSION = {
  XP_SHARD: { minor: 1, major: 5, super: 20 },
  XP_CURVE: { earlyBase:5, earlyStep:6, midBreak:20, midBase:119, midStep:13,
              lateBreak:40, lateBase:379, lateStep:22 },
  MAGNET: { baseRadiusPx:70, hardCollectPx:28, snapMaxV:900, snapMinV:120, snapTimeS:0.25, maxMagnetized:400 },
  CHOICES: { defaultCards:3, wideCards:4, baseRerolls:2, baseBanish:1 },
  WEIGHTS: { evolve:1000, upWeapon:60, upWeaponPerLvl:10, upAugment:40,
             newWeapon:35, newAugment:30, earlyBreadthMult:1.5 },
  FALLBACK: { scrapAmt:50, healPct:0.30, surgePct:0.03,
              w_scrap:50, w_heal:35, w_surge:15, lowHpHealWeight:60 },
  LIMITS: { maxWeapons:6, maxAugments:6, weaponMaxLevel:5, augmentMaxLevel:5 },
  PICKUPS: { scrapChance:0.12, hpChance:0.02, hpHealPct:0.25, hpHealMin:40,
             magnetEverySec:90, bombEverySec:120,
             bombFlat:9999, bombBossPct:0.05 },
  CHEST: { wooden:{c1:0.70,c3:0.25,c5:0.05}, golden:{c1:0,c3:0.40,c5:0.60} },
  META_COST: { /* see §5.2 table: base, growth, ranks per id */ },
  ENERGY: { regenMs: 6*60*1000, max:6, runCost:1, refillCores:60 },
  RUN_SCRAP: { surviveBonus:1.0, bossClearBonus:1.5 }
};
```

---

## 9. Edge Cases Checklist (for the implementer)

1. **Queued level-ups**: a 5-skill golden chest while already mid-level-up → push all to queue, resolve FIFO, never lose one.
2. **Pool exhaustion**: all maxed → always pad to N cards with fallback; never show empty screen or auto-skip.
3. **Evolve + slot full**: evolution replaces in-slot, does not require a free weapon slot.
4. **Banish below threshold**: if banishing makes real pool < N, fill remainder with fallback, keep Reroll greyed if no new combos exist.
5. **Double-counting Scrap**: in-run "Scrap Cache" fallback adds to `collectedScrap` BEFORE the run-end multiplier so meta/double-gold apply uniformly.
6. **XP overflow on huge pickups**: loop level-ups, carry remainder XP into next level; clamp to avoid integer overflow on absurd values.
7. **Save corruption**: clamp/repair on load; never hard-crash; keep prior valid save as `save_v1_bak` and roll back if parse fails.
8. **Energy regen across clock changes**: cap regen delta to `max` cells; ignore negative deltas (system clock moved backward).
9. **Revive cost escalation**: track `revivesUsedThisRun`; cost = `reviveBaseCost * 2^revivesUsedThisRun`; free meta revives consumed first and don't increment the paid counter.
10. **Operator selection**: persist selected operator; if a selected operator is somehow not in `unlocked` (save edit), fall back to `recruit`.

---

Sources:
- [Skills | SurvivorIO Wiki (Fandom)](https://survivorio.fandom.com/wiki/Skills)
- [Weapon Skill Evolution Guide | SurvivorIO Wiki (Fandom)](https://survivorio.fandom.com/wiki/Weapon_Skill_Evolution_Guide)
- [Characters | SurvivorIO Wiki (Fandom)](https://survivorio.fandom.com/wiki/Characters)
- [Survivor.io Skills Guide | One Chilled Gamer](https://onechilledgamer.com/survivor-io-skill-guide/)
- [Survivor.io Skills and Evolution Guide | BlueStacks](https://www.bluestacks.com/blog/game-guides/survivor-io/sio-skills-evolution-guide-en.html)
- [Survivor.io Skills Guide | MrGuider](https://www.mrguider.org/articles/survivor-io-skills-guide/)
- [Best Characters Guide | WriterParty](https://writerparty.com/party/survivor-io-best-characters-guide-unlock-all-heroes-and-character-shards/)