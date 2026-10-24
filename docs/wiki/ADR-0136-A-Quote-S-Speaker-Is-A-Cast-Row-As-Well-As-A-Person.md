# ADR-0136: A quote's speaker is a cast row as well as a person

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted

**Decided.** `store.SyncQuoteCast` writes `annotations.speaker_cast_id` and `dialogues.speaker_cast_id` on every path that writes a quote, beside `SyncQuotePerson` and under the same three rules. `store.LinkWorkQuotesToCast` catches a work's whole history up, called from `adoptQuoteCharacters` — the read that already reconciles the two tables. `GET /characters/{id}` carries `lines` and `shared_lines`, exactly as the person record does.

**Why, when 0059 had already linked the speaker to `people`.** Because they are not the same link and the app needed both. `actor_id` says *which human*; `speaker_cast_id` says *which role on this work* — and a role is what a picture, a character record and a per-work description all hang off. The two are needed on two different shelves: a novel has speakers and no performers, so the person link has nothing to say about a highlight, and a film line has both. The owner's ruling was that "a cast row and a quote's speaker should be the same thing in the backend", which is this entry's original decision restated after two releases in which the column existed and nothing wrote it.

**What the app did instead, and why it was not equivalent.** Every reader of "which cast row is this line's speaker" re-derived it by folding the character text and matching `work_cast.character_key`: `cast_images.go` for the chip, `cast_from_quotes.go` for adoption, `character_works.go` for the removal guard. Three folds in three files, all of them necessarily in Go — `CastKey` folds typographic punctuation and case that SQLite's `lower()` leaves alone, which is why a `LEFT JOIN` on the key is not available and 0048 says so in capitals. Three implementations of one join is three chances for them to disagree. And none of them can answer the reverse question at all: given a cast row, which quotes are its? That is not a `LIKE` — it is the read the character page needed and could not have.

**0059's objection is answered rather than overruled.** Its ground was the bin: a snapshot is `SELECT *` taken before a delete, a dangling foreign key fails the insert, and the failure loses a reader's quote to protect a number. `speaker_cast_id` is a real foreign key into `work_cast` and 0048's triggers reap a work's whole cast with the work, so the hazard is identical — and so is the remedy already in place for `actor_id`: `relinkOnRestore` drops the column on the way in and re-derives it from the name the row still prints. The table gained a `castKind` column and `annotations` gained a row; nothing new was invented.

**Instead of** a one-time backfill pass, which is what 0059 used for its own link. Rejected because adoption already walks a work's quotes on every cast-list read, already creates the rows a link needs, and is already the place the two tables meet — so the backfill would be a second implementation of a reconciliation that runs anyway, with a different lifetime and a version number attached to it. The cost is stated: the link pass is two SELECTs per cast-list read in the steady state and writes nothing, which is the same bargain `adoptQuoteCharacters` already struck and defends at length.

**Also rejected: making the link the source of truth and retiring the fold.** The fold answers a question the link cannot — a line naming three characters draws three faces, and the link is deliberately NULL on exactly that line. So the fold stays where it draws several, and the link answers where the question is singular.

<sub>`internal/store/quote_cast.go` · `internal/httpapi/cast_from_quotes.go` (`linkQuotes`) · `internal/httpapi/trash_handlers.go` (`relinkOnRestore`)</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
