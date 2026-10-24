# ADR-0133: The cache keeps the reader's spelling; it is rewritten only when it stops being true

Source of truth: this wiki page.

- **Area:** [§6 People, Credits and Metadata Providers](ADR-Index.md#area-6)
- **Status:** Accepted
- **Version:** `internal/store/credits.go`

**Decided.** `RecomposeCredit` leaves the column alone when it already renders the same people in the same order — `creditRendersLinks` splits it with the **account's own** separators and compares to the link rows. `CreditSep` (`", "`) is the fallback spelling, used when the column has genuinely gone stale. `CreditsAgree` asks the identical question.

**Why.** Good Omens prints "Neil Gaiman & Terry Pratchett" on its cover, and that string is what search matches, what an export writes, and what `credit_as` exists to preserve — the separator is part of the spelling, not punctuation the app is entitled to normalise. Under a strict recompose the one-time pass would have rewritten every `&` in every existing library on first start, silently, because `&` and `and` are on by default. `TestPeopleMultiAuthorSplit` is the evidence: it has always asserted *"the stored `books.author` string itself stays verbatim"*, and it passes under this rule with no edit and fails under the strict one.

**Instead of** normalising to `", "`, which is simpler and exactly checkable; and instead of storing the join separator per work, which is the most faithful and adds a column that all 21 write sites would have to get right. The middle answer keeps the invariant meaningful — *the column renders the links faithfully* is still checkable, still repairable by `SyncAllCredits`, and does not cry wolf on every co-authored book in a library that prints `&`.

**Approved by the owner**, who was shown the three options and the consequence of each. The comparison moved out of SQL to get it: `metadata.SplitCredits` knows about suffixes and the "and" guards, and a second splitter written in SQLite would drift from the first.

<sub>`internal/store/credits.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
