# Plan — right-click actions, and multiselect, on works and quotes

**PART 1 AND PART 2 SHIPPED in 1.9.0** — the action registry, the generalised
menu, the gesture, and the two bulk-endpoint commits (8 and 9), which the plan
itself notes are independent of everything above them.

**Part 3 (multiselect) is next**, as its own release rather than the tail of this
one: it rewires how a click behaves on three boards, and shipping it half-wired
would leave a mode nobody can get out of. The plan's own note applies — "cut it and
nothing above it is weaker for its absence".

Two departures from the plan so far, both in `docs/PLAN.md`:

1. The menu is live on the three QUOTE-card surfaces (annotation, dialogue, Home
   favourite). Work cards — Library and Catalogue tiles — come with Part 3, since
   the selection entry points land on the same cards and one pass over them is
   better than two.
2. `ownedIDs` already existed as `ownedRowIDs`, so the kinds became a TABLE rather
   than a second helper beside the first.

Two features, written as one plan because they are one mechanism seen twice. A
context menu asks "what can I do to *this*"; multiselect asks "what can I do to
*these*". Built separately, the app ends up with two answers to the same question
— a menu that offers Delete beside a bar that does not — and the divergence is
invisible until somebody notices one of them is missing something.

So: **one action registry, two surfaces.** Build the registry first; neither
feature is worth building without it.

Nothing here is written yet. This is the plan.

---

## What already exists

Verified against `09f8a5b` (v1.7.3).

| Thing | Where | Bearing on this |
|---|---|---|
| `MoreMenu({items:[{icon,label,onClick,danger}]})` | `ui.jsx` | **The context menu already exists**, as the mobile branch of `QuoteActions`. Renders `role="menu"` / `role="menuitem"`. Anchors to a button, not to a point. |
| `QuoteActions` | `ui.jsx` | The canonical per-quote set: Share · Edit · Delete. Already builds an `items` array on mobile and glyph buttons on desktop — two renderings of one list. |
| `BulkBar({n, onClear, children})` | `ui.jsx` | The selection strip, used by `MetadataPage` and `SearchPage`. Says "N selected" with a clear button. |
| Selection state | `SearchPage.jsx` only | A `Set` per result table, `toggleId` / `toggleAll`. Table-only, per-section, not shared, not exported. |
| `LONG_PRESS_MS = 500`, `LONG_PRESS_SLOP = 10` | `ui.jsx` | **Long-press is already taken.** `Tooltip` uses it to show its label on touch. |
| `Tooltip` | `ui.jsx` | Calls `onContextMenu={e => e.preventDefault()}` on its wrapper — right-click is *already* suppressed on every tooltip'd control and currently does nothing at all. |
| `InfoPopover` | `ui.jsx` | Anchored popover with real viewport-flipping maths, portalled to `<body>`. Lift its positioning; do not write new. |
| Bulk endpoints | `bulk_handlers.go` | `POST /books/bulk`, `/movies/bulk`, `/annotations/bulk`, `/dialogues/bulk`. |
| The bin | 1.8.0 | Every in-scope delete is recoverable for 30 days. Bulk delete is only sane because of it. |

### Three gaps

1. **No bulk endpoint for standalone quotes.** `annotations` and `dialogues`
   have one; `utterances` does not. Multiselect on the Quotes screen would have
   nothing to post to.
2. **No bulk colour.** Colour became a six-slot user-named category in 1.7.1 and
   the bulk endpoints still cannot set it — now the single most plausible reason
   to select forty quotes.
3. **No bulk delete.** Every bulk endpoint only ever *sets* fields.

---

## Decisions

All vetted.

| Question | Decision |
|---|---|
| Build order | **Registry → menu → multiselect.** Commit 1 changes no behaviour. |
| Where actions are declared | One module, `actions.jsx`: `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)`. |
| Menu component | **Generalise `MoreMenu`** to accept an anchor element *or* a point. One menu, three triggers. |
| Long-press conflict | Menu on the **card body**; `Tooltip`'s label long-press stays on **controls**. See below. |
| Right-click over selected text | **The browser's menu wins.** Non-collapsed selection inside the target → do not preventDefault. |
| Keyboard | <kbd>Shift</kbd>+<kbd>F10</kbd> and the Menu key, opening at the focused card, focus returned on close. |
| Delete in the menu | Present, but **below a separator, danger-styled, never adjacent to Select or Edit**. |
| Desktop selection entry | **Hover checkbox in the card corner, plus Ctrl/Cmd-click anywhere on it.** |
| Touch selection entry | **A Select toggle in the board toolbar.** Long-press always means menu, with no exceptions. |
| Range select | <kbd>Shift</kbd>+click over `shown`, the ordered visible list each board already computes. |
| Selection vs filters | Changing any filter **clears** the selection. |
| Cross-kind selection | **Forbidden.** Selecting in a second section clears the first. The bar names the kind. |
| Selection persistence | None. It dies with the screen. |
| Bulk delete | **Never from a gesture.** Select → toolbar Delete → typed confirmation. Last commit, alone. |
| Surfaces | Library, Catalogue, quote cards on work pages, the Quotes screen. **Not** Search results or Home favourites. |

---

# Part 1 — the action registry

**The whole plan rests here, and it is about thirty lines of data.**

Today an action's definition is spread across whatever renders it. `QuoteActions`
knows Share/Edit/Delete. A work's delete lives in `WorkDetails`. The shelf move
lives in `Library`. Nothing knows the *set*, so nothing can offer the set
anywhere else — which is exactly why there is no context menu, and why
`SearchPage`'s bulk form offers tags-and-fields rather than "the things you can
do to a quote".

```
actionsFor(kind, item, ctx)      -> [{ id, label, icon, danger?, single?, hidden?, run(item) }]
bulkActionsFor(kind, items, ctx) -> [{ id, label, icon, danger?, form?, run(items) }]
```

`kind` is `'book' | 'movie' | 'annotation' | 'dialogue' | 'quote'`. `ctx` carries
the callbacks a screen owns — open the share dialog, start an inline edit, reload
— so the registry stays declarative and screens keep their behaviour.

**Every action appears in both lists or is explicitly marked, and a test asserts
it.** An action that can be done to one thing and not to forty is a real category
— Edit is exactly that — so the registry marks it `single: true` rather than
omitting it. Absence is what drift looks like; a flag is what a decision looks
like.

Commit 1 changes no behaviour: `QuoteActions` renders `actionsFor(...)` instead
of its hardcoded three, `SearchBulkForm` renders `bulkActionsFor(...)`. If the
screens look identical afterwards, the registry is right.

---

# Part 2 — right-click and long-press

## The gesture problem

**Long-press is already taken, and by something that overlaps.** `Tooltip` opens
its label after `LONG_PRESS_MS` on touch, because a phone has no hover and the
glyph-only buttons introduced in 1.5.0 would otherwise be unlabelled. A card
contains those buttons. So "long-press opens a menu" and "long-press shows a
label" are live on the same square inch.

They coexist only because of what each is attached to:

- **Tooltip's long-press is on a control** — a 34px or 44px button, wrapped in
  `<Tooltip>`.
- **The menu's long-press is on the card body** — everything that is not one of
  those buttons.

So: the menu handler goes on the card, and any long-press whose
`event.target.closest('.tp-tip-wrap, button, a, input')` is non-null is ignored.
A thumb on the share glyph gets the label; a thumb on the quote gets the menu.
This is a constraint on the design, not a detail — bound to the whole card
including its buttons, every long-press on a glyph would race a tooltip against a
menu, and the winner would depend on event order.

Three further touch problems, each of which shows up on real hardware and on no
test here:

- **iOS raises the callout menu** (Copy / Look Up) on long-press over text.
  `-webkit-touch-callout: none` on the card body.
- **A long-press that becomes a drag is not a long-press.** `LONG_PRESS_SLOP`
  already exists; reuse the constant rather than inventing a second one.
- **The card must not also fire its click.** `Tooltip` already solves this with a
  `suppressClick` ref and an `onClickCapture` that eats the trailing click — copy
  that mechanism, do not re-derive it.

## Right-click

`onContextMenu` on the card body, `preventDefault()`, open at
`{x: e.clientX, y: e.clientY}`.

**Except when text is selected.** Somebody who has dragged across a quote and
right-clicked wants Copy, and taking the browser's menu away from them in a
note-keeping app is worse than having no menu at all — they would also lose Look
Up, Translate and Search With, none of which we would be reimplementing. Check
`window.getSelection()` for a non-collapsed range inside the target and bail.

**`Tooltip` already suppresses `contextmenu`** on every control it wraps. That is
desirable here — right-clicking the share glyph should not open a card menu — but
it means the suppression is now load-bearing for two reasons, and its comment
needs to say so.

## The menu component

Generalise `MoreMenu` rather than adding a second menu. It already renders
`role="menu"` / `role="menuitem"` and takes exactly the shape the registry
produces. What it needs:

- **Point anchoring** — `at={{x, y}}` beside the element anchor, with the
  viewport flipping `InfoPopover` already does. Lift that maths.
- **Real menu keyboard behaviour** — arrows move, Home/End jump, Escape closes,
  Enter/Space activate, focus returns to whatever opened it. This is what turns
  it from a dropdown into a menu.
- **Portalled to `<body>`**, so it escapes the card's stacking context.
- **A keyboard opener** — <kbd>Shift</kbd>+<kbd>F10</kbd> and the Menu key,
  anchored to the card rather than to a pointer that was never there.

## Where it goes

| Surface | Kind |
|---|---|
| Library tiles and table rows | `book` |
| Catalogue tiles and table rows | `movie` |
| Quote cards on a work's detail page | `annotation` / `dialogue` |
| The Quotes screen | `quote` |

Search results and Home favourites are **out of scope**: their rows vary in kind,
so the menu would have to pick a registry per row, and they are the least likely
place to be doing this work. One commit per surface, so a regression bisects to
one file.

## Tests

- The registry drives the menu: an action added to `actionsFor` appears, with no
  change to any card.
- A long-press on a card opens the menu; a long-press on a button inside it does
  **not**. This is the interaction the whole gesture design exists to protect,
  and it is one jsdom test.
- A long-press that moves more than `LONG_PRESS_SLOP` opens nothing.
- Right-click with a text selection inside the card does **not** preventDefault.
- Escape closes and focus returns to the card.
- `role="menu"` with `role="menuitem"` children, and arrows move between them.
- Delete is below a separator and carries the danger style.

Playwright, CI only, for the two things jsdom cannot see: that the native menu
really is suppressed, and that a real 500ms hold on a real card opens the menu at
the finger.

---

# Part 3 — multiselect

## Selection state

One hook, `useSelection(kind, orderedIds)`, returning
`{ selected, isSelected, toggle, extendTo, selectAll, clear, count }`.

**It clears when the filter changes.** Select thirty books, switch the shelf
filter, and the selection holds ids that are not on screen — act on it and you
have acted on things you could not check. The bin makes that recoverable now; it
does not make it honest. The hook takes `orderedIds` and clears when the set of
them changes in a way that drops a selected id.

**One kind at a time.** Search shows books and quotes in one view, and a
selection spanning both has no coherent bulk action — you cannot set a series on
a quote. Selecting in a second section clears the first. The bar says which:
"12 books selected".

**Shift+click extends over `orderedIds`**, the `shown` array each board already
computes. Not over the DOM, and not over the unfiltered list.

**Nothing is persisted.** A selection is a sentence you are in the middle of
saying; resuming it after a reload is a way to act on a library that changed
while you were away.

## Entering selection

A plain click keeps opening the thing. Selection gets its own door, and there are
three because there are three input situations:

- **Desktop pointer** — a checkbox fading into the card's corner on hover, and
  <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+click anywhere on the card. One you find by
  accident, one you already know from every file manager.
- **Any pointer** — "Select" as the first item in the context menu. This is what
  makes the two features one feature.
- **Touch** — a Select toggle in the board's toolbar. Long-press-to-select is the
  alternative and it collides with long-press-for-menu; the menu wins, because it
  is the more general gesture and it contains the selection entry anyway.

Once a selection exists a plain click **toggles** rather than opens, on every
device. The mode is visible — the bar is up, the cards wear checkboxes — so the
change of meaning is not a surprise, and clicking the last item off exits it.

## The bar

`BulkBar` gains the actions from `bulkActionsFor(kind, …)` and three things it
does not have:

- **Sticky.** Selecting forty and scrolling to check one should not lose the
  controls. `position: sticky` under the top bar; on mobile, the
  `mobile-sticky-bar` treatment the boards already use.
- **A count that cannot lie** — the selection clears with the filter, and the bar
  goes with it rather than reporting a number about nothing.
- **A form slot per action**, since Add tags and Set colour need input and
  Favourite does not. `SearchBulkForm` is already this shape; generalise it.

## Server work

**`POST /quotes/bulk`** — the missing fifth endpoint, and **not** the cheap
mirror it looks like.

`bulkTag` takes a `kind` and switches a triple of names, so it reads as
parameterised. It is not: both kinds it serves are *child* rows reached through a
parent, and its ownership check is `ownedChildIDs(table, parentCol, parentTable,
…)` — `WHERE parent_col IN (SELECT id FROM parent WHERE user_id = ?)`. A
standalone quote has no parent; `utterances.user_id` is on the row itself, which
is a different query and a different helper.

So this needs `ownedIDs(table, uid, ids)` beside the existing one, and `bulkTag`
chooses between them rather than switching three strings. Small, and easy to get
subtly wrong in either direction: an ownership filter that matches nothing is a
bulk action reporting success and doing nothing; one that matches everything is
someone else's library. Both directions get a test.

The rest lines up: `utterances` carries `updated_at`, so `bulkSetChild` works
unchanged, and the 5000-id cap and the "nothing selected" 400 already apply.

**`color` on all five bulk bodies** — a pointer field like the others, validated
against the same allowlist `validColor` uses, so a colour the API accepts is a
colour the CHECK accepts.

**Bulk delete, last and alone.** It is reached only by select → toolbar Delete →
a typed confirmation carrying the count and the kind ("delete 41 quotes"),
matching the `RESET` pattern the factory reset uses. Never from the context menu,
never from a gesture. It routes through 1.8.0's `trashAndDelete` per item in one
transaction, so the whole selection is one bin entry and one Undo.

Ownership filtering goes **in the same statement as the delete**, never as a
separate check — a foreign id answers **404, never 403**, and deletes nothing.

## Tests, client side

- Selecting, shift-extending, clearing over an ordered list.
- **Changing a filter clears the selection.**
- Selecting in a second section clears the first.
- With a selection up, a plain click toggles instead of opening.
- The bar's actions are exactly `bulkActionsFor` for that kind.
- An action marked `single` is in the menu and **not** in the bar.

---

## Commits

| # | Commit | Contains |
|---|---|---|
| 1 | `refactor: one list of the things you can do to a quote` | `actions.jsx`, `QuoteActions` + `SearchBulkForm` rewired, no behaviour change |
| 2 | `feat: a menu that opens where you pressed` | `MoreMenu` point anchoring, keyboard behaviour, portal |
| 3 | `feat: the gesture a card has always been missing` | long-press + right-click + Shift+F10, selection-aware bail-out |
| 4–7 | `feat: <surface> answers a right-click` | one per board |
| 8 | `feat: the fifth bulk endpoint` | `POST /quotes/bulk`, `ownedIDs` + tests |
| 9 | `feat: forty quotes, one colour` | `color` on the bulk bodies + tests |
| 10 | `feat: a selection is a sentence` | `useSelection`, entry points, sticky `BulkBar` |
| 11 | `feat: bulk actions read the same list as the menu` | bar wired to `bulkActionsFor` |
| 12 | `feat: deleting more than one thing on purpose` | bulk delete, typed confirm, one bin entry |
| 13 | `docs: what a long press does now` | `help.jsx`, `ui-glossary.html`, `README.md`, `AI.md` |
| 14 | `chore(release): 1.9.0` | CHANGELOG, tag |

Eight and nine are independent of everything above them and could land first if
the menu work stalls.

---

## Verification

1. `go vet ./...`, `go test ./...`, `-race` for the bulk transactions.
2. `npm test`, both projects.
3. `make frontend` in the same commit as any frontend change.
4. **Mutation-test the destructive paths**: drop the ownership filter, drop the
   transaction, drop the filter-clears-selection effect, invert the `single`
   flag. Each must go red.
5. `node scripts/roadmap-data.mjs --check` and `scripts/glossary-css.mjs --check`.

## Risk

Part 2 is the fiddliest, and almost all of its difficulty is on touch hardware
this machine cannot test — an argument for keeping the Playwright suite small and
pointed at exactly the two claims jsdom cannot make.

Part 3's last commit removes many rows at once. It is last, alone, behind a typed
count, unreachable by gesture, and recoverable for 30 days because 1.8.0 shipped
first. Cut it and nothing above it is weaker for its absence.

Next: [search facets](search-facets.md).
