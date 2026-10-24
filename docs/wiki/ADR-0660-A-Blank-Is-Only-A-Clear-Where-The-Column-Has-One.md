# ADR-0660: A blank is only a clear where the column has one

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** 2.2.4

**Decided.** A bulk field can declare that its column has no empty; the dialog then offers no blank, promises no clear, and refuses to apply.

**The failure.** `media_type` is NOT NULL and `normalizeMediaType` maps `""` onto `'movie'`. The dialog offered "(none)" under the words "Empty clears the field", so selecting five shows and pressing Apply converted all five into films — the loudest possible edit made by the quietest possible control, under a sentence that was false.

**The overwrite warning is not an answer to it.** It fired and said how many rows would change. A reader who has just been told the field will be *cleared* reads that as the cost of clearing. A warning cannot correct a lie beside it.

**The general rule.** "Empty clears" is a property of the COLUMN, not of the dialog, and a dialog that says it about every field is asserting something it cannot know. Every other field is unchanged, because a bulk editor that can set a series and never unset one sends you back to forty forms for the mistake it just helped you make.

<sub>2.2.4 — `web/frontend/src/bulkOps.jsx` · `web/frontend/src/SelectionBar.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
