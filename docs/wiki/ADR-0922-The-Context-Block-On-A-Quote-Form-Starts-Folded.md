# ADR-0922: The context block on a quote's edit form starts folded

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted
- **Refines:** [ADR-0917](ADR-0917-A-Library-Scan-Is-One-Press-And-A-Job.md)

**Decided.** On the edit forms for a highlight, a film line and a standalone quote, the stored context (the lines around the
quote) is folded until the reader presses **In context**, which is a door with a chevron beside it. It is loaded while folded,
so opening it waits for nothing. A failed load and the "Not found in" line stay showing, because hiding them hides that
anything went wrong ([#59](https://github.com/aaronified/tippani/issues/59)).

**Why.** The form is for the quote's own fields. Open by default, the context pushed those fields down a phone, and it is
reference, not something most edits need. The In context dialog on a card is unchanged: there the context is what was asked for.

**Rejected.** Remembering the last state per reader: a block that opens itself on some forms and not others is harder to find
than one that is always folded.
