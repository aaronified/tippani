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

## Open, and not ours to close yet

- [ ] **GO-2026-5932**, `golang.org/x/crypto/openpgp` ("unmaintained, unsafe by design"),
  has no fixed version. govulncheck finds no import or call of that package from this code,
  only the module in `go.mod`. The owner: "the second one cannot be fixed now". Upgrade
  `golang.org/x/crypto` when a fix is released, or when the advisory is withdrawn for
  modules that do not import the package.
