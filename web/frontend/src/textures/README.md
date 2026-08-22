<!-- PREAMBLE ADDED ON LANDING (2.1.3). Everything below the rule is the pack's
own README, verbatim. This part says what is actually WIRED UP today, because the
pack describes a design the app has not adopted yet. -->

# What is live in here, and what is waiting

**Six `.webp` tiles are live**: `paper`, `fabric`, `wood`, `metal`, `glass`, `rubber`.
They are composited the way `index.css` has always composited them —
`mix-blend-mode: multiply` on light and `screen` on dark for card grain, `overlay`
at `opacity: .5` for the accent grain — and `accent-texture.test.jsx` reads that
stylesheet as text to hold it.

**The ten `.png` tiles are resources and nothing references them.** They are here
for the UI overhaul, on the owner's instruction: *"add the texture packs in the
app. for now, keep them as resources… we will start a design overhaul soon. these
will be important there."* Vite bundles what is imported, so an unimported tile
costs the build and the binary nothing at all; it costs git the bytes, which is the
point of putting it somewhere it cannot get lost.

**One thing did change: `rubber.webp` is a different image.** It is the pack's
`rubber-flat.png`, converted to lossless WebP under the existing name so that not
one line of CSS or of its test had to move. The old tile had a seam — measured, its
horizontal wrap edge was **1.97x** an ordinary interior step, so a joining line
appeared every 130px across every accent-filled control on film. The new one is
1.07x and 0.98x, which is to say indistinguishable from an interior step.
`fabric.webp`, its counterpart on paper, was already 1.04x — which is why rubber
was the only one that needed replacing.

**And it is deliberately fainter.** Flattening to mean 128 dropped its standard
deviation from 23.9 to 9.0, so at the same `opacity: .5` the grain reads at about
40% of its old amplitude. That is the direction the pack is going rather than an
accident of the swap: its own strength formula, `s = min(1.8 / sd, 0.12)`, exists to
land every material at about +/-1.8 levels, which is subtler again. If the accent
grain on film now reads as too quiet, one number in `index.css` is the answer, not
a different tile.

**The operator described below is NOT implemented.** Composite-over-a-veil, one
file per material for both modes, the `TEX` scale table and the `FINE` set are the
overhaul's work. Until then this file is the record of what those numbers mean, and
the `sd` figures in the tables are load-bearing: they are what the strength formula
divides by.

---

# Texture pack — ten tiles, one operator

Drop `textures/` into `web/frontend/src/textures/` alongside the six CC0 `.webp`
tiles already there. Nothing here replaces those; these are additions, plus the
one change to how all sixteen are composited (see **The operator**, below).

Every tile is **256×256 grayscale PNG, seamless, mean exactly 128**, with its
standard deviation normalised to a stated figure. Those three properties are what
make the operator below work, and none of them is decoration — see **The
invariant**.

`contact-sheet.png` shows the five textiles tiled 2×2 with the crop centred on the
wrap, so any seam would be down the middle of each panel.

---

## The operator — one file per material, both modes

This is the part to read even if you skip the rest, because it is a **change to
existing behaviour**, not just new assets.

The current code picks a *different file* per theme and composites with
`mix-blend-mode: multiply` (light) / `screen` (dark). That has two faults:

1. Every multiplicative blend scales with the base colour, so the same tile at the
   same opacity lands at a fifth of the contrast on `#FFFEF9` that it does on
   `#262019` — the two modes carry visibly different grain.
2. It needs a light file and a dark file for every material, which is where the
   dark-mode texture went missing when a set named only one.

Plain alpha does not scale with the base. Composite the tile at strength `s` over
a veil of the surface colour at `1 − s`:

```
result = (1 − s)·colour + s·texture
```

The tile's amplitude is then `s ×` its own contrast **on any colour**, so light and
dark carry identical grain and the palette is the only thing that differs. One file
per material, both modes.

```js
// tile is the filename; a and b are the coarse and fine background-size in px;
// s is the strength; `over` is an optional layer that must sit ON TOP of the
// material rather than blend into it (a placeholder hatch, say — that is a
// statement about missing data, not a property of the cloth underneath).
//
// The stack, top to bottom: a veil of the surface colour at 1−s, then a fine
// pass at `overlay` (identity at mid-grey, so it perturbs rather than replaces),
// then a coarse pass at `normal`.
const surf = (hex, tile, a, b, s, over) => {
  const veil = `color-mix(in srgb,${hex} ${((1 - s) * 100).toFixed(1)}%,transparent)`
  const img = [], size = [], blend = []
  if (over) { img.push(over); size.push('auto'); blend.push('normal') }
  img.push(`linear-gradient(${veil},${veil})`, url(tile), url(tile))
  size.push('auto', `${a}px ${a}px`, `${b}px ${b}px`)
  blend.push('normal', 'overlay', 'normal')
  return `background-color:${hex};background-image:${img.join(',')};` +
    `background-size:${size.join(',')};background-blend-mode:${blend.join(',')};`
}
```

The `prefers-contrast: more` / `prefers-reduced-transparency: reduce` rule already
in `index.css` still applies unchanged: every texture goes, the layout does not
move.

---

## The invariant — why mean 128 and a measured sd

**Mean 128** is what makes the `overlay` pass an identity. Overlay leaves mid-grey
alone and pushes away from it, so a tile centred on 128 perturbs the colour beneath
without darkening or lightening it on average. A tile whose mean is 140 is a
brightening filter with a pattern on it, and every surface using it drifts.

**A measured sd** is what makes one strength number mean the same thing twice.
Strength is not chosen by eye — it is

```
s = min(1.8 / sd, 0.12)
```

so every material lands at the same visible amplitude (about ±1.8 levels) no matter
how contrasty its file is, and no surface shifts more than 12% toward grey. Wood at
sd 32 needs a sixth of `glass-soft`'s strength to read the same. If you regenerate
or replace a tile, re-measure and recompute; do not carry the old number over.

---

## The tiles

### Flattened neutrals — five

Derived from the existing CC0 tiles, flattened to mean 128 and de-tinted so they
carry grain and nothing else. These are the **fine** materials: they may sit behind
text and controls.

| File | sd | Was |
| --- | --- | --- |
| `matte.png` | 11.0 | uncoated stock |
| `brushed.png` | 12.8 | brushed alloy |
| `rubber-flat.png` | 9.0 | rubber, planed flat |
| `satin.png` | 6.0 | coated stock |
| `glass-soft.png` | 6.3 | glass with the creases taken out |

### Textiles — five, generated

Procedural, not photographic, and periodic by construction rather than by
edge-blending: the thread pitch divides 256 exactly and the noise lattice wraps, so
these tile at any scale with no cross-fade softening the weave.

A weave is warp over weft with the under-thread in shadow. **A float is one
element, not a row of bumps** — a thread passing over two crossings is one length of
yarn and takes one round cross-section along its whole run. The generator scans the
binding into runs first; without that, denim's 2/2 twill draws as brick.

| File | sd | Binding | Pitch |
| --- | --- | --- | --- |
| `cotton.png` | 12 | plain 1×1 — a fine even shirting, no character | 4px |
| `linen.png` | 16 | plain 1×1 with slubs — the thick-and-thin that is flax | 8px |
| `canvas.png` | 18 | basket 2×2 — every float two wide and two long | 8px |
| `denim.png` | 15 | 2/2 twill — the float steps one thread per pick | 8px |
| `wool.png` | 14 | none: felted, not woven. Matted fibre, isotropic | — |

**Denim is a twill you can see only because the warp is dyed.** The binding alone
draws warp floats and weft floats of equal weight, which reads as brick rather than
as a rib — the diagonal in a pair of jeans is indigo warp against undyed weft. The
tile carries that as a tone split (warp 1.0, weft 0.5) and the diagonal appears.
This is the one place where the drawing encodes a *colour* fact in grayscale.

`cotton`, `linen`, `denim` and `wool` are **fine**; `canvas` is coarse enough to
want confining (see below).

---

## Fine grain only where text and controls sit

Not taste — legibility. Large-scale variation behind a quote competes with the
quote, and behind a button it makes the button's edge ambiguous. So a `card` or
`shell` slot may name a fine-noise tile only; the coarse ones — wood, metal, glass,
with their planks, streaks and creases — are confined to `ground` and `cover`, where
nothing has to be read off them.

```js
const FINE = new Set(['paper.webp', 'fabric.webp', 'matte.png', 'brushed.png',
  'rubber-flat.png', 'satin.png', 'glass-soft.png',
  'cotton.png', 'linen.png', 'denim.png', 'wool.png'])
```

## Scale and strength — one per material, wherever it appears

The sizes used to be typed into each recipe, so paper was 430px in one and 540px in
another. A plank is a plank. `[coarse px, fine px, strength]`:

```js
const TEX = {
  'paper.webp':     [430, 139, .088],
  'fabric.webp':    [380, 121, .080],
  'wood.webp':      [760, 251, .056],
  'metal.webp':     [380, 131, .052],
  'glass.webp':     [400, 137, .050],
  'rubber.webp':    [340, 109, .079],
  'matte.png':      [300,  97, .12],
  'brushed.png':    [420, 137, .12],
  'rubber-flat.png':[260,  83, .12],
  'satin.png':      [320, 103, .12],
  'glass-soft.png': [300,  97, .12],
  'cotton.png':     [300,  97, .12],
  'linen.png':      [340, 109, .11],
  'canvas.png':     [400, 129, .10],
  'denim.png':      [320, 103, .12],
  'wool.png':       [360, 113, .12],
}
```

## Recipes — a place, not a list of surfaces

Each set names four slots: the desk (`ground`), the furniture (`shell`), what you
write on (`card`), and what the book is bound in (`cover`). Assembled slot by slot
they drift — an earlier Office was cloth-on-desk with glass on the book, the one
object in the room glass makes no sense on. Read each as somewhere you could stand.

```js
const SETS = {
  // A cloth blotter, paper on top of it, boards on the book.
  Manuscript:      { ground: 'linen.png',       shell: 'paper.webp',      card: 'paper.webp',  cover: 'wood.webp' },
  // A steel bench, brushed alloy furniture, matte stock, glass on the poster.
  'Film assembly': { ground: 'metal.webp',      shell: 'brushed.png',     card: 'matte.png',   cover: 'glass.webp' },
  // A glass desktop, a rubber mat, satin stock, a metal-clad cover.
  Office:          { ground: 'glass.webp',      shell: 'rubber-flat.png', card: 'satin.png',   cover: 'metal.webp' },
  // A timber desk, eraser rubber, paper, a cloth cover.
  School:          { ground: 'wood.webp',       shell: 'rubber-flat.png', card: 'paper.webp',  cover: 'cotton.png' },
  // A workshop: heavy canvas over the bench, a denim apron, cotton to write on,
  // a wool bolt for the binding. The only set with no paper, timber or glass.
  Atelier:         { ground: 'canvas.png',      shell: 'denim.png',       card: 'cotton.png',  cover: 'wool.png' },
}
```

`cover` is a real slot, not decoration: the missing-cover hatch composites **above**
it via `surf`'s `over` argument, so "no cover yet" reads as a hatch while the boards
it would be bound in show through the gaps.

---

## Licence

The five flattened neutrals derive from the CC0 tiles already in the repo and stay
CC0. The five textiles are generated from the description above — no source
photography, no third-party asset, nothing to attribute.
