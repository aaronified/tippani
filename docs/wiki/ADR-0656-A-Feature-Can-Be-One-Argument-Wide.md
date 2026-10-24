# ADR-0656: A feature can be one argument wide

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.3

**Decided.** The selection bar passes `setFields`, and owns the dialog that goes with it.

**What was there already.** The action has been in the registry since 1.16.0 with its label, its glyph and its single/bulk rule; `bulkOps.jsx` has carried the per-kind field tables and the overwrite warning for as long; `/books/bulk` and `/movies/bulk` take every field a work has, with the title and the supplier ids argued out in comments. The only thing missing was the callback — and the action reads `available: … && !!ctx.setFields`, so the menu item was simply not there. No error, no log, and no failing test: the registry test asserts the action EXISTS, and the bar's tests assert what the bar SHOWS.

**The general shape, which is this release's second instance of it** (see the cast panel above). A registry entry with no provider and a route with no caller are both healthy code by every check this repository runs. What catches them is a test that goes all the way to the REQUEST — which is what the new cases do, because a test that found the menu item would have passed on the day the callback was added and said nothing about whether the dialog sends anything.

**One field at a time, not a form of all of them.** A form of every field with a "leave alone" state per row is a form where "I did not touch this" and "I meant to clear this" look identical across forty rows. One named field and one value is a sentence you can read back before pressing it.

<sub>2.2.3 — `web/frontend/src/SelectionBar.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
