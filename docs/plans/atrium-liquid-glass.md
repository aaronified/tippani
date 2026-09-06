# Atrium — the glass set, built to Apple's Liquid Glass guidance

`atrium` is the eighth material set and the only one with no material. It ships as
a deliberate placeholder, and `theme.js` reserves the key for exactly this feature:

> the set this key is reserved for is a glass one, modern and lit from behind,
> which is a design of its own and not a set of four tiles. Shipping the flat
> version first gives the key a meaning people can already use … and gives the
> glass one somewhere to land without a second migration of everybody's stored
> preference.

So this is not a new set. It is what the reserved one is made of, what it costs,
and the four things that have to exist before it can.

The owner asked that it follow Apple's Liquid Glass guidance as closely as
possible. Apple's pages are client-rendered and fetch as empty HTML; the
quotations here come from the DocC JSON behind
`developer.apple.com/tutorials/data/…` for `human-interface-guidelines/materials`,
`human-interface-guidelines/color` and
`technologyoverviews/adopting-liquid-glass`.

---

## What already exists

Verified against `f3a28bb`.

| Thing | State |
| :-- | :-- |
| The `atrium` key, its four flat slots, its labels in `en.txt` and `bn.txt` | **Built.** `theme.js:135`, `en.txt:1264`, `bn.txt:1287` |
| `glassProps()` — translucent fill, 124° specular sweep, `blur(18px) saturate(1.5)`, rim border, two insets | **Built** — `theme.js:177-193` — **and it does not reach the screen.** See below |
| `--surf-<slot>-{color,image,size,blend,blur,border,inset}` written per slot | **Built** in `theme.js:480`, **consumed by `index.css` nowhere.** `grep -c "surf-" index.css` → `0` |
| Glass as a *tile*, in Office's ground and Film assembly's cover | **Built, and blurless.** Those slots render as an ordinary grayscale `overlay` tile, because `.scene-bg` reads only `--tile-ground` |
| `backdrop-filter` anywhere in the app | **Four scrims** — `.tp-scrim`, `.info-pop-scrim`, `.account-scrim`, `.drawer-scrim`, all `blur(10px) saturate(.78)` over `rgba(21,16,12,.42)` |
| FAMS — the eight material families, the light layer, the three stations | **Designed, not built.** `docs/design/handoff/material-instructions.md` and a working reference in `docs/design/prototypes/ui-glossary.dc.html`. `data-mat` appears **zero times** in `web/frontend/src` |
| Per-material physics | **Deleted, not migrated.** `--thumb-ease`/`--thumb-dur`/`--press-a`/`--press-r` are declared once on `html` with one `html .nav-toggle` override — paper's physics became everyone's. `data-mat-set` is written to `<html>` and read by no CSS rule |
| The glass tiles | **Present and measured.** `glass.webp` (448², sd 42.61, s .06 → 2.56 levels) and `glass-soft.png` (sd 6.32, capped at .12 → 0.76 levels) |
| A lit ground for glass to look through | **Partly.** `html::before` draws a fixed radial pool at z −2; `.scene-bg` the ground tile at 14% |
| Saving the preference | **Broken.** See the first thing the verification changed |
| List virtualization on the board | **None.** No windowing dependency, no `content-visibility` |

### What the verification changed

**Atrium cannot be saved today, and no test says so.**
`internal/httpapi/auth_handlers.go:262-264` declares `prefMaterialSets` with seven
entries and omits `atrium`; the gate at `:1099` rejects it with a 400 naming the
other seven. The frontend ships the set and the picker offers it, so choosing it
fires `persist({ materialSet: 'atrium' })` straight into that 400.
`grep -rn atrium --include=*.go internal` returns nothing, and `ui_test.go:36-75`
only exercises `manuscript`, `film-assembly` and the rejection of `vellum`. This
is a live defect in the shipped set, found before a line of the feature was
written, and it is step 1 below.

**The blur is on four scrims now, not one.** An earlier reading of this branch
found `backdrop-filter` only on `.tp-scrim`, whose own comment argues "One recipe,
one place." The same eleven-line recipe is now repeated at `.info-pop-scrim`,
`.account-scrim` and `.drawer-scrim`. That triples the accessibility gap below,
and the consolidation is worth doing while the glass work is in the file anyway.

**`glassProps` computes a pane and throws it away.** The blur, rim and insets are
recomputed on every theme apply and reach only the Settings specimen cards, whose
inline styles are the sole consumers of `surfaceStyle()`. `theme.js:484-487` says
why — "the surfaces move onto it one at a time" — and none has. So the prerequisite
for a glass set is not glass; it is finishing a migration that was started and
left, and finishing it fixes two shipped sets on the way.

---

## The rulings

| Question | Ruling |
| :-- | :-- |
| Where glass goes | **Apple's carve-out only** — the functional layer, plus the *clear* variant where a surface genuinely floats over rich imagery. Nothing glass on a plain library board |
| The liquid edge | **Real `feDisplacementMap`**, not a faked rim |
| Accent-bearing controls | **Stay opaque** |

The first reversed an earlier "everything, cards included" once Apple's
content-layer rule was on the table. The cost argument and the design argument
turned out to agree, which is the reason to record both.

---

## The Apple rules this is built to

**The layer rule — the one that set the scope.**
> Liquid Glass forms a distinct functional layer for controls and navigation
> elements — like tab bars and sidebars — that floats above the content layer…
>
> **Don't use Liquid Glass in the content layer.** … including it in the content
> layer can result in unnecessary complexity and a confusing visual hierarchy.
> Instead, use [standard materials] for elements in the content layer… An
> exception to this is for controls in the content layer with a transient
> interactive element…

**Restraint.**
> **Use Liquid Glass effects sparingly.** … overusing this material in multiple
> custom controls can provide a subpar user experience by distracting from that
> content. **Limit these effects to the most important functional elements.**

> Prefer to use standard spacing metrics instead of overriding them, and **avoid
> overcrowding or layering Liquid Glass elements on top of each other.**

**The two variants.**
> The **regular** variant blurs and adjusts the luminosity of background content
> to maintain legibility… Use the regular variant when background content might
> create legibility issues, or when components have a significant amount of text,
> such as alerts, sidebars, or popovers.
>
> The **clear** variant is highly translucent… Use this variant for components
> that float above media backgrounds — such as photos and videos…
>
> If the underlying content is bright, consider adding a dark dimming layer of
> **35% opacity**.

**Scale.**
> Liquid Glass appears more opaque in **larger elements like sidebars** to
> preserve legibility over complex backgrounds.

**Colour.**
> By default, Liquid Glass **has no inherent color**, and instead takes on colors
> from the content directly behind it.
>
> **Apply color sparingly** … reserve it for elements that truly benefit from
> emphasis, such as status indicators or primary actions. To emphasize primary
> actions, **apply color to the background rather than to symbols or text**…
> **Refrain from adding color to the background of multiple controls.**
>
> By default, symbols and text on these elements follow a **monochromatic** color
> scheme, becoming darker when the underlying content is light, and lighter when
> it's dark.
>
> If you define a custom color, supply light and dark variants, **and an increased
> contrast option for each variant**.

**Legibility under motion.**
> **Optimize for legibility when content scrolls beneath controls.** Scroll views
> offer a scroll edge effect that helps maintain sufficient legibility and
> contrast for controls by obscuring content that scrolls beneath them.

**Giving the glass something to look through, without real overlap.**
> A **background extension effect** … mirrors the adjacent content to give the
> impression of stretching it under the sidebar, and applies a blur to maintain
> legibility of the sidebar or inspector.

**Performance.**
> **Combine custom Liquid Glass effects to improve rendering performance.** If you
> apply these effects to custom elements, combine them using a
> `GlassEffectContainer`, which helps optimize performance…

**Accessibility.**
> people can … turn on accessibility settings that reduce transparency or motion
> in the interface. These settings can remove or modify certain effects. … Ensure
> you test your app's custom elements, colors, and animations with different
> configurations of these settings.

---

## What it costs, and where

### The server: one bug fix, and nothing else

Fixing `prefMaterialSets` is required whatever Atrium looks like. Beyond that the
server stores an opaque slug and never sees a tile, a blur or a colour.
`onetime_3_0_0_material_sets.go` needs no companion: the key's stored *meaning*
does not change, which is the argument the placeholder was shipped on.

### The client: GPU compositing, and this repo has measured this class of cost

`index.css`, on why `.grain-overlay` has no `mix-blend-mode`:

> A fixed, full-viewport element that blends with its BACKDROP forces the browser
> to read back and re-composite everything beneath it on every frame in which
> anything beneath it moves — which, for a layer pinned over a scrolling page, is
> every frame of every scroll. Two of these existed … and **the owner's report was
> ~500ms of lag on click and scroll alike**, on a page whose JavaScript does
> nothing while you scroll.

`backdrop-filter` is that same read-back plus a multi-pass blur. **The
functional-layer scope is what makes it affordable**, and it is the conclusion
Apple reaches from design rather than from cost: the expensive case was N glass
cards on a board that renders every card it has. Under the ruling the board never
enters the blur path.

| Surface | Cost | Paid for by |
| :-- | :-- | :-- |
| `.rail` (fixed, full height, the largest surface in the app) and `.topbar` | Re-blurs every frame the board scrolls behind it | Apple's **background extension effect** — mirror the adjacent strip and blur *that*, so the filter samples a static layer, not the live scroll; plus a **scroll edge effect** for legibility |
| Panels, sheets, popovers, menus | Transient — only while open | The shape the four scrims already use |
| The clear-variant carve-out | One element, static backdrop | The 35% dim layer |
| `feDisplacementMap` | Per-frame filter over the element's area | One filter, one map, referenced by every glass surface — the web analogue of `GlassEffectContainer` |

Cheap by comparison: the recipe itself. `glassProps()` is string arithmetic four
times per theme apply, and a tile costs zero bytes until a set names it — an
unresolved custom property is never fetched.

**No guard in this repo can see any of this.** `scripts/perf/README.md`: "Paint
and compositing happen off the main thread and cannot be measured from inside the
page … removing every texture, blend layer and shadow on the page changes the
frame timings not at all." `snappiness.mjs` measures timer drift against a 500ms
budget and would report green on a glass build that stutters. **Measure first.**

---

## What has to be built before the set can exist

### 1. `--surf-*` has to reach the stylesheet

This is structural, not plumbing:

- Every material currently arrives as an `isolation: isolate` + `z-index: -1`
  pseudo-element. `backdrop-filter` creates an isolated group, so those
  pseudo-elements stay **inside** it, unblurred, compositing as opaque grain over
  the blur — the "scuffed window" `theme.js` names. The tiles have to move off
  `::before` and into the `--surf-*-image` stack. `glassProps` already folds them
  that way, which is why it is the one recipe that gets this right.
- `.grain-overlay` is fixed at **z-index 60**, above every scrim and panel at 50.
  An open glass panel would blur the page and still wear an unblurred grain film
  across its own face.
- **An inline custom property on `<html>` cannot be overridden by a media query.**
  If the blur arrives only as `--surf-*-blur` written by `theme.js`, the
  accessibility block cannot switch it off. Either `index.css` spends the property
  through a rule the block can beat, or `theme.js` reads the media query itself.
  This is the single biggest structural gap, and it decides the shape of the
  migration rather than following from it.

### 2. `glassProps` needs two variants and a size term

One recipe today. Apple's *regular* (blur plus a luminosity adjustment, for
text-heavy surfaces) and *clear* (highly translucent, media backdrops only, with
the 35% dim) are different alphas and different filter stacks. And "Liquid Glass
appears more opaque in larger elements like sidebars" means one alpha per mode is
not enough — the rail sits more opaque than a chip.

### 3. FAMS, which already covers glass

The eight families, one shared rule — hover shows a soft elliptical highlight at
`gloss`, press replaces it with a dark contact patch at `dent`, release goes back —
carried by four registered custom properties painted by a single
`[data-mat]::after`. Glass is in the table at `gloss .42`, `dent .24`, `46 × 38`,
`screen` in dark and `overlay` in light, **and `blur 18→24px` on press**:

> Glass is the exception: its press happens *behind* it — a pane has no shadow to
> compress, so what gives way is the blur.

This is the same idea as Apple's "the knob transforms into Liquid Glass during
interaction", and it is the *sanctioned* content-layer exception: "controls in the
content layer with a transient interactive element … take on a Liquid Glass
appearance to emphasize its interactivity when a person activates it."

**No new animation mechanism is needed, and none should be added.** FAMS is CSS
transitions only — no Web Animations API, no rAF loop, no per-frame writes; the
hot path per pointer move is one division on a cached `getBoundingClientRect` and
one compare, and nothing is written unless the pointer crosses into another third.
Per-pixel tracking is banned by name, with the measured reason. Do not relax the
three-station quantisation to get smoother specular travel on glass: that decision
was made against a measurement, and glass is the family least in need of it.

### 4. The lens, behind a probe

Real lensing is `backdrop-filter: url(#displacement)` over an SVG
`feDisplacementMap`, which matches Apple's optical model rather than approximating
it. **Safari does not support SVG filter references in `backdrop-filter`**, so on
Apple's own browser Atrium would fall back while iOS renders the real thing
beside it. Do not trust a support table — probe:

```js
const canLens = CSS.supports('backdrop-filter', 'url(#tp-lens)')
```

with a rim fallback on `false`: a second high-blur, high-saturate inset shadow
plus a gradient border, which reads as a bright rim rather than as refraction. One
filter and one displacement map for the whole document, referenced by every glass
surface, per Apple's reasoning about combining effects.

---

## The set

```
atrium: ['flat', 'glass', 'flat', 'glass']
//        ground  shell    card    cover
```

- **ground** `flat` — the lit pool `html::before` already draws is the light
  source. Nothing composited; "the fastest surface in the app" stays true of the
  desk, which is also what the name is about.
- **shell** `glass`, **regular** variant — the rail, top bar, drawer, dock, sheet
  header and footer. Apple's functional layer, exactly.
- **card** `flat` — the content layer, per Apple. Quote cards keep the app's own
  standard material and gain a scroll edge effect under the bars.
- **cover** `glass`, **clear** variant plus the 35% dim — the carve-out: the detail
  hero and the portrait backdrop, where glass genuinely floats over rich imagery.

The four-slot signature is unique against Office (`glass/rubber/satin/metal`) and
Film assembly (`metal/brushed/matte/glass`), which `material-sets.test.jsx`
requires.

### Accents

Apple's "Liquid Glass has no inherent color, and instead takes on colors from the
content directly behind it" is the argument for the ruling: accent-bearing
controls stay opaque and glass carries the accent only as light. Three
consequences:

1. **`--on-accent` should be measured where it sits on glass.** It is chosen today
   from the accent's own luminance, which is valid only for an opaque fill. Since
   accent controls stay opaque, that calculation survives for them; what needs
   Apple's monochromatic treatment — darker over light content, lighter over dark —
   is any label sitting directly on a glass bar.
2. **`--sel-veil` breaks on a glass shell.** It reads `TEXTILES[shell][3]`
   unconditionally. Glass's `s` is `.06`, so a glass shell writes
   `--sel-veil: 94.0%` and drops raw `glass.webp` — sd 42.61, the second-loudest
   tile in the pack — into every selection fill. That is precisely the failure the
   veil was written to fix, where Bindery's suede and Quarry's sandstone put a
   light label on patches measuring **1.4:1**. Proposal: when the shell slot is
   glassy the fills take no tile at all — `--sel-veil: 100%`, the accent gradient
   plus the glass rim. Apple's "refrain from adding color to the background of
   multiple controls" points the same way.
3. **Each accent needs an increased-contrast variant**, which is what
   `prefers-contrast: more` should switch to. Four accents × two modes today; the
   third axis is new.

**Focus rings.** A hairline on a blurred translucent edge is the least visible
thing on a page. The global `:focus-visible { outline: 2px solid var(--accent-ui) }`
needs a dark companion stroke over glass.

### Accessibility, which is not optional and is already short

`@media (prefers-contrast: more), (prefers-reduced-transparency: reduce)` lives in
`@layer base` with every declaration `!important`, and zeroes decorative layers by
`opacity: 0`. **`opacity` cannot turn off `backdrop-filter`, and the block never
mentions it** — so all four blurred scrims keep their blur today for a reader who
has asked for reduced transparency. A pre-existing defect; for Atrium it would be
the whole set.

The block needs `backdrop-filter: none !important` and an opaque
`background-color`, and Atrium's reduced form should be exactly today's flat
placeholder — which is the argument for keeping `flat` in `TEXTILES` rather than
retiring it with the placeholder. `accent-texture.test.jsx` requires the block to
*win* for every selector it names, so this is enforced once written. Note that the
scrim's lower alpha is *bought* by its blur, so zeroing the blur alone leaves a
scrim too thin to separate anything: the opaque fill has to arrive with it.

---

## The guards, two of which crash rather than fail

| Guard | What happens |
| :-- | :-- |
| `material-sets.test.jsx` | **Hard stop.** Pins Atrium: all four `--surf-*-image` must be `none` and `--sel-veil` exactly `100.0%`. Any glass look edits this and the comment arguing for the flat behaviour. It also pins `seen.size === 8` and requires a unique four-slot signature |
| `surface-readability.test.jsx` | Real pixel compositing via `@napi-rs/canvas`; it `readdirSync`s the textures directory and **throws `no texture file for <name>`** for a slot with no file. `flat` has an explicit `FLAT_BAND` escape hatch in two `beforeAll` blocks; glass through `glassProps` is a blur, not a tile, and needs the same. Then 8 × 4 × 2 against a 3.0:1 floor and a 20% texture-cost cap |
| `text-readability.test.jsx` | Runs every skin but reads only palette tokens — it computes ink against `--card` as though `--card` were opaque, so **a translucent surface passes while unreadable**. Needs a translucency model, not another `KNOWN` row; the register already carries fifteen below floor |
| `accent-texture.test.jsx` | `isTexture` matches `textures/`, `feTurbulence`, `var(--tile-` — **not** `var(--surf-…)`, so a surface migrated to the composite vanishes from the derived off-switch roster and is neither checked nor required to switch off. Two assertions also name the literal `var(--tile-shell)`. It is blind to a blur and to a translucent colour by construction |
| `prefixed-pairs-survive.test.js` | Reads the **built** stylesheet. Every new `backdrop-filter` must write `-webkit-backdrop-filter` **first**, or the minifier's collapse drops the standard property — the defect that meant the scrim blur had never once reached a screen. `glassProps` sets `backdropFilter` through a React style object, which React does not prefix |
| `go test ./...` | `TestDistWasBuiltFromTheseInputs` fails on a stale `web/dist` |
| `npm run glossary:check` | Byte-exact against `docs/ui-glossary.html`; any `theme.js` or `index.css` edit fails CI until `make glossary` re-runs |

### The share image cannot render glass, and does not have to

`share.jsx` rebuilds the material on a canvas via `tileFor(material, 'card')`, and
a canvas has no `backdrop-filter`. Under this scope Atrium's **card slot stays
non-glass**, so the shared picture is unaffected — a further argument for the
ruling. No set has ever had glass in the card slot, which is why this has never
come up.

`src/textures/README.md`'s `FINE` rule independently agrees: the coarse tiles —
timber, metal, **glass**, stone — are confined to `ground` and `cover`, "where
nothing has to be read off them". `glass.webp` is not in `FINE`. `glassProps`
sidesteps the rule because it is a blur rather than a tile.

---

## The order, and what each step touches

Each step is separately shippable, and the first two collide with nothing.

1. **Fix the server.** `atrium` into `prefMaterialSets`, the error string, the
   "SEVEN MATERIAL SETS" comment, and a `ui_test.go` case so a ninth set cannot
   repeat it. — `internal/httpapi/auth_handlers.go`, `internal/httpapi/ui_test.go`
2. **Measure.** A real-browser compositing trace with the blur forced on the rail
   and top bar, and on the detail hero over cover art. A number before a design.
   — a new probe under `scripts/screenshots/`, a `Makefile` target,
   `DEVELOPMENT.md` (the file map fires on a new script), a note in
   `scripts/perf/README.md` about what it still cannot see
3. **Finish the `--surf-*` migration** for the four slots, moving each surface's
   tile off its `::before` into the composite and spending the blur through a rule
   the accessibility block can beat. Fixes Office and Film assembly on the way, and
   needs no Atrium decision. Consolidate the four repeated scrim recipes while the
   file is open. — `index.css`, `theme.js`, `accent-texture.test.jsx`
4. **Build FAMS** — `data-mat` per surface, the glass family included.
   — `index.css`, `ui.jsx`, a new module for the pointer handler, a new test
5. **The variants, the size term and the lens** behind its `CSS.supports` probe,
   with the filter defs rendered beside `.scene-bg` and `.grain-overlay`.
   — `theme.js`, `index.css`, `App.jsx`
6. **Atrium**, with everything it owes in the same commit: the accessibility block
   gaining `backdrop-filter: none` and an opaque fill, `--sel-veil`'s glass branch,
   the increased-contrast accent variants, the monochromatic label rule for glass
   bars, the focus-ring companion stroke, the scroll edge effect and the background
   extension. — `theme.js`, `index.css`, `material-sets.test.jsx`,
   `surface-readability.test.jsx`, `text-readability.test.jsx`, `palette.test.jsx`
7. **The docs the change goes stale without.** — `docs/PLAN.md` (the decision entry
   and this plan folded in, per this directory's rule), `docs/ui-glossary.html`
   (generated), `web/frontend/scripts/glossary/catalogue.js` (its "Materials &
   physics" prose still describes the deleted paper/film aesthetics),
   `CHANGELOG.md`, `AI.md`

Stale comments to correct while passing: "Seven sets" in `auth_handlers.go`,
`theme.js` and `en.txt`; the retired per-material physics described at
`index.css`'s press block and in `ui.jsx`; `textures/README.md`'s "Six are wired
up" and "The operator described below is NOT implemented"; and `CLAUDE.md`, which
names `scripts/glossary-css.mjs` for a script that is `web/frontend/scripts/glossary-build.mjs`.

**Two traps.** `web/dist/**`, `web/dist-inputs.json` and `docs/ui-glossary.html`
are generated — regenerate them, never merge them. And `internal/i18n/en.txt` and
`bn.txt` count as a **frontend** change, because `src/i18n.js` imports them with
Vite's `?raw`: editing either forces a `web/dist` rebuild.

## Verification

```bash
go vet ./... && go test ./...                  # includes the stale-dist check
cd web/frontend && npm test                    # material-sets, surface-readability,
                                               # text-readability, accent-texture,
                                               # prefixed-pairs-survive
make frontend                                  # rebuild web/dist + dist-inputs.json
make glossary && npm run glossary:check
bash scripts/perf/run-with-server.sh --quotes=2000
bash scripts/screenshots/run-panel-depth.sh    # computed style, in a real browser
```

Plus the checks no automated guard can give:

- `material-instructions.md` §6 — all three stations, both modes, distinguishable
  from its nearest neighbour **in motion**, at a 24px root font size. As still
  images the families are identical, so a screenshot proves nothing.
- Apple's own — the interface with Reduce Transparency, Increase Contrast and
  Reduce Motion each turned on, and in Safari, where the lens probe returns false.
