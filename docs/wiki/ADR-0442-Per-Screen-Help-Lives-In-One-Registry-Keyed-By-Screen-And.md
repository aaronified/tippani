# ADR-0442: Per-screen help lives in one registry keyed by screen, and describes the shell that is actually on screen

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 1.4.0, relocated 1.4.1

**Decided.** A `?` in the top bar opens the current screen's own glossary — every control named, with what it does. The copy lives in one registry, `web/frontend/src/help.jsx`, keyed by screen, rather than beside each component. Each screen's list appends the shell's controls, and there are **two** shell lists: `SHELL_COMMON` plus `SHELL_TOUCH` (the ☰ drawer, the floating bottom bar, the long press) or `SHELL_POINTER` (the tab strip, hover labels), picked by the same breakpoint the components render against.

**Why.** One file rather than scattered copy means a control explained in one place cannot contradict itself in another, and adding a control while forgetting its help is a visible gap. The two shell lists exist because the two shells are not the same shell — describing the drawer to someone who cannot see one is worse than saying nothing, because they go looking for it.

**Instead of.** Help beside each component — rejected; it is how the same control acquires two explanations.

**Reversal.** 1.4.0 put a `?` in eleven page headers, and 1.4.1 moved it into the top bar and made it resolve from the route. What I got wrong was making a property of eleven pages out of one thing that belongs in one place — and on a phone it was competing for the single row a page title also needs. Two exceptions remain, both because the shell bar is not on screen there: the work-detail screens keep it in their `⋯` menu, and the full-screen Profile page carries its own.

**Approved.** Mine both times; I approved the move once the phone made the row contention obvious.

<sub>1.4.0, relocated 1.4.1 — `web/frontend/src/help.jsx` · `CHANGELOG.md`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
