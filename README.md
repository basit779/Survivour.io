# Survivor Zero

A premium-feel **mobile horde-survival roguelite** in the style of *Survivor.io* / *Vampire Survivors* — auto-attacking weapons, swarming enemies, XP level-ups, weapon evolutions, bosses, and between-run meta progression.

Built to **ship to the App Store & Google Play** from a single codebase.

- **Stack:** HTML5 + TypeScript + Canvas2D, bundled with **Vite**, wrapped natively with **Capacitor** (iOS + Android).
- **Art:** 100% programmatic (neon/arcade — gradients, glow, particles). No sprite files.
- **Audio:** 100% synthesized (WebAudio). No audio files.
- **Performance target:** locked 60 fps on mid-range phones (fixed-timestep sim, object pooling, spatial hashing, zero per-frame allocation, adaptive quality).

---

## Quick start

```bash
npm install        # install deps (Vite, TypeScript, Capacitor)
npm run dev        # dev server -> http://localhost:5173
```

Open in Chrome and toggle the **Device Toolbar** (Ctrl/Cmd+Shift+M) to emulate a phone (touch + DPR). URL params for testing: `?seed=12345` (reproducible run).

### Build

```bash
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + vite build -> dist/
npm run preview    # preview the production build
```

### Ship to app stores (Capacitor)

```bash
# one-time native project setup
npm run build
npx cap add android
npx cap add ios        # macOS + Xcode required

# each time web code changes
npm run cap:sync       # build + copy web -> native

# open native IDEs to archive/sign/upload
npm run cap:android    # Android Studio -> Generate Signed Bundle (.aab)
npm run cap:ios        # Xcode -> Archive -> App Store Connect
```

Both platforms are locked to **portrait**. `android/` and `ios/` are gitignored (regenerated from `dist/`).

---

## Project layout

```
src/
  engine/      reusable engine: loop, math, rng, pools, spatial grid, renderer, camera, audio
  input/       virtual joystick + keyboard + gamepad -> unified input state
  data/        balance constants, palette, content tables (weapons/enemies/passives/waves/...)
  game/        the game itself: scenes, world, entities, systems, UI
  save/        versioned save via Capacitor Preferences
docs/
  MASTER_PLAN.md      the synthesized build plan (85-file manifest, build order, tuning tables)
  PROGRESS.md         current status + how to resume
  specs/              the 6 detailed subsystem design specs
```

## Design docs

The mechanics were researched and specced before coding. See:

- **[docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)** — the reconciled implementation plan + tuning constants.
- **[docs/specs/](docs/specs/)** — deep specs: core mechanics, weapons, enemy AI/spawn, progression/meta, tech architecture, juice/art/audio.
- **[docs/PROGRESS.md](docs/PROGRESS.md)** — what's done and what's next.

---

## Status

🚧 **In active development.** Foundation (toolchain, engine primitives, data/type contract) is in place; gameplay systems are being built per the master plan's implementation order. See [docs/PROGRESS.md](docs/PROGRESS.md).
