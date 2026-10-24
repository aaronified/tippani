# ADR-0445: keepLabel: primary submits and destructive confirms never collapse, and has-btn-icon marks only buttons whose words may disappear

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.6.0

**Decided.** `keepLabel` opts a button out of the collapse and renders `.btn-label-fixed`, which has no clip rule at all. Crucially, `has-btn-icon` is set only when a button has an icon **and** is not `keepLabel`.

**Why.** A glyph is a thing you learn, and neither "save this" nor "delete this permanently" is something a person should have to have learned already. A `keepLabel` button may still take an icon — the glyph helps you find it, the words say what it does. The `has-btn-icon` condition is the subtle half: that class is what squares the button to 44px under `data-labels="off"`, so a `keepLabel` button carrying it would be crushed to icon width with its words still inside.

**Approved.** My call, and I approved the note about which condition sets `has-btn-icon` being written into the component, because "has an icon" and "may lose its words" read as the same predicate and are not.

<sub>1.6.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
