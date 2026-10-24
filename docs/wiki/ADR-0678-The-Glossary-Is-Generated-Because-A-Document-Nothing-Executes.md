# ADR-0678: The glossary is generated, because a document nothing executes cannot fail

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** `docs/ui-glossary.html` is built by `web/frontend/scripts/glossary-build.mjs`
from the code it describes. The page is no longer edited by hand.

**IT HAD BEEN WRONG FOR A RELEASE, AND THAT IS THE ARGUMENT.** The page still offered a
*Paper / Film aesthetic* toggle after v3 deleted aesthetics — a control driving a
`data-aesthetic` attribute that appears zero times in `index.css` and zero times in
`theme.js`. Its topbar sample showed an Import tab `routes.js` no longer has. Four classes
it drew (`.bulk-bar`, `.show-toggle`, `.tp-filter-row`, `.bottom-nav-brand`) had been
deleted; two more (`.bin-back`, `.bottom-nav`) were cited in entries; and two helpers it
credited, `linkButtonClass` and `deleteButtonClass`, survive only in a comment recording
that they had no caller left. Its buttons were missing `tactile`, the class that makes a
button press — the exact drift the page's own `IconButton` entry describes catching once
before. None of this was carelessness. There was no mechanism, and prose is the half that
rots because nothing renders it.

**THE SOURCE IS THE CODE, AND THE LINK IS THE ENTRY'S OWN `src` LINE.** Every entry already
carried one — `InlineField — ui.jsx · .inline-field` — so the documentation had been naming
its own source all along and nothing was reading it. The generator does: it takes the
leading identifier, and if that component carries a `glossary` declaration it renders the
real component instead of a copy of its markup. **Adding the declaration is the whole
conversion** — no registry to update, no second key to keep in step, and the migration can
go one component at a time.

**THE THEME DATA IS CAPTURED, NOT MIRRORED.** The old page carried a hand-written copy of
`theme.js`'s palettes, which is how it ended up with `PALETTES['paper-dark']` after that
key stopped existing. The generator instead runs `applyTheme()` in a jsdom document and
keeps the custom properties it actually wrote. There is nothing left to keep in step, so the
toggles now offer all eight material sets in both modes under any accent — 64 combinations
the hand-written mirror could never have carried. Stored as a base per mode+accent plus the
twenty tile properties that differ per set: whole, it cost 151KB; as deltas, 85KB.

**`src/tokens.js` IS THE OTHER HALF.** The constants the page narrated in prose — 44px as
the touch floor, 999px as a person or a value, the hand-drawn card corner — are authored
once there and printed into the page from that table, so a number cannot be retyped into
documentation. **They are not declared as custom properties, and that is deliberate:**
declaring `--touch-min: 44px` while fifteen rules go on saying `min-height: 44px` would add
a third name for one number beside the literals it was meant to replace. `tokens.test.js`
binds each value to the literal the stylesheet still contains; the sweep that turns those
literals into `var()` belongs with the pass that introduces `ROW` and `EDGE`, where it can
be reviewed as one change. For the same reason the edge-fade distances are **not** in
tokens.js yet — nothing reads them, and plumbing with no tap is a thing this document has
already had to name once.

**THE TWO RATCHETS, RATHER THAN TWO ASPIRATIONS.** 20 ordinary components and 49 `Icon*`
glyphs have no entry at all — the page has a *Marks* section with two entries and no
catalogue of the icon set. Filling 69 entries is not what this change is, so the test
records the numbers that are true today and refuses to let them grow, plus a third
assertion on their sum so raising one ceiling means lowering the other. The same shape
holds the 141 entries still on carried markup. A ratchet makes the debt visible and turns
paying it down into a one-line diff; an aspiration in a comment does neither.

**And the checkers were made to stop crying wolf before they were trusted.** The first cut
reported `useCardMenu` as a missing `CardMenu`, `skipReason` as a missing `Reason`,
`ANNOTATION_COLORS` as an undocumented component, `dialogues.season` as a missing CSS class
and `.dot-*` as a class rather than a wildcard — five false alarms in one run. `ui.jsx`'s
own icon-import test already records where that ends: a checker nobody believes gets
deleted. Each matcher was narrowed until every remaining finding was real, and all nine
that survived were fixed.

<sub>Unreleased — `web/frontend/scripts/glossary-build.mjs` · `web/frontend/scripts/glossary/` · `web/frontend/src/tokens.js` · `web/frontend/src/ui.jsx` · `web/frontend/test/rules/tokens.test.js` · `web/frontend/test/rules/glossary-registry.test.js` · `scripts/glossary-css.mjs` (deleted)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
