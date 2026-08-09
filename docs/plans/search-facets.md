# Plan — search that knows where you are and what you meant

**Target: 1.10.0. Independent of the other two plans; could land at any point.**

Two asks, one mechanism: **tagged searches** — say which field you mean, with the
values offered to you — and **context-aware searches** — the screen you are on
narrows the search before you type, visibly and removably.

Nothing here is written yet. This is the plan.

---

## What already exists

Verified against `09f8a5b` (v1.7.3). Search is not a thin feature here; most of
this plan is exposing machinery that is already built.

| Thing | Where | Bearing on this |
|---|---|---|
| Sectioned search | `search_handler.go` (1239 lines) | Results are sectioned by **what matched**: Authors, Directors, Actors, Speakers, Notes, Tags, Genres, plus Decade and DateAdded. The facets already exist — as *outputs*. This plan makes them *inputs*. |
| `searchScope` | `search_handler.go` | `all \| books \| annotations \| movies \| dialogues \| quotes`, one struct rather than a bool per medium, deliberately. |
| `searchScoped(scope)` in the shell | `App.jsx` | **The context-aware half is already built and already deliberate.** Its comment: *"The top bar's Search lands scoped to whatever you were looking at (Library → Books, Catalogue → Movies)… The drawer's Search clears the scope instead."* What is missing is that nothing on screen says which one you got. |
| `fuzzyCorrect` | `search_handler.go` | Typo correction against `fts5vocab`, best-effort, degrading to `""` so search never 500s because fuzzy broke. Today it runs **only on zero hits**. |
| `TokenInput` | `ui.jsx` | Removable pills + a `.token-menu` suggestion dropdown, used at nine call sites for tags and genres. The facet chips are this component, generalised. |
| `nameConds`, `queryTokens` | `search_handler.go` | `instr(lower(col), ?)` per token, ASCII-folding, matching how tags are typed. |
| `editDistance` | `MetadataPage.jsx` | Client-side, already written for near-duplicate detection. Needs lifting into a shared module for the dropdown's typo tolerance. |
| Filter sheets | `Library.jsx`, `Movies.jsx` | Nine ephemeral `useState`s each, with an `onReset` that enumerates them. |

---

## Decisions

All vetted.

| Question | Decision |
|---|---|
| Facets | **All four families.** `tag: colour:`; `author: speaker: actor: director:`; `shelf: genre: series: year:`; `favourite: note: wishlist:`. |
| Trigger | A known field name followed by `:`. |
| Value list | **One vocabulary call on first focus, cached for the session.** Filtering and typo-tolerance happen locally. |
| Typo tolerance | Client-side over the cached vocabulary, narrowing as you type. |
| Active facets | **Chips in a row beneath the box.** The input stays free text. |
| Context seeding | **Board filters and work pages.** On the Library the search is scoped to books unless the chip is removed. |
| Mobile | Drawer search is **always global**; top-bar search is **local**. (Already the behaviour — now visible.) |
| Desktop | Top search is always context-aware; **right-click the icon toggles global/local**, and global wears a small globe in the search circle. |
| Combining | **Per facet.** Multi-valued facets (`tag`, `genre`) **AND**; single-valued ones (`colour`, `shelf`, `year`, `series`) **OR**. |
| Filter sheets | **Kept, sharing one state with the chips** — two editors of the same thing. |

**Why combining depends on the facet.** A quote has one colour. `colour:doubt
colour:joy` under an all-AND rule means "has two colours", which nothing does, so
that query returns nothing forever and looks broken. Under per-facet rules it
means "either", which is what you would say out loud. Meanwhile `tag:stoicism
tag:death` **must** be an intersection, because narrowing by two tags is a real
question in a quote library and OR would widen it. One rule cannot serve both,
so the rule is a property of the facet.

---

## Part 1 — the grammar lives on the client

The box holds **free text**. Typing a known field name plus `:` opens the value
dropdown; choosing a value **lifts the token out of the box into a chip beneath
it**, exactly as `TokenInput` already lifts a typed tag into a pill.

So the `field:value` syntax is a *typing affordance*, not a wire format. The
client sends structured parameters:

```
GET /search?q=<free text>&scope=books&tag=stoicism&tag=death&colour=doubt&author=Le+Guin
```

**One parser, not two.** A grammar the client parses for chips and the server
re-parses for SQL is a grammar that drifts, and the drift shows up as a query
that renders one way and matches another. Keeping the syntax entirely on the
client means the server API stays typed, and a malformed facet is impossible to
send rather than merely rejected.

It also makes the URL the honest record: every chip is a query parameter, so a
search is bookmarkable, shareable and directly reusable by a saved view.

---

## Part 2 — the vocabulary

`GET /search/vocabulary` — one call, returning what this user can be offered:

```json
{"tags":[…],"genres":[…],"series":[…],"authors":[…],"speakers":[…],
 "actors":[…],"directors":[…],"colours":[{"key":"blue","name":"doubt"},…],
 "shelves":[…]}
```

Fetched on first focus of the search box and held for the session. A personal
library's vocabulary is small — this is one request, not one per keystroke, and
the dropdown is instant with no flicker behind the typing.

**Colours come back as key *and* name**, because 1.7.1 made them user-named: the
chip must read `colour:doubt` and the query must send `blue`. A facet that shows
the storage token would be showing the user something they deliberately renamed.

Narrowing is prefix-match first, then `editDistance` as a fallback, so an exact
prefix never loses to a fuzzy match on a different word. `editDistance` moves out
of `MetadataPage.jsx` into a shared module — it is about to have two callers, and
the second one is not about metadata.

Per-user isolation applies as everywhere: the vocabulary is `WHERE user_id = ?`,
and a name that is not yours is not offered.

---

## Part 3 — the server

`/search` gains repeated facet parameters. Each maps to a predicate applied
before the existing sectioning, so sections keep meaning "what matched" and the
facets mean "within this".

- **Multi-valued** (`tag`, `genre`): one `EXISTS` per value, ANDed.
- **Single-valued** (`colour`, `shelf`, `series`, `year`): one `IN (…)` per
  facet, OR within it.
- **Credits** (`author`, `speaker`, `actor`, `director`): reuse `nameConds` and
  the credit splitting `matchedCredits` already does, so `author:Gaiman` matches
  a book credited *Gaiman & Pratchett*.
- **Flags** (`favourite`, `note`, `wishlist`): boolean predicates.

**Never interpolate a facet value into an FTS `MATCH`.** The facets are ordinary
SQL predicates on ordinary columns; only the free-text `q` reaches FTS, and it
reaches it the way it does today.

An unknown facet name is a **400**, not a silent ignore — a typo'd facet that is
quietly dropped returns a wider result set that looks like a correct answer.

`fuzzyCorrect` keeps its zero-hit behaviour unchanged. It corrects free text, not
facets: a facet value came from a list the user was shown, so correcting it would
be second-guessing a choice rather than a typo.

---

## Part 4 — context

The seeding already half-exists; this makes it visible and removable.

- **Board filters become chips.** On the Library filtered to *reading*, the
  search opens with `shelf:reading` already up. On a work's page, `book:The
  Dispossessed`. Every seeded chip is removable, so narrowing is free and
  widening is one click.
- **The Library seeds `scope:books`**; the Catalogue seeds films. Removing the
  chip widens to everything. This is what `searchScope(tab, detail)` already
  computes — it just had nowhere to show itself.
- **Mobile**: the drawer's Search stays global, the top bar's stays local. No
  behaviour change; the chips make the difference legible for the first time.
- **Desktop**: the top search is context-aware, and **right-click on the icon
  toggles global**. Global mode draws a small globe in the search circle.

**One cross-plan dependency.** `Tooltip` calls `onContextMenu => preventDefault()`
on every control it wraps, and the search icon is one of them — so right-click
there does nothing today and will keep doing nothing unless the suppression grows
an opt-out. That same line is load-bearing for the [context menu
plan](context-menu-and-multiselect.md), so whichever ships first should add the
opt-out rather than both inventing one.

**Discoverability is a known cost, accepted deliberately.** The toggle is
right-click only, with no on-screen affordance. It goes in `help.jsx` and the UI
glossary, which is where this app documents its other invisible gestures.

---

## Part 5 — the filter sheets

The sheets keep their checkboxes, and setting one **writes a chip**. Sheet and
bar become two editors of one state, so they cannot disagree.

This is the largest single piece of work in the release and the only one that
touches screens outside search. It is worth it for one reason: with facets able
to express everything a sheet can, leaving them separate would mean two ways to
say *tagged stoicism* that do not know about each other — which is exactly the
divergence the [action registry](context-menu-and-multiselect.md) exists to
prevent one screen over.

The nine `useState`s per board collapse into the facet state, and `onReset`
becomes clearing it.

---

## Commits

| # | Commit | Contains |
|---|---|---|
| 1 | `feat: the words your library actually uses` | `GET /search/vocabulary` + tests |
| 2 | `refactor: edit distance was not about metadata` | shared module, no behaviour change |
| 3 | `feat: say which field you meant` | facet parsing, chips beneath the box, dropdown |
| 4 | `feat: a search that can be narrowed` | facet params on `/search`, per-facet AND/OR |
| 5 | `feat: searching from a shelf searches the shelf` | context seeding, chips from board filters |
| 6 | `feat: a globe for when you meant everything` | globe badge + right-click toggle + Tooltip opt-out |
| 7 | `refactor: the filter sheet writes chips` | shared state, `onReset` collapse |
| 8 | `docs: what a colon does in the search box` | `help.jsx`, `ui-glossary.html`, `README.md`, `AI.md` |
| 9 | `chore(release): 1.10.0` | CHANGELOG, tag |

---

## Verification

1. `go vet ./...`, `go test ./...`.
2. `npm test`, both projects.
3. New Go tests:
   - each facet narrows, and narrows to the right rows — **values, not counts**;
   - two tags intersect; two colours union;
   - an unknown facet is a 400;
   - `author:` matches inside a joined credit;
   - the vocabulary endpoint is per-user, and a foreign name is never offered;
   - no facet value can reach an FTS `MATCH`.
4. New Vitest tests: the parser lifts a token to a chip; the dropdown narrows and
   tolerates one typo; an exact prefix outranks a fuzzy match; removing a seeded
   chip widens the scope.
5. `make frontend` in the same commit as any frontend change.
6. `node scripts/roadmap-data.mjs --check` and `scripts/glossary-css.mjs --check`.

## Risk

Low, and mostly confined to Part 5. Parts 1–4 add parameters and a read-only
endpoint; nothing writes, nothing deletes, and a wrong answer is a wrong result
set rather than a lost row. Part 5 rewires two working screens onto new state,
which is where a regression would actually land — hence its own commit, last,
after the facets are proven.
