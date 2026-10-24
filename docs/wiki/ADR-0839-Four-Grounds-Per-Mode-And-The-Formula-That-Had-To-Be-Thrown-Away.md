# ADR-0839: Four grounds per mode, and the formula that had to be thrown away

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `GROUNDS` holds four grounds per mode; a ground is a set of token
overrides applied over that mode's palette by `paletteFor`. Cream and Night carry EMPTY
override sets, which is how they are the shipped palettes hex for hex.

**Why.** The v3 pack's Theme section replaces one palette per mode with four "ground
triads", and a ground is three stacked surfaces — desk, furniture, page — because one
colour spread over all three flattens the stack the materials exist to build.

**THIS SUPERSEDES A STANDING RULING.** `theme.js` states one palette per mode as a fact
about the build: "THE FILM PALETTES ARE GONE, NOT MERGED." That ruling was about
retiring a second AESTHETIC; this adds grounds within one. The owner chose the 4+4 over
keeping the pair, and the condition was that `contrast.test.js` measure all eight rather
than the two that ship.

**AND THE FORMULA WAS THE INTERESTING FAILURE.** The first draft derived `card-top`,
`card-bottom`, `topbar-*` and `faint` from the three surfaces — a highlight is the card
stepped toward white, a rule is soft stepped toward the ground, and so on. It is a
tidier table and it was wrong twice over, both caught by widening the contrast suite
before anything shipped:

- Cream's `--faint` came out at **4.34:1**, under the AA floor. The shipped value is
  `#766A59`, hand-moved there from `#8A7C68` precisely to clear 4.5 — a correction
  recorded in that suite's own header, and a formula that reproduces the palette
  approximately reproduces the bug it was tuned to fix.
- Night's `--card-top` came out lighter than the shipped `#352D23`, which dragged
  `--error` on it to **4.06:1**.

So a ground is a flat merge and nothing is computed. The cost is a longer table; the
thing bought is that every value a reader can end up looking at was chosen and measured.

**THE TOKENS ARE HEX, NOT `color-mix()`.** They could be CSS functions resolved by the
browser. They are not, because `contrast.test.js` measures these values as numbers and a
token it cannot parse is a token nothing checks.

**AND THE NEW GROUNDS NEEDED THEIR OWN SEMANTIC COLOURS.** `--ok`, `--amber` and
`--error` were tuned against Cream and Night; on a white or grey desk two of them fall to
4.32 and 4.35, and on Sepia three do. Each ground that misses carries its own value,
moved by the smallest step that clears — the same method the original five corrections
used.

**A NEW VERB IN THE JOURNEY HARNESS**, and it earned admission on the harness's own
test. `chosen(name)` reports what a control announces about itself, from `aria-pressed`
or `aria-selected` — the accessibility tree every other verb already works from, which a
screen reader says out loud and a sighted reader sees as the ring the same attribute
drives. Without it, a control whose entire effect is a colour has no words to assert and
no browser-tier coverage at all. It returns `null` rather than `false` for a control with
nothing to say, because "not a toggle" and "toggle that is off" are different facts and
collapsing them lets a journey pass while proving nothing.

**Approved** — the owner chose "Adopt the 4+4 triads" when the cost was put to them.

*Unreleased — `web/frontend/src/theme.js`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/pure/contrast.test.js`,
`web/frontend/test/journeys/harness/screen.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
