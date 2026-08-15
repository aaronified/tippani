# Skipping the quiz is a fact about a quote

A correction to 0033. Exclusion is currently two flags that both gate the deck —
the quote's and its work's — and the second one makes the first one lie.

## The report

> Take a highlight that is excluded both on its own account and by its book. The
> selection bar reads the own flag, so it offers **Add to quiz**; pressing it
> clears the quote's own column and toasts "back in the quiz" — but the book
> still excludes it, so the deck still won't serve it and the mark stays put.

The toast is wrong, and it is wrong in the one way a toast must never be: it
reports an outcome that did not happen, about a change that did happen. Nothing
on screen resolves the contradiction, because the mark reads both flags and the
button reads one.

## What already exists

Verified against the tree at `0057ee0`.

| Thing | Where | State |
| :-- | :-- | :-- |
| The columns | `0033_review_exclusion.sql` | `review_excluded` on `books`, `movies`, `annotations`, `dialogues`, `utterances` |
| The eligibility rule | `reviewSource.where()` | ONE choke point, spliced by five callers. Ands the child's flag with `p.review_excluded` when there is a parent |
| The mark | `QuizSkipMark` (`ui.jsx`) | Reads two flags and already labels them differently — *Not in the quiz* vs *Skipped with its book* |
| The parent flag on children | `work_review_excluded` | One shared name across both quote kinds, carried on child rows and on all five search hit shapes |
| Bulk | `bulkTag` | `review` sets the child column; `/books/bulk` and `/movies/bulk` set the work's |

That the rule has exactly one choke point is what makes this affordable. The
comment there is explicit that a rule added to four of the five callers is "a
deck that will not serve a card the badge is still counting" — the same
reasoning applies to removing one.

## The change

**The deck reads the quote's flag and nothing else.** One term drops out of
`where()`. That alone makes the button and the toast honest, because the flag
the button clears becomes the only flag there is.

**The work-level control becomes a bulk write over its quotes.** "Skip this book
in the quiz" stops meaning "gate every child at query time" and starts meaning
"set the flag on all forty of these, now". That is what the reader thought it
did, and it is undoable by the same control the other way.

**The work's own column survives, with a narrower job: the default for quotes
added later.** This is the one genuinely good property of 0033 and it should not
be lost — exclude a reference manual and the highlight you add tomorrow is
excluded too. It stops gating the deck; it seeds new children at insert.

**The work's mark is derived, not stored:** shown when the work has quotes and
every one of them is excluded. A work with forty highlights and one still in the
deck is not "skipped", and saying so would be the same class of lie in the other
direction.

### What this costs, stated plainly

Under 0033, excluding a book was O(1) and covered every future child for free.
Now it is a write across the children, and a book whose quotes are individually
re-included stops reading as excluded even though its column still says so. That
is the intended trade: the flag that gates is the flag the reader can see and
change on the card in front of them.

A work with **no** quotes reads as not-skipped whatever its column says. There is
nothing to skip, and a mark on an empty shelf is a claim about nothing.

## Order of work

1. Drop the parent term from `where()`; fix the tests that assert the old rule.
2. Work-level toggle writes children (single work + `/books/bulk`, `/movies/bulk`).
3. New-quote insert inherits the parent's column.
4. Work rows carry `quotes_total` / `quotes_excluded` so the mark can be derived;
   `QuizSkipMark` loses its two-flag branch on works and keeps it on children.
5. `docs/ui-glossary.html` — the mark's entry describes the two-flag rule at
   length and is wrong the moment step 1 lands.

## What does not change

The columns, all five of them. Nothing is dropped, so the bin's `SELECT *`
snapshot, the account backup and the export carry exactly what they carried
before, and none of those three learn anything about this.
