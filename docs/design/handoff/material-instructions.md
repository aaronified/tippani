# Materials — instruction set

Rules for anything that draws a physical surface in Tippani. Source of truth is
`UI Glossary.dc.html` (the light layer in `<helmet>`, `FAMS` in `renderVals`).
Copy values from there; never re-derive them.

## 1. One rule, eight families

Every surface is a `[data-mat="<family>"]` element. The families are
**paper · cloth · metal · glass · rubber · rigid · stone · leather**, and a family is
nothing but numbers fed to one shared rule:

- **hover** → a soft elliptical highlight appears at intensity `gloss`
- **press** → the same ellipse is replaced by a dark contact patch at `dent`
- **release** → back to `gloss` if the pointer is still over, else 0

No family gets a second mechanism. If a material needs behaviour the four numbers
cannot express, it is not a new family — it is a wrong number.

| family | gloss (dark) | dent | rx × ry | blend (dark) | reads as |
|---|---|---|---|---|---|
| paper | .16 | .17 | 72 × 64 | soft-light | thumb on matte stock |
| cloth | .12 | .22 | 78 × 68 | soft-light | woven, least sheen, deepest dent |
| metal | .50 | .26 | 150 × 26 | screen | streak along brush lines |
| glass | .42 | .24 | 46 × 38 | screen | small bright reflection (+blur 18→24px) |
| rubber | .22 | .24 | 96 × 82 | soft-light | broad dull sheen |
| rigid (wood) | .20 | .16 | 118 × 42 | soft-light | grazing band along grain |
| stone | .24 | .18 | 50 × 46 | overlay | hard crystal glint |
| leather | .26 | .22 | 80 × 68 | soft-light | wide waxy sheen, softest falloff |

`rx`/`ry` are percentages of the surface, so shape survives any size. Metal is a
streak; stone is a glint. That contrast is the only thing telling the two apart in
motion, so do not average them toward each other.

## 2. Light mode is not the same numbers

`screen` does not read on a light ground and `soft-light` washes out. So in light mode:

- every blend becomes `overlay`
- `gloss` is lifted: `min(1, glossD * 1.7)`
- the map gains a darkening ring — bright core, `rgba(0,0,0,.16)` at 66%, clear at 88%

What a reader sees on paper in daylight is the falloff beside the highlight, not the
highlight. Skip the ring and light mode looks like nothing is happening.

## 3. Three stations, and only three

Horizontal position quantises to **left · centre · right** (`nx < -0.33 / < 0.33 /
else`). Hover, press tilt, transform-origin and the light all snap to the same station.

- A material therefore has exactly **one hover and three presses**, each distinguishable.
- Vertically the light never moves. It is a reflection of a source *above* the surface;
  following a finger up and down is the one thing it must not do.
- A drag re-lights at most twice crossing the surface. During a drag the light stays with
  the finger while the surface slides under it — that is the tell that the sheen is a
  reflection, not a decal.

Per-pixel tracking is banned. It gave a continuum of near-identical states, no two
presses repeatable, and a full-size gradient repaint per frame for as long as a hand
rested on the page.

## 4. The transport is CSS transitions only

Four registered custom properties (`--lx`, `--lit`, plus `--lmap`, `--lblend` as plain
vars) on `[data-mat]`, painted by `::after`. Registered numbers interpolate, which is
why one pseudo-element serves every family with no extra DOM.

- **No** Web Animations API, **no** RAF loop, **no** per-frame writes.
- Hot path per pointer move: one division on a cached `getBoundingClientRect`, one
  compare. Nothing is written unless the pointer crossed into another third.
- Durations are literal in the stylesheet (`--lit .2s ease`, `--lx .22s
  cubic-bezier(.3,.7,.3,1)`). A custom property in a duration slot does **not**
  transition in this engine — the inline value moved between stations while the computed
  one stayed pinned to the first. Do not reintroduce `var(--travel)`.
- `prefers-reduced-motion` drops `::after` entirely and keeps the material.

## 5. Press behaviour belongs to the family, not the light

Each family also owns `press` transform, `ease`, `dur`, `hover`, `k`, `max`, `stretch`,
`tilt`, `wall`. Composed once per gesture and appended to during a drag, so the object
does not flatten out of 3D mid-gesture. Rubber is the only family that visibly bounces.
Metal and stone tilt but never squash. Glass is the exception: its press happens
*behind* it — a pane has no shadow to compress, so what gives way is the blur.

## 6. Checks before shipping a surface

- Does the tile respond at all three stations, and differently at each?
- Is it distinguishable from its nearest neighbour (metal vs rigid, stone vs glass)
  **in motion**? As still images they are identical, so a screenshot proves nothing.
- Both modes. A family that only works in dark is unfinished.
- Root font size at 24px — the light layer is percentage-based and must not care.
