# ADR-0875: The rest of the eighteen: Review, Language and Server

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**A LIST OF TITLES ASKS A READER TO RECOGNISE THEIR OWN LIBRARY FROM BIBLIOGRAPHIC DATA.**
"Never asked about" drew a mono label per work and nothing else. The pack draws each work
with its cover or its poster, the people behind it, a count and a chevron
(`settings-restructured.dc.html:381-403`), and the reason is what a person actually
recognises a book by months after skipping a line in it. So the endpoint grew two fields —
`art` and `people` — read per source: a book's cover and author, a film's poster and
director, a standalone quote's speaker and no artwork at all. Crossing those columns is the
failure with no symptom, because a query that matches nothing looks exactly like a work with
no cover, which is an ordinary state; `TestExcludedWorksCarryTheirArtworkAndTheirCredit`
asserts both sources for that reason and the film is the one that fails if they are swapped.

**THE CREDIT IS SPLIT ON THE SERVER AND CUT AT TWO.** `creditSeparators` is a preference
because a shelf can hold "Rowling, J. K." — and honouring it here would mean loading a
preference into a list endpoint that needs none, so this splits on comma, semicolon and
ampersand and stops at two names. What it feeds is a row of chips at a phone's width, a hint
at who wrote the thing rather than the canonical credit, and the work's own page still shows
it whole.

**THE TICK BOXES SELECT QUOTES, NOT WORKS, even where a work's own box ticks all of them.**
What the button does is restore quotes; a selection of works would have to be expanded into
quotes before it could act, and a work whose rows moved under it would then restore something
nobody ticked. The bulk route is per source table, so a selection spanning a book and a film
is two calls — sending the film's ids to `/annotations/bulk` would restore nothing, silently.

**AND THE CHIPS ARE DOORS, because every credit in this app is.** `person-router.test.jsx`
holds every screen that imports `PersonChip` to `usePersonOpener`, which is why Settings now
mounts a `PanelHost` of its own. A chip that named an author and did nothing would be the
same picture as one that opens them.

**FOUR ADJECTIVES ARE NOT AN EXPLANATION.** "How hard the questions are" offered Easy,
Medium, Hard and Random, with a line under Easy alone — so a reader on Hard could read the
whole row without learning that it means typing. There is a line under whichever is chosen
now. The info dot describes all four, which is a different question from what the one in
force does. Easy's line still names the cost rather than only the benefit (Little, Bjork,
Bjork & Angello, 2012): a tier that advertised one side of itself would be selling the
reader something.

**A FACE IS NAMED IN THE SCRIPT IT IS BEING CHOSEN FOR.** The owner's: *"if a font doesn't
natively support a script, it is very hard to see what it will show when chosen to render
that script."* A list of Latin names is a list of Latin names whether or not the face behind
each one has a single Bengali glyph in it — so a face that can draw the script writes its own
name in it, and one that cannot keeps its Latin name. `FACE_NAME_IN` in `fonts.js` is the
app's own knowledge about its own bundled faces and is NOT a locale key: নোটো সেরিফ বাংলা is
the same fact on an English screen as on a Bengali one, and a key would be one copy per
locale of a string that must never differ between them. `no-hardcoded-bengali.test.js` takes
the allowance from that table's values rather than from a pattern, so a fourth name typed
elsewhere in the file is still a finding.

**THE SPECIMENS WERE TOKENISED ALL ALONG, AND THAT WAS NOT THE WHOLE ANSWER.** The report was
that changing the language left them in English. They follow the interface — they are keys —
but three of the interface's four Latin-role samples had never been translated, and more to
the point a Latin-only face CANNOT show Bengali: a Bengali specimen under Newsreader would
draw the fallback's letterforms under Newsreader's name, which is worse than showing nothing
about Bengali at all. So `specimenSample` switches the line to the script being chosen for
only where `hasScript` measures that the face can draw it, and `null` — "could not tell" —
falls back, because a specimen in a script nobody verified is the boxes the check exists to
prevent.

**"THESE FACES ARE FOR" WAS A LANGUAGE PICKER UNDER A LANGUAGE PICKER.** The owner's:
*"the interface faces do not need a 'these faces are for' because the language is selected
above anyway."* The scope is `localeActive()` now — the language being rendered, not the one
stored, because editing the faces of a language nothing is drawn in is a control with no
visible effect. Every language still gets a full picker; the way to it is being in that
language, which is also the only state in which the specimens can be believed. THE COST,
STATED: a face chosen while reading English writes English's overlay rather than the flat
field every language inherits, so it no longer leaks into Bengali. That is a change in what
gets written and it is the honest reading of the ask — the faces you pick while reading a
language are for that language — and `fontsByLocale` was only ever reachable through the
chooser this removes, on a branch that has not shipped.

**THE QUOTE-FONT PANEL WAS A DOOR THAT OUTLIVED ITS REASON**, like the others this pass has
opened. It was a pop-up because the list is as long as a library has languages and Settings
was one column where an unbounded list pushed everything below it off the screen; Language is
its own screen of cards now, so it is the card that grows. The door OUT of it — to Metadata's
language table — stays, because a language is created there and nowhere else.

**AND THE SERVER SECTION IS ROWS.** It was the last block on Settings still drawn as a stack
of bare divs and `MonoLabel`s: Version, Channel, Make a backup and Restore now each have
their name on the left and their control on the right, as the pack draws them
(`settings-restructured.dc.html:2749-2759`). The pack's middle backup row — a nightly backup
— is NOT here, and its absence is recorded rather than faked: it needs something that wakes
at four in the morning, and this repo's standing invariant is that nothing wakes on a timer.
See `docs/plans/nightly-backup.md`.

*Unreleased — `internal/httpapi/review_excluded.go`, `web/frontend/src/Settings.jsx`,
`web/frontend/src/fonts.js`, `web/frontend/src/fontPicker.jsx`,
`web/frontend/src/index.css`, `internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

**AND A RATING FOUND THAT HALF OF IT WAS WIRED TO NOTHING.** `FontSections` computed
`script` from the active locale and never handed it to `FontRow` — so inside the row it was
`undefined`, every face kept its Latin name and every specimen its Latin line, in every
language. Nothing failed, because the rows look identical when the answer is "could not
tell": that is the same shape as the dead bulk control this repo shipped once before. What
showed it was a journey that uploads a real Bengali face (`@fontsource`'s Noto Serif
Bengali), gives it the interface, switches the app into Bengali and watches the specimen —
the only way to see it, because the decision rests on a canvas MEASUREMENT and jsdom has no
text metrics, so a jsdom test passes identically whether the app consults the measurement or
ignores it.

**THE MEASUREMENT ALSO NEEDED THE FONT TO BE THERE.** A canvas does not load a webfont, it
measures what is already loaded — so a face the reader had just chosen measured as though it
had no Bengali in it, and nothing re-rendered to correct that. `FontRow` now asks
`document.fonts.load` for the probe string and bumps a counter when it resolves; the rest
state is unchanged and correct on its own, the load merely arrives at it sooner.

**AND THE INTERFACE ROWS' NAMES ARE STILL INERT, WHICH IS WORTH SAYING RATHER THAN LEAVING
GREEN.** Every face this app offers for a Latin role is Latin-only and has no entry in
`FACE_NAME_IN`, so the name half changes nothing there today.
`font-script-names.test.js` pins that claim instead of the wire: the day a face with a native
name is offered for one of those roles, it fails and names it.

**THE CREDIT SPLIT WAS A FOURTH COPY OF A RULE THE REPO KEEPS IN LOCKSTEP.** `creditNames`
split on comma, semicolon and ampersand by hand, with a comment arguing that honouring
`creditSeparators` would load a preference into a list endpoint that needs none. Measured:
"Martin Luther King, Jr." came back as two chips, the second of them "Jr."; "Gaiman and
Pratchett" came back as one. Every chip here is a DOOR onto a person, so a bad split is a
press that opens a record for somebody who does not exist. It calls `metadata.SplitCredits`
with the reader's own separators now — the same function the credits table, the cast builder
and the character console call — and keeps only the two-chip ceiling, which is this screen's
own and is about the width of a phone.

*Unreleased — `internal/httpapi/review_excluded.go`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/journeys/a-font-that-can-write-your-script.journey.mjs`,
`web/frontend/test/journeys/putting-back-what-you-skipped.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
