# The screen audit: what it found and what is left

An adversarial pass over every screen in the app — each finding handed to a second
reader whose only job was to refute it — plus the defects the owner reported from
the running app while it went on. **29 findings survived refutation. 11 are fixed
and shipped; 18 are listed below and are not built.**

This file exists because that list is the only part of the audit that cannot be
recovered from the tree: a fixed defect leaves a commit, a test and a changelog
entry behind it, and an unfixed one leaves nothing at all. It follows this
directory's rule — **delete it when the list is empty**, and fold anything worth
keeping into [`../PLAN.md`](../PLAN.md).

It is not a feature plan, which is what the rest of this directory holds. It is
here because the directory's promise — *this is not built yet* — is exactly true of
it, and because the alternative was a list that lives only in a chat log.

## What already exists

Verified at `682874b` on 2026-09-03. Every line number below was re-read on that
commit unless the row says otherwise.

| | |
| :-- | :-- |
| The rule the fixed half enforced | A failed request is not an empty screen |
| Where it is already enforced | `BinPage.jsx`, `StatsPage.jsx`, `boards.jsx`, `Home.jsx`, `MetadataPage.jsx` |
| Its tests | `test/dom/bin.test.jsx`, `test/dom/load-failure.test.jsx` |
| The keyboard rule's one owner | `onActivate` in `ui.jsx`, used by `Home.jsx` and `flow.jsx` |

### Shipped, so that the list below is only what is left

`6f8d2dc` — Quotes board Reset threw; `game` never swept through Home; Bin and
Stats folded failure into their rest state; `.name-scroll` clipped every scrolling
name vertically; the superlatives grid wasted rows; Breakdown and Top tags had no
practice button; the Stats character breakdown drew no faces; the search box never
said what it could parse.

`682874b` — the Quotes shelf list, Home's favourites wall, Shuffle and the speaker
remap each reported a failure as an absence; Home's two count tiles announced
themselves as buttons and ignored the keyboard.

## What is left

Ordered by how badly it misleads a reader, not by how hard it is.

### 1. A name is truncated on the review screen

`review.jsx:348` sets `textOverflow: 'ellipsis'` on a speaker's name inside the
credit chip. The standing rule is that a name is never truncated — a shortened name
and a short name look alike, so an ellipsis destroys the thing the chip exists to
show.

**Why the ratchet missed it.** `scripts/screenshots/typescale-baseline.json` reads
zero on every screen it lists, and it lists thirteen. The review/practice screen is
not one of them. This is the clearest instance of a theme the audit found five
times over: **a guard keyed to a hand-maintained list leaks at exactly the rate the
list goes stale.** Fixing the chip is ten minutes; deciding whether the baseline
should enumerate screens at all is the real item.

### 2. Untranslated strings behind state gates

Nine strings reach the screen in English under a non-English locale. All nine sit
behind a state the `screens-i18n` pseudo-locale sweep never reaches, because that
sweep mounts each screen and reads it at rest: an error state, an empty state, a
second dialog page. The sweep is not wrong, it is shallow — **it tests the default
mount and calls that the screen.**

Not re-verified at `682874b`; the count is from the audit and the two fixed batches
may have moved it.

### 3. Font sizes frozen in px

Boxes and labels that must hold scaling text are sized in px rather than
`max(<px floor>, <em>)`. `typescale.test.js` does not see them for the same reason
as (2): it reads what a screen renders at rest.

Not re-verified at `682874b`.

### 4. A heading with no control under it

`Quotes.jsx:424` draws the **Board** label and its `<label>` wrapper
unconditionally, and gates only the `<Select>` inside it on `boards.length > 0`. A
reader with no boards — or any reader, for the whole time `/boards` is in flight —
gets a field heading with nothing beneath it. Either the label moves inside the
gate or the empty case gets a control that explains itself.

### 5. A spacing step typed into a row

`TagsPage.jsx:110` — `margin: '1.5rem 0 0.25rem'` on an `<hr>`. Spacing is a
constant (`var(--edge)`, `var(--row)`); a step typed into a row is a bug, and
`spacing-debt.test.js` counts how many remain. Check whether this one is already
counted there before adding it.

### 6. Scrollers with no fade

Bare `overflow` in places that should use `Scroller` or `useEdgeScroll`. An edge
fade is what says *this scrolls*, and a scroller without one gives no signal and no
mouse gesture. Sites not re-verified at `682874b`.

### 7. The rest, from the audit and not re-read since

Each of these survived refutation when it was found. None has been confirmed
against `682874b`, so **re-read before fixing** — two batches have landed since.

- The Quotes board phone layout labels a control **Kind** where the desk layout
  does not, or vice versa. Confirm which.
- An anthology dialog renders its empty state through `ErrorText`, so *nothing here
  yet* arrives in red. `anthologies.jsx` handles the loading/empty split correctly
  at `:92` — the defect is in a dialog, not the list.
- An expanded row in the Bin does not clear when the row above it collapses.
- The Library export writes an English fragment into a file whose surrounding text
  is translated.

## The five themes

The individual defects matter less than these, and none of the five is fixed by
fixing its instances.

1. **Failure folded into the rest state** — found on nine screens. Six are fixed.
   The remaining question is whether `api.js` should make the three-state split
   (reading · failed · empty) hard to avoid, rather than leaving each caller to
   remember it. Every instance was a caller that forgot.
2. **No loading state distinct from empty.** Same shape, different half: a screen
   that says *nothing here* before it has asked is as wrong as one that says it
   after a failure.
3. **The i18n and typescale guards only test the default mount state.** They are
   the two ratchets this project trusts most and they both stop at the front door.
4. **Ratchet guards keyed to hand-maintained lists leak.** The typescale baseline
   names thirteen screens; the app has more. A list that must be edited to stay
   correct is a list that is wrong between edits.
5. **A whole media kind can go unswept.** `game` has been first-class since 0040
   and Home had never been walked for it. Nothing in the suite asks *does every
   screen handle every kind*, so the answer was found by reading rather than by
   failing.

## How to resume

    git checkout v3
    go test ./... -timeout 25m          # httpapi alone is ~680s
    cd web/frontend && npx vitest run

Then take item 1. It is the smallest, it is verified, and it forces the decision in
theme 4 before the easier items make that decision by default.
