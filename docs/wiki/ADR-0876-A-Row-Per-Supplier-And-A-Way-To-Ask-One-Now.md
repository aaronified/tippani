# ADR-0876: A row per supplier, and a way to ask one now

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**A LIST OF KEY FIELDS IS NOT A LIST OF SOURCES.** The Metadata sources console drew one row
per CREDENTIAL — a TheTVDB key, a TheTVDB pin, an IGDB id, an IGDB secret — which is the
shape of the form rather than the shape of the question. What a reader standing there is
asking is "who does this app ask about my books, and are any of them broken": a list of
suppliers, each with what it supplies, whether it can be asked at all, how much of this
library came from it, and what it said last time. The pack draws exactly that and titles the
group "Who the app can ask" (`metadata.dc.html:476-489, 805-821`). A supplier that needs no
key — Open Library, Wikimedia — appeared nowhere at all on the old screen, so "nothing is
stored because nothing is needed" and "nothing is stored and nothing will answer" looked
identical.

**THE STATE COMES FROM THE SAME RESOLVERS THE LOOKUPS CALL**, so a row cannot claim a key
that a fetch would not find. Four words, the pack's: `saved`, `builtin`, `optional`,
`needed`. The keyless suppliers were `optional` rather than `saved`, which was a reading
worth stating — "key saved" would be a green light about a key that does not exist.
**Revised 17 October: they are `builtin`.** The owner: the inbuilt sources where a reader
need not provide anything were marked optional, and could be marked built-in. They could:
`optional` promises something to add, and Open Library, Wikimedia, Fandom, Wikidata, IMDb,
Letterboxd and the keyless Google image reading have nothing to add. `optional` stays for
Google Books and Amazon, where a key or a cookie really does improve the answer.

**"RECORDS SUPPLIED" IS THE LIBRARY'S OWN RECORD, not a tally this feature keeps.**
`work_field_source` already stores which supplier wrote each accepted field, so the number
is a fact, and it is scoped by user like everything else on the console: a supplier that
filled in somebody else's shelf did not fill in yours.

**A TEST ASKS THE SUPPLIER THE WAY EVERYTHING ELSE ASKS IT.** The same client, the same
`recordLookup`, a famous subject — Dune, Metropolis, Tetris — so that "nothing found" is an
answer about the supplier rather than about the subject. It is deliberately NOT a bespoke
health protocol: a second way of asking is a second thing that can disagree with the first,
and a green Test over a broken lookup is worse than no Test at all. That is also why the
result lands in the fault registry rather than beside it — one truth, read by the chips and
by the rows.

**AND ONLY THE SUPPLIERS A READER CAN CONFIGURE.** The picture ladder's rungs are scrapes of
other people's sites; asking them a synthetic question on a button press is how an install
earns a rate limit, and they already report themselves every time they are actually used. A
Test names its refusal rather than returning a row it never asked — a green light about an
unasked supplier is the failure this whole screen exists to prevent. The button is admin's,
because it spends the instance's quota against somebody else's API.

*Unreleased — `internal/httpapi/metadata_sources.go`,
`internal/httpapi/metadata_faults.go`, `internal/httpapi/metadata_handlers.go`.*

**AND THE SCREEN READS IT.** The rows sit ABOVE the legend that explains their marks, which
is a reversal: the legend used to lead because the marks it described were on the key rows.
They are on the source rows now, and a legend above the thing it is about is a key to a map
you have not seen. The key fields stay underneath, because adding a key is still what a row
sends you to — what has gone is the pretence that the fields WERE the list of suppliers. The
per-row Test button is drawn for the keyed suppliers only and mirrors the server's own
`testableSources`: the server refuses the others by name, and a button a reader can press
only to be told no is worse than one that is visibly not for them.

**WHERE THIS LIST DEPARTS FROM THE PACK'S, IN BOTH DIRECTIONS.**

*Three things the pack's row has and this one does not:*

- **The per-row key act** (`metadata.dc.html:819`). The key fields are already on this card,
  a few rows below; a per-row door to the field beside it is the repeat this pass has spent
  itself removing. The rows carry the Test; the fields carry the keys.
- **The per-row state chip** (`:816`). The pack says the state twice — a ring on the mark and
  a chip beside it — and this app already replaced exactly that chip with the ring and one
  legend, for width: at 390px the row's own label was breaking mid-word. A row says a thing
  once.
- **A blank where the count is zero** (`:813`). The repo draws `0`, because a supplier that
  has never supplied anything is the one a reader is deciding whether to configure, and a
  blank reads as a number that failed to load.
*And the suppliers, which differ both ways:*

- **Goodreads and Wikipedia are in the pack's twelve and get no row of their own.**
  Nothing here asks Goodreads at all. Wikipedia IS reached — the picture ladder's Wikimedia
  rung queries `en.wikipedia.org` (`internal/metadata/wikimedia_images.go`) — but it is one
  rung, recorded under the name the ladder calls it, and a second row for the same requests
  under a different name would be two rows reporting one thing. (IMDb and Letterboxd, also in the pack's twelve,
  DO get rows — `knownMovieSource` lets them write a field.)
- **Google Images and Wikimedia get rows the pack has no line for.** They are rungs of the
  picture ladder, they answer without a key, and they are recorded every time the app uses
  one — so a reader whose portraits have stopped arriving can see which rung went quiet.
- **Hardcover is accepted by `knownBookSource` and gets no row**, which is the one exclusion
  that needed thinking about. It arrives through an IMPORT and is never queried: a Hardcover
  export can attribute a field, but nothing here can ask Hardcover anything, so a row under
  "Who the app can ask" would be false — and it would have drawn its own slug in lower case
  beside "Open Library", because the app has never had to name it on a screen.
  `TestEverySourceRowHasANameToDraw` is the ratchet for that second half.

**AND THE ROWS ARE NOT A HAND-TYPED LIST ANY MORE, they are a checked one.** A rating found
four suppliers that could write into `work_field_source` and had no row — so their records
were counted into nothing, on the one screen whose subject is suppliers.
`TestEverySupplierThatCanWriteAFieldIsOnTheList` READS THE TWO WHITELISTS' OWN SOURCE. It
listed the slugs by hand first, and a rating proved that could not work by adding one to the
switch and watching the case stay green — the second time in this change a guard was claimed
for something it did not guard. A list typed into a test is a list typed by whoever got the
other one wrong.

The pack's "N sources need a key before they can be asked" line (`:845`) IS drawn, beside the
column's caption rather than in place of it — everything else on the Metadata screen depends
on at least one supplier being answerable, and a reader counting red marks by eye is a reader
who miscounts. A caption that vanishes when there is news leaves a column of unexplained
integers exactly when the reader is reading hardest, which the journey caught.

**AND A RATING CAUGHT THE STATE THE SCREEN COULD NOT PAINT.** The server named the
built-in-key state `bundled`; the app's whole vocabulary for it is `builtin` — the
stylesheet's `.is-src-builtin`, `SRC_STATE_WORD`, `KEY_STATES`, and the pack's own
`SRC_STATE` (`metadata.dc.html:490`). On an official build, the only kind with a key
compiled in, TMDB's mark therefore had no colour rule and its accessible name read "TMDB — "
with the state missing out of the middle. NOTHING FAILED: the Go test asserted the word on
the wire, the browser world has no built-in key, and each half was right about itself —
which is the failure this repo's testing ruling is written against. THE FIRST ATTEMPT AT A GUARD DID NOT GUARD IT EITHER, and the second rating caught
that: a dom case that renders four states hardcodes its own four strings, so putting the Go
constant back to `bundled` left it green. What has to be compared is the three LISTS —
`test/rules/source-state-enum.test.js` reads the Go constants, `SRC_STATE_WORD` and the
stylesheet's `.is-src-*` rules and asks whether they are the same set.
`test/dom/source-rows.test.jsx` is the other half: it renders each state and asks the screen
to paint it.

**A TEST ON A SUPPLIER WITH NO KEY USED TO DO NOTHING AT ALL** — no client, no call, no
record, and a row handed back with nothing on it. That is the one thing a button must never
do. The press is not offered for a row in that state, and the server answers 409 with a
reason for the race where a key is cleared between the render and the press. "Test every
source" SKIPS the keyless ones rather than failing them: a new install has one supplier that
can answer, and a press that refused the lot would be the card crying wolf about its
ordinary state.

**AND THE TWO TESTABLE LISTS ARE HELD TOGETHER BY A SCANNER.** The server refuses a source it
cannot test and the screen does not draw a button a reader could only press to be told no —
two lists that must agree, with nothing asking whether they did. `test/rules/testable-sources.test.js`
reads both sources rather than holding a list of its own, because a list typed into a test
would have been typed by whoever got the other two wrong.


**AND OPEN LIBRARY'S ROW WAS TELLING A LIE THE WHOLE TIME.** `SearchBooks` asks Google Books
AND Open Library on every book lookup and returns one merged list with `Source` on each
candidate — and `recordBooksLookup` recorded the total under `"google"`. So Open Library's
row read "nothing has asked it yet" for ever, including immediately after a Test that had
just asked it, and a rating found the comment and the commit narrative both asserting that
this was the honest state of a supplier nothing uses. It records per supplier now. An error
is recorded against BOTH, because the error that search returns is the pair of them failing
and there is no way to tell which half died; attributing it to one would exonerate the other
on no evidence.


**AND OPEN LIBRARY'S ROW THEN LIED THE OTHER WAY, WHICH IS THE MORE INTERESTING HALF.** The
first fix counted candidates by their `Source` field — and an ISBN search MERGES both
providers' answers into one record, because they are half-describing the same book, keeping
Google's `Source`. So on the commonest path in the app Open Library was recorded as having
answered and found NOTHING, and three of those in a row is `emptyRunFault`: a working
supplier reported broken, which is worse than the silence it replaced. The count is by
`GoogleID` and `OpenLibraryID` now, which survive the merge precisely because a merged
candidate has two identities. What the number means is stated where it is computed: how many
of the candidates the reader was OFFERED this supplier had a hand in — not the size of its
raw reply, because the list is merged and then cut to twelve.

**WIKIDATA WAS THE LAST SUPPLIER ANSWERING INTO SILENCE.** It is the floor under IGDB — it
runs when the pair is missing or has failed, which is exactly when a reader most needs to
know whether the thing catching them is itself working — and nothing recorded it. One line at
its call site.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
