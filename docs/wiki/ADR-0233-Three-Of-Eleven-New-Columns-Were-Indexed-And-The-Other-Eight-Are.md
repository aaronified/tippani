# ADR-0233: Three of eleven new columns were indexed, and the other eight are a decision

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 2.2.0

**Decided.** 0047 adds eleven columns across four quote tables and puts exactly three of them in a full-text index: `annotations.character`, `utterances.recipient` and `utterances.work_title`. Both indexes were dropped and recreated to get them, because an FTS5 external-content table cannot gain a column.

**Why those three.** `dialogues_fts` has carried `character` since 0003, the results page builds a **Characters** section out of it and `/search/vocabulary` autocompletes it — for films, shows and games only. A book character that is storable and not findable is the same asymmetry read from the other end, and it would present as a bug on the day the form ships rather than as a missing feature. "Every letter to Nehru" and "everything in that essay" are the same query shape as "everything Bose said", which is already a section; one rebuild covered both, and there was not going to be a cheaper moment.

**Why not the other eight.** `act`, `quest` and `locator` are *locators*, and no locator in this schema is indexed — not `chapter`, not `location`, not the timestamp. Searching by one is what the facet grammar is for. `region`, `language` and `orig_language` are short reader-owned vocabularies rather than prose: 0026 said it about `place` and `medium` and 0035 said it about `language`, and indexing them would let a search for "Bengali" return every Bengali proverb ranked above the quote that is actually about Bengal — the vocabulary endpoint is their surface. `episode_name` follows the season it sits beside, and a show's own title is already in `movies_fts`. `occasion_circa` is a flag.

**The shape of the rebuild is 0029's and 0035's, in that order:** drop the three sync triggers, drop the virtual table, recreate it with the column **appended**, recreate the triggers verbatim, and run `'rebuild'` **last** — rebuilding an external-content index while its triggers are live is the documented route to `database disk image is malformed`. The names land back exactly because two things find them by name and both fail silently: `store.Recover` excludes `%\_fts` from its table copy, and `rebuildFTSTable` finds an index's triggers with `sql LIKE '%<name>%'`. `bm25()` is called with no per-column weights, so a new column changes no ranking, and the `*_fts_vocab` tables survive untouched because fts5vocab resolves its target by name at query time.

**Approved.** Mine. The test that matters is not the MATCH — it is the UPDATE and the DELETE afterwards, because the three triggers were re-cut by hand and a missing `_au` leaves a renamed character findable forever under its old name.

<sub>2.2.0 — `internal/store/migrations/0047_per_kind_fields.sql` · `internal/store/per_kind_fields_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
