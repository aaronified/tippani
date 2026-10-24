# ADR-0471: The desktop ⋯ menu portalled to <body> — the origin of the standing rule

Source of truth: this wiki page.

- **Area:** [§14 Boards, Cards, Charts and Popups](ADR-Index.md#area-14)
- **Status:** Accepted
- **Version:** `web/frontend/src/ui.jsx`

**Decided.** The nav's overflow menu portals to `<body>` and positions against its button.

**Why.** It rendered inside the horizontally-scrolling top-bar nav, whose overflow clipped the dropdown so it appeared *behind* the page. The fix was local and correct, and it is the first time the two ingredients of the eventual rule appear together: escape the ancestor, and place against the trigger rather than against whatever happens to contain it. It stayed a one-off for a long time, which is the part worth recording — the general rule was available here and I read it as a bug about one menu. I approved the local fix; the generalisation took several releases.

<sub>`web/frontend/src/ui.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
