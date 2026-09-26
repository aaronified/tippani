# Follow-ups

**Not a feature.** What is left over from a release's task list, one line per task. Each
item is struck from here when it ships and recorded where its kind of fact lives: the
changelog, `Design-decisions.md`, or a test. The file is deleted when the list is empty.

3.0.2's list shipped whole except for what is below.

## Moved past 3.0.2 by the owner

- [ ] **glass-cost cannot measure on Firefox.** `launchBrowser`'s Firefox profile always
  sets reduced motion, so `lensAllowed` refuses the lens. The probe now says so and exits 1,
  but it has no way to run there. It needs a browser running the app, which this machine
  cannot keep signed in for more than about thirty seconds.
- [ ] **cardmaterial's figures are light-scheme figures.** They were recorded as "dark"
  and measured in Chrome's default light scheme. Re-measure in dark, now that the probe
  applies its theme and installs its no-motion stylesheet.

## Found while shooting 3.0.4's README

- [ ] **A Kindle clipping's date is kept as Kindle wrote it**, e.g. "Added on Saturday,
  26 September 2026 09:12:03", by design (the parser reads the format by structure, not by
  language, and `kindle_clippings_test.go` pins the raw string). Every screen that prints a
  noted date assumes ISO. The pending-import row prints its first ten characters, "ADDED ON
  S". Home and Quotes print no date at all, because `fmtDate` cannot parse it. Decide
  whether the importer parses the common locales into ISO; at least, the pending row
  should format the way the other screens do.
- [ ] **At 175% type, mono labels on Stats break mid-word** outside the tiles 3.0.4 fixed:
  the section heads (MEMORY, TIMELINE, BREAKDOWN on a phone) and chart figures (10–17, 673).
  Found with a script that reports any word whose line boxes have more than one top.
- [ ] **The quiz blank's hint still clips at 175% type on a phone**: 349px of text in a
  298px box, "type what belongs in the b". 3.0.4 made it fit at the default size, and the
  field already spans the row there. A shorter phone hint, or a hint line that wraps, is the
  fix, and either is a copy decision (the Bengali is the owner's).
- [ ] **Nothing guards the Stats tiles against breaking a word again.** jsdom does no
  layout, and `make typescale` counts clipping, which a wrapped word is not. The probe that
  found it (de692fb0's body) needs a browser. As a journey it needs a new verb in
  `screen.mjs`, which is the owner's vocabulary to extend.

## Open, and not ours to close yet

- [ ] **GO-2026-5932**, `golang.org/x/crypto/openpgp` ("unmaintained, unsafe by design"),
  has no fixed version. govulncheck finds no import or call of that package from this code,
  only the module in `go.mod`. The owner: "the second one cannot be fixed now". Upgrade
  `golang.org/x/crypto` when a fix is released, or when the advisory is withdrawn for
  modules that do not import the package.
