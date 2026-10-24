# ADR-0859: The works console sees the library through what is missing

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THREE OF THE PACK'S SEVEN ISSUES WERE NOT OFFERED.** The dropdown had `nocover`,
`lowres`, `noyear` and the rest; it had no "No people", no "No synopsis" and no "Complete"
(`docs/design/prototypes/metadata.dc.html:851`). The last is the one a reader reaches for
after a pass — to see what they finished — and the console's whole premise is seeing the
library through what is MISSING, so an issue it cannot name is a shelf it cannot reach.

**"NO PEOPLE" CROSSES THE SHELVES, AND EACH SHELF ANSWERS IT WITH THE CREDIT IT HAS.** A
book's people are its author; a film's are its cast, not its director — the pack's own
fixture flags a Ray film with a director and no cast as `nopeople`
(`metadata.dc.html:464`). A film with no director is `no_director`, beside it.

**"COMPLETE" IS NOT A PREDICATE.** It is "every other filter would reject this", and that
is the only definition that cannot drift. A hand-written completeness test is a second list
of what completeness means, and the day a gap is added it becomes the stale one — a work
missing the new field would go on being called complete, which is the one answer this
filter must never give wrongly.

**A FILM COULD NOT SAY WHETHER IT HAD A SYNOPSIS.** `movies.description` has existed since
0003 and `GET /metadata/library` never reported it, while the book row has carried
`has_description` all along. Half a library that cannot answer a question is a filter that
cannot be offered over the library.

**AND THE FILM ROW WAS FOUR CHIPS SHORT.** The dropdown has always offered `no_director`,
`no_year` and `no_genre` over films, and the rows it returned carried no chip saying why —
so a film filtered to "No year" drew `chipsEmpty`, which is the word "Complete". A row that
answers a filter with its own contradiction is worse than one that answers nothing.

**THE FILTER HAD NO NAME.** It is wrapped in a `Tooltip`, which carries words and adds no
attribute, so the one control this console is built around announced itself as an unnamed
combo box — while the type selector beside it has had a `title` since it was written. "Which
gap" rather than the tooltip's sentence: a name says what a control is, and a tooltip says
what it does.

**FILTER-AS-SELECTION WAS THE OPEN QUESTION, AND THE ANSWER IS "ONE PRESS AWAY".** The pack:
*"Pick an issue and the list becomes only the works that have it, so the bulk fetch below
acts on exactly those."* The repo acts on the rows a reader has TICKED, which is a different
safety model and the better one — a press that writes to a hundred records should be a press
on a number you can see. "Select all shown" already ticks exactly the filtered set, so the
pack's sentence is one press away with the count on the screen first. Nothing was built for
this; the finding is that nothing needed to be.

**"FETCH EMPTY FIELDS" IS THE RE-VERIFY FLOW WITH THE OVERWRITES DROPPED.** The pack draws
two bulk acts (`metadata.dc.html:852`). The second is that flow exactly. The first is the
same flow with everything that would overwrite removed before the reader is asked — the
review already ticked precisely the empty-stored rows, so the two acts were already one act
and its default, with no way to ask for only the default. The rejected alternative was a
second, unattended endpoint: it would have been a second trust boundary over the same
writes, and the reader would have had no way to see what a hundred works were about to be
given.

**THE SURFACE HAD TO SAY WHICH ACT OPENED IT.** Landing in a sheet headed "Re-verify
metadata" after pressing "Fetch empty fields" is the surface contradicting the button, and a
reader cannot tell from it whether the overwrites are hidden or simply absent.

**THE PAGE'S PROGRESS BAR STAYS AT THE TOP OF THE PAGE.** The pack draws the progress line
inside the works section; the bar the repo has belongs to the whole-library fetch, which is
started from the screen's own ⋯ menu and runs while the reader is on any section. Moving it
into Works would hide a running job from everywhere else. The bulk act's progress is inside
the flow it belongs to, which is the pack's point.

**THE VOCABULARY GAINED `choose`, AND IT HAD TO.** A native `<select>` is not pressable — a
reader opens it and picks a word — and `type` cannot drive one either: it clicks, clears and
types, and a select has nothing to clear. So the control this console is FOR could be looked
at from a journey and never operated. It names the option by its words, never by the token
the app stores, and it refuses an option that is not offered rather than leaving the list on
whatever it was showing: a silent no-op is a journey that goes on asserting against the
unfiltered screen and passes.

**TWO ASSERTIONS PASSED WITH THEIR SUBJECT DELETED, AND BOTH FAILED THE SAME WAY.** A
`toContain('no synopsis')` over the whole screen matched the FILTER that had just been set to
it — a closed list prints the option it is on — so every chip could be removed and the
journey stayed green; it counts occurrences now. And `see('Fetch empty fields')` matched the
button that had just been pressed, because `see` folds case and the bulk bar renders in
capitals; the heading is the only place those words are drawn as written, so the assertion is
case-sensitive and the other flow's heading is ruled out beside it.

*Unreleased — `internal/httpapi/metadata_library.go`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/src/ReverifyReview.jsx`, `web/frontend/test/journeys/harness/screen.mjs`,
`web/frontend/test/journeys/filtering-works-by-what-is-missing.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
