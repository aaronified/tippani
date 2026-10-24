# ADR-0742: The rating pass found the chips half-built, and what each finding turned out to be

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The chips landed at `ecdf52f` with a green suite behind them and scored **5/10**. Every
finding held up under a probe. They are recorded here rather than quietly fixed, because
four of the five are the same mistake: a claim asserted in a comment, a changelog and a
test that the code did not make true.*

**THE PAYLOAD DID NOT MEAN WHAT THREE DOCUMENTS SAID IT MEANT.** `characterImagesFor`
emitted an entry only for a character who HAD a stored picture — correct while the client
drew face discs, since a disc with no picture is a picture of nobody — and the new card
suppresses its own character text as soon as any chip draws. So a line reading
"Rick, Ilsa, Sam" with one stored portrait drew one chip and **lost two names outright**,
where before the change all three printed. The commit message, `CHANGELOG.md` and the
entry above all claimed "one entry per named character"; the only test for it used a
fixture (`{name: 'Ilsa', path: ''}`) the server never sends. Worse below it: all three fill
sites ran the fold inside `if found := loadCharacterImages(…); len(found) > 0`, so a reader
who had never stored a single character picture — most readers, every new library — got
`character_images` on **no line whatsoever** and therefore no chips at all, anywhere.

The fix is on the server and it is not a data change: the same query, the same split, one
fewer `if`. An entry now exists per name with the path it has or an empty one, and the
distinction the old shape was protecting survives — an entry with an empty path is a
character nobody has a picture of, no entry is a name the line does not carry, which is
exactly what the client's ladder (this picture → the performer's → a hashed silhouette)
needs. `CharacterFaces` already filtered empty paths, so the disc rows are untouched.
`TestALineNamesItsCharactersWithNoStoredArtAnywhere` fails against the old gate.

**THE LABEL CHIP ATE THE PRESS OF THE THING BEHIND IT.** `PersonChip` calls
`stopPropagation` — it must, or opening a character would also toggle the card it sits on —
and the new `span` form kept the handler. Home's favourite tile is ONE button from its
label to its faces, and the chips draw inside it, so the row became a dead strip across the
middle of the tile: press a name, nothing happens. The entry above says "the tile is itself
the press", and it was not. A label now carries no handler at all.

**A `<div>` INSIDE A `<button>`.** Same site. `Scroller` rendered a div and a button's
content model is phrasing only, so the browser is free to reparent the row out of the
button. `Scroller` gained an `as` prop and the chip row is a `span`; `.speaker-chips`
already sets `display: flex`, so nothing moves.

**THE CHARACTER AND PERFORMER PAGES NEVER GOT THE PILLS**, though the ruling named them.
Doing it needed one honest piece of server work, and the asymmetry is the interesting part:
a character's lines are linked THROUGH `work_cast`, so the name the line prints is already
its character text, while a person's are linked through `actor_id`, so the printed name is
the PERFORMER. Folding the printed name on the person's side matches "Claude Rains" against
a cast keyed by character and draws nothing. `QuoteLine` therefore carries the roster as its
own field beside the printed name, and one handler folds both.
`TestAPanelsLinesCarryEveryCharacterNamedOnThem` fails with exactly that symptom when the
printed name is folded instead. The chips there open nothing, and the reason is not Home's:
the panel is already the record's own page, so the chip that would open a character is where
the reader is standing.

**AND THE FILM CARD LOST A STEP.** The old wrapper was `mt-1.5`; the new one had none, so
the row sat flush against the quote. `SpeakerChips` takes a `className` for the caller's
spacing — the film frame wants a step above the row, the book card does not because the
block above it already carries one, and the panel's line wants air on both sides.

**WHAT THE TESTS THEMSELVES GOT WRONG, TWICE.** The suite was green through all of this.
Beyond the two hollow assertions already recorded, adding a locale key with no call site and
importing `t` into a file that names a `.map((t) => …)` parameter were both caught only by
existing sweeps (`locale-complete`, `token-coverage`, `locale-shadow`) — which is the
argument for that kind of test and not against it. The two keys with no caller were removed
rather than kept for a future one; the map parameter was renamed.

<sub>Unreleased — `internal/httpapi/cast_images.go` · `annotation_handlers.go` ·
`dialogue_handlers.go` · `search_character_images.go` · `identity_handlers.go` ·
`internal/store/quote_cast.go` · `quote_person.go` · `web/frontend/src/people.jsx` ·
`ui.jsx` · `identity.jsx` · `characterRows.jsx` · `Movies.jsx` · `index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
