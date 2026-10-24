# ADR-0468: A panel body owns its record, because a panel's props are frozen when it is pushed

Source of truth: this wiki page.

- **Area:** [§13 Controls, Labels, Icons and Help](ADR-Index.md#area-13)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `useWorkRecord` reads the work back on mount, holds it, writes full state from what it read, and reports every result both to its own copy and to the page above. `WorkDetails`, `WorkPeople` and `FieldSheet` each use it. The prop they are handed is a SEED, named `initial`, not the truth. A read-back is adopted only when `r.data.id` matches the record asked for.

**Why — and this was live, unreported, and mine.** A panel descriptor is captured when it is PUSHED: `render: () => <WorkDetails item={…}/>` closes over the record as it stood at that moment, and the stack entry is immutable, so a page re-rendering with a newer record never reaches it. `PanelHost` also renders only its TOP entry, so opening a sheet UNMOUNTS the body underneath and walking back mounts a fresh one from that same frozen prop. Two facts that were each harmless became one defect when Details moved onto the panel stack: save the title and the row snapped back to the old one; save a second field and its full-state body restated the first field as it was before; edit a description in its own sheet and the row that opened it still showed the old text.

Nothing errored and every toast said "saved", which is the shape of failure this repo keeps finding — and the reason the fix comes with a test that saves twice and reads the SECOND request's body.

**Read back rather than plumbed through.** The alternative is a live reference the page updates and the descriptor closes over, which makes every screen that opens a panel responsible for a ref it cannot see the use of, and still does not survive the unmount. One GET per panel open is what identity.jsx's panels already pay, and it also fixes a second thing for free: a Details opened from a stale list row shows the record as it now is.

**Only if it is the same record.** An unexpected reply — an error body, a stub, a redirect — must not blank a form the reader is looking at. That is a worse failure than the staleness the read exists to end.

<sub>3.1.0 — `web/frontend/src/WorkDetails.jsx` · `web/frontend/test/dom/work-details-order.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
