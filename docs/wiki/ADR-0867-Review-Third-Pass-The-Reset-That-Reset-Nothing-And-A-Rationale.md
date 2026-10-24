# ADR-0867: Review, third pass: the reset that reset nothing, and a rationale that did not hold

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE RATING FOUND A CONTROL WHOSE WHOLE PROMISE WAS FALSE, AND THE LAST PASS MADE IT LOAD-
BEARING.** `resetSection` cleared every key in a section into `onPreferences` — which is
App's local `setUser` and nothing else — and sent no PUT. So "Reset section" emptied the
screen, every row returned to its default in front of the reader, and the next load brought
all of it back. The bug was pre-existing. What made it matter was the previous pass
narrowing the in-depth panel's own reset from seven review keys to `srTuning` alone, on the
written grounds that "the rest are rows on the section … and the section has its own Reset".
That sentence was never checked. It was true of the button and false of the write behind it,
and between the two changes five review preferences had no working restore at all.

The fix is the two lines every card's own `set` already runs — the local merge so the screen
answers at once, and the PUT so the server agrees. A journey moves How hard off its default,
presses Reset section, and reloads; deleting the PUT fails it.

**THE RULE THIS IS AN ARGUMENT FOR:** a change justified by "something else covers this" has
to open the something else and look. The reasoning was sound and the premise was not, which
is the only kind of mistake this shape makes.

**AND ONE OF THIS SWEEP'S OWN RECORDED DECISIONS IS OVERTURNED, ON EVIDENCE IT DID NOT
CHECK.** The entry above keeps **Review covers** over the pack's **Drawn from**, arguing
"the app's word is the one the rest of the screen uses for the same idea — a deck COVERS the
library, the catalogue, the quotes". Every other occurrence of the word in `en.txt` means
cover ARTWORK: "Covers, people and duplicates", "no cover", "Fetching missing covers",
`cover.noun.cover.plural`. There is no second site using it as scope, so the consistency the
entry claims does not exist — and Settings' own Sections screen carries a slider labelled
**Library covers** that is about artwork size, two screens from a row that would mean
something else by the same word. The pack's wording wins because the argument for keeping
the app's was checkable and wrong, not because the pack is the pack. The other half of that
entry stands: **Seeing lengthens half-life by** is a multiplier and the pack's "Don't show
again before / 3 days" is a cooldown in days, which is a different mechanism rather than a
rename.

**THE ROOM BEHIND THE DOOR GOT THE ROWS THE SECTION GOT.** The section was given rows and
the panel it opens was left as ten ALL-CAPS mono labels each over a full-width slider — the
exact label-over-block shape the pass had just removed, ten times in a column, inside a
change whose own changelog line reads "The interface stopped talking in a code font". The
pack draws them as rows (`settings-restructured.dc.html:657-661`) and `PrefRow` is that
shape. Its inner heading "The numbers behind it" also went: it stood over its only content,
inside a panel now titled "The numbers behind the schedule", which is the same fact twice on
one press. **The panel and the door share a name deliberately** — the pack does this, and it
is how a reader knows they arrived — which is why the dom test that asserted on that title
in both directions now keys on a tuning row instead, the only thing in the room that is
not also on the section.

**PRACTICE IS A GROUP, BECAUSE A HEADING NAMES EVERYTHING UNDER IT.** The practice deck's
two rows sat under "Schedule" — the same "heading names half its contents" defect the pass
had fixed for group 1 and then reintroduced here to keep the two columns even. The pack's
group 2 is the schedule and nothing else; it has one deck where this app has two, so the
second deck takes a heading of its own rather than borrowing one that is not about it.
Column balance does not justify filing a row under the wrong name: a reader looking for what
practice asks would not look under Schedule, and a reader reading Schedule is told a thing
that is not the schedule. Group 1's rows also go back to the pack's order — what it draws
from, then what it asks, then how hard — where difficulty had been sitting second.

**TWO SMALLER THINGS.** `width={220}` was passed to `Slider` twice; `Slider` has no such
prop and renders at the input's intrinsic width, so both lines said something the component
never read. And `form-modal-open.test.jsx` imported `TUNING_FIELDS` from `src/quiz.js` — a
module path a dom test has no declared exception for — to read a `label` that is a getter
already calling `t`, so it resolved one key twice. It asserts the words on screen now and
the import is gone.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/test/dom/form-modal-open.test.jsx`,
`web/frontend/test/journeys/tuning-the-deck.journey.mjs`, `internal/i18n/en.txt`,
`internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
