# ADR-0743: Task 16, first half: the two global screens, and the scope table under all five

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The owner's standard for these screens: "the screens should exactly resemble these. Your
rater must acknowledge that. Any departure must be heavily reasoned and approved by me."
What landed here is `char-global` and `people-global` built to the pack, plus the table the
other three will be built from. The three local scopes still wear the panel's older
presentation and are the next increment; the split is at the `if (!work)` in each body, so
neither shape has to carry the other's.*

**THE FIVE SCREENS ARE FIVE SCOPES OF ONE OBJECT, AND NOW THAT IS A TABLE.**
`identityScope({ table, work })` answers with the scope's id and its whole vocabulary — the
locator noun over the second count, whether a performer can be paired with the part, whether
a dub can be credited. Every difference between the pack's five screens falls out of two
questions (which table, which work), and five components would drift: `char-film` and
`char-game` differ by exactly two facts, which nobody reading two files would guess.

The locator noun is **derived from the Go source in the test**, not asserted as three
strings. `locatorNoun` in `whos_in_it.go` answers the same question for the number the
server computes, and the two disagreeing would print the server's count under the client's
word — a lie no test of either side alone can see.

<sub>**Since replaced.** There is no locator noun. The count it labelled could only ever
read one and the owner had it swapped for a favourite count, which needs no per-medium word
— see "The second count could only ever read one" below. The cross-language guard survives
in a better form: it now compares the wire field names rather than a noun.</sub>

**THERE ARE FIVE SCOPES, AND THERE WERE SIX.** The sixth was `people-work` — a person seen
from inside one work, where a credit's own spelling was edited — argued for here as a
departure the pack does not draw. The owner's ruling retired it: *"people is always
global!"* A person is one record however many works credit them, and the place to change
what one work PRINTS is that work's own credit list, not a fourth screen offering to rename
them everywhere. `identityScope` now returns `people-global` for a person handed a work and
drops the work; the table still has one switch and no special case.

**WHAT WENT WITH IT, and it is a capability rather than a screen.** `work_person.credit_as`
— Bulgakov as "M. Bulgakov" on the Vintage — has no editor anywhere in the app now. The
column and `PUT /credits` both remain, and every credit tile on a person's record still
prints "as Harry", so nothing is lost from the data; there is simply nowhere to type it.
The work's cast list is NOT the substitute: it edits `work_cast`, which is characters and
performers. Its home is an open question, and the two candidates are the work's own credit
list and the tile that already prints the spelling.

**A COMPANY IS A `people` ROW WITH DIFFERENT WORDS.** A studio (0040) and a publisher both
get these screens — every control on them is right for a company — and what differs is the
vocabulary: founded rather than born, "The company", "Merge with another company". One
predicate answers it (`isOrganisation` in people.jsx), read by the heading, the rows and the
link popup's id spaces so they cannot disagree.

It reads the credit ROWS, and the reason is the split this repo keeps rediscovering:
`work_person.role` is `director` for BOTH a film's director and a game's studio, because
`movies.director` holds both and `media_type` is the only thing telling them apart. There is
no `RoleStudio` for a role read to find. `person_kinds` looks like the better source and is
worse — it is empty for a record a credit sync created, which is every studio and publisher
in a library nobody has fetched portraits for.

**THE DEPARTURES, each reasoned:**

- **The blast-radius sentence is kept on both global screens.** The pack gives `char-global`
  "Edits here reach every work." over its name / sort / born rows and gives `people-global`
  nothing over the same three. They write to the same kind of record with the same radius,
  so the omission reads as an inconsistency in the pack rather than a decision — and that
  sentence is the only thing between a reader and renaming an author across thirty-one books.
- **The lines list and the description field are kept**, neither being in the pack. "Which
  quotes are this character's" is the question `speaker_cast_id` exists to answer and the
  pack predates anything reading it; the description is the fallback every `work_cast` row
  without one uses, so dropping the only place it can be typed would strand the column.
- **Aliases are the name row's second line**, which is the pack's shape — and the chips that
  add, remove and split a spelling moved BEHIND that row rather than sitting under it, since
  an always-open list printed every alias twice. Split is a verb per spelling and cannot
  live in one line of them, so the chips stay; they are now the row's editor.
- **The works strip's tile opens that work's card, not the work's screen.** The pack's
  global screen is navigation only: every per-work act belongs to the local screens, which
  are not built. Dropping the controls until they are would leave a reader unable to promote
  a picture at all; drawing the cards under the strip would list every work twice. The tile
  opens its own card — the same row→editor shape the name row above it uses.
- **The performer's name stays on the global screen**, on the tile face's own title. The
  pack does not name a performer there (that is the local screen's credit row, with its own
  door), but the panel this replaces reached the performer from every appearance, and a fact
  that is on screen today should not vanish while the screen meant to carry it is unbuilt.
  The door moved one press in; the fact did not move.
- **"performer" is `unit.role.actor`.** The pack's crumb says performer; `work_person.role`,
  the `unit.role.*` family and every cast screen say actor. One thing with two names in one
  interface is the glossary's whole complaint.
- **The two destructive rows are drawn only where they act.** The pack's "Remove from all
  works" opens a multi-step picker that is not built, so the row is absent rather than
  present and inert — the same rule the strip's add tile already followed.

**AND ONE REAL BUG THE REBUILD INTRODUCED AND THE SUITE CAUGHT.** The new global branch
returned before `DropWorkDialog` was rendered, so a removal the server refused — the
character still speaks on twelve lines — showed nothing at all: the press looked like it
had failed silently. It is now rendered by the branch that can remove.

**A NOTE ON THE TESTS, because it cost an hour.** Several existing cases read
`act(() => within(card(t)).getByText(…).click())`. React defers a nested flush until the
outermost `act()` exits, so the helper's own press had not re-rendered when the helper
queried for its result — and the failure looks exactly like a broken click handler. Take the
element first, then press.

**Still to build:** the three local scopes (the facts row, the two counts, the credit rows
and the dub section), the exhaustive tile chooser over `whos-in-it`, "Set for the identity",
and "Remove from all works" one at a time.

<sub>Unreleased — `web/frontend/src/identityScope.js` · `identityGlobal.jsx` · `identity.jsx`
· `internal/store/identity.go` · `test/rules/identity-scope.test.js`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
