# Tippani — project instructions

## Overflow: the edge-fade rule

Two affordances, never mixed, and the pair is readable at a glance:

1. **An edge fade means the row scrolls.** Wherever content outruns its width, the
   last ~26px fade to transparent (`edgeMask`). The fade is the whole signal —
   no arrows, no scrollbar, no counter. It says: keep going sideways.
2. **A button at the fade opens the full set in a popup.** When a row also carries
   a control at its edge (`+3 more`, `+2 tags`), that control is not part of the
   scroll — it opens a sheet holding everything, including what is already visible.

So a row may scroll, or open, or both, and the reader can tell which without
trying: fade alone → swipe; button → tap for all of it.

**Corollary.** Never collapse a list to fit. If it does not fit, it scrolls under
the fade; if it is long enough that scrolling is a chore, it also gets the button.
Truncating a person's name, or dropping a credit because the row is narrow, is not
an option — reach for the fade first, since it is already built.

**The button is a control, not a member.** It takes `.tp-btn`'s 9px corner and 44px
floor, so it cannot be mistaken for another pill in the row. Round = a person or a
value; 9px = something that acts.

**A scrolling row must be reachable by pointer.** `overflow-x` alone is a touch-only
affordance, and these are phones drawn on a desk — so every scroller also takes
press-and-drag, with a drag past 3px swallowing the click so dragging a row never
opens what you dragged.

## Spacing is a constant, never a literal

A screen declares `ROW` (the vertical step between rows) and `EDGE` (the horizontal
page margin) once, and every row spaces itself from those two names. A padding
value typed into a row is a bug, not a decision: five hand-tuned numbers agree on
the day they are written and drift on the next change, and the drift is invisible
until someone screenshots it.

**Corollary.** Rows carry horizontal padding only. Vertical distance belongs to the
column's `gap`, so there is exactly one place to change the rhythm and no way for
two adjacent rows to disagree about it.

## Type size is a setting, so nothing may be measured in px

Readers can change the type size, which means every px width around text is a
guess that stops being true the moment they do. So:

- **A box that holds text is sized in `em`, `ch`, or a share of its container.**
  `max-height: calc(3 * 1.5em)` is three lines at any size; `max-height: 72px` is
  three lines at exactly one size and a clipped word at every other.
- **A fold is a line count, never a height.** Same for a fade: express it in `em`
  so it always spans the last line rather than an arbitrary strip of pixels.
- **Spacing, touch targets and the device frame stay in px.** 44px is a fingertip
  and 390px is a phone; neither changes when the type does. `ROW` and `EDGE` are
  spacing, so they stay px too.

**The test:** set the root font size to 24px. Every line count must hold, every
fade must still land on ink, and nothing may clip that did not clip before.

## Placeholders

- A missing **person** is the silhouette (`assets/person-silhouette.svg`).
- A missing **anything else** — cover, still, poster — is the app's `.ph` hatch:
  45° `--ink` at 5% over `--raised`, 12 on / 14 off.
- They are not interchangeable. A hatch where a face belongs reads as a broken
  tile; a silhouette where a cover belongs reads as a person nobody named.

## Working rules for this project

- Values come from the shipped stylesheet (`docs/ui-glossary.html`), `theme.js`,
  `fonts.js` and `ui.jsx` — never from memory or invention. See `repo-design-system.md`.
- Every glyph is lifted from `ui.jsx` verbatim. The repo's icon test fails
  near-duplicates, so a hand-drawn lookalike is a CI failure, not a style choice.
- Type roles are **display · ui · mono · hand**. The `bengali` and `devanagari`
  roles are retired: a role is a job, and each job names one face per script.
- Sample data is always the hard case — two authors, one long name, one Bengali
  name, an empty cover. A sample that fits proves nothing.
