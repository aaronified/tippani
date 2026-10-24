# ADR-0794: Every name box asks for capitals, and no prose box does

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

The owner's: *"all name type fields should have the auto capitalisation (the html based one
used in character name for example). chapter name, editor, song name, etc all can benefit
from that."*

`autoCapitalize="words"` is a **hint to the phone's keyboard and never a rewrite** — press
shift and `bell hooks` is what gets stored, which `ui.jsx`'s own note has said since the
casing pass. That is what makes this cheap: on a name it helps, and on prose it is merely
annoying rather than destructive. Nine boxes were missing it, including the chapter name
the owner named first.

**The interesting part is the half that must NOT have it.** A sweep adding the hint to
every input would be wrong on a quote, a note and a translation (sentences, where per-word
capitals are the keyboard fighting the typist), on an occasion (*"the funeral of his
brother"* is the common shape, and title-casing it is not an improvement), on a location or
a locator (a page, a percentage, a stanza), and on a timestamp. So the rule has two
directions and `name-casing.test.js` checks both — which is what makes it a rule rather
than a ratchet somebody satisfies by adding the attribute everywhere.

### The key cannot always answer

`common.field.name` is deliberately absent from the guarded list, and the reason is a real
limit on keying this rule to an i18n key: **that one key is reused by a board's name, a
sticker's name and a tag's name**, and the third is lowercase by this app's own convention —
the same convention that keeps `common.field.tags` in the prose list. One key cannot answer
for all three. The two that want the hint carry it at their call site and the guard does
not police them; naming the gap beats a rule that would be wrong a third of the time.

`CastCombo` and `NameInput` are exempt for the opposite reason: the hint is already inside
them (`nameCase` defaults true; `NameInput` hardcodes the attribute and exists for exactly
this). Requiring the prop at those call sites would make a caller that restated it read as
though the others had opted out.

### And the guard reinvented a walk the repo already had

The first cut of `name-casing.test.js` hand-rolled `readdirSync` over `src/`, and
`one-walk.test.js` refused it — correctly, and for this test's own stated worry, already
solved: *"a walk that finds nothing makes a guard green while it checks nothing, which is
how two of these were found wrong by a reader rather than by a run."* `sourcesUnder()`
throws below its floor, so the guard cannot silently read nothing, and it is **recursive**,
which a one-directory readdir is not — a guard that stopped seeing a form moved into a
subfolder is the exact bug it exists to prevent. Worth recording as the second time a new
source-reading test has had to be pointed at that helper.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
