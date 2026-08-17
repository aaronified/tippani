# Quick wins — roadmap §1

**Status:** Shuffle and On this day shipped in 1.16.0 — their decisions are in
[`../PLAN.md`](../PLAN.md) §12. What is left is Saved views and keeping the
capture form filled.

Roadmap section [`#quick-wins`](../roadmap.html#quick-wins), tracked as issue
#15. Its framing: *things that are an afternoon each and pay for themselves
immediately*, grouped together *because a cheap item filed under an expensive
heading never gets picked up*.

---

## What already exists

Verified against `456e5a5`.

| §1 item | State |
| :-- | :-- |
| **Shuffle** | Not built. `shuffleSeeded` exists but only orders Home's favourites; there is no random-quote surface and no route for one. |
| **On this day** | Not built. Nothing in the tree matches. |
| **Manifest surfaces** — `shortcuts`, `file_handlers`, `launch_handler` | **Shipped.** All three are in `web/frontend/public/manifest.json`. |
| **App-icon badge** — `navigator.setAppBadge()` | **Shipped.** `App.jsx:1031`, including the `setAppBadge(0)` case the roadmap does not mention and the code comments do. |
| **Saved views** | Not built — and the reason the roadmap gives for it being cheap **is wrong**. See below. |
| **Keep the form filled after saving a quote** | Not built. `AddSurface.jsx` has no persistence across saves. |
| **Rotate the quote on the login screen** | **Shipped.** `epigraphs.js` + `App.jsx:450`. Its own header says *"a different one each time you come back"*. |

### What the verification pass changed

**Three of the seven had already shipped.** The manifest item is the starkest:
it names *Capture quote · Daily quiz · Pending imports* as the shortcuts to add,
and `manifest.json` has those three shortcuts, with those names, pointing at
`/capture`, `/` and `/pending`. It names `.md`, `My Clippings.txt` and a
Bookcision `.json` landing in staging, and `file_handlers` accepts
`text/markdown`, `text/plain` and `application/json` at `/import`. The roadmap
entry is a description of a file that already exists.

All three come out of the roadmap in this release. That is the third such cull —
1.15.3 removed eight, §3 removes two more — and at this point the pattern is
worth naming rather than fixing one more time by hand: **items are being marked
done in the changelog and not removed from the roadmap**, and nothing checks.
`scripts/roadmap-data.mjs --check` validates the *generated* sections against
`docs/data/*.json` and cannot see the hand-written backlog at all, which is
where every one of these thirteen items lived.

**The saved-views justification does not hold.** The roadmap says *"the filter
state is already serialised into the URL in full, so a saved view is a
`(name, url)` row"*. It is not. `App.jsx:1101` pushes the **path** only; every
filter, scope, chip, view mode and grouping is held in `localStorage` through
`usePersistedState` (`tippani:search:q`, `:scope`, `:chips`, `:searchview`,
`:search:group`, and the same pattern on Library and Catalogue). There is no URL
to save.

That does not kill the item, but it changes what it is: not an afternoon writing
a two-column table, but **first making the filter state a URL**, then saving it.
Which is a better feature anyway — a search you cannot link to a friend is a
search you cannot link to yourself tomorrow — and it is the same work item 1
of [`search-precision.md`](search-precision.md) benefits from. It should be
built once, for both, and it stops being a quick win.

---

## What gets built

### Shuffle and On this day — **shipped 1.16.0, with one departure**

Both landed on Home rather than at their own routes.

The plan said `/shuffle` should be a real page, on the reasoning `routes.js`
gives for the bin: a route bookmarks and survives a refresh. That is true and it
is not worth the routing surface here — a card you press buys the same pleasure,
and pressing is the whole gesture. The plan's argument stands if Shuffle ever
wants its own screen.

Two things the plan got right and one it left open:

- **Nothing touches `item_reviews`.** Written as a caution; it turned out to be
  the assertion the tests are built around, because these draw the same quote
  card the deck does.
- **Kind before row.** Not in the plan at all, and it is what makes Shuffle
  usable: drawing uniformly across every quote shows a film line once in a
  hundred tries in a library that is mostly highlights.
- **`noted_at` over `created_at`** — the plan called this out as the thing the
  roadmap left unsaid, and it was right to.

### Saved views

Two pieces, in order, and the first is the one the roadmap missed:

1. **Put the filter state on the URL.** Search's `q`, `scope`, `chips`, `view`
   and `group`; the same for Library and Catalogue. `usePersistedState` keeps
   working as the fallback for arriving with a bare path.
2. **Then a saved view is a `(name, url)` row** and a list in the drawer, as
   written.

### Keep the form filled after saving a quote

Work, colour and tags persist for the next one. Today a sitting of six quotes is
six full re-entries.

- **The quote text and the note do not persist.** Those are the row; carrying
  them forward risks saving the same line twice, which is the one mistake this
  app should never help you make.
- **It has to be visibly on.** A form that silently keeps its last state looks
  like a form that failed to clear. A small "kept from the last one" line, and a
  way to clear it.

---

## Verification

| Test | Asserts |
| :-- | :-- |
| `internal/httpapi` (shuffle) | `/shuffle` returns one row across all three kinds, and leaves `item_reviews` untouched. |
| `internal/httpapi` (on this day) | Matches on month-day across years; prefers `noted_at` over `created_at`; empty day returns empty rather than today's rows. |
| `routes.test.js` | `/shuffle` is a route and not a nav tab, and the existing nav invariant still holds. |
| `test/dom` (add surface) | After a save, work/colour/tags survive and quote/note do not. |
| `test/dom` (URL state) | A search with chips round-trips through the URL: navigate away, come back by URL, same query. |
