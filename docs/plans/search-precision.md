# Search precision — roadmap §3

**Status:** designed, not built. The visibility half shipped in 1.16.0 and its
decisions are in [`../PLAN.md`](../PLAN.md) §7; what is below is what is left.

Roadmap section [`#search-precision`](../roadmap.html#search-precision), tracked
as issue #20. Its own framing is right and worth keeping: search is good at
finding a thing you half-remember and cannot answer a *precise* question, and
that gap widens with every hundred quotes.

---

## What already exists

Verified against `456e5a5`, by reading the tree.

| §3 item | State |
| :-- | :-- |
| **Field operators** — `author:austen tag:grief colour:blue` | **Shipped in 1.10.0** — and made *findable* in 1.16.0, which is what the report was actually about. Both items are out of the roadmap now. |
| **Highlight the matched words** | **Shipped.** `SearchPage.jsx` `Highlight`, fed by `queryTerms` on both the exact and the corrected path. |
| **Counts beside each facet value** | Not built, deliberately. See PLAN §7 — the count worth having is per *query*, not per library, and it is fifteen more queries per value per field. |
| **Exact phrases** — `"to be or not to be"` | Not built. `internal/search/fts.go` has `Query`, `PrefixQuery`, `ColumnPrefixQuery` and no phrase form. |
| **Date ranges** — `2025-01..2025-06`, "last 30 days" | Not built. The single-day `date_added` facet exists and the Stats calendar links into it. |
| **"More like this"** without an embedding model | Not built. The `*_fts_vocab` views it would read exist (0016, and 0026 for utterances). |
| **Neighbouring highlights** | Not built. `locSortVal` exists but is **client-side, in `Library.jsx:1194`** — the server has no locator ordering. |
| **Cross-work duplicate quotes** | Not built. `/books/merge` and the duplicate console exist; neither compares quote text across works. |
| **Sort by date or length; a filter box inside one work** | Partly. Table view sorts via `useSort`; tiles and list do not, and there is no in-work filter box. |

### What the verification pass changed

**Two of the eight had already shipped**, fifteen releases ago in one case. That
is the same defect 1.15.3 culled eight instances of, and it is not cosmetic
here — it is *the reason this plan exists in the shape it does*.

The owner's report was: *"I do not see search facets yet"*, then *"these should
have landed before"*. Both true. Field operators shipped in 1.10.0 and the
roadmap still lists them as coming. So a reader who cannot find facets in the
interface, and goes to the roadmap to check, is told they do not exist — by the
document whose one job is answering *what is coming next*.

The interface tells them the same thing, which is the actual bug.

---

## 1. Exact phrases

`"to be or not to be"` becomes one FTS5 phrase query instead of six independent
prefix terms. For a library *made of phrases* there is currently no way to ask
for one at all.

The whole change is in `internal/search/fts.go`, which is 51 lines and the only
place a query string is built. Split the input on balanced double quotes; a
quoted run becomes `"…"` passed through to FTS5 with its internal quotes
doubled; unquoted runs keep today's prefix behaviour exactly.

**A trailing prefix `*` must not be added inside a phrase.** `"to be or not to
be"*` is a different query and not the one anyone typed.

**An unbalanced quote is not an error.** Somebody typing a quotation mark
mid-search should get results, not a red box, so an unclosed quote is treated as
an ordinary character — the same forgiveness `note\:` gets in the facet grammar.

## 2. Date ranges

`date_added` parses one day. `2025-01..2025-06` and "last 30 days" are the
extensions, and the Stats calendar already links into the single-day form.

Two decisions worth writing down before it is built:

- **The range is a facet, not free text.** It goes on the wire as
  `&added_from=&added_to=`, parsed in `search_facets.go` with everything else,
  so it inherits the unknown-name 400 and reaches all fifteen queries through
  one builder.
- **Partial dates compare as TEXT**, following `work_reads` (0024) and
  `utterances.occasion_date` (0026), which are the two places this schema has
  already solved partial dates. `2025-01` sorts correctly against `2025-01-15`
  lexically; converting to a datetime would invent a precision nobody typed.

## 3. "More like this", without an embedding model

Semantic search via `sqlite-vec` sits under Later and costs a dependency plus an
indexing pass. There is an 80% version that costs neither: take the quote's
highest-value terms from the `*_fts_vocab` views that already exist for typo
correction, and run them as one `OR` match.

Worth shipping first because it may well be enough. The stop-word problem is the
whole of the work: `fts5vocab` gives document frequency, so "the" and "and" fall
out by being common rather than by a bundled English word list — which matters,
because this library is not only in English.

## 4. Neighbouring highlights

*"What else did I mark near here"* — the annotations either side of this one by
`location` in the same book. Nothing else in this category can do it, because
nothing else keeps the locator.

**The correction this plan makes:** `locSortVal` is named in the roadmap as
though it were reusable, and it is not — it lives in `Library.jsx:1194` and runs
in the browser over a page of rows already fetched. Neighbours have to be
computed server-side over the whole book, so the parser has to exist in Go as
well. Two parsers for one locator format is the drift risk this repo names over
and over, so: **one table of cases, tested on both sides**, or the Go one is
authoritative and the client sorts by what the server returns.

## 5. Cross-work duplicate quotes

A passage saved under two editions of the same book. Pairs with the merge that
already exists (`/books/merge`; there is still no `/movies/merge`).

`store.DedupeHash` already normalises quote text and *excludes* the locator, so
the join key exists — this is a report over a hash that is already computed and
already stored, not new normalisation.

## 6. Sorting and an in-work filter box

Sort by date or length in tiles and list, not only in table view. And a filter
box inside a single work, which stops being optional somewhere around the
three-hundredth highlight in one book.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| `internal/search/fts_test.go` | (phrases) A quoted run is one phrase; a prefix `*` is never added inside it; an unbalanced quote searches rather than errors. |
| shared locator cases | (neighbours) The Go parser and `locSortVal` agree on every case in one table. |
