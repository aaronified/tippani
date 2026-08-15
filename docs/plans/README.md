# Plans for things that are not built yet

One file per feature that has been **designed and not yet built**. Nothing in
here describes the app as it stands.

That is the whole rule, and it has a second half that was missing until 1.14.2:

**When a feature ships, its plan is folded into [`../PLAN.md`](../PLAN.md) — with
a pass recording where the plan turned out to be wrong — and the file here is
deleted.** So this directory is always a list of what is coming, never an
archive. Git holds the retired plans.

## Why it has an exit

A plan for a feature that shipped six releases ago is a design document sitting
in a directory whose entire promise is *this is not built yet*, and it goes
stale in the one way nothing can detect: every sentence in it was true when it
was written, some of them still are, and nothing marks which. That is the
failure that turned `PLAN.md` from a design document into a decision log. Three
shipped plans stayed here afterwards and reintroduced it one directory over —
along with twenty-three entries in the log whose grey line still read *planned*
for features that had been running for months.

## The two documents

| | |
| :-- | :-- |
| `docs/plans/*.md` | How will one specific **unbuilt** feature work? |
| [`docs/PLAN.md`](../PLAN.md) | Why is the **built** thing shaped this way, what was turned down, and what did I get wrong? |

A plan is written against the tree rather than against memory: open with a
*What already exists* table verified at a named commit, and record what that
verification changed. It has moved real claims every time.

## The three that retired here

`trash-and-undo.md` (shipped 1.8.0), `context-menu-and-multiselect.md`
(1.10.0, works in 1.11.1, finished in 1.14.2) and `search-facets.md` (1.10.0).
Their decisions and their corrections are in `PLAN.md` under sections 3, 7
and 14.
