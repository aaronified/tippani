<!-- PREAMBLE, REWRITTEN FOR v3. Everything below the rule is this repo's record of
the pack, not the pack's own README any more: the seven-set library in
`.claude/design-import/v3/sources/UI Glossary.dc.html` is the source of truth for
the tables, and every sd and amplitude figure here was measured from the file on
disk rather than carried over. Where the pack's README and the glossary disagreed,
the glossary won and the disagreement is written down. -->

# What is live in here, and what is waiting

**Twenty-eight tiles are in this directory. Six are wired up.** `paper`, `fabric`,
`wood`, `metal`, `glass` and `rubber` `.webp` are composited the way `index.css`
has always composited them — `mix-blend-mode: multiply` on light and `screen` on
dark for card grain, `overlay` at `opacity: .5` for the accent grain.

**The twenty-two `.png` tiles are resources and nothing imports them.** Vite bundles
what is imported, so an unimported tile costs the build and the binary nothing; it
costs git the bytes, which is the point of putting it somewhere it cannot get lost.
They are the seven material sets' inventory, and the operator that reads them lands
in the same release as the sets.

## What this pass changed, and what it cost

**Twelve tiles arrived**: `walnut`, `pine`, `marble`, `granite`, `sandstone`,
`concrete`, `cardboard`, `paper-photo` and four leathers. They complete the seven
sets — Bindery and Quarry have no tiles at all without them — and they are
photographic where everything before them was generated or flattened, which is why
they are the loudest block in the table below.

**Ten existing PNG tiles were re-encoded** from colour-type 6 (four channels holding
R=G=B) to single-channel grayscale. Every one was verified equal in value before it
was replaced, not assumed to be.

**Five `.webp` tiles were flattened to mean 128, and that is a smaller win than it
was expected to be.** The claim it was going to fix — that the six legacy webps are
"genuinely chromatic" and so tint every surface they land on — is **wrong, and
measuring is what corrected it.** All five carry a maximum channel spread of exactly
2 levels out of 255, before this pass and after it, because that spread is the WebP
encoder's chroma subsampling and not the image. What was actually wrong was the
mean: 127.07 to 127.86 instead of 128, which the flattening fixed.

At the strengths in the table below that mean error was worth about 0.02% of one
surface's tone — so this bought a true invariant and a re-measurable number rather
than a visible improvement, and it cost **101KB** in git and in the binary. Recorded
because the next person to weigh a re-encode should know the size of the prize.

**`rubber.webp` was left alone.** It had already been flattened when it was replaced
in 2.1.3, and it is the one file here that was already exactly right: mean 128.002,
sd 9.00, no channel spread at all. Re-encoding it moved its mean to 128.123 and its
sd to 8.98 for no reason, so that was reverted.

**`wool.png` was left alone too, and the bundle's copy of it discarded.** The two
images share a name, differ in 98% of their pixels by up to 87 levels, and have
**the same standard deviation to three decimal places** — two runs of the same
generator at the same normalisation target, different seed. Neither is a correction
of the other, the strength arithmetic is identical either way, and the one in git is
the one `contact-sheet.png` was shot from.

**The operator described below is NOT implemented.** Composite-over-a-veil, one file
per material for both modes, the `TEXTILES` scale table and the `FINE` set are still
the overhaul's work. Until then this file is the record of what those numbers mean,
and the `sd` figures are load-bearing: they are what the strength formula divides by.

---

# The pack — twenty-eight tiles, one operator

Every tile is **seamless grayscale, mean 128, with its standard deviation
normalised to a stated figure**. Those properties are what make the operator work,
and none of them is decoration — see **The invariant**.

**Two of the pack's own claims about itself are not true, and the table is the
authority, not the prose.** Not every tile is 256×256: `matte`, `rubber-flat` and
`rubber` are 192, and `paper`, `metal`, `wood` and `glass` are 384 or 448. And the
mean is 128 to within 0.15 rather than exactly — a lossy WebP encode brightens by
0.05 to 0.15 of a level and a global correction cannot remove it, because on an
integer array a sub-level shift moves almost no pixels. The measured value is
published instead of the intended one.

`contact-sheet.png` shows the five generated textiles tiled 2×2 with the crop
centred on the wrap, so any seam would be down the middle of each panel.

---

## The operator — one file per material, both modes

```
result = (1 − s)·colour  +  s·overlay(fine, coarse)
```

A veil of the surface's own colour at `1 − s`, a fine pass composited `overlay`, a
coarse pass composited `normal`, each at its own `background-size`. One file serves
light and dark: the tile carries no tone of its own, only deviation from the middle,
so the mode's colour comes from the veil and the grain comes from the file.

Glass and polished metal do **not** go through this recipe. A pane does not hide
what is behind it, it softens it, so glass takes a backdrop blur and a specular
sweep instead of a tint veil.

## The invariant — why mean 128 and a measured sd

`overlay` pivots at 128: below it the pass multiplies, above it the pass screens. A
tile whose mean *is* 128 therefore neither darkens nor lightens the surface — the
pass is an identity in tone and carries only texture. A tile whose mean is 120
darkens every surface it touches, in both modes, and no amount of tuning `s` gets
that back, because `s` scales the deviation and the offset together.

And the sd has to be **known**, not merely small, because the visible amplitude is
`s × sd` in levels out of 255. Two tiles at the same `s` with sd 12 and sd 52 are
not two textures at one strength; they are a whisper and a shout.

## Strength is not one number, and the formula only covers half the pack

The pack's `s = min(1.8 / sd, 0.12)` aims every material at about ±1.8 levels. The
five generated textiles hit it. **The photographic block deliberately does not**:
its sd is three to four times a generated textile's, and at the formula's strength
those tiles are invisible. So the published strengths run 2.8 to 6.5 levels there,
and the formula describes the procedural half only.

`AMP` below is `s × sd` — what a reader actually sees, in levels out of 255.

| key | file | WxH | coarse | fine | s | sd | **AMP** | mean |
| :-- | :-- | :-- | --: | --: | --: | --: | --: | --: |
| `paper` | `paper.webp` | 384² | 220 | 71 | .10 | 26.05 | **2.61** | 128.083 |
| `linen` | `linen.png` | 256² | 340 | 109 | .11 | 16.00 | **1.76** | 128.002 |
| `cotton` | `cotton.png` | 256² | 300 | 97 | .12 | 12.02 | **1.44** | 127.969 |
| `canvas` | `canvas.png` | 256² | 400 | 129 | .10 | 17.99 | **1.80** | 127.953 |
| `denim` | `denim.png` | 256² | 320 | 103 | .12 | 14.97 | **1.80** | 128.027 |
| `wool` | `wool.png` | 256² | 360 | 113 | .12 | 14.00 | **1.68** | 128.000 |
| `wood` | `wood.webp` | 448² | 300 | 97 | .12 | 40.15 | **4.82** | 128.095 |
| `metal` | `metal.webp` | 384² | 260 | 84 | .09 | 37.10 | **3.34** | 128.096 |
| `brushed` | `brushed.png` | 256² | 240 | 78 | .08 | 12.82 | **1.03** | 128.000 |
| `matte` | `matte.png` | 192² | 200 | 65 | .07 | 11.00 | **0.77** | 128.005 |
| `satin` | `satin.png` | 256² | 210 | 68 | .07 | 6.05 | **0.42** | 127.998 |
| `glass` | `glass.webp` | 448² | 280 | 90 | .06 | 42.61 | **2.56** | 128.148 |
| `rubber` | `rubber-flat.png` | 192² | 230 | 74 | .10 | 9.00 | **0.90** | 128.002 |
| `fabric` | `fabric.webp` | 256² | 260 | 84 | .11 | 28.00 | **3.08** | 128.046 |
| `walnut` | `walnut.png` | 256² | 300 | 97 | .09 | 52.87 | **4.76** | 128.002 |
| `pine` | `pine.png` | 256² | 340 | 109 | .09 | 51.03 | **4.59** | 127.991 |
| `marble` | `marble.png` | 256² | 360 | 116 | .08 | 38.90 | **3.11** | 127.999 |
| `granite` | `granite.png` | 256² | 280 | 90 | .08 | 43.65 | **3.49** | 128.003 |
| `sandstone` | `sandstone.png` | 256² | 300 | 97 | .09 | 45.65 | **4.11** | 128.006 |
| `concrete` | `concrete.png` | 256² | 320 | 103 | .08 | 49.08 | **3.93** | 128.024 |
| `cardboard` | `cardboard.png` | 256² | 280 | 90 | .10 | 52.08 | **5.21** | 128.034 |
| `paper-photo` | `paper-photo.png` | 256² | 300 | 97 | .07 | 49.30 | **3.45** | 128.038 |
| `leather` | `leather-004.png` | 256² | 260 | 84 | .10 | 41.20 | **4.12** | 128.045 |
| `leather-suede` | `leather-021.png` | 256² | 240 | 78 | .11 | 59.07 | **6.50** | 127.990 |
| `leather-pebbled` | `leather-034d.png` | 256² | 280 | 90 | .09 | 42.94 | **3.86** | 127.893 |
| `leather-tooled` | `leather-037.png` | 256² | 320 | 103 | .06 | 46.67 | **2.80** | 128.056 |

Two files in this directory are in no set and are referenced by nothing:
`glass-soft.png` (sd 6.32) and `rubber.webp` (sd 9.00, live today under the old
compositing). `rubber.webp` goes when the operator lands and `rubber-flat.png` takes
the `rubber` key from it.

---

## The tiles, by how they were made

### Flattened neutrals — five

Derived from the CC0 webp tiles already in the repo by converting to grayscale and
normalising: `matte` (uncoated stock), `brushed` (brushed alloy), `rubber-flat`
(rubber, planed flat), `satin` (coated stock), `glass-soft` (glass with the creases
taken out).

### Textiles — five, generated

Procedural, not photographic, and periodic by construction rather than by
edge-blending: the thread pitch divides 256 exactly and the noise lattice wraps, so
these tile at any scale with no cross-fade softening the weave.

A weave is warp over weft with the under-thread in shadow. **A float is one element,
not a row of bumps** — a thread passing over two crossings is one length of yarn and
takes one round cross-section along its whole run. The generator scans the binding
into runs first; without that, denim's 2/2 twill draws as brick.

| File | Binding | Pitch |
| --- | --- | --- |
| `cotton.png` | plain 1×1 — a fine even shirting, no character | 4px |
| `linen.png` | plain 1×1 with slubs — the thick-and-thin that is flax | 8px |
| `canvas.png` | basket 2×2 — every float two wide and two long | 8px |
| `denim.png` | 2/2 twill — the float steps one thread per pick | 8px |
| `wool.png` | none: felted, not woven. Matted fibre, isotropic | — |

**Denim is a twill you can see only because the warp is dyed.** The binding alone
draws warp floats and weft floats of equal weight, which reads as brick rather than
as a rib — the diagonal in a pair of jeans is indigo warp against undyed weft. The
tile carries that as a tone split (warp 1.0, weft 0.5) and the diagonal appears.
This is the one place where the drawing encodes a *colour* fact in grayscale.

### Photographic — twelve

`walnut`, `pine` (timber); `marble`, `granite`, `sandstone`, `concrete` (stone and
poured); `cardboard`, `paper-photo` (stock); `leather-004`, `leather-021`,
`leather-034d`, `leather-037` (hide: full-grain, suede, pebbled, tooled). Flattened
to mean 128 like everything else, and normalised to no sd target at all — their
spread is the material's own, which is why they need their own strengths.

### Legacy — six webp

`paper`, `fabric`, `wood`, `metal`, `glass`, `rubber`. CC0, oversized (384 or 448),
and the only tiles in the pack whose grain arrives through a lossy codec.

---

## Fine grain only where text and controls sit

Not taste — legibility. Large-scale variation behind a quote competes with the
quote, and behind a button it makes the button's edge ambiguous. So a `card` or
`shell` slot may name a fine-noise tile only; the coarse ones — timber, metal,
glass, stone, with their planks, streaks, creases and veins — are confined to
`ground` and `cover`, where nothing has to be read off them.

**`paper-photo` is in `FINE` on a measurement, not a hunch.** It is the loudest
thing ever put in a card slot at 3.45 levels — and `paper.webp` has been behind
every quote in the app for four releases at 2.61, so the step is 0.84 of a level,
not a change of kind. `cardboard` at 5.21 and every leather stay out.

```js
const FINE = new Set(['paper.webp', 'fabric.webp', 'matte.png', 'brushed.png',
  'rubber-flat.png', 'satin.png', 'glass-soft.png', 'cotton.png', 'linen.png',
  'denim.png', 'wool.png', 'paper-photo.png'])
```

## The seven sets — a place, not a list of surfaces

Each set names four slots: the desk (`ground`), the furniture (`shell`), what you
write on (`card`), and what the book is bound in (`cover`). Assembled slot by slot
they drift — an earlier Office was cloth-on-desk with glass on the book, the one
object in the room glass makes no sense on. Read each as somewhere you could stand.

| set | ground | shell | card | cover |
| :-- | :-- | :-- | :-- | :-- |
| **Manuscript** | `linen` | `paper` | `paper` | `wood` |
| **Film assembly** | `metal` | `brushed` | `matte` | `glass` |
| **Office** | `glass` | `rubber` | `satin` | `metal` |
| **School** | `wood` | `rubber` | `paper` | `cotton` |
| **Atelier** | `canvas` | `denim` | `cotton` | `wool` |
| **Bindery** | `concrete` | `leather-suede` | `paper-photo` | `leather-pebbled` |
| **Quarry** | `sandstone` | `granite` | `satin` | `marble` |

A cloth blotter with paper on it and boards on the book; a steel bench with alloy
furniture and glass on the poster; a glass desktop with a rubber mat; a timber desk
with eraser rubber and a cloth cover; a workshop with canvas over the bench, a denim
apron and a wool bolt — the only set with no paper, timber or glass. Then a binder's
room: a poured floor, a suede-topped bench, photographic stock to work on, the book
bound in pebbled hide, and the only set where the cover is the softest thing in it.
And a stonecutter's: sandstone underfoot, a granite bench, coated stock, marble
boards.

`cover` is a real slot, not decoration: the missing-cover hatch composites **above**
it, so "no cover yet" reads as a hatch while the boards it would be bound in show
through the gaps.

Dropped from the glossary's own table: `basalt.png`, which is not in this directory.

---

## Licence

The five flattened neutrals derive from the CC0 webp tiles already in the repo and
stay CC0. The five textiles are generated from the description above — no source
photography, no third-party asset, nothing to attribute.

**The twelve photographic tiles are CC0**, from AmbientCG or a comparable CC0 texture
library — the owner's account of where they came from, recorded here on 2026-08-25
because `textures-bundle.js` delivered them with no licence header and no source list.
CC0 asks for no attribution, so nothing is owed to anyone by the binary that
redistributes them; what is written down is the ANSWER, so that the next person to ask
does not have to ask the same person again. A per-file source URL was never captured
and is not recoverable from the bundle.
