# ADR-0149: A speaker rename re-hashes that account's quotes, and a collision leaves one row on its old hash

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/httpapi/people_handlers.go`

**Decided.** After the credit rewrite, `rehashRenamedQuotes` recomputes `dedupe_hash` for every utterance in the account. A row whose new hash collides with an existing one keeps its old hash and logs a warning.

**Why.** `UtteranceDedupeHash` folds the speaker in, because standalone quotes invert the usual rule — the occasion is a locator and it *discriminates*. So renaming a speaker changes what those quotes are, and a hash still computed from the old spelling would fail to recognise a re-import of the same line under the new one, quietly producing a duplicate months later. SQL cannot compute a SHA over normalised fields, so this is a second pass rather than part of the UPDATE. On collision: two quotes that differed only by the spelling of a name become the same quote, and `UNIQUE (user_id, dedupe_hash)` refuses the second. Failing the whole rename over it would strand the library half-renamed; deleting the loser would destroy a row nobody asked to lose. Leaving that one row on its old hash costs nothing today and is visible as an ordinary duplicate pair the user can resolve. My call — the least bad of three bad options, and I would rather it be written down than discovered.

<sub>`internal/httpapi/people_handlers.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
