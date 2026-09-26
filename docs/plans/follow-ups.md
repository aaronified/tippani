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
- [ ] **The console logs a CSP refusal of the app's own `<style id="tp-language-type">`** on
  Home and other screens, which would mean the per-language type rules do not apply. Seen by
  both 3.0.4 rater passes and dated by them to 48367b5c (fonts.js), so it is in 3.0.3 too.
  Not yet checked first-hand.
- [ ] **Home's favourite cards cut a person's name** ("Rabindranath Tago…", "Ranchoddas
  \"Ranch…"), which the name rule forbids where the reader is there to read it. Seen by the
  second 3.0.4 rater pass in the README's favourites image. It predates 3.0.4.

## For 3.1.0, the owner's call at 3.0.4

- [ ] **The journey fixture's unverified verbatim lines become invented prose.** The fixture
  keeps four real books verbatim. Only The Idiot has been checked, and 11 of its 22 lines
  match Eva Martin's public-domain translation (Gutenberg #2638). The owner, asked what the
  public repo should keep: *"Swap unverified lines for invented prose"*. The same goes for
  the import sample's two Seneca lines, which are of unrecorded source. Re-run the curator
  (`scripts/journeys/curate-fixture.mjs`, against the archive), then the full journey tier.

## Open, and not ours to close yet

- [ ] **GO-2026-5932**, `golang.org/x/crypto/openpgp` ("unmaintained, unsafe by design"),
  has no fixed version. govulncheck finds no import or call of that package from this code,
  only the module in `go.mod`. The owner: "the second one cannot be fixed now". Upgrade
  `golang.org/x/crypto` when a fix is released, or when the advisory is withdrawn for
  modules that do not import the package.
