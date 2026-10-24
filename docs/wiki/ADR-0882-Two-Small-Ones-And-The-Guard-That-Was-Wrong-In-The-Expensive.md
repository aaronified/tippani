# ADR-0882: Two small ones, and the guard that was wrong in the expensive direction

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE PROVIDER LINKS WERE DELETED BELOW A BREAKPOINT.** A person's row drew them behind
`{!mobile && …}`, so on a phone — on the one screen whose entire subject is which providers a
person is linked to — a reader could see none of them. The pack draws them at every width.

**THE GATE WAS TREATING A SYMPTOM.** Five chips in a wrapping flex take three lines at 390px,
which turns every row of a ninety-row list into a paragraph, so the row was repaired by
removing the content. The repo's own rule is the other repair: a row that can overflow scrolls
under a measured edge fade, never bare `overflow` and never a wrap. `ProviderChips` is a
`Scroller` now, and because the fade is measured a person with one link wears none at all.
The `mobile` prop on `PersonRow` had no other reader and went with the gate.

**A COLOUR CATEGORY IS A SLOT, NOT A ROW**, which is why "delete" needed defining before it
could be built. Eight positions exist whether or not anybody has used them, so there is
nothing to remove. What a reader means by "delete this one" is that it stops being one they
MADE — name, colour and hiding all back to what the app shipped — and that took three separate
acts, one of them selecting the text in a field and deleting it. It is one press now, offered
only on a slot somebody has touched, because on an untouched one it would do nothing and a
control that does nothing teaches a reader that the controls here are inert.

**NO QUOTE CHANGES, AND THE CONFIRM SAYS SO.** The stored token never moves — this section's
own promise, and what makes a Markdown export round-trip — so a quote filed under that colour
goes on being filed under it, wearing the app's default name again. A bin glyph implies the
opposite, so the dialog carries the correction and the dialog's reversibility line says the
act is not one-way.

**THE ONE SUBTLETY IN THE CODE** is that `save` merges its patch over the values collected
from the LIVE rows, so clearing the name in a patch while the input still held it would have
written the name straight back. `unmake` clears the row in state and hands that array to
`save`; the mutation that drops it is red.

### And the guard that demanded a redundant declaration

A dom case asserting the chips do not wrap **passed with the rule changed to `wrap`** — jsdom
loads no stylesheet, so `getComputedStyle(el).flexWrap` reads the initial value whatever
`index.css` says. That is the vacuous pass the repo's testing ruling exists to end, and it was
caught by mutating rather than by reading. The claim moved to the tier that reads the
stylesheet, as a derived sweep: every class handed to a `Scroller axis="x"` is read off the
call sites, so a new sideways scroller is covered by being written.

**ITS FIRST CUT WAS WRONG IN THE EXPENSIVE DIRECTION.** It demanded an explicit
`flex-wrap: nowrap` and named four rules that are perfectly correct — `.meta-rail`,
`.board-head-chips`, `.skipped-work-people`, `.work-hero-credit-row` — because **`flex-wrap`'s
initial value IS `nowrap`**. A guard asking for a redundant declaration on four working rules
would have been "satisfied" by four pointless edits, and the next reader would have learned a
rule CSS does not have. What is actually forbidden is DECLARING the wrap, so that is what the
sweep asserts. A guard can fail by asking for too much as easily as by asking for nothing, and
only the second failure mode is usually looked for.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
