# ADR-0843: A saved look is six fields, and the mode is not one of them

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**Decided.** `savedThemes.js` holds up to four looks per profile. A look carries the
material set, the accent, both grounds, the per-slot tiles and the material dials. Export
writes one look to a file; import reads one back.

**Why six and not one.** They are a single decision. A ground chosen against one accent is
a different decision against another, and a material set chosen for a light ground reads
differently on a dark one. Saving them separately would mean switching between two looks
is six presses, which is the thing having saved looks is for.

**THE MODE IS DELIBERATELY NOT CARRIED.** Which of light and dark you are in is about the
room you are sitting in, not about the look — a saved theme that dragged a reader into
dark at noon is a theme nobody saves twice. `applyFields` takes the mode from what is
applied now and everything else from the saved entry.

**FOUR IS THE CAP AND IT IS THE DESIGN.** A fifth turns a set of looks you switch between
into a list you maintain: naming them, tidying them, wondering which of two near-identical
ones is the good one. A re-save under an existing name REPLACES rather than adding a
second row with the same word on it, which a reader can neither tell apart nor choose
between.

**THE SEAM THE TESTS EXIST FOR.** `texTweak` is an object inside a saved look and a STRING
through the preferences endpoint. A look applied with the object form would silently wear
the factory dials — everything else about it correct, so nothing looks broken. `applyFields`
crosses that seam and a case holds it.

**EXPORT IS ONE LOOK, NOT THE LIST.** A file called "my theme" that turns out to hold four
is a file nobody can share a look with. What travels is what you are wearing.

**A FORWARD VERSION IS REFUSED RATHER THAN GUESSED AT.** Reading a file written by a later
release as though it were this one produces a look nobody chose, which is worse than
saying no. Each refusal has its own reason, because this is somebody pasting a file into a
box and "that did not work" is not something they can act on.

*Unreleased — `web/frontend/src/savedThemes.js`, `web/frontend/src/Settings.jsx`,
`web/frontend/test/pure/saved-themes.test.js`,
`web/frontend/test/journeys/saving-a-look.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
