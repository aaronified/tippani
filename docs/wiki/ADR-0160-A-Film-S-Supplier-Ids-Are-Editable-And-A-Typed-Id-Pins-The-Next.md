# ADR-0160: A film's supplier ids are editable, and a typed id pins the next search

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** 1.7.8 (reversal)

**Decided.** `tmdb_id` and `tvdb_id` are **editable fields**, typed or fetched. They still read as a link to the record they name, and picking a match under Fetch metadata still writes them, but both rows now edit in place like any other field on the Details panel and in the Metadata console's editor. They also *feed* the search rather than only recording its result: `POST /movies/lookup` takes `tmdb_id`/`tvdb_id`, fetches those records by id, and lists them ahead of the title hits, deduped against them. A title is no longer required — an id alone names one record exactly, which is more than a title ever did.

Two guards come with that. The id fields are `*int64` on `movieReq` while everything else on that PUT is full-state, because a supplier id is not a value you retype on every save and an older client that has never heard of it must not wipe it by omission — `nil` leaves the column alone, `0` clears it. And a hand-typed id another of the user's titles already holds is caught before the write, so the partial unique index reports as a 409 naming the collision instead of a 500. Correcting an id does not touch the cached cast or `source_metadata`, which still describe the old record until a re-sync goes and gets the new one: fixing the pointer is not the same act as following it.

**Why.** A title search cannot tell two films of the same name apart. Search TMDB for *Persuasion* and four films come back with that name; the id is the only thing that separates them, and it was the one field the picker could not be told.

**Instead of** a smarter matcher — more ranking signals on the title search, or a disambiguation step in the picker. Both are guesses about which record you meant, and the id already *is* the answer; adding cleverness to avoid asking for it would be a worse version of typing seven digits.

**Reversal.** This replaces the decision below, taken when the ids were introduced and overturned in 1.7.8.

> **A film's supplier ids are read-only, written only by picking a match.** `tmdb_id` and `tvdb_id` are set by `createMovieFromSource` / `resyncMovieFromSource` from whatever the fetched details carried, and shown as a link to the record rather than an editable field — the hint beside each said so in as many words: set by picking a match, not typed, because it is what a re-sync pulls from. An id you cannot type is an id that cannot be wrong: every one in the database arrived attached to a real fetched record, so the id and the cached payload beside it always described the same thing, and a re-sync could never be pointed at a record nobody chose.

That was sound about the id and wrong about the search that produces it: it defended the field from *becoming* wrong while leaving no way to fix it when it already was. The guarantee it bought — id and cached payload always agreeing — is kept anyway, because editing an id deliberately does not touch the payload; the two disagree only until the re-sync you edited the id in order to run.

**Approved.** Mine, both halves. The original was the conservative reading — plumbing only the machine writes has one fewer failure mode — and it cost more than it saved the first time a common title needed correcting.

<sub>1.7.8 (reversal) — `internal/httpapi/movie_handlers.go` · `internal/httpapi/lookup_handlers.go` · `web/frontend/src/WorkDetails.jsx` · `web/frontend/src/CoverPicker.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
