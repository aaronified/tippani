# ADR-0740: The character screens: the owner's rulings, before a line of them was drawn

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner supplied the design pack's own prototype for the character popup —
`Character_Popup.dc.html`, five screens in one file — and set the bar: "the screens
should exactly resemble these. Your rater must acknowledge that. Any departure must be
heavily reasoned and approved by me."* So the departures were found first, put to them,
and are recorded here as decisions rather than discovered later as drift.

**THE PROTOTYPE IS FIVE SCOPES OF ONE OBJECT**, not five screens: `char-global`,
`char-book`, `char-film`, `char-game`, `people-global`. The qualifier decides the header's
art, the locator vocabulary (page · timestamp · quest) and the performer pairing (none ·
actor · voice); everything under the identity heading is the same object in all of them.
Its row vocabulary is nine kinds — `head` · `row` · `names` · `facts` · `pair` · `pills` ·
`seg` · `credit` · `strip` — and its picker is one sheet in three modes (person, note,
choose), because all three answer one question about one credit and two dialogs for that
would drift apart.

#### The eight rulings

| # | The question | The owner's answer |
| --- | --- | --- |
| 1 | Two unnamed credits on one character in one work collide on `idx_work_cast_pair` | Drop uniqueness where there is no name to be unique about |
| 2 | Where `Part` · `First appears` · `Age here` live | Three free-text columns on `work_cast` |
| 3 | `names()` makes the alias list ORDERED, against 0056's "display never uses one" | Yes — aliases gain a `seq` |
| 4 | The header's qualifier chip prints `char-film` / `people-global` | Drop it — the crumb and the cover-with-glyph already say the scope |
| 5 | The prototype ellipsises names; the standing rule forbids it | **The standing rule wins** — names scroll under a fade |
| 6 | Nine of its font sizes are off the ten-step type scale | Snap each to the nearest step |
| 7 | `pair()`'s second count — Scenes and Quests are numbers nothing stores | A DISTINCT count over the character's own quotes, per medium; a blank locator is one of the distinct values |
| 8 | The strip's fade: four-or-more tiles, or measured overflow | Measured, through the repo's own `Scroller` |

**Ruling 5 is the one worth reading twice.** The prototype truncates in three places — a
row's label, a credit's name, the header title — and the standing rule's own words are
"a shortened name and a short name look alike, so an ellipsis on one destroys the thing
the row exists to show". The prototype's reason for `nowrap` is real and is kept: a credit
row must not reflow, because a reflow moves every other row on the list. A scroller holds
the row height exactly as `nowrap` does, so the resemblance survives for every name that
fits — which is nearly all of them — and differs only where the prototype would have lied
about a name. `typescale-baseline.json`'s ratchet is not spent.

**Ruling 7 in the owner's own words:** *"In a movie all scenes are distinct anyway."* So
the second count is `COUNT(DISTINCT locator)` over this character's quotes in this work —
`annotations.chapter_no` for a book, `dialogues.timestamp` for a film, `dialogues.quest`
for a game — with the blank coalesced rather than dropped, so a work where nobody has
filled a locator counts one. The prototype's words (Chapters · Scenes · Quests) are kept:
the label was never the departure, the number was.

**And one correction to my own reading of the pack.** I first listed the draggable strip
order as a ninth schema gap. `strip()` takes a `sortable` parameter and NEITHER call site
passes it — both strips are scroll-only, and `char-global`'s own hint says so ("the order
is the release order"). The drag-to-sort code is carried and unused. No column.

**The carousel chooser is exhaustive, on the owner's instruction** — *"the carousels will
open the list of the characters/roles linked with the work + the character/people and the
work's tippani link as well. The user will then choose which they want."* The prototype
lists only the character on the path you arrived by; the ruling widens it to every
character linked to that work and every person credited in it, plus the work's own page,
grouped under three headings so a large cast stays readable. The prototype's own comment
points the same way: "a work with two roles lists both characters here — which is why
this is a list."

<sub>Unreleased — `internal/store/migrations/0063_credit_and_character_fields.sql` ·
`internal/store/credit_fields_test.go` · `internal/httpapi/cast.go` · `cast_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
