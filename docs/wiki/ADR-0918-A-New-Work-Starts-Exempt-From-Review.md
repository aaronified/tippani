# ADR-0918: A new work starts exempt from review

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** the review exclusion of migration 0033 and 0046

**What was true.** Every work and quote was in the quiz unless the reader excluded it. The spaced-repetition scheduler assumed a
library of material to be recalled.

**Why that was wrong for this app.** Most of a quotation library is kept for its wording, not to be recalled. A reader's first
experience was a deck of cards they never asked for, and the way out was to find and exclude each work.

**What replaced it.** A work the reader adds starts **exempt** (`review_excluded = 1`), and so does every quote it gets, because a
quote inherits its work's flag when it is inserted. This covers a work typed by hand, fetched from a provider, or created by an import
approval. The reader opts in to what they want to practise with the control that already exists (include a work, or a quote), and
including a work brings in what it holds and what it gets later.

- It applies to **new** works only. Nothing existing is changed, so no migration.
- It is one value at the creation sites (`Server.newWorkExcluded`), not a database default and not a trigger: a restore, a backup and
  a bin restore copy rows with their flag and must not have it rewritten.
- Standalone quotes have no work and are not covered.
- `Server.NewWorksInQuiz` reverses it. The test server sets it so the suite's decks keep meaning what they say, and
  `TestANewWorkStartsExemptFromReviewAndTheReaderOptsIn` runs the real default.

**Rejected.** A preference ("new works start in the quiz") as the first cut: the request was for a different default, and a setting
nobody asked for is more to explain. It can be added if readers want the old behaviour back.

See also: [ADR index](ADR-Index.md) · [Home](Home.md)
