# ADR-0764: The info dot goes inside the box, not on the label

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**The owner's ask.** "there SHould be an info dot on the year fields (keep it in the field,
and not on the header) (all of them) to explain the formats and how to do circa (the button)
and BCE (-)."

**A DEPARTURE FROM THE CONVENTION, ruled on by the owner.** Every other info dot in the app
rides in a field's header row beside its `MonoLabel` — that is what `Field` and `BigField`
do, and it is why `hint` exists on them. The reason the parenthesis overrules it here holds:
a reader who needs this is looking at the box and about to type into it, and a dot up on the
header reads as an explanation of the field's NAME rather than of what may go in it.

**ONE FUNCTION FOR TWO COMPONENTS**, per the repo's own directive that a control drawn on two
screens has one behaviour living in one place. `dateFieldInfo(kind)` returns the title and
body for the three cases a box can be — a bare year, a date in the reader's own life, a date
in history — and both `YearField` and `PartialDateField` call it. The third case is the only
one that mentions an era, because a read log would refuse one and a dot that offers what the
field rejects is worse than no dot.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `Quotes.jsx` · `AddSurface.jsx` · `people.jsx` ·
`identity.jsx` · `identityGlobal.jsx` · `review.jsx` · `Home.jsx` · `SearchPage.jsx` ·
`internal/httpapi/shelf.go` · `utterance_handlers.go` · `import_quotes.go` ·
`search_handler.go` · `review_handlers.go` · `historical_date_test.go` (new) ·
`test/pure/historical-date.test.js` (new) · `test/dom/historical-date-field.test.jsx` (new) ·
`internal/i18n/en.txt` · `bn.txt`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
