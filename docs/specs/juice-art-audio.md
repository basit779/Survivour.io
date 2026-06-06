I have enough authentic grounding on Survivor.io (top-down neon arena, weapons like Lightchaser/Shotgun→Gatling, urban-night setting, zombie hordes, boss "Hela", green XP gems, glowing energy attacks). I have deep knowledge of the canvas/WebAudio/juice domain. Let me produce the implementation-ready spec directly.

# Subsystem Spec — Game Feel "Juice", Programmatic Art Direction & Synthesized Audio

> Target: 60fps Canvas2D on mid-range phones (e.g. Snapdragon 6-series, iPhone SE-class). Game working title in code: **"NEON SURVIVOR"** (Survivor.io-style, trademark-safe). All art is drawn at runtime; zero image assets. All audio is synthesized via WebAudio; zero audio files.

---

## 0. Global Rendering Setup & Conventions

### 0.1 Canvas / DPR strategy
```ts
// One main canvas. Cap DPR at 2 for perf on phones.
const DPR = Math.min(window.devicePixelRatio || 1, 2);
canvas.width  = Math.round(cssW * DPR);
canvas.height = Math.round(cssH * DPR);
canvas.style.width  = cssW + 'px';
canvas.style.height = cssH + 'px';
ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // work in CSS px everywhere else
ctx.imageSmoothingEnabled = true;       // we draw smooth shapes, not pixels
```

- **World units = CSS px.** Camera is centered on player.
- **Design reference resolution:** 390 × 844 (logical). Scale UI by `min(w/390, h/844)` clamped to `[0.85, 1.4]` → call this `uiScale`.
- **Fixed timestep for logic** at 60Hz (`dt = 1/60`), variable render. Pass an interpolation alpha to draw. All juice timers below are in **seconds** unless stated.

### 0.2 Two-pass additive rendering (the key to "premium without sprites")
Render in layers; glow layer uses additive blending so overlapping lights bloom.

```
Pass 1 (source-over):  background grid + biome tint + vignette base
Pass 2 (source-over):  ground decals, XP-gem shadows, enemy bodies, player body
Pass 3 (lighter):      ALL glow/neon strokes, projectiles, gem cores, particles (spark/explosion)
Pass 4 (source-over):  damage numbers, smoke particles, HUD-world elements
Pass 5 (DOM overlay):  HUD, level-up cards, pause, game-over (CSS, see §4)
```
- `ctx.globalCompositeOperation = 'lighter'` is the additive mode. Set it ONCE per pass, not per entity (state changes are the #1 Canvas2D cost).
- **Cheap "bloom" without blur filters:** draw each glowing element twice in the additive pass — a wide, low-alpha radial-gradient "halo" then a bright thin core. `ctx.filter='blur()'` and `shadowBlur` are too slow per-entity on mobile at scale; reserve `shadowBlur` for ≤ the player + boss only.

### 0.3 Performance budget (per frame @ 60fps = 16.6ms)
| Bucket | Budget | Notes |
|---|---|---|
| Logic/physics/spawns | 4.0 ms | |
| Background | 1.0 ms | grid is cached to offscreen canvas, blitted with offset |
| Entities (≤300 enemies) | 5.5 ms | flat-shaded bodies, halos only when on-screen |
| Particles (≤600 live) | 2.0 ms | pooled, additive, no per-particle gradients (use 1 cached sprite) |
| Glow/projectiles | 1.5 ms | |
| HUD/DOM | 1.0 ms | DOM updates throttled (see §4.1) |
| Slack | 1.6 ms | |

Hard caps that auto-engage under load (see §3.5): enemy halos off > 200 enemies; particle spawn rate ×0.5 if frame > 22ms for 10 frames.

---

## 1. Visual Identity

### 1.1 Master palette (hex)
Neon-on-dark "urban night / cyber-arena," matching Survivor.io's glowing-energy-vs-zombie-horde mood.

**Backgrounds / neutrals**
| Token | Hex | Use |
|---|---|---|
| `bg.void` | `#070A12` | deepest background |
| `bg.deep` | `#0B1020` | base fill |
| `bg.panel` | `#10162B` | HUD panels |
| `grid.line` | `#1B2A4A` | parallax grid lines |
| `grid.glow` | `#2A4D8F` | grid intersection dots (additive) |
| `ink` | `#E8F0FF` | primary text |
| `ink.dim` | `#8FA3C8` | secondary text |

**Player / friendly energy (cyan-electric)**
| Token | Hex |
|---|---|
| `hero.core` | `#EAFBFF` |
| `hero.mid` | `#3FE0FF` |
| `hero.glow` | `#14B5FF` |
| `hero.rim` | `#0A6CFF` |

**Projectiles / weapons (warm-electric + per-weapon hue)**
| Token | Hex |
|---|---|
| `proj.core` | `#FFFFFF` |
| `proj.hot` | `#FFE36B` (bullets) |
| `proj.plasma` | `#FF4FD8` (energy/plasma) |
| `proj.laser` | `#5BFF8F` (beams) |

**Enemies (horde) — bodies are desaturated/dark, rim-lit in toxic hues so the player's neon always reads against them**
| Token | Hex | Enemy class |
|---|---|---|
| `foe.body` | `#243042` | base zombie body fill |
| `foe.body.dark` | `#171F2E` | shaded underside |
| `foe.rim.toxic` | `#7CFF5B` | normal zombie rim |
| `foe.rim.acid` | `#B6FF3C` | fast runner |
| `foe.rim.brute` | `#FF7A3C` | tank/brute |
| `foe.rim.ranged` | `#C46BFF` | spitter/ranged |
| `boss.core` | `#FF2E63` | boss aura |
| `boss.rim` | `#FF7AA8` | boss rim |

**Pickups / FX**
| Token | Hex | Use |
|---|---|---|
| `gem.xp` | `#39FF88` | XP gem (green, like SIO) |
| `gem.xp.big` | `#00E0FF` | large XP gem |
| `gold` | `#FFC23C` | coins |
| `heal` | `#FF4D6D` | health pickup |
| `magnet` | `#7AB8FF` | magnet pickup |
| `crit` | `#FFD23C` | crit damage number |
| `dmg` | `#FFFFFF` | normal damage number |
| `heal.num` | `#5BFF9D` | heal number |
| `vignette.danger` | `#FF1133` | low-HP vignette |

> Color discipline rule: **friendlies = cyan/cool, threats = warm/toxic, rewards = green/gold.** A player should identify danger vs reward purely by hue at a glance.

### 1.2 Background (cached grid + parallax + biome tint)

**Grid (Tron-style) — cached to an offscreen tile, scrolled:**
- Cell size `64px`. Draw onto an offscreen canvas of size `(64*ceil(w/64)+64) × (64*ceil(h/64)+64)`.
- Lines: `strokeStyle=grid.line`, `lineWidth=1`, faint. Every 4th line `lineWidth=1.5` color `#22386A`.
- Intersection glow dots: `2px` radius `grid.glow` at additive, alpha `0.5`, only on every 4th×4th node (keeps count low).
- **Parallax:** background scrolls at `0.92×` camera (near-static, slight depth). Blit cached tile at offset `(-(camX*0.92) mod 64, -(camY*0.92) mod 64)`.

**Starfield (far layer, behind grid):** 60 static points generated once into the grid cache or a separate cache; twinkle by modulating alpha `0.3 + 0.2*sin(t*2 + i)`. Parallax `0.5×`. Keep ≤ 80 points.

**Biome tint (per stage):** full-screen radial vignette overlay, `source-over`, very low alpha (`0.10–0.18`), recolored per stage to sell different chapters:
| Stage | Tint center→edge | Mood |
|---|---|---|
| 1 City Night | `#0B1530` → `#05080F` | default blue |
| 2 Toxic Sewers | `#0C2018` → `#04100A` | green |
| 3 Crimson Lab | `#220A18` → `#0A0306` | red |
| 4 Server Core | `#0A1A22` → `#050C10` | cyan |

Edge vignette (always on): radial gradient, transparent at `0.55×radius`, to `rgba(0,0,0,0.55)` at corners. Drawn in Pass 1.

### 1.3 Draw recipes per entity

All recipes give: shape, colors, sizes, and the additive halo. `r` = entity radius (collision radius); visual extends slightly beyond.

---

#### Player (hero)
Collision `r = 14`. A glowing diamond/orb core with a directional "thruster" and an outer ring.

```
Pass 2 (body):
  - Drop shadow ellipse on ground: fill rgba(0,0,0,0.35), ellipse cx,cy+r*0.9, rx=r*0.9, ry=r*0.45
  - Body orb: radial gradient (cx,cy, 0 → r):
       0.0  hero.core
       0.45 hero.mid
       1.0  hero.glow
    fill circle r.
Pass 3 (additive glow):
  - Halo: radial gradient (cx,cy, 0 → r*2.6): hero.glow@0.55 → transparent. fill circle r*2.6.
  - Rim ring: stroke circle r*1.05, lineWidth 2, hero.core@0.9.
  - Facing dart: small triangle pointing toward aim/move dir, length r*1.4, fill hero.core, additive.
  - (player only) shadowBlur=12, shadowColor=hero.glow on the rim ring for a soft bloom.
```
- **Idle pulse:** scale body by `1 + 0.04*sin(t*5)`.
- **Move lean:** squash toward velocity: scaleX/scaleY by ±4% along movement axis.

---

#### Enemy — Normal Zombie (Walker)
Collision `r = 12`. Dark lumpy body, toxic rim light, subtle wobble walk.

```
Pass 2:
  - Shadow ellipse (as player, smaller).
  - Body: radial gradient (offset up-left for fake top light) (cx-3,cy-3, 0 → r*1.15):
       foe.body → foe.body.dark.  fill a slightly squashed circle (ry = r*0.92).
  - Two eye dots: 2px, color foe.rim.toxic, additive-ish (just bright fill).
Pass 3:
  - Rim arc: stroke the lower-right 60% of the circle, lineWidth 2.5, foe.rim.<class>@0.85.
    (Rim-only, not full ring → reads as a 3D lit edge, cheap.)
  - Faint halo ONLY if within camera + (enemyCount < 200): radial r*1.8, rim color @0.18.
```
- **Walk wobble:** `angle = sin(t*9 + phase)*0.12`; rotate body; vertical bob `sin(t*9+phase)*1.5px`.
- Class variants change rim color + size:
  - **Runner (fast):** `r=9`, rim `acid`, body stretched along velocity (scaleX 1.15).
  - **Brute (tank):** `r=22`, rim `brute`, 3px rim, slower wobble, add 4 small spikes (short triangles around perimeter).
  - **Spitter (ranged):** `r=13`, rim `ranged`, a pulsing `purple` core dot that brightens before firing (telegraph: dot alpha ramps 0→1 over 0.4s pre-shot).

---

#### Boss
Collision `r = 48`. Large, layered, animated aura; the only enemy allowed full `shadowBlur`.
```
Pass 2:
  - Big soft shadow.
  - Body: 2-layer. Outer "armor" polygon (8 sides) fill foe.body.dark with boss.rim stroke 3px.
    Inner core orb radial: boss.core → #3A0A18.
Pass 3:
  - Pulsing aura: radial r*1.6→r*2.4 (animated), boss.core@0.4 → transparent.
  - Rotating energy ring: dashed stroke circle r*1.25, lineWidth 3, boss.rim, rotate t*1.2.
  - shadowBlur=24 shadowColor=boss.core on core.
  - Boss HP bar pinned to top of screen (DOM, §4.2).
```

---

#### Projectiles
Drawn entirely in additive Pass 3. Core + halo + optional motion trail.

| Type | Shape | Core color | Halo | Trail |
|---|---|---|---|---|
| Bullet | filled circle r=4 | `proj.core` | `proj.hot` radial r=10 @0.6 | 3 fading ghost circles along velocity, alpha 0.4/0.25/0.12 |
| Plasma orb | circle r=7 | `proj.core` | `proj.plasma` radial r=18 @0.7 | wobble + 4 spark trail particles/sec |
| Laser beam | rounded rect (capsule) along dir, width 6 | `proj.core` | `proj.laser` outer capsule width 16 @0.5 | none (instant), fade alpha over 0.12s |
| Energy wave (Lightchaser-style) | arc/crescent stroke, lineWidth 5 | `proj.core` | `hero.glow` lineWidth 14 @0.4 | expands radius, alpha fades with distance |
| Boomerang/blade | rotating rounded triangle | `proj.laser` | radial @0.5 | rotation `t*20` |

Recipe (bullet):
```
additive:
  halo: radial(x,y,0→10) proj.hot@0.6 → transparent
  core: fill circle r=4 proj.core
  trail: for k in 1..3: circle at (x - vx*0.012*k, y - vy*0.012*k), r=4-k, alpha 0.4*(1-k/4)
```

---

#### XP Gem
Collision/pickup base `r=6`. Faceted green crystal with vacuum animation (§2.9).
```
Pass 2: tiny ground shadow.
Pass 3 (additive):
  - Halo: radial r=14, gem.xp@0.5 → transparent.
  - Crystal: draw a 4-point diamond (poly) fill gem.xp, with a brighter top-half (lighten) and white specular dot (2px, #FFFFFF) upper-left.
  - Bob: y += sin(t*3 + phase)*2.
  - Spin shimmer: scaleX = 0.7 + 0.3*abs(sin(t*4+phase)) (fakes rotation).
```
- **Large gem (10× value):** color `gem.xp.big`, r=10, slow rotating ring around it.
- **Coins (gold):** flat ellipse, `gold` gradient, shimmer sweep (a moving white highlight band) every 1.2s.
- **Health pickup:** plus-sign (`heal`) inside a soft red orb halo, gentle pulse `1±0.08`.
- **Magnet pickup:** ring/horseshoe shape in `magnet`, with 2 orbiting dots.

---

## 2. Juice System

Central tunable object `JUICE` (single source of truth — expose in a debug menu so designers tune live).

### 2.1 Screen shake — trauma model (Squirrel Eiserloh style)
Use **trauma** (decays) → shake = `trauma²` for natural feel.

```ts
trauma:  0..1, clamp.
decay:   trauma -= TRAUMA_DECAY * dt;      // TRAUMA_DECAY = 1.6 (≈0.6s to drain a full hit)
shakeAmt = trauma*trauma;
maxOffset   = 18 px  * uiScale;
maxRotation = 0.05 rad;
// per-frame, sampled from smooth noise (use 3 perlin/lerp-noise channels, freq 22Hz)
offsetX = maxOffset   * shakeAmt * noise(seedX, t*22);
offsetY = maxOffset   * shakeAmt * noise(seedY, t*22);
rot     = maxRotation * shakeAmt * noise(seedR, t*22);
// apply to camera transform before drawing world (NOT to HUD)
```
**Trauma added per event (additive, clamped):**
| Event | +trauma |
|---|---|
| Player fires (light) | 0 (no shake on normal fire) |
| Enemy hit by player | 0.0 (use hit-flash only; shaking on every hit = nausea) |
| Enemy killed (normal) | 0.04 |
| Brute killed | 0.18 |
| Explosion (AoE weapon) | 0.10 + 0.02·log2(enemiesHit+1), cap 0.35 |
| Player takes damage | 0.25 (scaled by dmg/maxHP, min 0.12) |
| Player low-HP heartbeat | adds 0.05 pulse every 1.0s while < 25% HP |
| Boss spawn | 0.5 |
| Boss death | 0.8 + freeze-frame |
| Level-up | 0.12 |

Add a small constant **idle hum** of `trauma=0` (none) — only event-driven. Noise prevents the cheap "violent jitter" look; use value-noise, not `Math.random()` (random = harsh, noise = cinematic).

### 2.2 Hit flash (enemy)
On taking damage, tint enemy white for a few frames.
```
hitFlash timer = 0.08s. While active:
  draw body normally, then overlay same shape filled with rgba(255,255,255, 0.85 * (timer/0.08))
  using 'lighter' (additive white = blowout flash).
Brutes/bosses: flash duration 0.06s, alpha 0.6 (so big enemies don't strobe).
```

### 2.3 Knockback
On hit, push enemy away from damage source.
```
knockback impulse = KB_BASE / sqrt(enemyMass)
  KB_BASE (normal weapon) = 90 px/s impulse
  applied as velocity add along (enemy - source) normalized
mass: walker 1, runner 0.6, brute 6 (barely moves), boss 40 (immune; use 0)
decay: knockVel *= 0.86 each frame (≈ stops in ~0.25s), separate from AI move vel.
Explosions: radial knockback = KB_EXPLOSION (220) * (1 - dist/radius), falloff linear.
```
- Edge case: clamp so knockback can't shove enemies through the player or off-arena; cap displacement per frame to `6px`.

### 2.4 Squash & stretch
| Entity | Trigger | Effect | Duration |
|---|---|---|---|
| Player | start move | stretch 8% toward dir | ease over 0.12s |
| Player | dash/ability | stretch 18% | 0.1s then overshoot back |
| Enemy | spawn | scale 0→1.15→1 (pop-in) | 0.18s elastic |
| Enemy | death | scale 1→1.3 then →0 + fade | 0.12s |
| Gem | pickup start | quick scale 1.4 then shrink into player | §2.9 |
| Damage number | spawn | scale 0.5→1.2→1 | 0.14s |

Use easing: pop-in `easeOutBack` (overshoot k=1.7), death `easeInQuad`.

### 2.5 Damage numbers
Pooled DOM-free canvas text in Pass 4.
```
Normal: text = floor(dmg), font = `${14*uiScale}px` bold "Arial Black"/system, color dmg(#FFF),
        stroke rgba(0,0,0,0.6) lineWidth 3 (outline for readability over neon).
Spawn pos: enemy top ± random(±6px). Each kill stacks +12px up if same enemy hit within 0.1s
           (prevents overlap; "combo" stacking).
Motion: rise 38px over lifetime 0.7s, easeOutCubic; xDrift random(-10..10).
Alpha:  1 for first 60%, then fade to 0.
Scale:  pop 0.5→1.2→1 over first 0.14s.

Crit: color crit(#FFD23C), font 22*uiScale, add '!' suffix, bigger pop (→1.5→1),
      stroke #7A4B00, lifetime 0.85s, rise 52px, micro-shake first 0.1s (±2px),
      +0.03 trauma. Spawn 3 yellow spark particles.

Heal: color heal.num(#5BFF9D), prefix '+'.
DoT / small ticks: 60% size, alpha 0.7, no pop (avoid clutter).
```
Cap visible numbers at ~40; if exceeded, merge same-enemy hits into one accumulating number.

### 2.6 Level-up flash
```
On level up:
  1. Full-screen additive flash: white→transparent radial from player, peak alpha 0.5, fade 0.25s.
  2. Expanding ring from player: stroke hero.glow, radius 0→260px over 0.4s, lineWidth 6→0, alpha fade.
  3. trauma += 0.12.
  4. Time freeze ramp: game timeScale 1→0 over 0.15s (smooth), then open level-up cards (§4.3).
  5. SFX: levelup chime (§5).
  6. "LEVEL UP" text rises and fades behind the cards.
```

### 2.7 Kill particles / explosions
- **Normal kill:** 6–8 spark particles (rim color) + 1 expanding shock ring (r 0→24, 0.2s) + small smoke puff (2 particles).
- **Brute kill:** 18 sparks + 2 shock rings + 6 debris (small dark triangles, gravity) + 0.18 trauma + freeze-frame 60ms.
- **AoE explosion:** 
  ```
  flash sprite (cached radial) scale 0→1.4 over 0.18s, additive, color proj.hot.
  ring: r 0→radius over 0.22s, lineWidth 8→0.
  sparks: 16, speed 120–340, rim/hot colors, gravity 0.
  smoke: 5 particles, slow, rise, fade 0.6s.
  ```
- **Boss death:** sequence — 5 sequential explosions (staggered 80ms) across boss body, white screen flash 0.4s, freeze-frame 180ms, slow-mo timeScale→0.25 for 0.8s recovering to 1.0, big trauma 0.8, confetti of gold gems erupt.

### 2.8 Freeze-frame (hit-stop)
On heavy impacts, freeze the whole sim briefly for impact weight.
```
hitStop(ms): set timeScale=0 for `ms`, restore.  (Logic uses dt*timeScale; render continues.)
Triggers: brute death 60ms; crit on elite 40ms; big explosion (≥8 enemies) 70ms; boss death 180ms;
          player takes hit ≥25% maxHP: 90ms.
Cap: total hit-stop ≤ 120ms per 1s window (avoid sluggishness in dense fights).
```

### 2.9 XP gem vacuum animation
Two phases: idle bob → vacuum when in pickup/magnet range.
```
pickupRadius = 26 + player.magnetBonus.   (Magnet pickup or level "Vacuum" → set radius = screen).
Phase MAGNET (in range):
  accel toward player: a = lerp(280, 900, progress) px/s² ; cap speed 1200.
  As it nears (<40px), it homes (steer toward current player pos), leaving a 4-dot fading trail (gem.xp).
  Scale 1→1.4 on entering, then →0.6 right before contact.
On contact (dist<player.r):
  +XP, play pickup SFX (pitch rises with combo, §5),
  spawn 2 tiny green sparks, brief player rim pulse (rim ring alpha +0.3 for 0.1s),
  XP bar gets a quick scale-y 1.15 squash.
Mass-vacuum (level-up reward "magnet all"): all gems start MAGNET simultaneously,
  stagger arrival by distance so they "stream" in; pickup SFX rate-limited to 1 per 30ms,
  rising pitch sequence = satisfying slot-machine cascade.
```
Edge: if >150 gems on field, merge nearby gems (within 18px) into one gem of summed value (perf + cleaner vacuum).

### 2.10 Low-HP vignette
```
When HP/maxHP < 0.30:  intensity = (0.30 - ratio)/0.30  (0→1)
  Pulsing red edge vignette: radial transparent center → vignette.danger @ (0.25 + 0.25*sin(t*6)) * intensity.
  Add heartbeat SFX (§5) at 1.0s interval, rate→0.6s as ratio→0.
  At ratio<0.12: desaturate world slightly (draw a low-alpha gray overlay 0.12) + heavier pulse.
On heal above 0.30: fade vignette out over 0.4s.
On taking a hit: quick red flash (full additive red @0.25, fade 0.2s) regardless of HP.
```

---

## 3. Particle System

### 3.1 Architecture
- **Single struct-of-arrays pool**, preallocated `MAX = 1000`. No GC per frame.
```ts
class Particles {
  x=Float32Array(MAX); y=Float32Array(MAX);
  vx=Float32Array(MAX); vy=Float32Array(MAX);
  life=Float32Array(MAX); ttl=Float32Array(MAX);  // life counts down
  size=Float32Array(MAX); size0=Float32Array(MAX);
  r=Uint8Array(MAX); g=Uint8Array(MAX); b=Uint8Array(MAX);
  type=Uint8Array(MAX);    // enum
  rot=Float32Array(MAX); vrot=Float32Array(MAX);
  count=0;                 // active prefix; dead are swapped to end
}
```
- **Spawn:** if `count<MAX` append; else **overwrite oldest** (lowest life). 
- **Update:** integrate, decay life; swap-remove dead (move last active into slot).
- **Render once per type** in the additive pass. **Crucial perf rule:** do NOT create a gradient per particle. Pre-render **one** 32×32 radial-glow sprite to an offscreen canvas (white core→transparent), then `drawImage` it tinted via `globalAlpha` + a per-type composite. For tinting cheaply, pre-bake **4 tinted copies** (white, hot, toxic, plasma) and pick by type — `drawImage` of a cached sprite is ~10× faster than gradient fills on mobile.

### 3.2 Particle types & params
| Type | Sprite | Blend | Size | Life | Velocity | Gravity | Fade | Notes |
|---|---|---|---|---|---|---|---|---|
| `SPARK` | glow dot | lighter | 2–4px | 0.25–0.45s | 120–360 px/s radial | 0 | size→0, alpha linear | core combat feedback |
| `EMBER` | glow dot | lighter | 1–3px | 0.4–0.7s | 40–120 | -30 (rises) | flicker alpha | from fire/plasma |
| `SMOKE` | soft blob | source-over | 6–14px grow | 0.5–0.9s | 20–60 up | -20 | alpha 0.3→0, expand 1.6× | dark `#2A3550@0.4` |
| `EXPLOSION` | glow blob | lighter | 18→0 | 0.18s | 0 | 0 | scale+fade | one per blast, hot color |
| `SHOCKRING` | ring stroke (drawn, not sprite) | lighter | r 0→target | 0.2s | — | — | lineWidth→0 | cheap, ≤2 at once |
| `PICKUP_TRAIL` | glow dot | lighter | 3→0 | 0.2s | inherit 0.4× gem vel | 0 | fade | gem vacuum trail |
| `DEBRIS` | tiny triangle (drawn) | source-over | 3–5px | 0.5s | 80–200 | +260 | spin, fade | brute/boss chunks |
| `CONFETTI_GEM` | gem sprite | lighter | 6px | 1.2s | up then fall | +200 | — | boss reward burst |

### 3.3 Emission rules (who spawns what)
| Trigger | Type×count |
|---|---|
| Bullet impact | SPARK ×4 |
| Crit | SPARK ×6 (crit color) |
| Plasma travel | EMBER ×1 every 60ms |
| Normal kill | SPARK ×6, SMOKE ×1, SHOCKRING ×1 |
| Brute kill | SPARK ×16, DEBRIS ×6, SMOKE ×3, SHOCKRING ×2 |
| AoE explosion | EXPLOSION ×1, SPARK ×16, SMOKE ×5, SHOCKRING ×1 |
| Gem vacuum (homing) | PICKUP_TRAIL ×1 per 40ms |
| Level up | SPARK ×20 ring burst from player |
| Boss death | EXPLOSION ×5 staggered, DEBRIS ×24, CONFETTI_GEM ×30 |

### 3.4 Update math
```
p.life -= dt;
p.x += p.vx*dt; p.y += p.vy*dt;
p.vy += gravity[type]*dt;
p.vx *= drag; p.vy *= drag;   // drag 0.96 for SPARK, 0.99 smoke
p.rot += p.vrot*dt;
t01 = p.life/p.ttl;
alpha = (type==SMOKE) ? 0.4*t01 : t01;        // linear fade
size  = (type==EXPLOSION) ? size0*(1-t01)*1.4 : size0*t01;  // explosion grows, others shrink
```

### 3.5 Mobile degradation (auto)
```
if avgFrameMs(last10) > 22:  particleScale = max(0.4, particleScale-0.1)   // multiply spawn counts
if avgFrameMs(last10) < 15:  particleScale = min(1.0, particleScale+0.05)
Hard cap live SMOKE ≤ 60 (source-over fill is the priciest). SHOCKRING ≤ 4.
Below "Low FX" user setting: disable SMOKE & DEBRIS, halve SPARK, keep flashes/numbers.
```

---

## 4. UI / HUD

**Recommendation: hybrid.** 
- **World-space juice** (damage numbers, gem trails, low-HP vignette, level flash, boss aura) → **canvas** (must align with camera + additive blending).
- **All chrome** (health/XP bars, timer, counters, icons, buttons, level-up cards, pause, game-over) → **DOM/CSS overlay** absolutely-positioned above the canvas.

Why DOM for chrome: crisp text at any DPR (no canvas text blur), trivial layout with flexbox + `env(safe-area-inset-*)`, easy big touch targets, GPU-composited (cheap), and you avoid redrawing static HUD every frame on canvas. Update via direct DOM writes, **throttled** (§4.1), not React/virtual-DOM per frame.

### 4.1 DOM update discipline
- Cache element refs once. Update bars by setting `style.transform = scaleX(p)` (compositor-only, no layout) on a fixed-width fill element — **never** set `width` (triggers layout).
- Numeric labels (timer, gold, kills): update only when value changes, and at ≤ 10Hz for timer.
- Use `will-change: transform` on bar fills.

### 4.2 In-game HUD layout (390×844 reference; scale by `uiScale`, honor safe-areas)
```
TOP, full width, inside safe-area top:
  [Boss HP bar]  ← only when boss alive: thin red bar pinned top, 90% width, centered, label "ELITE".
  Row: [⏱ 12:34 timer]  (center, large mono, 28px, ink, subtle glow)
  Left of timer: [Level badge "Lv 7"] circular, hero.glow ring.
  Right: [⏸ pause button] 44×44 min touch target.

UNDER timer (center, slim): [XP BAR] full-width-ish (86%), height 8px,
  track bg.panel, fill gradient hero.glow→hero.mid, rounded.
  Tiny "next: 1200 XP" optional.

BELOW XP (center): [HEALTH BAR] width 70%, height 12px,
  track #2A1020, fill gradient #FF3B6B→#FF7A3C (red→orange), rounded, white tick segments every 25%.
  Numeric "240/300" centered, 12px, white, shadowed.

TOP-LEFT corner column (under level badge): resource chips, 28px tall pills, icon+number:
  [💰 gold]  [☠ kills]   (programmatic icons, see §4.4)

LEFT-BOTTOM (above joystick zone): WEAPON/PASSIVE TRAY:
  Horizontal row of up to 6 weapon slots + 6 passive slots, 36×36 icon tiles,
  each tile shows level pips (1–6 dots) along bottom; maxed tile gets gold border + ✦.

BOTTOM-LEFT: virtual joystick zone (owned by input subsystem; HUD just reserves it & dims that area).
BOTTOM-RIGHT: optional active-skill button(s) (big 64px circle, cooldown sweep overlay).
```
Touch targets: every interactive element ≥ **44×44 CSS px** (Apple HIG) / 48dp (Android). Joystick dead-zone respects bottom-left 40% of screen.

### 4.3 Level-up card screen (the signature SIO moment)
On level-up (after the freeze ramp §2.6):
```
Overlay: full-screen, background = backdrop-filter blur(6px) + rgba(7,10,18,0.78).
  (If blur too costly on device, fall back to solid bg.deep@0.9.)
Header: "LEVEL UP" — big, hero.glow text glow, slides down + fades in (0.2s).
Cards: 3 (sometimes 4 with luck) choices, vertical stack on phones (full-width cards),
  each card 100% width, ~96px tall, rounded 16px, bg.panel with left accent bar colored by rarity.
  Rarity colors: Common #9FB4D8, Rare #3FA9FF, Epic #C46BFF, Legendary #FFC23C (animated shimmer).
  Card content: [big icon] | [Name + "Lv 2→3"] / [short effect text] / [stat delta in green].
  Entrance: stagger cards in from right, 60ms apart, easeOutBack.
  Selected card: scale 1.06, glow pulse, others fade+slide out, then resume game (timeScale ramp 0→1 over 0.15s).
Reroll / Banish / Skip buttons row at bottom (44px tall) if those features exist.
Newly-unlocked weapon: card gets "NEW!" ribbon + extra sparkle particles (canvas behind overlay).
```
- **Selection juice:** tap → card flashes white, SFX confirm, brief 80ms freeze, then close.

### 4.4 Programmatic icons (no sprites)
Draw weapon/passive icons as small canvases (cache each to an offscreen 36×36 once) or as **CSS+SVG inline**. Recipes (geometric, neon, additive glow):
- Bullet/Gun: small circle + 3 motion dashes.
- Plasma: ringed orb.
- Laser: thin diagonal beam with end-caps.
- Energy wave: crescent arc.
- Magnet: horseshoe (two arcs + caps), `magnet` color.
- Heal/Regen: cross/plus, `heal`.
- Speed: chevron `»`.
- Armor: shield outline.
- Crit: starburst.
- Area: dashed circle.
Color each by its weapon hue; add a 1px outer glow ring. Cache them; they don't change between frames (except level pips).

### 4.5 Pause screen
Dim overlay (`rgba(7,10,18,0.7)`), centered panel: RESUME (big), RESTART, SETTINGS (SFX/Music/FX-quality/Haptics toggles), QUIT. Show current run stats. Game logic fully stopped (`timeScale=0`); particles/animation frozen.

### 4.6 Game-over / victory summary
```
Backdrop dark, slow zoom-in on panel.
Title: "YOU SURVIVED 12:34" or "DEFEATED".
Stats grid (count-up animation, 0→value over 0.8s, ticking SFX):
   Time | Level | Kills | Damage dealt | Gold earned | Best combo.
Per-weapon damage breakdown bars (horizontal, colored by weapon hue).
Rewards: gold earned banner + meta-currency.
Buttons: RETRY (primary), HOME, SHARE.
Subtle confetti/ember particles on victory; muted desaturated bg on defeat (+ slow heartbeat fade-out of music).
```

### 4.7 Haptics (Capacitor)
Map juice events to haptics for premium phone feel:
| Event | Haptic |
|---|---|
| Crit / brute kill | `impact medium` |
| Player hit | `impact heavy` |
| Level-up | `notification success` |
| Card select / button | `selection` (light) |
| Boss death | `impact heavy` ×2 |
Throttle to ≤ 1 haptic / 80ms. User toggle in settings.

---

## 5. Synthesized Audio (WebAudio)

### 5.1 Engine setup
```ts
const ac = new (window.AudioContext||webkitAudioContext)();
const master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
const sfxBus  = ac.createGain(); sfxBus.gain.value = 0.9;  sfxBus.connect(master);
const musicBus= ac.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
// Optional: a soft master compressor to glue + prevent clipping in dense fights:
const comp = ac.createDynamicsCompressor(); // threshold -18, knee 24, ratio 4, attack .003, release .25
master.disconnect(); master.connect(comp); comp.connect(ac.destination);
```
- **Unlock on first touch** (mobile autoplay policy): `ac.resume()` in the first `pointerdown`.
- **Voice limiting:** cap concurrent SFX voices at **16**; if exceeded, drop the oldest/lowest-priority. Rate-limit identical SFX (e.g., shoot) to min **30ms** apart; when many fire same frame, play one slightly louder instead of stacking (prevents harsh buildup + CPU).
- **Helper:** small ADSR gain envelope util `env(gain, t, a, d, s, sLevel, r)`.
- Pre-create one **noise buffer** (1s white noise) reused via `BufferSource` for all noisy SFX.

### 5.2 SFX recipes
Each: oscillator/noise + gain envelope (+ filter). Times in seconds. All connect to `sfxBus`.

**Shoot (bullet)** — short bright blip:
```
osc: type 'square', freq 880 → 520 (exp ramp over 0.06)
gain: A 0.001, peak 0.18, D 0.06 → 0 (no sustain)   total ~0.07s
filter: lowpass 2200, Q 1
pitch jitter: ±5% per shot for liveliness
```

**Plasma/energy shot** — wider, synthy:
```
2 osc: 'sawtooth' 330 + detuned 'sawtooth' 337 (beating)
freq slide 330→220 over 0.12
gain peak 0.16, A 0.005 D 0.12 R 0.04
filter: lowpass start 1800 → 600 (sweep), Q 6
```

**Hit (enemy takes damage)** — tiny percussive tick (very frequent → keep cheap/quiet):
```
noise burst through bandpass 1200 Q 2, gain peak 0.06, D 0.04.  +click: 'triangle' 240, 0.02s.
(Pitch up +2% per combo step, reset after 1s gap.)
```

**Explosion / AoE** — noisy boom:
```
noise source → lowpass 1200 → 200 (sweep down over 0.3), Q 1
gain: A 0.002 peak 0.5 D 0.30 R 0.1
sub thump: 'sine' 90 → 45 over 0.18, gain peak 0.35
slight distortion: WaveShaper (mild tanh curve) for grit on big blasts.
```

**Level-up** — rising triumphant arpeggio:
```
3 'triangle' notes: C5(523) → E5(659) → G5(784), each 0.09s, 60ms apart, last sustains 0.25s
gain per note peak 0.22, soft A 0.005 D 0.12
add shimmer: 'sine' 1568 (G6) bell, 0.4s decay, gain 0.1.
reverb-ish: feed into a short FeedbackDelay (delay 0.09, feedback 0.25, wet 0.3) for sparkle.
```

**Pickup (XP gem)** — short pluck, pitch rises with combo:
```
osc 'triangle', freq = 660 * 2^(min(combo,12)/12)   // climbs up to ~1 octave
gain peak 0.14, A 0.001 D 0.07.  (rate-limited to 1/30ms in mass-vacuum → cascade)
coin/gold: brighter, two 'square' notes 988→1319, 0.05s each.
```

**Heal** — warm rising sine:
```
'sine' 440→660 over 0.2, gain peak 0.18 D 0.25.  add 'sine' 880 octave at 0.5 gain.
```

**Player hurt** — harsh down-buzz + sub:
```
'sawtooth' 220→110 over 0.15, lowpass 800, gain peak 0.3 D 0.15.
noise burst peak 0.15 D 0.08 (impact). trigger low-HP duck (see music).
```

**Boss spawn / roar** — ominous:
```
'sawtooth' cluster 55,58,82 (dissonant), slow swell A 0.4 to peak 0.4, hold 0.6, R 0.5
lowpass 600 → 1400 sweep up. add sub 'sine' 41 (low E) rumble 1.2s.
distortion + long delay (0.3, fb 0.4).
```

**Heartbeat (low HP)** — two thumps:
```
'sine' 60, two pulses 0.12s apart, each gain peak 0.4 D 0.1. interval shrinks with danger (§2.10).
```

**UI confirm / card select:** 'square' 660→990, 0.05s, peak 0.12.  
**UI tick (count-up):** 'square' 1200, 0.015s, peak 0.05.

### 5.3 Procedural music loop
Drive from `ac.currentTime`-scheduled steps (lookahead scheduler, 25ms timer, schedule 0.1s ahead). Tempo **128 BPM** (16th = 0.117s). Synthwave/arcade vibe to match neon theme.

**Layers (each its own gain into musicBus):**
```
BASS:   'sawtooth' through lowpass(700, Q4). 8-note root pattern in A minor, root 55Hz (A1).
        Pattern (per beat, scale degrees): A A E G | A A C E  (loop 8 beats).
        Each note: A 0.005 D 0.18 S 0.5 R 0.1, gain 0.5.
KICK:   'sine' 120→45 over 0.08, gain 0.9, on beats 1 & 3 (four-on-floor optional: every beat).
HAT:    noise → highpass 7000, gain 0.12, on every 8th (off-beats accented).
SNARE:  noise → bandpass 1800 + 'triangle' 180, gain 0.4, beats 2 & 4.
ARP:    'square' through lowpass sweep, plays Am pentatonic 16ths, gain 0.18, only when intensity≥0.5.
PAD:    2 'sawtooth' detuned, lowpass 900, long A/R, chord progression Am–F–C–G (1 chord/bar),
        gain 0.12, always-on bed.
```
**Adaptive intensity** (ties juice→audio):
```
intensity (0..1) from enemiesNearby & time. 
  intensity<0.33: PAD + BASS + KICK only (calm).
  0.33–0.66: + HAT + SNARE.
  >0.66:     + ARP + raise tempo feel via doubling kick + filter brightening.
Boss fight: switch BASS pattern to a tense 2-note ostinato (A, A#), +sub drone, musicBus tempo +6 BPM.
Player low-HP: musicBus lowpass 1200 (muffled) + slight pitch-down 2%, "danger" feel.
Player hit: duck musicBus.gain to 0.25 for 0.15s then ramp back (sidechain feel).
```
**Looping:** schedule a 4-bar (or 8-beat) cell; the scheduler enqueues the next cell seamlessly. No audio file; all notes are oscillator events. Keep total scheduled oscillators reasonable (reuse: create per-note, `stop()` after release; GC handles short ones — or pool a few persistent voices for PAD/BASS).

### 5.4 Settings & mixing
- User sliders: Master, Music, SFX (map 0–1 to gain via `gain = x²` for perceptual taper). Mute toggles.
- Auto-pause audio (`ac.suspend()`) on tab blur / app background (Capacitor `appStateChange`).
- Duck SFX bus −3dB while level-up card open so the chime + UI read clearly.

---

## 6. Master Tunables (single config block for the dev)

```ts
export const JUICE = {
  shake:   { decay:1.6, maxOffset:18, maxRot:0.05, freq:22 },
  trauma:  { killNormal:0.04, killBrute:0.18, explBase:0.10, explPer:0.02, explCap:0.35,
             playerHitMin:0.12, playerHitScale:1.0, levelUp:0.12, bossSpawn:0.5, bossDeath:0.8,
             crit:0.03 },
  hitFlash:{ dur:0.08, alpha:0.85, bigDur:0.06, bigAlpha:0.6 },
  knockback:{ base:90, expl:220, drag:0.86, maxStepPx:6 },
  hitStop: { brute:0.060, critElite:0.040, bigExpl:0.070, bossDeath:0.180, playerBigHit:0.090,
             windowCap:0.120 },
  dmgNum:  { life:0.7, rise:38, fontPx:14, critFontPx:22, critLife:0.85, critRise:52, maxVisible:40 },
  levelUp: { flashAlpha:0.5, ringMax:260, freezeRamp:0.15 },
  gem:     { pickupBase:26, accelMin:280, accelMax:900, speedCap:1200, mergeDist:18, maxGems:150 },
  vignette:{ threshold:0.30, pulseHz:6, criticalRatio:0.12 },
  particles:{ max:1000, smokeCap:60, ringCap:4, degradeAtMs:22, recoverAtMs:15 },
  audio:   { masterGain:0.8, sfxGain:0.9, musicGain:0.45, maxVoices:16, sfxMinGapMs:30,
             bpm:128, duckOnHit:0.25, duckMs:150 },
} as const;
```

---

## 7. Implementation Notes & Edge Cases
1. **Apply shake to camera transform only**, never to HUD (DOM) — HUD must stay rock-steady or it induces nausea.
2. **Cache everything static once:** grid tile, starfield, particle glow sprite (×4 tints), each weapon/passive icon, the explosion flash sprite, gem crystal sprite.
3. **Composite-op batching:** sort draws so all `lighter` happen contiguously (Pass 3). Switching `globalCompositeOperation` flushes GPU state — minimize switches.
4. **Damage-number flood:** in late game thousands of hits/sec — merge per-enemy and cap total; never allocate a string per frame (cache `String(n)` for small ints, or use a ring buffer of objects).
5. **Particle overdraw is the real mobile killer**, not particle count — keep sprites small and SMOKE (source-over alpha) strictly capped; sparks are additive small = cheap.
6. **timeScale** must gate all gameplay dt but NOT animation of the level-up overlay or HUD; freeze-frame is logic-only, render keeps running so the frozen frame is visible.
7. **Audio on iOS:** must `resume()` inside a user gesture; keep a silent 1-sample buffer trick if needed to fully unlock.
8. **Reduced-motion accessibility:** a setting that halves shake, disables freeze-frame & heavy flashes, and reduces vignette pulse — required for App Store accessibility and to avoid motion-sickness complaints.
9. **Color-blind:** since friend/foe is encoded by hue, also encode by shape (cool orbs vs lumpy bodies vs green diamonds) so it survives color-blindness — already satisfied by the recipes; add an optional high-contrast outline toggle.
10. **Don't shake on every enemy hit** — only on kills/explosions/player-damage; per-hit shake in a horde game is the most common "feels bad/nauseating" mistake. Use hit-flash + numbers + SFX for per-hit feedback instead.

---

Relevant grounding (real Survivor.io for authenticity): top-down neon arena, energy-style auto weapons (Lightchaser energy waves, Shotgun→Gatling), zombie hordes, green XP drops, urban-night biomes, elite/boss encounters.

Sources:
- [Survivor.io tier list / weapons - Inven Global](https://www.invenglobal.com/articles/17917/guide-survivorio-tier-list-for-best-weapons)
- [Vampire Survivors Weapons Wiki](https://vampire.survivors.wiki/w/Weapons)
- [Survivor.io App Store listing](https://apps.apple.com/us/app/survivor-io/id1528941310)