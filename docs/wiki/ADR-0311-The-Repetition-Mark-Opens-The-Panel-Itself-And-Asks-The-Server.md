# ADR-0311: The repetition mark opens the panel itself, and asks the server rather than trusting the card

Source of truth: this wiki page.

- **Area:** [§8 The Review Loop](ADR-Index.md#area-8)
- **Status:** Accepted
- **Version:** 3.1.0

**Decided.** `ReviewDot` is a `<button>` that renders its own `InfoPopover` — anchored beside the mark on a desktop, a centred sheet on a phone. It takes no handler from any screen; the kind comes from the row through `reviewKindOf`, which reads the parent id a highlight and a film line always carry and treats their absence as the third kind. The panel fetches `GET /review/card` on open, and `due` there is `dueSQL` AND a schedule row.

**Why.** The owner asked for it *"like the infodots"*, which is a chrome and not a category — so it wears the infodot's popover and none of its copy answers to `help-budget`'s caps. The verb lives in the mark because the mark is drawn by three files — Library's `ActionRow`, Movies' `Frame` and Home's favourite tile — and reaches five screens through them, the Quotes board and Search taking `AnnotationCard` from Library. The repo's directive is that a control drawn by one component has one behaviour in one function. Threading a handler in from each is the shape `personOpen.jsx` records two dead controls to: *"A capability that has to be re-threaded at each call site is a capability that is absent at most of them."* It asks the server because the card carries the schedule as it stood when its list was fetched and the Daily Quiz moves it without the list hearing — a panel whose subject is "when did I last remember this" may not be the one surface showing yesterday's answer. And `due` needs the schedule row because the deck's own rule reads true whenever `last_reviewed_at` is NULL, which on a LEFT JOIN that matched nothing is every card the quiz has never asked about; those arrive through `bucketUnseen` and its grace week, so the bare rule would announce a card is owed while the quiz deliberately leaves it alone.

**Instead of.** A panel on the screen's own `usePanelStack` — rejected on two grounds. Only some of those screens host one, so it would be threaded after all; and `usePanelStack` writes `tpPanelDepth` into `window.history.state`, so a shell-level host to serve all four would have two live stacks fighting over one key.

**Approved.** Mine. The mark also takes the ♥'s phone-width box in the same CSS rule rather than keeping one of its own, because the two stand a gap apart in the same row and a copy is how one drifts under the touch floor while the other stays over it.

<sub>3.1.0 — `web/frontend/src/ui.jsx` · `web/frontend/src/index.css` · `internal/httpapi/review_card.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
