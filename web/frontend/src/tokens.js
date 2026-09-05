// The geometry constants, authored once.
//
// WHY THIS FILE EXISTS. `docs/ui-glossary.html` used to *narrate* these numbers in
// prose — "44px is the floor for anything tappable", "999px is a person or a value" —
// while `index.css` restated them as literals, and the two had no way of disagreeing
// out loud. A number written down in two languages is a number that drifts in one of
// them, and the prose is always the half that rots, because nothing renders it.
//
// So the value is authored HERE, in one place, and it has three readers:
//
//   1. `tokens.test.js`, which asserts every `proof` below still appears verbatim in
//      the built stylesheet. That is the binding: change a number here without
//      changing the CSS, or the other way round, and the suite goes red.
//   2. `scripts/glossary-build.mjs`, which writes the glossary's rules section from
//      this table rather than from a paragraph somebody typed. The documentation
//      cannot restate a constant from memory because it never gets to type one.
//   3. A reader who wants to know what 44 means without grepping 255KB of CSS.
//
// WHAT IS DELIBERATELY NOT HERE, and it is the harder half of the decision:
//
//   - `TYPE_STEPS` and the palettes stay in `type.js` and `theme.js`. Both are
//     already single sources with their own tests. Copying them here would create
//     exactly the second source this file exists to remove.
//   - `ROW`, `EDGE` and the two edge-fade distances ARRIVED WITH THE CODE THAT
//     READS THEM, which is the condition this note used to set for them. `--edge`
//     has three consumers (the page body at two widths and the top bar), the fade
//     distances have six rules apiece, and `--row` has almost none — see its entry
//     below, which says so rather than pretending otherwise.
//
// SOME OF THESE ARE CUSTOM PROPERTIES AND SOME ARE NOT, and the split is the
// decision rather than an inconsistency. `--edge` and `--row` are declared, because
// two elements that are not in the same subtree (the page body and the top bar) have
// to agree about the gutter, and a variable is the only way for them to. The rest —
// 44px, 999px, 9px — are literals with a proof, because declaring `--touch-min: 44px`
// while 15 rules go on saying `min-height: 44px` would add a token nothing reads
// beside the literals it was meant to replace: two sources again, plus a third name
// for the same number. Turning those into `var()` is a sweep of its own, and it can
// be reviewed on its own; until then the test is the binding, which is weaker than a
// variable but honest about what the stylesheet actually says.

// Each entry: what the number IS, what it MEANS, and the literal that proves the
// stylesheet still agrees. `proof` must contain `value`, and `tokens.test.js`
// checks that too — otherwise a proof could quietly stop being about its own token.
export const GEOMETRY = {
  touchMin: {
    value: '44px',
    of: 'The floor for anything tappable, and it is a floor rather than a size — a control may be taller, never shorter.',
    proof: 'min-height: 44px',
  },
  pill: {
    value: '999px',
    of: 'A person, or a value. The most-used radius in the app, and the one that says "this is a thing, not a verb".',
    proof: 'border-radius: 999px',
  },
  actsRadius: {
    value: '9px',
    of: 'Something that acts on the row it sits in. `.tp-btn` wears it, which is what keeps a button from reading as another pill in a row of chips.',
    proof: 'border-radius: 9px',
  },
  buttonBorder: {
    value: '1.4px',
    of: 'Every `.tp-btn`. Transparent at rest on the primary; `--ink-border` on a ghost.',
    proof: 'border: 1.4px solid transparent',
  },
  cardBorder: {
    value: '1.6px',
    of: 'Every `.hand-card`. Heavier than a button on purpose: the card is the object, the button is a control on it.',
    proof: 'border: 1.6px solid var(--ink-border)',
  },
  cardRadius: {
    value: '15px 9px 14px 10px / 9px 15px 10px 14px',
    of: 'The hand-drawn card corner — four different radii on two axes, so no two corners of a card match. `.hc-r1/r2/r3` rotate this same figure rather than inventing three more.',
    proof: 'border-radius: 15px 9px 14px 10px / 9px 15px 10px 14px',
  },
  edge: {
    value: '20px',
    of: 'The page\u2019s horizontal margin, and the one number the page body and the top bar must never disagree about \u2014 they are not in the same subtree, so a literal in each is a literal that drifts. Falls to 12px on a phone. Spacing, so it stays px: a gutter is not made of words.',
    proof: '--edge: 20px',
  },
  row: {
    value: '12px',
    of: 'The vertical step between rows. ALMOST NOTHING READS THIS YET \u2014 the app still spaces its screens with hand-typed Tailwind `space-y-*` classes across seven different values, which is the drift this constant exists to end. `spacing-debt.test.js` holds that count as a ratchet; the screen-by-screen pass is what spends it.',
    proof: '--row: 12px',
  },
  fadeX: {
    value: '26px',
    of: 'How far a sideways scroller dissolves at an end that still has content. An edge fade IS the signal that a row scrolls \u2014 there is no arrow, no scrollbar and no counter. px, because what it has to clear is a thumb rather than a word.',
    proof: 'linear-gradient(to right, #000 calc(100% - 26px), transparent)',
  },
  fadeV: {
    value: '1.6em',
    of: 'The same fade downward, and the unit is the whole point: it has to land on the LAST LINE, and the last line moves when the reader changes their type size. `max-height: 72px` is three lines at exactly one setting; 1.6em is one line at all of them.',
    proof: 'linear-gradient(to bottom, #000 calc(100% - 1.6em), transparent)',
  },
  hatch: {
    value: '45deg',
    of: 'The `.ph` placeholder for a missing picture: `--ink` at 5%, 12px on and 14px off, at 45 degrees. A missing PERSON is never this — that is the silhouette, and the two are not interchangeable.',
    proof: 'repeating-linear-gradient(45deg, color-mix(in oklab, var(--ink) 5%, transparent) 0 12px, transparent 12px 26px)',
  },
}

// The ink roles: which token a thing wears at rest. This is the part the palette
// could not settle — `theme.js` says what the colours ARE, and this says what they
// are FOR, which is a different question and the one that actually drifted (a dock
// whose glyphs sat at `--ink` beside tabs at `--soft`, so one bar carried two blacks).
//
// No `proof` here: these are a rule about usage, not a literal a stylesheet repeats,
// and inventing a grep for them would be a test that passes by coincidence.
export const INK_ROLES = [
  ['--ink', 'Body text, a person’s name, a row label, a work title — and any glyph under the pointer.'],
  ['--soft', 'Every glyph at rest, everywhere. A chip’s label. Secondary prose.'],
  ['--faint', 'A mono label, a locator, a drawer badge, a role line.'],
  ['--accent-ui', 'A chapter heading, a link, a MORE, the Add row.'],
  ['--on-accent', 'Anything riding on a lit row, key, tab or chip.'],
  ['--error', 'Destruction only. Not a warning, and not a subtractive half.'],
  ['--ok', 'Commit. The tick in a sheet head is the only green on that surface.'],
]
