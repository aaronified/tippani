# Plan — right-click actions, and multiselect, on works and annotations

Two features, written as one plan because they are one mechanism seen twice. A
context menu asks "what can I do to *this*"; multiselect asks "what can I do to
*these*". If they are built separately the app ends up with two answers to the
same question — a menu that offers Delete and a bulk bar that does not, a
Favourite that means one thing on a card and another over a selection — and the
divergence is invisible until somebody notices the menu is missing something the
bar has.

So: **one action registry, two surfaces.** Build the registry first; neither
feature is worth building without it.

Nothing here is written yet. This is the plan.

---

## What already exists

Verified against `ae0fbe6` (v1.7.2). Named rather than line-numbered, because the
tree moves.

| Thing | Where | Bearing on this |
|---|---|---|
| `MoreMenu({items:[{icon,label,onClick,danger}]})` | `ui.jsx` | **The context menu already exists**, as the mobile branch of `QuoteActions`. It renders `role="menu"` / `role="menuitem"`. It anchors to a button, not to a point. |
| `QuoteActions` | `ui.jsx` | The canonical per-quote set: Share · Edit · Delete. Already builds an `items` array on mobile and glyph buttons on desktop — two renderings of one list. |
| `BulkBar({n, onClear, children})` | `ui.jsx` | The selection strip, already used by `MetadataPage` and `SearchPage`. Shows "N selected" and a clear button. |
| Selection state | `SearchPage.jsx` only | A `Set` of ids per result table, `toggleId` / `toggleAll`, feeding `SearchBulkForm`. Table-only, per-section, not shared, not exported. |
| Bulk endpoints | `bulk_handlers.go` | `POST /books/bulk`, `/movies/bulk`, `/annotations/bulk`, `/dialogues/bulk`. |
| `bulkTag` | `bulk_handlers.go` | Add tags + set favourite, over an ownership-filtered id list, one transaction. |
| `LONG_PRESS_MS = 500`, `LONG_PRESS_SLOP = 10` | `ui.jsx` | **Long-press is already taken.** `Tooltip` uses it to show its label on touch. |
| `Tooltip` | `ui.jsx` | Calls `onContextMenu={e => e.preventDefault()}` on its wrapper — so right-click is *already* suppressed on every tooltip'd control, and currently does nothing at all. |
| `.tp-select-panel`, `.token-menu`, `InfoPopover` | `ui.jsx` / `index.css` | Three anchored popovers with real positioning logic. All now carry `overscroll-behavior: contain` (1.7.2). |
| `useBodyScrollLock` | `ui.jsx` | Ref-counted page freeze, on every full-viewport overlay as of 1.7.2. |

### Four gaps found while planning

1. **No bulk endpoint for standalone quotes.** `annotations` and `dialogues` have
   one; `utterances` does not. Multiselect on the Quotes screen would have
   nothing to post to. §24 shipped the medium and stopped short of this, the same
   way it stopped short of the Stats page and Home's favourites.
2. **No bulk delete anywhere.** Every bulk endpoint only ever *sets* fields.
   Delete is the action a context menu most obviously offers and the one a
   selection most obviously wants, and it is the one with no server support and
   no undo.
3. **No bulk colour.** Colour became a six-slot user-named category in 1.7.1 and
   the bulk endpoints still cannot set it — which is now the single most
   plausible reason to select forty quotes at once.
4. **`Tooltip` eats `contextmenu` on every control it wraps.** That line was
   written to stop Android raising the selection handles over a long-pressed
   label. It also means the plan cannot simply "add an onContextMenu" and expect
   it to fire — the suppression has to be understood before it is worked around.

---

## Decisions

| Question | Decision |
|---|---|
| Build order | Registry → context menu → multiselect. The bar and the menu read the same list. |
| Where actions are declared | One module, `actions.jsx`, exporting `actionsFor(kind, item, ctx)` and `bulkActionsFor(kind, items, ctx)`. |
| Menu component | Generalise `MoreMenu` to accept either an anchor element **or** a point. One menu, three triggers. |
| Long-press conflict | Long-press opens the **menu** on a card/row body; `Tooltip`'s long-press-for-label stays on **controls**. They never overlap, because a card body is not a tooltip'd control. See *The gesture problem*. |
| Right-click over selected text | Native menu wins. If `window.getSelection()` is non-empty inside the target, do not preventDefault. |
| Keyboard | The menu is reachable by <kbd>Shift</kbd>+<kbd>F10</kbd> and the Menu key, opens at the focused card, and returns focus on close. |
| Selection entry | Explicit, never implicit: a hover checkbox on desktop, "Select" in the context menu, and a selection mode on mobile. A plain click keeps opening the thing. |
| Range select | <kbd>Shift</kbd>+click over `shown`, which is already the ordered visible list. |
| Selection vs filters | Changing any filter **clears** the selection. |
| Cross-kind selection | Forbidden. One kind at a time. |
| Selection persistence | None. It dies with the screen; nothing is written to storage. |
| Bulk delete | Ships, but behind a typed count, and **not** in the first commit. |
| New endpoints | `/quotes/bulk`; `color` on all four bulk bodies; `DELETE`-mode bulk for all five. |

### House rules that apply

- Five words maximum for a tooltip label or a toast; longer copy goes in an `InfoDot`.
- Every new or re-glyphed control gets a `help.jsx` entry and a `docs/ui-glossary.html` row.
- `web/dist/` is a committed artifact: frontend source **plus** rebuilt dist in the same commit.
- One commit per fix and per feature; the release commit stands alone.
- Docs speak in the first person.

---

# Part 1 — The action registry

**The whole plan rests here, and it is about thirty lines of data.**

Today an action's definition is spread across the component that renders it.
`QuoteActions` knows Share/Edit/Delete. A work's delete lives in `WorkDetails`.
The shelf move lives in `Library`. Nothing knows the *set*, so nothing can offer
the set anywhere else — which is exactly why there is no context menu and why
`SearchPage`'s bulk form offers tags-and-fields rather than "the things you can
do to a quote".

```
actionsFor(kind, item, ctx) -> [{ id, label, icon, danger?, hidden?, run(item) }]
bulkActionsFor(kind, items, ctx) -> [{ id, label, icon, danger?, form?, run(items) }]
```

`kind` is `'book' | 'movie' | 'annotation' | 'dialogue' | 'quote'` — the five the
app already routes on. `ctx` carries the callbacks a screen owns (open the share
dialog, start an inline edit, reload) so the registry stays declarative and the
screens keep their behaviour.

**Every action appears in both lists or in neither, and a test asserts it.** An
action that can be done to one thing and not to forty is a real category — Edit
is exactly that — so the registry marks it `single: true` rather than omitting
it, and the test checks the *marking*, not the absence. Absence is what drift
looks like; a flag is what a decision looks like.

The first commit changes no behaviour: `QuoteActions` renders `actionsFor(...)`
instead of its hardcoded three, and `SearchBulkForm` renders
`bulkActionsFor(...)`. If the screens look identical afterwards, the registry is
right.

---

# Part 2 — Right-click and long-press

## The gesture problem

**Long-press is already taken, and by something that overlaps.** `Tooltip` opens
its label after `LONG_PRESS_MS` on touch, because a phone has no hover and the
glyph-only buttons introduced in 1.5.0 would otherwise be unlabelled. A card
contains those buttons. So "long-press opens a context menu" and "long-press
shows a label" are live on the same square inch.

They can coexist, but only because of what each is attached to:

- **Tooltip's long-press is on a control** — a 34px or 44px button, always
  wrapped in `<Tooltip>`.
- **The menu's long-press is on the card or row body** — everything that is not
  one of those buttons.

The rule is therefore: the menu handler goes on the card, and any long-press
whose `event.target.closest('.tp-tip-wrap, button, a, input')` is non-null is
ignored. A thumb resting on the share glyph gets the label; a thumb resting on
the quote gets the menu. This is a genuine constraint on the design and not a
detail — if the menu were bound to the whole card including its buttons, every
long-press on a glyph would race a tooltip and a menu, and whichever won would
depend on event order.

Three further touch problems, each of which will show up on a real phone and on
no test here:

- **iOS raises the callout menu** (Copy / Look Up) on long-press over text.
  `-webkit-touch-callout: none` on the card body, and `user-select: none` on the
  parts that are not meant to be selectable.
- **A long-press that becomes a drag is not a long-press.** `LONG_PRESS_SLOP`
  already exists for this; reuse the constant rather than inventing a second one.
- **The card must not also fire its click** when the menu opens. `Tooltip`
  already solves this with a `suppressClick` ref and an `onClickCapture` that
  eats the trailing click — copy that mechanism, do not re-derive it.

## Right-click

`onContextMenu` on the card body, `preventDefault()`, open the menu at
`{x: e.clientX, y: e.clientY}`.

**Except when the user has selected text.** Somebody who has dragged across a
quote and right-clicked wants Copy, and taking the browser's menu away from them
in a note-keeping app is worse than having no menu at all. Check
`window.getSelection()` for a non-collapsed range inside the target and bail.

**And note `Tooltip` already suppresses `contextmenu`** on every control it
wraps. That is desirable here — right-clicking the share glyph should not open a
card menu — but it means the suppression is now load-bearing for two reasons, and
the comment on it needs updating to say so.

## The menu component

Generalise `MoreMenu` rather than adding a second menu. It already renders
`role="menu"` / `role="menuitem"` and takes exactly the item shape the registry
produces. What it needs:

- **Point anchoring** — `at={{x, y}}` beside the existing element anchor, with
  the same viewport-flipping `InfoPopover` already does. Do not write new
  positioning maths; lift `InfoPopover`'s.
- **Real menu keyboard behaviour** — arrow keys move, Home/End jump, Escape
  closes, Enter/Space activate, focus returns to whatever opened it. This is the
  part `MoreMenu` does least well today and the part that turns it from a
  dropdown into a menu.
- **Portalled to `<body>`**, like `HelpSheet` and `InfoPopover`, so it escapes
  the isolated stacking context of the card.
- **A keyboard opener**: <kbd>Shift</kbd>+<kbd>F10</kbd> and the <kbd>Menu</kbd>
  key on a focused card, anchored to the card rather than to a pointer that was
  never there.

## Where it goes

| Surface | Kind |
|---|---|
| Library tiles and table rows | `book` |
| Catalogue tiles and table rows | `movie` |
| Quote cards on a work's detail page | `annotation` / `dialogue` |
| The Quotes screen | `quote` |
| Search result rows | whichever the section is |
| Home favourite tiles | whichever the tile is |

One commit per surface, so a regression bisects to one file — the same discipline
the 1.5.0 icon sweep used, and for the same reason.

## Tests

- The registry drives the menu: an action added to `actionsFor` appears, with no
  change to any card.
- A long-press on a card opens the menu; a long-press on a button inside that
  card does **not** (it opens the tooltip). This is the interaction the whole
  gesture design exists to protect, and it is one jsdom test.
- A long-press that moves more than `LONG_PRESS_SLOP` opens nothing.
- Right-click with a text selection inside the card does **not** preventDefault.
- Escape closes and focus returns to the card.
- The menu is `role="menu"` with `role="menuitem"` children, and arrow keys move
  between them.

Playwright, CI only, for the two things jsdom genuinely cannot see: that the
native context menu really is suppressed, and that a real 500ms touch-hold on a
real card opens the menu at the finger.

---

# Part 3 — Multiselect

## Selection state

One hook, `useSelection(kind, orderedIds)`, returning
`{ selected, isSelected, toggle, extendTo, selectAll, clear, count }`.

Four decisions inside it, each of which is a bug if taken the other way:

**It clears when the filter changes.** Select thirty books, switch the shelf
filter, and the selection now holds ids that are not on screen — press Delete and
you destroy things you cannot see. The hook takes `orderedIds` and clears
whenever the *set* of them changes in a way that drops a selected id. Not a
convenience: the alternative is a silent, destructive lie.

**One kind at a time.** Search shows books and quotes in one view. A selection
spanning both has no coherent bulk action — you cannot set a series on a quote —
so selecting in a second section clears the first. Stated in the bar: "12 books
selected".

**Shift+click extends over `orderedIds`**, which is exactly the `shown` array
each board already computes. Not over the DOM, and not over the unfiltered list.

**Nothing is persisted.** No localStorage, no URL. A selection is a sentence you
are in the middle of saying; resuming it after a reload is a way to act on a
library that changed while you were away.

## Entering selection

A plain click keeps opening the thing. Selection needs its own door, and there
are three, because there are three input situations:

- **Desktop pointer** — a checkbox in the card's corner, appearing on hover, and
  <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+click anywhere on the card.
- **Any pointer** — "Select" as the first item in the context menu. This is the
  one that makes the two features one feature: the menu is how you start a
  selection, and once one exists the menu's actions apply to all of it.
- **Touch** — a "Select" toggle in the board's toolbar, which is the honest
  answer on a phone. Long-press-to-select is the alternative and it collides with
  long-press-to-open-menu; the menu wins, because it is the more general gesture
  and it contains the selection entry anyway.

Once a selection exists, a plain click **toggles** rather than opens, on every
device. The mode is visible (the bar is up, the cards wear checkboxes), so the
change of meaning is not a surprise — and clicking the last selected item off
exits the mode.

## The bar

`BulkBar` already exists and already says "N selected" with a clear button.
It gains the actions from `bulkActionsFor(kind, ...)`, and it needs three things
it does not have:

- **To be sticky.** Selecting forty items and scrolling to check one should not
  lose the controls. `position: sticky` under the top bar, and on mobile it takes
  the `mobile-sticky-bar` treatment the boards already use.
- **A live count that survives filtering** — see above; if the filter drops
  selected items the selection clears, and the bar goes with it rather than
  reporting a number about nothing.
- **A form slot per action**, since Add tags and Set colour need input and
  Favourite does not. `SearchBulkForm` is already exactly this shape; generalise
  it rather than writing a second one.

## Server work

This is the part with real risk, and it is where the plan spends its testing.

**`POST /quotes/bulk`** — the missing fifth endpoint, and **not** the cheap
mirror it first looks like.

`bulkTag` takes a `kind` and switches a triple of names, so the shape reads as
parameterised. It is not: both kinds it serves are *child* rows reached through a
parent, and its ownership check is `ownedChildIDs(table, parentCol, parentTable,
…)` — `WHERE parent_col IN (SELECT id FROM parent WHERE user_id = ?)`. A
standalone quote has no parent. `utterances.user_id` is on the row itself, which
is a different query and a different helper.

So this needs `ownedIDs(table, uid, ids)` beside the existing one, and `bulkTag`
needs to choose between them rather than switching three strings. That is a small
change and an easy one to get subtly wrong — an ownership filter that silently
matches nothing is a bulk action that reports success and does nothing, and an
ownership filter that silently matches everything is the other user's library.
Both directions get a test.

The rest lines up: `utterances` carries `updated_at`, so `bulkSetChild` works
unchanged, and the 5000-id cap and the "nothing selected" 400 already exist and
apply.

**`color` on all five bulk bodies.** A pointer field like the others, validated
against `annotationColors` — the same allowlist `validColor` uses, so a colour
the API accepts is a colour the CHECK accepts. This is the most likely reason
anyone selects forty quotes, and it does not exist.

**Bulk delete, and it is the dangerous one.** Every bulk endpoint today only
*sets* fields; a mistake is re-editable. Delete is not, there is no undo
anywhere in this app, and the natural gesture — select all, then press the
rightmost button — is one slip from an empty library.

So it ships last, on its own, with:

- a **typed confirmation** carrying the count and the kind ("delete 41 quotes"),
  matching the `RESET` pattern the factory reset already uses;
- **ownership filtering in the same statement as the delete**, never as a
  separate check, the way `bulkSetChild` already does it — a foreign id must
  answer **404, never 403**, and must delete nothing;
- **one transaction**, so a partial delete is impossible;
- and cover/poster cleanup for works, mirroring `handleDeleteUser`'s
  `userCoverFiles` dance, because the cascade frees rows and not files.

**Tests, per the house pattern** — written before the endpoint in the same
commit, each asserting values and not counts:

- a selection containing another user's id deletes nothing at all, and answers
  404;
- a bulk colour outside the allowlist is refused by the API rather than reaching
  the CHECK, which would surface as a 500 instead of a 400;
- a bulk tag over a mixed-ownership list tags only what the caller owns;
- deleting N annotations leaves their book, their tags and the FTS index
  consistent — the external-content index keeps its own entries, which 1.7.1
  learned the hard way;
- the transaction rolls back whole on a mid-list failure.

## Tests, client side

- Selecting, shift-extending, and clearing over an ordered list.
- **Changing a filter clears the selection** — the destructive one.
- Selecting in a second section clears the first.
- With a selection up, a plain click toggles instead of opening.
- The bar's actions are exactly `bulkActionsFor` for that kind.
- An action marked `single` is in the menu and **not** in the bar.

---

## Commits

| # | Commit | Contains |
|---|---|---|
| 1 | `refactor: one list of the things you can do to a quote` | `actions.jsx`, `QuoteActions` + `SearchBulkForm` rewired, no behaviour change |
| 2 | `feat: a menu that opens where you pressed` | `MoreMenu` point anchoring, keyboard menu behaviour, portal |
| 3 | `feat: the gesture a card has always been missing` | long-press + right-click + Shift+F10 wiring, selection-aware bail-out |
| 4–8 | `feat: <surface> answers a right-click` | one per board |
| 9 | `feat: the fifth bulk endpoint` | `POST /quotes/bulk` + tests |
| 10 | `feat: forty quotes, one colour` | `color` on the bulk bodies + tests |
| 11 | `feat: a selection is a sentence` | `useSelection`, entry points, sticky `BulkBar` |
| 12 | `feat: bulk actions read the same list as the menu` | bar wired to `bulkActionsFor` |
| 13 | `feat: deleting more than one thing on purpose` | bulk delete, typed confirm, ownership-in-statement |
| 14 | `docs: what a long press does now` | `help.jsx`, `ui-glossary.html`, `README.md`, `AI.md` |

Nine and ten are independent of everything above them and could land first if the
menu work stalls.

## Verification

No local server run — the firewall blocks binding a port, so this is `go test` +
Vitest + review, and Playwright is CI-only. That divergence is already stated in
`DEVELOPMENT.md`.

1. `go vet ./...`, `go test ./...`, `-race` for the bulk transactions.
2. `npm test`, both projects.
3. `make frontend` in the same commit as any frontend change; CI enforces it.
4. Mutation-test the destructive paths specifically: drop the ownership filter,
   drop the transaction, drop the filter-clears-selection effect, invert the
   single/bulk flag. Each must go red.
5. `node scripts/roadmap-data.mjs --check` and `scripts/glossary-css.mjs --check`.

## Scale and risk

Part 1 is small and makes the other two possible. Part 2 is the fiddliest, and
almost all of its difficulty is on touch hardware this machine cannot test —
which is an argument for keeping the Playwright suite small and pointed at
exactly the two claims jsdom cannot make.

**Part 3's last commit is the most dangerous change in the plan.** Everything
else in this app either adds a row or edits one. Bulk delete removes many, has no
undo, and is reached by a gesture whose whole purpose is doing something to
everything at once. It is last, alone, and behind a typed count for that reason,
and if it is cut from the first release nothing above it is weaker for its
absence.
