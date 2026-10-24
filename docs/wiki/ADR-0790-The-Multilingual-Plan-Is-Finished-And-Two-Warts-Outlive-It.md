# ADR-0790: The multilingual plan is finished, and two warts outlive it

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/multilingual.md` is deleted. The owner's word: *"multilingual.md in docs/plans/
is stale and already completed."* The mechanism shipped in 2.1.0, the Bengali in 2.1.1, and
the pseudo-locale gap that was the file's last real open item is closed — `screens-i18n.test.jsx`
mounts every screen `App` can route to under `qps` and fails on a readable plain-ASCII
string, so what holds the coverage is a test rather than a paragraph.

**The style sheet did not go with it.** `docs/wiki/Bengali-style.md` — moved out of `docs/plans/`
in the same pass, on the owner's instruction that "it is implemented and the guideline needs
to be kept recorded". That is the case the plan directory's delete-on-ship rule does not
cover: a shipped plan whose text goes on *binding new work* is a guideline, and a guideline
is kept rather than deleted. Nine live citations point at it, `fonts.js` among them.

**Two things in its punch-list are real and are recorded here rather than lost with the
file**, because both are code that exists and neither is a promise:

- **The Go side's user-facing strings are not in the catalogue.** Deliberately out of scope
  for the 2.1.0 pass; `internal/i18n` serves the SPA, and a Go error string reaches the
  reader in English whatever locale they chose. Not scheduled — noting it so the next
  person to find one knows it is known.
- **`works.jsx` still carries English `-s` plural fallbacks** (`nounPlural = ${noun}s`) —
  English grammar living in code, in a file that serves a language with no `-s`. Unreachable
  today because every call site passes `nounPlural` explicitly, which is why it has not been
  ripped out: removing the default changes three component signatures for a branch nothing
  takes. It is a wart with a guard, not a defect.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
