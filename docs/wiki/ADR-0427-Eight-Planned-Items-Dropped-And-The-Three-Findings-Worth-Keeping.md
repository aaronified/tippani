# ADR-0427: Eight planned items dropped, and the three findings worth keeping from them

Source of truth: this wiki page.

- **Area:** [§12 Shell, Navigation and Entry Points](ADR-Index.md#area-12)
- **Status:** Accepted
- **Version:** 1.16.0

**Decided.** After 1.16.0, roadmap §§1–3 (Quick wins, The review loop deepened, Search precision) are gone. Their remaining eight items are not being built, and three now-empty sections came out with them. `docs/plans/quick-wins.md`, `review-loop-cards.md` and `search-precision.md` were folded here and deleted, because the plans directory promises *this is not built yet* and a plan for something nobody intends to build fails that promise exactly as a shipped one does.

**Why the sections went rather than staying empty.** A heading that names a theme and lists nothing is a worse document than no heading: it reads as an oversight rather than a decision. Removing them renumbered everything below, and the §number is the disposable half of the pair by design — the id is durable and the number is positional — so the rail, the body and sixteen in-prose cross-references were rewritten off the ids.

**The three findings that outlived their plans**, each of which came out of a *What already exists* pass and each of which contradicts something the roadmap asserted:

1. **The recall sparkline could not have been built as described.** §2 promised "query-time work against columns that already exist" and the entry said the sparkline was "drawn from `item_reviews`". That table is `PRIMARY KEY (kind, item_id)` — one row per quote, every column a scalar. A sparkline is a series. It needs a review LOG: a new table, a retention policy for the first unbounded-growth table in the schema, a delete trigger per parent (0026's header explains why a missed one lets a reused rowid inherit a stranger's history), and a place in backup and restore. Pricing that as an afternoon is how it stayed unbuilt while looking cheap.

2. **Saved views was not a `(name, url)` row.** §1 claimed "the filter state is already serialised into the URL in full". It is not: `App.jsx` pushes the path only, and every filter, scope, chip, view mode and grouping lives in `localStorage` behind `usePersistedState`. The real first half was putting the filter state on the URL — worth doing on its own, and not a quick win.

3. **`locSortVal` is not reusable.** §3's neighbouring-highlights entry cited it as though it were; it runs in the browser, in `Library.jsx`, over a page of rows already fetched. Deciding two highlights are adjacent means ordering the whole book, which is server work — so it needs the same locator parser in Go, and one shared table of cases testing both, or the two disagree silently.

**What this says about the roadmap as a document.** Across 1.15.3 and 1.16.0, nineteen items left it: eleven because they had shipped and nobody removed them, and eight because they were dropped. Three of its assertions about the code turned out to be false, and all three were found by writing a plan against the tree rather than against the roadmap. `scripts/roadmap-data.mjs --check` cannot catch any of this — it validates the *generated* sections against `docs/data/*.json` and never reads the hand-written backlog, which is where every one of those items lived.

**Instead of.** Leaving them listed. A roadmap that names work nobody intends to do is the same failure as one that names work already finished: in both cases the page stops answering the only question it is for.

<sub>1.16.0 — `docs/roadmap.html` · `docs/plans/`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
