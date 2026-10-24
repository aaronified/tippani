# ADR-0495: ColorSwatches is a roving-tabindex radio group where selection does not follow focus

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** One tab stop for the whole group; arrows move focus without committing; Enter or Space picks. Each dot is a transparent hit box around the 20px circle so touch targets can reach 44px without changing how the dot looks. A hidden slot is dropped from the choices but never from a quote already wearing it.

**Why.** Selection-follows-focus is the usual ARIA radio-group behaviour and it is wrong here: the card quick-pick writes on change, so arrowing across six categories would fire a PUT per keystroke. The same split is what `Select` uses, so the two controls do not teach different keyboard habits. The picker draws the reader's *names* rather than the colour words, because "Pick blue" describes a highlighter and the whole point of naming a category is that the picker then asks the question you actually have. And hiding a slot is about tidying a picker you have stopped using — a quote silently changing colour because of that would be the app editing your library to match a preference. My call on all three.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
