# Survivor Zero — Art Bible

Grounded in the **real Survivor.io** App Store screenshots (`tools/ref/shot1-5`), viewed
directly. This is the single source of truth for the visual rebuild. The old look was
dark neon-arcade; the target is **bright chunky cartoon**.

## The 6 ingredients that make it read as Survivor.io (not a cheap clone)

1. **Thick black outline + white rim on every sprite.** This is the signature. Each
   character/zombie has a heavy near-black outline AND a white halo separating it from
   the ground. Without this, sprites melt into the background and look cheap.
2. **Chunky cartoon proportions.** Big rounded heads, small bodies, bold simple shapes,
   smooth (not pixel) edges. Cute-but-apocalyptic.
3. **Bright, color-coded enemies** on a **desaturated grey urban ground.** The ground is
   muted on purpose so the saturated sprites and VFX pop.
4. **BIG punchy AOE VFX** — large semi-transparent orange/red additive rings/explosions
   that dominate the screen. This is the #1 "juice/premium" lever.
5. **Bold UI** — dark slate rounded panels, gold ribbon banners, rarity-colored chunky
   square icons, fat outlined sans-serif text.
6. **Zoomed-out camera** so the horde + AOE read at a glance. (Already in place.)

## Palette (hex)

- Ground asphalt: base `#5b6068`, light `#6b7079`, seam/dark `#474c54`, road paint `#e6e8ee` (~40% a)
- Outside/letterbox: `#23262c`
- Outline (everywhere): `#15171c` ; Rim: `#ffffff`
- Hero: cap `#3d8de0`, jacket/navy `#2b3a5e`, skin `#f1c79b`, gun metal `#3a3f47`, gun accent `#e0503a`
- Zombies: basic green `#8bc34a`, tank ogre `#6aa84f`, runner tan `#b89b72`, spitter purple cyclops `#9c4dcc`, bomber orange `#ff7043`, slime teal `#26c6da`, elite orange-red `#e8623a`, boss green `#5e9c3f`
- XP gems: green `#7ee37a`, blue `#56b8ff`, gold `#ffcb3d`
- VFX fire: `#ff7a18` core, `#ffd24a` rim ; zap `#9fd0ff`/`#ffe066`
- UI: panel `#2b2f3a`, panel light `#3a3f4d`, panel border `#15171c`, gold banner `#ffc02e` (border `#d68f1e`), accent blue `#3d9bf0`, good-green `#7cc242`, text `#ffffff`, dim `#b8c0d0`

## Sprites

- **Hero (top-down 3/4):** round head with **blue cap + brim**, skin face, navy jacket
  shoulders, two stubby hands holding a **prominent gun pointing forward (up)**. Thick
  outline + white rim. Drawn facing up; reads fine top-down.
- **Zombies (per type, distinct silhouette + color):**
  - swarmer — hunched green humanoid, arms forward, white dot eyes
  - runner — lean tan zombie leaning forward, small
  - brute — stocky green ogre, angry brow
  - spitter — **purple cyclops slug** (one big eye, light-blue bubble spots) — matches ref
  - bomber — round orange body, dark spots, lit fuse, googly eyes
  - splitter/splitling — teal googly slime blob
  - elite_brute — bigger armored orange-red brute
  - boss_warden — **big green ogre, angry toothy mouth, small arms** — matches ref
- All baked with a `withRim()` dilation pass (white halo) + thick `#15171c` outlines.

## Ground

Grey asphalt tile (subtle seams + speckle, desaturated) + sparse **world-space white
dashed road lines** and faint expansion joints. Muted so sprites/VFX pop.

## VFX / juice

- Big additive **AOE rings** (`spawnRing`): bomber blast, boss death, aura pulse, strike
  impact — orange core → bright rim, expanding + fading.
- Hit flash (white) on enemies; hurt flash + low-HP vignette on player.
- **Damage numbers**: bold, black-outlined, white (crit = gold, bigger, pops).
- Screen shake on crits/explosions/boss (trauma already wired).

## UI

- Gold **ribbon banner** for headers ("LEVEL UP" / menu title).
- Level-up **cards**: rarity-colored header band, name, description, star-rating row,
  chunky rounded panel with drop shadow.
- HUD: top green→gold XP bar, big outlined timer, chunky HP bar, boss bar with name,
  rounded joystick.
