# ADR-0838: The sections take an order, and the language table takes an address

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `sectionOrder` is a preference — a comma-separated list of tab keys — read
by `sectionOrder(prefs)` and applied inside `visibleTabs`, which now orders as well as
filters. Settings → Sections draws the list with a pair of arrows per row. Separately,
the language-marks table is a section of the Metadata console rather than a `FormModal`
behind a button inside Sources.

**Why the order lives in `visibleTabs`.** That function already exists because four
hand-maintained nav lists naming the same tabs "only stays correct if something checks
it", and 1.5.0 proved it. A second function answering "in what order" would be the same
bug with a second preference in front of it. So one function answers both, and only the
content sections move: Home, Search and the utility rows are not in `SECTIONS` and pass
through untouched, which is what stops Settings being reorderable to the top of the rail.

**Instead of** a drag. A drag needs a pointer that can hover to discover it is draggable,
a keyboard equivalent invented from nothing, and a touch target that does not fight the
page's own scroll — and the repo has no drag-to-sort anywhere else to be consistent with.
Two buttons are the same answer from every input the app supports.

**A STRING, NOT A LIST, on the wire.** Every other field the preferences endpoint takes
is a scalar; a slice would be the only one needing its own JSON shape and its own
zero-value rule. The keys are four short words from a closed set. The server does not
validate the value against the tabs it knows, deliberately: the client keeps only the
keys it recognises and appends what it did not find, so a stale order written before a
fifth section existed still places the four it knows. Rejecting it server-side would turn
a harmless stale value into a failed save.

**AND THE LANGUAGE TABLE WAS A ROOM WITH NO DOOR.** The v3 pack draws no Languages
section on Metadata, and its own Settings prototype depends on one — the quote faces are
"read from the metadata language table, which is the only place a quote's language is
defined; Settings links there rather than keeping a second list". The table existed, as a
pop-up inside another section, which is not something another screen can point at. The
pack removed the door and never built the room; this builds it. The panel itself is
unchanged — only where it hangs — which is why its own suite needed nothing but a
different mount.

**Approved** on the plan, which listed both the section sort and the missing Languages
tab as asks.

*Unreleased — `web/frontend/src/routes.js`, `web/frontend/src/App.jsx`,
`web/frontend/src/Settings.jsx`, `web/frontend/src/MetadataPage.jsx`,
`web/frontend/src/MetadataSources.jsx`, `internal/httpapi/auth_handlers.go`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
