# ADR-0072: The dedupe hash excludes the locator — except where the locator identifies

Source of truth: this wiki page.

- **Area:** [§4 What a Quote Is](ADR-Index.md#area-4)
- **Status:** Accepted
- **Version:** 1.3.1 and 1.5.0

**Decided.** `DedupeHash` is `sha256(lower(collapse_ws(fold_punct(text))))` with chapter, location and timestamp excluded. `DialogueDedupeHash` folds season and episode in. `UtteranceDedupeHash` folds speaker, occasion and occasion date in, and leaves place and medium out.

**Why.** A book is one work and a passage in it is one passage, so excluding the locator is what keeps re-importing a growing `My Clippings.txt` a no-op. A series is one `movies` row holding a whole run, so a line is located *by episode* — before 1.3.1 the second occurrence of a catchphrase hit `UNIQUE (movie_id, dedupe_hash)` and was silently folded into the first, or worse relabelled it with the newer episode through the importer's COALESCE enrichment. For an utterance the occasion discriminates outright: the same words said on two occasions are two quotes. Place and medium stay out because they are the fields refined afterwards — Burma to Rangoon, radio to Azad Hind Radio — and folding them in would make each refinement fork a duplicate instead of enriching the row already there.

**Instead of.** Folding the whole occasion in — rejected, with the cost of refusing it stated: the same speaker giving the same line at two rallies on one date in different places collapses to one quote. Rarer than the typo, and recoverable by editing.

**Approved.** Both inversions are mine and I approved each separately, a release apart.

<sub>1.3.1 and 1.5.0 — `internal/store/hash.go` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
