# ADR-0803: The anthology update shipped, and both its plan files leave by the front door

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/anthology-update.md` and `docs/plans/anthologies.md` are folded in here
and deleted, per that directory's rule. Three asks, one release, and all three are in
the tree: a rule that fills an anthology from a search, EPUB and print, and
everything an entry is joined to.

**What answers for each of them now.**

| The plan asked for | Where it lives |
| :-- | :-- |
| A field registry replacing 0045's six booleans | `internal/httpapi/anthology_registry.go`, with migration 0074's one `fields` column |
| Everything the entries are joined to | `attachWorkFields`, `attachPersonFields`, `attachCastFields` in `anthology_handlers.go` |
| A print stylesheet and a Print control | the `PAPER` block at the foot of `index.css`, guarded by `print-hides-the-chrome.test.js` |
| EPUB | `internal/httpapi/export_anthology_epub.go`, `GET /anthologies/{id}/export.epub` |
| The rule column and the fill | migration 0075 and `internal/httpapi/anthology_fill.go` |
| The rule UI | `RuleDialog` in `anthologies.jsx`, drawing the Search screen's own `SearchBox` |
| `rule_auto` | the check-on-open above, which has its own entry — the plan's two sentences were two designs |

**`anthologies.md` goes with it and had nothing of its own left.** Its one open item
was EPUB, deferred on 2026-08-19; its two others had shipped and the file had not
caught up; its third was already handed to `episodes.md`'s `ReorderList`. The newer
plan says all of that itself, which is why this is one entry and not two.

### Where the plans turned out to be wrong

**`anthology-update.md` §3 describes a `people` table that has not existed since
0027.** It says the person join is *"`people` (0012), matched by exact name"* and
lists a `kind`. 0012's table had `kind` (`'author' | 'actor'`); **0027 replaced it
with one row per name** — `UNIQUE(user_id, name)`, no kind, and its own comment
naming `movies.director` as a fourth thing it matches. Building from the plan's
description would have written a `kind` predicate against a column that is gone.

**Its cast join names the wrong column, and the right one makes the feature
possible.** The plan reaches for `work_cast`'s picture; `work_cast` has two.
`image_url` is the **provider's**, out on the internet, and `internal/metadata` is
the only package allowed an outbound call — so from the exporter that field is
unreadable. `character_image_path` (0050) is the copy this install already
downloaded, sitting under `MediaCover`, and that is what is joined. The distinction
decides whether the field can exist at all.

**Genres is in the plan's list and is not in the registry.** Both works tables carry
`genre_text`, which is space-joined for FTS — "Fiction Fantasy", not
"Fiction, Fantasy" — so printing it in a document made to be read would put a search
index on the page. The readable form needs the `book_genres` / `movie_genres` join,
which is a different shape of work from the eleven fields that need no join at all.

**The roadmap's EPUB costing was one package too generous, in our favour.** It
budgeted *"`archive/zip` … and `encoding/xml`"*. `encoding/xml` is the wrong tool
for the escaping: `xml.EscapeText` escapes newline, carriage return and tab as
numeric references — correct inside an attribute, where whitespace is normalised
away, and wrong in prose, where it would print `&#xA;` at every line break in a
reader's commentary. `html.EscapeString` covers exactly the set XML text content
needs, and nothing else here wants a marshaller.

**And `matched` could not be counted the way a count is normally counted.**
`facetedCount` reads the base table and knows nothing about FTS, so under a
free-text rule it would count every row the facets allow and ignore the words. The
fill therefore scans (5000 per kind) and reports `matched_capped` when that ceiling
is reached — a floor is honest; a ceiling reported as the truth is not.

### What stays named and unbuilt

The plan's own *Out of scope* list survives the fold, because naming a thing you did
not build is the half of a plan that keeps its successor honest:

- **Saved searches** — a stored query that stays *live*, listed on the Search screen.
  A real feature and a good one; it is what an "automated anthology" would be if the
  word *anthology* did not already mean something with an order and a voice in it.
  This release stores a rule **on** an anthology; a saved search is its own object.
- **Publishing** — a public URL for an anthology, which brings an access-control
  model, a rate limit and a moderation question. `anthologies.md`'s pointer to
  roadmap §18 was already stale when it was written; that section is now directories
  and icon CDNs, and the question has no home on the roadmap at present.
- **A server-rendered PDF**, and the typesetting dependency it would take.
- **Sectioning an anthology by work** — the real answer to the plan's "once per
  group" caution, which the registry deliberately does not carry. See its own entry
  above.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
