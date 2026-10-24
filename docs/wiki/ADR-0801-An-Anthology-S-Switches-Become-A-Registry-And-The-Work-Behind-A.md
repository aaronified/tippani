# ADR-0801: An anthology's switches become a registry, and the work behind a passage reaches the page

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/anthology-update.md`'s step 1 and the first half of its step 2, landed
together. The plan stays — steps 3 to 7 (print, EPUB, the rule column, the rule UI,
`rule_auto`) are unbuilt, so the file describes something that does not exist, which
is that directory's condition for keeping it.

**Step 1 was not allowed to land alone, and that is a departure from the plan's own
order.** Its step 1 is *"the field registry, replacing the six booleans without
changing what they do"*. A registry over six fields read by one renderer is not
simpler than the six `if`s it replaces, and it cannot even be a clean loop: the
Markdown order interleaves two bindings that answer to no switch — the quote's own
`note` between the date and the colour, `favorite` last — and the colour carries its
own `!= "yellow"` condition. A faithful "changes nothing" registry is two loops with
a fixed middle, which is more code saying the same thing. Building the seam first
with nothing reading it is the defect this repository already recorded in
`attribution.js`'s `attributionOf`. So the registry shipped with its first eleven
callers.

**One column and not eleven (0074).** `fields TEXT NOT NULL DEFAULT ''`, a sorted
JSON array of the keys that are on. The owner's answer to "which fields?" was
everything, and a column per switch is how that promise gets capped at six again.
Sorted because a stored set is only worth reading in a backup if two anthologies
showing the same things store the same bytes; `''` rather than `[]` because a row
written before the migration and a row nobody has configured must be one state.

**A second pass, not thirty-three more columns on the UNION.** `entriesFor`'s own
comment says the locator *"is built per arm, in SQL, and that is the only place it
can be"* — which is true of a value that is per ENTRY and has to survive an ORDER BY
running across three kinds. A work field is neither: it is per WORK and read after
the entries are ordered. `attachWorkFields` gathers the ids and asks each table once.

### Where the plan turned out to be wrong

**Its §3 table describes a `people` table that has not existed since 0027.** The
plan says the person join is *"`people` (0012), matched by exact name to
`book.author` / `dialogue.actor` / `utterance.speaker`"*. 0012's table had a `kind`
column (`'author' | 'actor'`) and 0027 replaced it with one row per name —
`UNIQUE(user_id, name)`, no kind, and its own comment naming `movies.director` as a
fourth thing it matches. Anyone building the person join from the plan's description
would write a `kind` predicate against a column that is gone. This is for the pass
that lands it; nothing in this commit touches `people`.

**Genres is in the plan's list and is not in the registry.** Both works tables carry
`genre_text`, which is space-joined for FTS — "Fiction Fantasy", not
"Fiction, Fantasy" — so printing it in a document made to be read would put a search
index on the page. The readable form needs the `book_genres` / `movie_genres` join,
which belongs with the person and cast joins rather than beside eleven fields that
need no join at all.

**And the guard the tidier version of this commit tripped.** The anthologies INSERT
went from nine placeholders to ten, so they were briefly generated with a
`strings.Repeat` over `len(args)`. That is the version that cannot be wrong, and it
is worse: `TestEveryInsertBalancesItsColumnsAndValues` reads the statement as text,
resolves `anthologyFieldCols` from the package's own consts, and counts top-level
commas on both sides — so a generated VALUES clause reads as one value against ten
columns. The guard went red on code that could not make the mistake it guards
against. Turning a checked literal into an unchecked expression is not a safety
improvement; it moves the check out of the repository.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
