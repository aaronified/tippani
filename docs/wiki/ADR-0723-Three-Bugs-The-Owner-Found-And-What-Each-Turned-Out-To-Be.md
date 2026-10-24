# ADR-0723: Three bugs the owner found, and what each turned out to be

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted
- **Version:** Unreleased

- **The one-click update pulled and never recreated.** Four applies in an hour, four
  successful pulls, a container still on the image it started on. The one-shot helper
  was `containrrr/watchtower`, whose last release (1.7.1, 2023) negotiates Docker
  Engine API 1.25; a current daemon refuses anything below 1.40 and the helper then
  panics on a nil metric and exits. **The app cannot see any of that**: the helper runs
  detached and `AutoRemove`, so its stderr goes nowhere this process reads — Tippani
  logs "recreater launched", and the only symptom is a version that does not change.
  The default is the maintained fork now; `TIPPANI_UPDATER_IMAGE` still overrides it.
  The test spells the name out rather than comparing it to the constant, because a test
  that reads `DefaultUpdaterImage` twice passes whatever it is changed to.
- **A merged character lost its picture on every work but one.** The quote card's face
  comes from `work_cast.character_image_path`, which is per-appearance on purpose — a
  character is drawn differently in the novel and in the film. What was missing is the
  other half of that arrangement: with no per-work picture, the record's own is what
  should be shown. Without it, "default image" named a field nothing read. The merge is
  correct and unchanged; it must not copy a picture onto every appearance.
- **A dock key stayed lit after it was pressed.** Not a press effect: on a touch screen
  the last-tapped element keeps `:hover` until something else is tapped. Gated on
  `@media (hover: hover)`, with `sticky-hover.test.js` reading the stylesheet — jsdom
  has no pointer and the browser harness runs with a mouse, so neither can reproduce it
  and the declaration is the defect. The list of guarded selectors is deliberately
  short: most hover styles in the app are on surfaces a thumb never keeps on screen.
- **"Pulling the new image…" was a button label.** A 140px control asked to hold a
  sentence, on a phone. It is prose now and the form goes while the update runs — once
  the pull has started there is nothing on that row left to decide — which also folded
  the card's confirmation and the sheet's into one node they already shared state with.

<sub>Unreleased — `internal/updater/docker.go` · `internal/httpapi/cast_images.go` ·
`web/frontend/src/index.css` · `Settings.jsx` · `docs/wiki/Troubleshooting.md` ·
`test/rules/sticky-hover.test.js` · `internal/httpapi/character_merge_test.go`</sub>

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
