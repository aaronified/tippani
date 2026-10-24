# ADR-0098: A sixth quote kind, and the cheap way to widen a CHECK

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `poem` joins speech, letter, essay, proverb and other. Migration 0067 widens the CHECK on `utterances.kind` by **parking the value in a new column that carries the wider constraint, dropping the old column, and renaming** — six statements, no table rebuild. `staged_quotes.kind` is unconstrained and unchanged, so an import naming a poem already worked; it was the library's own column that had to learn the word.

**Why it is a migration at all**, restated because the cost is real and was accepted knowingly: the vocabulary is a column CHECK, and `utterance_handlers.go` says so — "that is the cost of a fixed vocabulary, and it is worth paying". It is still worth paying. `medium` was free text and the Quotes board GROUPS on the kind, so a typed field produced one shelf per spelling with nothing in the interface able to say that "Speech" and "speech" were the same thing.

**Why not 0029's table rebuild.** That is how the colour CHECK was widened: a hundred and fifty lines reproducing every column, index and trigger, losing whichever one somebody forgot. `utterances` has gained fourteen columns since (0033, 0035, 0036, 0047, 0053, 0059), three FTS triggers, two schedule triggers and six indexes — so the rebuild has gone from risky to a bad idea, and its failure mode is somebody's library, silently. SQLite has since learned `DROP COLUMN` (3.35) and `RENAME COLUMN` (3.25), and a rename rewrites the column's own CHECK expression with it. Nothing else in the schema is touched, and nothing can be forgotten because nothing is retyped. The index goes first, because `DROP COLUMN` refuses a column an index refers to and `idx_utterances_kind` is the only thing that refers to this one — no trigger does, the kind being a filter value rather than prose.

**Verified against the driver before it was written**, not against the documentation: "the rename rewrites the CHECK" is exactly the kind of claim that holds in SQLite's docs and not in a particular build. The value survives, `poem` is accepted, and a value outside the list is still refused.

**And the guard is a SAVE, not a list.** The vocabulary lives in three places that must agree — `QUOTE_KINDS`, `quoteKinds`, and the CHECK — and a test over either list passes with the migration missing while every save of a poem fails on a constraint error naming a column. `TestAPoemCanBeSavedAndAnInventedKindCannot` writes one, and reverting 0067 turns it into the 500 it was written for.

**Approved.** Mine, on the owner's "we need a poem kind as well".

<sub>3.1.0 — `internal/store/migrations/0067_quote_kind_poem.sql` · `internal/httpapi/utterance_handlers.go` · `web/frontend/src/quoteKind.js` · `internal/i18n/en.txt` · `internal/i18n/bn.txt` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
