# ADR-0223: Context-aware search made visible and removable, with a right-click globe

Source of truth: this wiki page.

- **Area:** [§7 Search and the Full-Text Index](ADR-Index.md#area-7)
- **Status:** Accepted
- **Version:** 1.10.0

**Decided.** The context-aware half is already built and already deliberate — `searchScoped` in the shell scopes the top bar's search to whatever you were looking at, and the drawer's search clears the scope. What is missing is that nothing on screen says which one you got. So board filters and work pages become removable chips: on the Library filtered to *reading* the search opens with `shelf:reading` already up; on a work's page, `book:The Dispossessed`. Every seeded chip is removable, so narrowing is free and widening is one click. On desktop the top search is always context-aware and **right-click on the icon toggles global**, with global wearing a small globe in the search circle. That toggle has no on-screen affordance, and its discoverability is a known cost I accepted deliberately: it goes in `help.jsx` and the UI glossary, which is where this app documents its other invisible gestures. There is one cross-plan dependency I want on the record — `Tooltip` calls `onContextMenu => preventDefault()` on every control it wraps, including the search icon, so the suppression needs an opt-out that the context menu plan also needs; whichever ships first should add it.

**Instead of.** A visible global/local switch, which spends permanent chrome on a rare action.

**Reversal.** None; this makes existing behaviour legible rather than changing it.

<sub>1.10.0 — `internal/httpapi/search_facets.go` · `web/frontend/src/facets.js` · `web/frontend/src/SearchPage.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
