# ADR-0537: The selection bar is three glyphs and an overflow, and which three is a decision in the registry

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** 1.12.0

**Decided.** Every bulk action now carries `where: ROW | OVERFLOW` and an `icon`, the same two fields the item list has carried since the card grew a ⋯. Three stand in the row — for quotes the colour, the ♥ and the quiz toggle; for works fill-the-gaps, the shelf and the quiz toggle — and everything else folds behind a ⋯, Delete included. A test asserts the row holds exactly three.

**Why.** The bar shipped with four word-buttons and left 1.11.1 with eleven controls: colour dots, a tag field, a tag button, Seal, Favourite, a shelf dropdown, Fill gaps, Skip in quiz, Delete, Deselect all, ✕. Every one was added for a good reason, and none of them is the one that broke it — because nothing broke. It became, on a phone where the bar is pinned under the header at a fixed height, a strip wider than the phone, one release at a time. There was no error, no failing test and no screenshot; the only signal was a reader saying it looked crowded.

WHICH THREE lives in `actions.jsx` rather than in the component that draws them, for the same reason the action list itself does: the bar would otherwise be a second place with an opinion about what matters, and the two would drift the first time somebody added an action to one of them. The exactly-three assertion is what makes the strip's width a rule rather than a habit — a fourth fits on a desktop and pushes the count off the screen on a phone, silently.

The three that fold away were not picked for being unimportant. Each needs something MORE from you before it can run: tags need a keyboard, the seal needs a picture chosen, Delete needs a phrase typed. The tag field standing open in the row was the widest control in the strip and was open on every selection whether or not anybody meant to type into it — on a phone, one stray tap from a keyboard.

**The quiz toggle's picture flips with its label**, and that stopped being optional the moment the words came off. "Skip in quiz" / "Add to quiz" was doing two jobs — naming the action and reporting which way round the selection is — and a single fixed glyph keeps the first and silently drops the second. The button still works, which is why it would have survived review. It is the only reason the icon set holds two drawings that are nearly the same picture on purpose.

**Edit joins the bar at exactly one, and Set fields at two upwards.** They are mirror images and are never offered together: over one work the work's own form is strictly better, over several there is no single form to open. Edit stays `single: true` on the item side — this is not editing a selection, it is editing the one thing in it. It is dropped rather than greyed at two, because a disabled item in a menu is a thing to wonder about.

**The card's own ⋯ is untouched.** Removing it was on the table and was rejected by the reader: multiselect is an added way in, not a replacement, and a card that lost its overflow would have left Edit unreachable on a phone — the long press there selects, and there is no right-click to fall back on.

**Instead of.** Smaller buttons or a scrolling strip (postpones the same problem and makes the count scroll away). A second bar for phones (two components, one of them only ever seen by the author on a resize).

**Approved.** Mine on the shape, the reader's on which three and on keeping the card's ⋯.

<sub>1.12.0 — `web/frontend/src/actions.jsx` · `web/frontend/src/SelectionBar.jsx` · `web/frontend/src/ui.jsx` · `web/frontend/test/dom/selection-bar.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
