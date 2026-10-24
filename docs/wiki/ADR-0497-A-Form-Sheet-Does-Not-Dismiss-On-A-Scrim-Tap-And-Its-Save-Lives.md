# ADR-0497: A form sheet does not dismiss on a scrim tap, and its Save ✓ lives in the title bar

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** `dismissOnScrim` defaults to true and is turned **off** for forms. `actions` puts a form's Save glyph in the sheet's title bar, and the ✓ is absent until a form registers through `useFormHost`.

**Why.** A filter sheet loses nothing to a stray tap beside the card; a half-written quote loses everything. That asymmetry is the entire rule, and it is expressed as a prop with a default rather than as two components. Save belongs in the title bar because it is pinned and reachable without scrolling past six fields, where a footer button on a long form is somewhere the thumb has to hunt for. The ✓ being *absent* rather than inert is the subtler half: `WorkDetails` saves each field on its own and the staged-quote editor commits through its own buttons, so a header ✓ on either would be a control that looks like it saves and does nothing — worse than no control. The disabled state carries the reason, which keeps it inside the five-word label rule. Approved by me.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
