# ADR-0677: v3 — the materials release, decided before it was started

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** v3.0.0

**Decided.** The whole redesign ships as one release, `v3.0.0`. Seven material sets replace
two aesthetics; light/dark stays a separate control beside them; a left rail replaces the
top tabs on every screen above 700px and the phone keeps its own navigation.

**THE WORKING MATERIAL IS NOT IN GIT, AND THAT IS DELIBERATE.** Four DesignComposer exports
(~830KB) plus a 2.4MB texture bundle live in `.claude/design-import/v3/sources/`, beside
fourteen files distilled out of them — the frame contract, both layout trees, both
behaviour models, the element catalogue, the reconciled material spec, three audits and a
defect list. `.claude/` is gitignored and this follows the pattern the folder beside it
already set (`Tippani Mobile.dc.html` next to its own SPEC files). What belongs in git is
this entry: the decisions, which have to survive a clone.

**AUTHORITY HAD TO BE RANKED, because the sources disagree.** `UI Glossary.dc.html` wins —
it is the design library and its own header settles the naming question ("where the repo
already has a component, the repo's name wins"). Then `Book Detail Wide.dc.html`, then
`material-instructions.md`, then the phone file, which is OLDER than the rest and still
carries two things the glossary corrects: five sets instead of seven, and a separate
`bengaliFace` type role instead of a Bengali face inside every role's own stack. The phone
file stays authoritative for phone layout and behaviour and for nothing else — the wide
file's own rule is that "the frame changes what is SHOWN, never what things are made of".

#### `data-aesthetic` is not a texture switch, and that is the release's real work

Only **8 of its 62 rules** are pure texture. **15 are material physics** — `--thumb-ease`,
`--thumb-dur`, `--press-a`, `--press-r`, paper's `cubic-bezier(.2,.68,.28,1)/.32s` against
film's `cubic-bezier(.34,1.62,.48,1)/.48s` — with a comment saying "the switches don't just
LOOK leather vs rubber, they MOVE and DEPRESS differently". That is `FAMS` before `FAMS`
existed, and it is deleted rather than migrated.

**THREE ARE NEITHER NUMBERS NOR TILES**, which is the part a tile-swap plan would have lost
in silence: `film .hand-note .tick { display: none }` removes content; `film
.hand-note::before` *generates* a taped corner with no paper counterpart; and
`--lift`/`--lift-hi` are the app's only drop-shadow tokens, aesthetic-keyed, with film's
carrying a three-stop amber LED edge-light. Seven sets means seven of those or a token
redesign.

**The preference migration is nearly free, which is the argument for doing it properly.**
`loadPrefs` already heals unknown values, so dropping `paper`/`film` from `prefAesthetics`
retires them on read with no pass at all — and lands every existing reader on one default.
Mapping paper to Manuscript and film to Film assembly is exactly the "meaning changed in a
release" condition `internal/store/onetime.go` describes, so it is
`onetime_3_0_0_material_sets.go` and one `json_set`. Two traps found while auditing:
`ui_test.go:69` asserts `"vellum"` is a 400, so a set named vellum would have a test
asserting the new system invalid; and `setup-dom.js:115` removes `data-aesthetic` in
`beforeEach`, which after a rename becomes a no-op that leaks the new attribute between
tests while **no test fails**.

#### Thirty-nine defects in an approved design, fixed during the port

The owner approved the features and asked for obvious bugs. Thirty-nine, five of which lose
a reader's work — and eleven of which contradict a comment sitting directly above the code.
The sharpest: pressing the colour key inside the add form sets `dialog: null` on the OPEN
path, discarding a half-written quote past `tryCloseDialog`, `formDirty` and the discard
confirm. The file's own banner says "A DISMISS MUST NOT DESTROY WORK" and lists four times
it was caught; this is the fifth gesture. **They are fixed as the port goes rather than
filed**, because a defect carried across and fixed later is a defect a reader met.

#### The tiles, and what measuring them changed

The glossary needs 27 tiles; the repo had 14. `textures-bundle.js` supplied the rest. All
thirteen new ones are 256x256, grayscale in value, and land on mean 128.00 +/- 0.06 — the
invariant that makes the `overlay` pass an identity rather than a brightening filter.

**A RAW TILE AT FULL CONTRAST IS NOT EVIDENCE ABOUT A SURFACE AT FOUR PERCENT STRENGTH.**
Tiled 3x3 at full contrast, six of the thirteen show an obvious repeating motif and three
looked unusable. Rendered through the actual operator — veil at 1-s, fine pass at overlay,
coarse pass at normal, each at its own two background-sizes, on the card colour, with type
on it — every motif disappears and the quote stays legible in both modes. The first reading
was wrong and the measurement is what corrected it.

**The published strengths run louder than the pack's own formula, deliberately.**
`s = min(1.8/sd, 0.12)` aims for +/-1.8 levels; the five generated textiles hit it exactly,
the flattened neutrals sit quieter on purpose, and the photographic block runs 2.80-6.50.
At the formula's strength those tiles are invisible, because their sd is three to four times
a generated textile's. So the README's formula describes the procedural half only, and the
glossary's table is right. That also answers `FINE` with a number: `paper-photo` as
Bindery's card lands at 3.45 levels against `paper.webp`'s 2.61, already behind every quote
today, so the three new slot tiles join the set.

`basalt.png` is dropped. Twenty-eight tiles re-encoded from colour-type 6 to single-channel
grayscale: 1.78MB to 1.04MB, verified equal in value per file rather than assumed.

**AND THE CLAIM ABOUT THE SIX LEGACY WEBPS WAS WRONG.** This entry said they are chromatic,
so the operator's "identical grain in both modes" promise held for only twenty tiles until
they were flattened. They are not chromatic. Every one carries a maximum channel spread of
exactly 2 levels out of 255 **before the flattening and after it**, because that spread is
the WebP encoder's chroma subsampling and not the image. What was genuinely wrong was the
mean — 127.07 to 127.86 instead of 128 — which is worth about 0.02% of one surface's tone
at these strengths. Flattening them bought a true invariant and a re-measurable number
rather than a visible improvement, and it cost 101KB in git and in the binary at quality
95; lossless would have cost 382KB to hold a mean the format never held. `rubber.webp` was
already exactly right and re-encoding it made it worse, so it was left alone. The tile
record is `web/frontend/src/textures/README.md`; the number that matters per tile is
`s x sd`, not `s`.

#### One thing ships before the branch

`index.css:242`'s `prefers-contrast: more` / `prefers-reduced-transparency` block is beaten
by the cascade three ways — out-specified by `html[data-aesthetic="paper"] .tp-toggle-thumb`
(0,2,1) against its own (0,1,0), out-ordered by three later `::before` rules in the same
layer, and outranked outright by `.topbar::before` and the drawer rules, which sit AFTER the
last `@layer components` closes and so beat any layered rule. **The reading-by-eye said
seventeen of nineteen decorative layers are never stripped; resolving the cascade in code
said all twenty-three of them, including the two that looked safe** — the page grain and
the scenic backdrop are each beaten by their own dark-theme rule twenty lines above the
block. The same resolver, given the tile list derived from the stylesheet rather than typed,
found two textured surfaces the hand-written list had never named. `accent-texture.test.jsx:105` passes because it
asserts the selector *string appears* in the block; it never resolves the cascade.

**Reduced-motion works for the reason contrast does not**: its rule is in `@layer base` with
`!important`, and `!important` reverses layer precedence. The fix is cascade placement, not
more selectors, and it ships as **2.2.9 on its own** so v3 is not blamed for a defect that
predates it.

<sub>v3.0.0 — `.claude/design-import/v3/` (not in git) · `docs/wiki/Design-decisions.md` · decided 2026-08-25</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
