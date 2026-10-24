# ADR-0848: Changed means set, not different

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE PACK PUTS A NUMBER ON EVERY SECTION** — "3 changed", "all default" — on the tab, in
the section's header and totalled on the phone's index. The obvious way to compute it is a
table of every preference a section owns with its default beside it, and that table is the
trap. Every card in `Settings.jsx` already states its default at the point it reads the
value, as `p.srDaily || 8`. A second copy of seventy-four defaults is a second copy that
goes stale, and a badge that has gone stale is worse than no badge: it sends a reader
looking for a change nobody made.

**SO A PREFERENCE COUNTS WHEN IT IS PRESENT.** One the reader has never touched is absent
from the object the server sends. Counting presence needs no defaults at all. The cost is
that setting a value back to its own default still counts, and that is defensible — the
reader did go and set it, and the Reset is right there to unset it.

**FALSE AND ZERO ARE VALUES SOMEBODY CHOSE**, which a falsy test would have dropped.
`hideLibrary: false` is only ever written by a reader switching the Library back on; a
count that ignored it would say "all default" over a section they had just changed twice.

**THE MEMBERSHIP TABLE IS THE PART THAT CAN ROT, SO A TEST OWNS IT.** A tab you are not
standing on draws no rows, so the count cannot be collected from what rendered — which
was the first design and is why it was abandoned. `settings-prefs.test.js` reads the Go
struct's json tags and fails when a key belongs to no section and is excluded by none.
That test carries a declared exception to the testing rule, and the reason is that the
claim under test IS a claim about a source file: there is no screen you can drive to
discover a preference nobody wired up, because the symptom is a number that fails to
move.

**AND WHAT IS DELIBERATELY NOT COUNTED IS NAMED.** `tour`/`tourStep` are progress,
`defaultBoardId` is chosen on the board, `creditSeparators` belongs to Metadata, and the
colour-category triples left Settings for the Metadata console — counting those under
Theme would put a number on a tab that has nothing to do with where the reader changed
them.

**RESETTING SENDS EMPTY, NOT DEFAULTS**, for the same reason the count reads presence:
clearing a key is what restores the default, and it is the only restore that cannot
disagree with the card that reads it.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/prefRow.jsx`,
`web/frontend/test/pure/settings-prefs.test.js`,
`web/frontend/test/dom/settings-changed.test.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
