# ADR-0737: The door behind a field's mark, and the question re-verify cannot answer

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

*The owner's ask: "the metadata is supposed to be provider specific with mix and match.
The detail screen in the prototype had all that. The app does not have that feature. The
provider icons were supposed to work here as well."* handoff §1.2's last clause, and the
second of the three gaps the prototype sweep named.

- **The sweep called this "mostly a door" and that was wrong.** Its reasoning: the
  candidates are already computed per field (`fieldAlt{source, value}`) and
  `ReverifyReview.jsx` already draws them side by side, so all that was missing was a way
  in. What that missed is WHICH fields carry candidates. `attachBookAlts` and
  `attachMovieAlts` hang alternatives on the DIFFS, and `diffStr` emits no diff when the
  preferred supplier agrees with what is stored. A field's mark reads "TMDB" *because* TMDB
  wrote the value — so stored equals TMDB's answer by construction, and the diff for it is
  empty. The door would have opened on an empty room for every field it was worth pressing,
  and only worked on the fields whose marks say somebody else.
- **So there are two questions, not one.** Re-verify asks *what has changed*; a field
  picker asks *what is on offer*. `offers` is a flag on the same route rather than a route
  of its own, and the reason is drift: a second endpoint would have to repeat the row read,
  the identity ladder and the per-supplier fetch — about 150 lines per kind, all of it the
  code whose own comments keep warning about exactly this — to add one loop at the end. The
  flag is off for the reviewer and for the unattended filler, so neither pays for a list it
  never reads.
- **The offers pass walks the same picker tables the diff does** (`bookAltPickers`,
  `movieAltPickers`), which is those tables' whole purpose: a field that can be reviewed and
  a field that can be offered must not be able to drift apart. One supplier is enough here,
  unlike in `alts` — the choice being drawn is between the record and a supplier, so a
  single supplier is still something to take.
- **A door onto an empty room is worse than a label**, so three kinds of field do not get
  one: a supplier id (TheTVDB's opinion of a TMDB id is not an alternative anybody can
  weigh), a picture (§1.4 — not a field), and a cast (a panel, not a value). The client's
  `OFFERED_FIELDS` decides which marks become buttons, and `offers-fields.test.js` reads the
  Go picker tables out of the source and fails if the two lists disagree — the same
  cross-language pin the locale tests use, for the same reason.
- **A panel and not a popover.** Two descriptions read side by side is prose: it wants the
  width of a sheet, a scroll of its own, and identical behaviour on a phone. The stack gives
  all three plus the back gesture every other door on this screen already uses; a popover
  would have been a second navigation to learn, anchored to an 18px mark.
- **The kept row wears the mark and not the supplier's name.** It is the tag the reader
  pressed, so dropping it would open the panel having lost the one fact that got them
  there — but what the row is FOR is the value on the record, so the word beside the mark
  says so. It is also the one row that is not a button: "keep it" is what closing the panel
  already means, and a button for it would be a second way to do nothing.
- **The marks reached the reviewer too**, which is the other half of the owner's ask. Four
  columns of values under supplier names in small caps is the densest place in the app for
  "which of these did Google write", and `docs/wiki/Provider-marks.md` argues that a mark is
  recognised without being read. It was already true of every field row and was not true of
  the one grid built for comparing suppliers.
- **Two applier whitelists were lifted to package scope** so a test could hold them up
  against the picker tables. Every field a row offers has to be one the apply route will
  write, or the panel draws a button that fails — and the two lists live in different files.

<sub>Unreleased — `internal/httpapi/field_offers.go` · `reverify_handlers.go` ·
`web/frontend/src/fieldOffers.jsx` · `ui.jsx` · `WorkDetails.jsx` · `ReverifyReview.jsx` ·
`index.css` · `internal/i18n/{en,bn}.txt` · `test/rules/offers-fields.test.js` ·
`test/dom/field-offers.test.jsx` · `internal/httpapi/field_offers_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
