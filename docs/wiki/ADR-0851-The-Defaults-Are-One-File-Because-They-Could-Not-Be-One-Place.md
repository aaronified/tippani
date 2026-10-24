# ADR-0851: The defaults are one file, because they could not be one place

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**loadPrefs FILLS DEFAULTS IN ON READ**, so what reaches the browser for a reader who has
never opened Settings is `theme: "system"`, `accent: "terracotta"`, `srDaily: 8`. The fact
"they never set this" is destroyed on the server, deliberately, because every other
consumer wants the effective value.

**THE CHANGED COUNT NEEDS THAT FACT BACK, AND GOT IT WRONG TWICE.** The first version
counted any value present; only two of the struct's seventy-four fields carry `omitempty`,
so every untouched preference arrives as `""`, `0` or `false` and a fresh account read
"7 changed". The second stopped counting zero values and a fresh account still read
"4 changed" per section — one for every field loadPrefs defaults. Each version passed a
suite written to match its own reasoning. A capture found both.

**SO THE DEFAULTS ARE DATA, IN A FILE BOTH SIDES READ.** `web/frontend/src/prefDefaults.json`
holds the ones loadPrefs applies. Go cannot import a React module and a browser cannot call
loadPrefs, so the two copies cannot be collapsed; `pref_defaults_test.go` reads that same
file, signs up a fresh account, and fails when they disagree — in either direction. The
reverse direction is the one that rots quietly: a field that starts being defaulted to
something non-empty, with no entry on the client, reads there as a value the reader chose
and puts a number on a tab nobody has opened. It caught `creditSeparators` on its first run.

*Unreleased — `web/frontend/src/prefDefaults.json`,
`internal/httpapi/pref_defaults_test.go`, `web/frontend/src/Settings.jsx`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
