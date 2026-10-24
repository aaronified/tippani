# ADR-0823: A face for dyslexia, and why it is offered on two roles rather than one

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`access.md`'s §6, third item, and the only row of that plan's inventory that was exactly
right: a reader could always UPLOAD a dyslexia face (0039 shipped user font uploads), so
the gap was never a capability. It was that nothing offered one — somebody it would help
had to already know the face existed and where to get it.

**THE LICENCE WAS THE FIRST QUESTION AND IT IS SETTLED.** `@fontsource/opendyslexic@5.3.0`
ships its own `LICENSE`: "Copyright (c) 2019-07-29, Abbie Gonzalez … with Reserved Font
Name OpenDyslexic … licensed under the SIL Open Font License, Version 1.1." That is the
licence `fonts.js` already claims for all eighteen bundled faces, so redistribution in the
binary needed no new argument. The Reserved Font Name clause binds one thing: a MODIFIED
build may not keep the name. We bundle it unmodified.

**IT IS OFFERED ON BOTH `display` AND `ui`, and it is the only face in two lists.** The
plan says the face must reach the QUOTE text and not only the interface, and the display
role is what a quote reads — so display was mandatory. Adding `ui` as well is a judgement
and here is the argument: a reader who needs these letterforms to read a quote needs them
to read the navigation, and offering it on one role only is half a feature. The preference
stays per role, so choosing it for one leaves the other alone, and `fonts.test.jsx` names
the sharing explicitly — a face appearing on a third role fails, so this cannot quietly
become a pattern.

**THE EVIDENCE FOR OPENDYSLEXIC IS CONTESTED AND THAT IS NOT THE ARGUMENT.** Several
studies find no reading-speed benefit over a plain sans. The argument for shipping it is
not efficacy: it is that a reader who wants it should not have to go and find a font file.
Atkinson Hyperlegible was considered as a second face — same registry, same OFL-1.1, drawn
by the Braille Institute for LOW VISION, which is what the rest of §6 is about — and was
NOT added, because the plan asked for a dyslexia face and widening the ask is not this
change's to do. It is the obvious next one if the owner wants it.

**WHERE A GUARD HAD TO CHANGE, and why that is not the tail wagging the dog.**
`fonts.test.jsx` asserted every role offers EXACTLY three faces. That number described what
happened to be there rather than anything that has to be true: the assertion worth making
is that no role arrives empty and every role has somewhere to go. It reads
`toBeGreaterThanOrEqual(3)` now, plus two assertions the old count never made — no
duplicate id inside a role (an id is the stored preference, so a duplicate makes a saved
choice ambiguous), and exactly one face shared across roles, named.

`OpenDyslexic` ships 400 and 700 with italics and no 500 or 600; a heading asking for 600
gets 700, which is the browser's own rule and the right answer.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
