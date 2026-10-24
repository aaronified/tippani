# ADR-0194: A game's publisher is its own column, and the developer-to-publisher fallback is gone

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 0042

**Decided.** Migration 0042 adds `movies.publisher`. `igdbCredits` and `GameDetailsWikidata` return the developer and the publisher as two values; neither stands in for the other. Where a record names only a publisher, the studio is empty. Where several companies are flagged developer, the one with the **narrower claim** wins — a company flagged developer *and* publisher is passed over while a developer-only company exists.

**Why.** Reported exactly: *Mass Effect Legendary Edition* stored **Electronic Arts** as its studio. EA published it; BioWare made it.

0040 mapped "studio" onto `movies.director` on good grounds — a show's creator already lived there — and both suppliers were then written to fall back from the developer to the publisher when no developer was flagged, on the stated reasoning that "a blank studio is worse than a slightly wrong one", measured as developer logos on 18 of 24 games against publisher on 22. **That reasoning was sound about one column and became wrong the moment the fact had somewhere else to go.** A field labelled STUDIO naming a company that did not make the game is not vagueness; it is the interface asserting something false in the present tense, which is the same class 0041 fixed for provenance and for the same reason.

**The tie-break is where the reported bug actually lived, and I did not see it until I looked at the payload shape.** Removing the fallback alone would not have fixed the report. IGDB's `involved_companies` is a set of flag pairs in **no meaningful order**, and a label that owns the studio it published through is routinely entered as both — so "the first row flagged developer" picked EA by array position while BioWare sat further down flagged developer alone. The narrower claim is the only signal in the payload. It narrows an answer and never blanks one: a studio that publishes its own game is named in both fields, because both are true of it, and there is a test asserting that specifically because it is the way this change could have made things worse. Wikidata's P178/P123 take the same rule, and the studio LOGO is now read off the entity the name came from rather than the first `P178` statement — otherwise the tie-break would leave the icon and the credit beside it describing two different companies.

**A publisher gets no `people` row**, unlike a studio. 0037 set the bar — a new kind must have BEHAVIOUR, not just a label — and a studio clears it with a logo, a click target and its own slot where a director's face goes. A publisher here has none of that: it is a name on a details page, and nothing groups, portraits or navigates by it. So it is a plain column and plain mono text (`PUB.`), and a clickable name would promise a page that does not exist.

**Not backfilled, and it cannot be.** Every game stored before 0042 holds either its developer or its publisher in `director` and **nothing records which** — that is the defect. Guessing would write the same wrong fact into a second column and give it the authority of having been migrated. The remedy is a re-fetch, which is why the publisher is deliberately **overwritten** by a re-sync rather than preserved the way a hand-typed `imdb_id` is: the supplier is the authority on this one, and keeping a blank would leave the row exactly as wrong as it was.

**Instead of.** Splitting `movies` into `movies`/`shows`/`games` — the reasoning 0040 measured (twenty query files, 105 `'movie'` literals, and a failure mode of *silence*) has not weakened, and this defect was not caused by the shared table but by a shared *field with two meanings*, which is what giving the second meaning its own column fixes. A CHECK tying the column to games — a film has a distributor and a show has a network, both the same kind of fact, and the CHECK would be the obstacle the next time either is wanted. Indexing it in `movies_fts` — a fourth column means dropping and rebuilding the external-content table and all three of its sync triggers, which 0029 is the record of the care required for, bought for a field nobody has asked to search by.

**Approved.** The reader's report, and my call on the shape. The five write sites were swept rather than patched — create, full-state update, re-sync, bulk edit and the export round trip — because a column some paths write is the defect class this repo has documented five times, and the two front-end full-state bodies (`movieState`, `fullState`) are the ones that silently *clear* a column rather than merely miss it.

<sub>0042 — `internal/metadata/igdb.go`, `internal/metadata/wikidata_games.go`, `internal/httpapi/movie_handlers.go`, `internal/httpapi/game_publisher_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
