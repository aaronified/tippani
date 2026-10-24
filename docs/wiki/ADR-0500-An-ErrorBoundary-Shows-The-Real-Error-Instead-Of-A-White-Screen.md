# ADR-0500: An ErrorBoundary shows the real error instead of a white screen

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx` · `web/frontend/src/App.jsx`

**Decided.** One boundary around the whole screen and one per tab, showing the actual message plus a reload escape hatch, with the component stack logged to the console.

**Why.** There was no boundary at all, so one thrown component blanked everything — and the concrete case was an engine that lacked a JS feature a page used, which is the ES2018 lookbehind bug from §10 seen from the other side. On a phone, a white screen is an unreportable bug: the person who hit it has nothing to tell me. Showing the real message makes it diagnosable from a screenshot, and `label` scopes it to the tab so "the Quotes screen" is part of the report. I approved showing the raw error rather than a friendly one, because a friendly message on a self-hosted app you run yourself is a message that helps nobody.

<sub>`web/frontend/src/ui.jsx` · `web/frontend/src/App.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
