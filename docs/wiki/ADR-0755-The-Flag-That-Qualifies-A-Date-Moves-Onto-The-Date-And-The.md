# ADR-0755: The flag that qualifies a date moves onto the date, and the marker stops being deleted

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

**Decided.** The owner: *"Approx date moves beside the date field"*, and on how: *"Parse it
and tick the button."*

**The comment being overruled had the argument backwards.** It read: "it sits here rather
than beside the date because it is the only one of the five that qualifies another field".
Being the only control that qualifies another field is the reason to put it NEXT to the
field it qualifies, not away from it — a flag on its own says "approximate" about nothing in
particular, and the reader has to work out which of five boxes it means.

**AND THERE WAS A SWALLOWED GESTURE UNDER IT, which is the half nobody had noticed.**
`PartialDateField`'s input accepts digits and a separator and silently drops everything
else, so a reader typing the ordinary thing — `c. 1890` — watched the `c.` vanish, saw
1890 land, and had no way to learn that a checkbox further down the form was what they had
meant. Nothing was broken; nothing said anything. The marker is now read BEFORE the strip
that was eating it, and ticks the flag.

**A period or a space is required, and a bare `c` is not enough.** This is a numeric box,
so a stray letter is a slip rather than an instruction, and ticking a flag off a slip is
worse than ignoring it — the reader never asked and the box is where their eye is not.
`c.`, `ca `, `ca. `, `circa `, `c.1890` and `~` all tick it; `c` alone does not.

**PARSING SETS THE FLAG AND NEVER CLEARS IT.** Only the reader unticks. A parse that also
unset it would untick the box on the very next keystroke after ticking it.

**It is a prop on the shared field, not a copy in each form.** Both quote surfaces — the
full form and the capture card — pass it, so they cannot drift; the capture card had its own
checkbox with its own defence of its own placement, which is exactly the "a line each" the
repo's directive is about. The three callers with nothing to be approximate about (a
person's birth and death, a work's date) pass none of it and draw what they drew before.

**A `span` inside the field, not a nested `label`.** The field is already a `label` whose
control is the date input, so a nested one would give the checkbox two things claiming to
caption it; the box carries its own `aria-label` instead. The words are still inside the
outer label, so clicking them still works.

<sub>Unreleased — `web/frontend/src/ui.jsx` · `web/frontend/src/Quotes.jsx` · `web/frontend/src/AddSurface.jsx` · `web/frontend/test/dom/circa-beside-date.test.jsx`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
