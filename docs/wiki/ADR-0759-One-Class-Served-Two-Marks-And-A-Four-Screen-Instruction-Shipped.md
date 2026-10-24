# ADR-0759: One class served two marks, and a four-screen instruction shipped as one screen

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Three owner questions, and all three were mine.** *"you are again messing things up… who
authorises these departures? i want to meet them."* Nobody did. Each is recorded here with
what was actually wrong, because two of the three are the same failure twice.

**THE PROVIDER MARKS WERE NOT REMOVED ON PURPOSE — A RULE I CALLED DEAD WAS LOAD-BEARING.**
`36fee095` fixed "seven solid squares" in Metadata by deleting the paint rule from
`.src-mark`, and its commit message states the reason: *"with no `mask-image` anywhere there
was nothing to mask."* That was false when it was written. TWO components render onto that
class and they need OPPOSITE things from it:

| | how it draws | what `.src-mark` must be |
|---|---|---|
| `SourceIcon` | an inline `<svg>` child | a flex box, **no** background |
| `ProviderMark` | `mask-image` set inline, **no child** | `background-color: currentColor` + mask sizing |

`ProviderMark` already existed and sets a mask on every links pill, every ids row and every
field-source tag in the app. Deleting the fill left a 24px span with no background and no
child — nothing, everywhere. The owner saw it as three bare words where a person's links
should be.

**AND THE GUARD I WROTE TO PREVENT IT BLESSED IT.** `src-mark-visible.test.js` asserted "IF
this class paints a background, a mask must be cutting a shape out of it" — which a class
painting NOTHING satisfies. It was written for the first regression and passed through the
second. Its invariant is two-sided now and read from the components rather than from a class
name: whichever class the child-less renderer uses must be filled and must size its mask,
whichever class the glyph renderer uses must not be filled. Both regressions fail it, and so
does swapping the two classes over.

**THE WINDOW IN THAT GUARD WAS A CHARACTER COUNT, WHICH IS WORTH ITS OWN LINE.** It read
each component with `ui.slice(at, at + 2600)`, and adding a comment to one of them pushed
the code out of the window — two cases silently went from asserting something to finding
nothing, which is indistinguishable from finding nothing wrong. It is bounded by the
function now. A guard whose reach depends on how much prose sits above the code expires
without saying so.

**METADATA WAS THE LAST SCREEN DRAWING CATEGORY GLYPHS.** The owner's second question —
*"do you think the icons you used in the metadata sources are the provider icons I spoke
about?"* — no. A book for Google Books, a film strip for TMDB, a television for TheTVDB, a
gamepad for IGDB: the app's own drawings, on the one screen whose whole subject is which
supplier is which. `ProviderMark`'s own header had already made the argument against them
("five of the twelve suppliers shared one drawing") and Metadata had never been switched
over. `SourceIcon` draws the real mark where one exists now, at 16px inside its 24px box so
the state RING still has somewhere to be — a mask clips an element's background AND its
box-shadow, so a mark filling the box edge to edge would have taken the owner's own
"border on the provider icon" with it.

**AND THE PAIR OF NUMBERS WAS ON ONE SHEET OF FOUR.** The instruction named them: *"for all.
people, character, details, all pages those two boxes are."* I asked which box, was told
"swap the second box everywhere it exists", and read "everywhere it exists" as a description
of the CODE rather than of the four screens already named — found the one screen with a
pair, changed it, and reported the scope as covered. The owner's correction: *"i told you to
standardise the quotes•favourited pair in all relevant popup cards (details, people,
character (global and local)). why did you not?"*

**SO THE CELLS ARE ONE FUNCTION AND THE SCOPE IS A PARAMETER.** `quotePair.jsx` builds both
cells and both doors; the four sheets pass their own scope and their own chips. The captions
do NOT vary — "quotes" and "favourited" mean the same on all four, which is what makes the
numbers comparable — and only the tooltip says what each is counted over.

**THE COUNTS COME OFF THE SAME ROWS AS THE LIST BENEATH THEM**, which is why they are not a
new aggregate query. `store.QuoteTally` is returned by the two functions that already build
a record's lines, counted before the cap; a second query would have been a second definition
of "this character's lines", and the linker's rules are not trivial (a two-hander is
deliberately unlinked, a tombstoned cast row is excluded, a book highlight counts for a
character and not for a performer). A work's pair rides on the count its own card already
draws, with a favourite count added in the same statement.

**A PERSON'S PAIR HAS NO DOOR, and that is a decision rather than an omission.** Their lines
are linked as a performer (`dialogues.actor_id`) OR as a quoted speaker
(`utterances.speaker_id`) — two facets, and chips across two fields AND together — so one
press could only ever reach half of what the number counted. A figure with no door is the
honest state `PairRow` already draws; a door onto a search covering half the rows is the
class of quiet wrongness the whole of this entry is about.

**AND A TEST FIXTURE ASSUMED SOMETHING THE APP DELIBERATELY DOES NOT DO.** The first version
of the character case billed "Harry" on two films and expected one record. `CharacterForCast`
keys on (kind, work, folded name) on purpose — *"'Narrator', 'Mother' and 'The Doctor' recur
across unrelated works and are not one character"* — so a record spans two works only when a
reader says so. The fixture uses that verb now; the count was right and the test was wrong.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `index.css` · `quotePair.jsx` (new) ·
`identityGlobal.jsx` · `identityLocal.jsx` · `WorkDetails.jsx` · `identity.jsx` ·
`internal/store/quote_person.go` · `quote_cast.go` · `internal/httpapi/identity_handlers.go`
· `book_handlers.go` · `movie_handlers.go` · `internal/i18n/en.txt` · `bn.txt` ·
`test/rules/src-mark-visible.test.js` · `quote-pair-everywhere.test.js` (new) ·
`test/dom/settings-key-field.test.jsx` · `identity_counts_test.go` (new)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
