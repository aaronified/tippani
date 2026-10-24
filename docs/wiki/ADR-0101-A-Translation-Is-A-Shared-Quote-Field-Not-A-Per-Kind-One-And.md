# ADR-0101: A translation is a shared quote field, not a per-kind one — and there is no language beside it

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 2.3.0

**Decided.** Migration 0051 puts `translation TEXT NOT NULL DEFAULT ''` on `annotations` and `dialogues`, indexes it in both FTS tables, and moves the field off `utteranceReq`/`utteranceRow` into `quoteReq`/`quoteRow` so all three kinds carry it by embedding. `language` stays where it is: on the standalone quote alone.

**Why the field is shared.** The two halves of `quote.go`'s split are *prose about the quote* and *a pointer into its source*. `chapter`/`location`, `character`/`actor`/`timestamp`, `occasion`/`place` are pointers, and they are per-kind because the kinds genuinely differ. A translation is not a pointer — it is the same sentence in another language, which is the same kind of content as the quote itself and is answerable for every kind. Leaving it on one kind is the drift `quote_parity_test.go` was written for: from 0035 to 0051 somebody looking for it on a highlight found it missing on two kinds out of three, exactly as `dialogues` once had no tags and no colour.

**Why not the note.** A note is what you thought; a translation is what the line says. `quote_markdown.go` has drawn that distinction in one sentence since the quote importer was written, and folding them together is not merely untidy: the review deck would prompt you to recall a quote using your own reaction to it, the share image would print the reaction where the meaning goes, and `notes` as a search section would stop meaning notes.

**Why there is no `language` beside it, which is the asymmetry worth arguing with later.** A standalone quote has no parent, so it carries its own — a proverb with no speaker, occasion or date has the language as its only locator, which is why 0035 put it there. An annotation's original language is the book's, held by `books.language` and `books.orig_language` since 0047. A film's is **nowhere**: `movies` has no language column, and this migration does not add one, so a translated dialogue records what it says and not what it was said in. That is a real gap left open on purpose. A film's language is a fact about the *work*, it belongs with the metadata pipeline that fills the rest of a film's fields from a provider, and adding it here as a free-text box on the quote form would put one fact in two places on two kinds.

**Indexed, unlike 0034's `translator`.** 0034 refused to add a column to `books_fts` because the rebuild is a genuine risk — a DROP and CREATE of the virtual table, its three sync triggers and a full reindex, with `store.Recover()` and `rebuildFTSTable` both matching FTS objects by name pattern — "taken for a feature nobody asked for". This is the feature: a translation exists so the half of the line the reader can actually type is written down, and an index that does not hold it takes that purpose away. `utterances_fts` has carried the column since 0035, so the alternative was a search that finds a translated proverb and not a translated highlight.

**Out of the dedupe hash**, and for a sharper reason than the locators are: the hash answers "is this the same quote", and that cannot depend on whether anyone has translated it yet. Folding it in would make typing a translation fork a second copy of the line on the next import of the same file.

**Approved.** Mine. The `''` literal the stray-marks sweep had been scanning in this slot on two of the three kinds — named and scanned from the start, one release earlier — became the real column and nothing else in that file changed.

<sub>2.3.0 — `internal/store/migrations/0051_quote_translation.sql` · `internal/httpapi/quote.go` · `web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
