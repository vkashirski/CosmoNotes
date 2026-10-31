# Effects and mouse followers (`src/fx/`)

Open this when adding or changing a background effect or mouse follower, or the Layer / loop behind them.

**How they arrived:** 1.1.16 the engine; 1.1.18 23 more backgrounds; 1.1.19 Aquarium (gone again in 1.1.22) + a redrawn Fish; 1.1.20 four removed + a follower for every background; 1.1.21 the mouse plays with the background; 1.1.22–1.1.23 rounds of the owner's picks and tweaks (below).

**Removed at the owner's request (don't bring back unless asked):** Lorenz (`lorenz`), Shape shifter (`morph`), Contour map (`topo`, too processing-hungry), Black hole (`blackhole`, an Interstellar-style redo was too heavy), Fairy dust (`fairy`), XP orbs (`xp`), Neon tunnel (`tunnel`), Synthwave (`synthwave`), Solar system (`solar`), Aquarium (`aquarium`). Old saved choices of a removed id fall back to "same as all notes".

## The files in `src/fx/` (1.1.24; before that one 180 KB file, `src/fx.js`)

`note.html` and `list.html` load them in this order (the tests too, through `tests/fx-source.js`, which reads the list
from `note.html`). Each file is its own closed block. They share names through `window.COSMO_FX_KIT`: `kit.js` makes it,
every other part takes what it needs on its first line (`const { … } = window.COSMO_FX_KIT;`) and adds what later parts
need at its end. `engine.js` puts the finished API on `window.COSMO_FX`.

| File | What's in it |
|---|---|
| `kit.js` | colours for light / dark papers (`LIGHT`, `DARK`), shared helpers (`R`, `clamp`, `near`, `shove`, `nudge`, `bucketDots`, `bucketFade`, `strokeSegs`, `glowSprite`, `presence`…), fish drawing (`fishDraw`…), Matrix glyphs; makes the empty `EFFECTS` / `FOLLOWERS` lists |
| `effects-classic.js` | backgrounds, the first eleven: Snow, Fireworks, Stardust, Fireflies, Bubbles, Autumn leaves, Hearts, Rain, Confetti, Matrix, Rainbow |
| `effects-lab.js` | backgrounds from the Effect Lab: Plankton, Warp speed, Network, Embers, Cherry blossom, Night sky, Analog monitor, Digital ocean, Silk waves, Glass shards, Ghost ripple, Fish, Dust in light |
| `effects-magic.js` | backgrounds from the Spell Lab: Healing aura, Lightning, Cauldron, Ghost jellyfish, Fel fire |
| `followers-classic.js` | follower rules (`ALONG`, `room`) and the followers Stardust, Rainbow, Hearts, Bubbles, Fireflies, Rain (`ripples`), Fireworks, Snow (`frost`), Confetti, Autumn leaves |
| `followers-lab.js` | the followers for the Effect Lab backgrounds |
| `followers-magic.js` | the followers for the Spell Lab backgrounds, Pencil line (`pencil`, mouse-only) and Matrix |
| `engine.js` | `ORDER`, `EFFECT_IDS` / `FOLLOWER_IDS`, `resolve`, the shared loop (`PACE`), `fadeable`, the paper tint (`paperPalette`), `Layer`, `ICONS`, `PAIRS`, `window.COSMO_FX` |

**One effect:** `grep -n "^    <id>: {" src/fx/*.js` gives two hits: the background (an `effects-*` file) and its mouse
follower (a `followers-*` file). Read from that line to the next `^    [a-z]+: {` line (20–130 lines).

**Adding or changing an effect:** put it in the matching file. If it needs a helper from `kit.js`, add the name to the
`const { … }` line at the top of that file: a missing name only fails (ReferenceError) when the effect runs, so run
`npm test`, which runs every effect. A new shared helper goes in `kit.js` and in the `window.COSMO_FX_KIT = { … }` list
at its end. Add the id to `ORDER` in `engine.js` and to `FX_EFFECTS` / `FX_FOLLOWERS` in store.js. A new part file must be
added to both HTML files in the same place (`v1124.test.js` checks).

**The Layer draws once before the first step** (when an effect or follower is switched on). Anything `draw()` reads
must already have a value then: the Ghost ripple follower read `near` before `step()` set it and threw (fixed in
1.1.25). `v1125.test.js` switches every effect and follower on and draws before anything moves.

## Lab names → app ids

The owner may name an effect by its preview-page name. From the "CosmoNotes Effect Lab" (1.1.18): Bioluminescent plankton B (Breaking wave) = `plankton`; Hyperspace B (Warp jump) = `warp`; Constellation network A (Living web) = `network`; Floating embers A (Campfire) = `embers`; Cherry blossom B (Gust whirls) = `blossom`; Living night sky A (Twinkle & shooting stars) = `nightsky` (one shooting star about every 12 s); Glitch fragments B (Glitch storm) = `glitch`, now **Analog monitor** (id kept); Particle wave field A (Digital ocean) = `ocean`; Particle wave field B (Flowing silk) = `silk` (Silk waves); Prismatic shards A (Glass drift) = `shards` (Glass shards); Invisible ripple field B (Passing ghost) = `ghost` (Ghost ripple); Boids A (School of fish) = `fish` (redrawn in 1.1.19 along a bending 4-segment spine); Volumetric dust A (Light shafts) = `dust` (Dust in light). From the "Spell Lab": Healing aura `heal`, Lightning `lightning`, Cauldron `cauldron`, Ghost jellyfish `jelly`, Fel fire `fel`. Other preview pages: "Fish Picks" (1.1.19), "Black Hole Picks", "CosmoNotes 1.1.22 Picks", "Cauldron Picks" (1.1.23).

## Rules for the engine

- **Effects (1.1.16) must stay light.** The first eleven are a few dozen shapes each; the 23 added in 1.1.18 (picked by the
  owner from the "CosmoNotes Effect Lab" preview page, two versions per idea; Lorenz, Shape shifter, Contour map and Black hole were dropped again; the last five, magic ones, came from a second preview page, "Spell Lab") go up to ~150–260 dots, always with a hard
  cap (`capped(n, k, max)`), and each measured well under 1 ms a frame in Chromium.
  Heavier ideas were dropped for being too much for the engine (the owner's call in 1.1.18: Contour map, an Interstellar-style black hole, then the black hole altogether).
  1.1.19 (removed again in 1.1.22): `aquarium` (Aquarium, the owner's pick from the "Fish Picks" preview, where Koi pond, Silver shoal and Doodle fish were not picked) is added at the end of the list; `fish` keeps its flocking but each fish is now drawn along a 4-segment bending spine (tapered body, forked tail that lags a beat, side fins, sheen, eyes), still 7 fills a frame (~0.15–0.18 ms on a normal note).
  1.1.20: `fairy`, `xp`, `tunnel`, `synthwave` removed (owner's request). **Every background has a mouse follower** with
  the same id (except `frost` = snow, `ripples` = rain), name and icon; the Mouse tab = the Background tab + Pencil line.
  Followers draw a small cousin of their background where the pointer goes (0.01–0.5 ms a frame). Companions (fish,
  solar, jelly, aquarium; 1.1.22: only fish and jelly are left) use `presence()` and expose `fade()`: the Layer multiplies the follower's opacity by it, and
  they fade 2.5 s after the mouse stops so `busy()` turns false. Fish drawing is shared (`fishDraw`…; `aqKit` went with Aquarium in 1.1.22).
  **1.1.21: the mouse plays with the background.** `step(dt, t, m)`: m = `{ x, y, vx, vy, sp }` (px, px/s) while the
  switch is on (`resolve(...).interact`, settings `fxInteract`, note `fx.mi`) and the mouse is over the canvas, else
  null; every effect reacts in its own way (see `CHANGELOG-archive.md`, 1.1.21). Helpers `near`, `shove`, `nudge`. A new background
  should do something with `m` too (and must work with `m === null`).
  Draw many lines/dots in a few calls
  (`strokeSegs`, `bucketDots`; `bucketFade` when something must fade smoothly all the way to nothing: `bucketDots` always draws its faintest group at about 12 %) and don't use `Path2D`: the tests run the src/fx/ parts against a fake canvas without it. All drawn on a canvas by the effects' one shared
  loop (`requestAnimationFrame`, at most 30 frames a second). The loop stops by itself when no layer `wants()` a frame:
  paused, rolled up, off screen (list cards: `IntersectionObserver`), no effect, or only a follower and the mouse is still
  (followers report `busy()` while their trail is still fading). Don't add per-element DOM particles or CSS animations for
  these. A new effect or follower needs its id in both src/fx/ and store.js (`FX_EFFECTS` / `FX_FOLLOWERS`; a test checks). The old follower id `comet` (Rainbow line) was folded into `rainbow`: `resolve` and store `cleanFxId` map it, so saved choices keep working. The Rainbow background paints each bow solid and masks it once (no seams).
  **Opacity (1.1.17)** is a multiplier, not an extra canvas: `fadeable(ctx)` in engine.js wraps the context's `globalAlpha` so
  whatever an effect sets is multiplied by the layer's `eOp` / `fOp` (effects don't need to know). Changing it only redraws
  (`Layer.set` → `opChanged`), never remakes the effect. `resolve` returns `effectOpacity` / `followerOpacity` (`opacityOf`,
  same rule as store.js `cleanFxOpacity`).
  The note's canvas is `position: fixed; z-index: -1` (behind everything, above the paper, which is the page background).
  While a note is resized, `Layer.resize()` keeps the running effect and only makes it again 300 ms after resizing stops
  (making it on every resize event made it restart over and over). Matrix draws Windows' Japanese fonts (the film's font
  can't be shipped; used if installed), mirrored, with `mirror()`.

## Mouse followers – more rules (1.1.22)

- Followers that spawn by distance (the `ALONG` list in followers-classic.js) get a fast mouse jump in ≤10 px steps from `Layer.move`, and their particle limits drop the oldest instead of refusing new ones (`room()`), so a fast stroke stays even.
- Followers may have `leave()` (`Layer.leave` calls it): fel and embers burn while the pointer rests on the note.
- Snow flakes shatter when touched; fireflies within 70 px of the pointer drift over to it for 2–3 s, gently, and let go once it is over 110 px away, then ignore it for 4–16 s.
- Lightning: the mouse one rests 0.5 s between strikes; the background one hits the pointer about three bolts in four, while side bolts still strike elsewhere.
- Dust in light (mouse): the frequency scale moved down (`k × 0.35/2.6`): the old Rarely amount is now Often.
- Network nodes keep apart (separation, own heading, soft edges) so they no longer collapse into a clump.
- The switch is called "Mouse can interact with the background" (`fxInteract`). The Effects pop-up greys out frequency / opacity / interact with None (`.off`).

## The owner's picks that are in the app

- 1.1.22, from the "CosmoNotes 1.1.22 Picks" preview: Analog monitor follower = Phosphor pixels, Healing aura bottom = Breathing, Ghost jellyfish touch = Slingshot ghost (shine spreads from the touch; a still violet mirage of the jellyfish is left behind once when the pointer goes in, fading smoothly, never moving or following it), Digital ocean follower = Surf. The other versions and `COSMO_FX.PICK` were removed (nothing is waiting for a pick).
- 1.1.23: the Cauldron mouse effect is a soft dip that follows the pointer (pick B without the whirlpool).

## 1.1.23 changes (details also in CHANGELOG.md)

- **Speed:** Rainbow draws and blurs its bands once per rainbow (`solidBow` / `bowBox` / `maskBow`, cached picture reused once fully drawn in; never `c.filter` per frame); soft glows are stamped from cached pictures (`glowSprite`, `halo`, `soft`, `stamp`; don't add per-particle `createRadialGradient` again); the shared loop slows effects to 20 / 15 steps a second when a step averages over 11 / 18 ms (`PACE`, `COSMO_FX.loopPace()`). Benchmarks and pixel comparisons were done in headless Chromium with `--disable-gpu` (and CPU throttled 6× for a weak laptop).
- **Paper tint:** a touch of the paper's colour on effects (`paperPalette(dark, paper)` in engine.js turns coloured inks 12 % towards the paper's hue; `Layer.set({ paper })`).
- **Warp speed:** the pointer no longer steers. While it is in the centre box (24 % of the width and height, `BOX = .12`) the jump is constant hyperdrive at speed 3 (`HYPER`).
- **Analog monitor:** calm 6 px scanlines crawling at 3 px/s, and one slow soft scan line (8 s to cross, every `clamp(24 / k, 12, 75)` s, so frequency = how often it sweeps); the pointer opens a smooth gap in the lines where it is (no springs).
- **Pickers and order:** effect choices have a fixed height and "Same as all"; dust +20 %; the order changed again.
- **Order of the effects** is by theme (the owner's Option A, adjusted): `ORDER` in engine.js (builds `EFFECT_IDS` / `FOLLOWER_IDS`) and `FX_EFFECTS` / `FX_FOLLOWERS` in store.js must stay the same list; ids unchanged. (1.1.22 tweak: Rainbow after Rain; Fireworks, Confetti, Hearts after Cherry blossom, then Bubbles, Fish, Glass shards, Plankton.)
- Tests: `v1122.test.js`, `v1123.test.js`.
