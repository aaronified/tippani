# ADR-0799: The import wall became one drop target, and the guard that was supposed to catch it took three weeks

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

`docs/plans/import-one-drop-target.md` is folded in here and deleted, per that
directory's rule. It shipped: the wall of seven format cards is one file row that is
also a drop target, the server reads the bytes, and the reader never picks a format.

**What it promised and what answers for it now.** `importer.Detect(data []byte) string`
lives at `internal/importer/detect.go:57` and takes no filename — which was the plan's
central line, *"nothing in this plan may depend on a file's extension or its declared
type"*. It is reached through `POST /import/auto`, wired at `internal/httpapi/server.go:498`
beside the per-source endpoints the plan kept on purpose (*"they are the API, the override
re-posts to them"*). Readest JSON became the eighth source (`internal/importer/readest.go`),
and the markdown parser got back the notes and timestamps it had been dropping. The list of
what is supported moved into help, where the plan said a list belongs — and it went further
than the plan asked, becoming its own rail section rather than a row under Capture.

**Where a mis-dropped file lands** is the part worth keeping in the log, because it is the
plan's own argument and it held: `import.near-miss.*` (`internal/i18n/en.txt:4018-4023`) has
six answers — backup, zip, epub, image, font, binary — and each names the door that DOES
take the file. The comment above them states the rule: *"'unrecognised' to a backup archive
is a worse answer than the wall of cards was."*

### Where the plan turned out to be wrong

**The `screens.js` guard it asked for cannot exist.** Its guards table says of
`web/frontend/test/screens.js`: *"`import` is absent, so `screens-mount.test.jsx` never
mounts it. Adding it is the first test this file has ever had."* It is not addable.
`screens-mount.test.jsx:49` asserts `screenLabelsInApp()` — every `data-screen-label` found
in `App.jsx` (`screens.js:67-70`) — equals `Object.keys(SCREENS).sort()`. Import is a MODE
of the add surface, not a screen with a label of its own, so adding it to the table breaks
the assertion that makes the table worth having. The plan read "a screen the reader can be
on" where the guard means "a labelled branch in App.jsx", and those stopped being the same
thing when import moved onto the add surface.

**The `controls.mjs` guard was right and took until 11 September.** The same table said
`SURFACES` *"never reaches Import or the Add surface at all, so `MIN_CONTROLS`, the 44px
touch floor and the unlabelled-control count do not police it."* True when written and true
for three more weeks. Closing it needed two things the plan did not foresee: the ＋ is drawn
twice, once per width, so the probe had to press `[data-tour="add"]` rather than either
bar's class; and the phone sheet carried no `role="dialog"`, so the probe could not tell
that the surface had opened at all — an accessibility gap found by a touch-floor probe,
which is not where anyone was looking for one.

**What the guard found when it finally ran** is the honest measure of what the wall's
replacement cost: at 1280 every control on both surfaces clears the floor, and at 390 the
only real defect was `SaveDontPasteNote`'s `<summary>` at 34px. The other two sub-floor
entries are the sheet's own grip, thin by the owner's ruling that moved the drag target to
the whole header bar. One defect, in a screen rebuilt from nothing, found by a gate that
should have existed before the rebuild rather than after it.

**AND THE BIGGEST DEPARTURE WAS THE OWNER'S OWN, WHICH THIS SECTION DID NOT LIST.** The
plan forbids an `accept` filter outright — four separate clauses of it — and
`ImportPage.jsx:182` ships `accept={IMPORT_ACCEPT}`. That is not drift. The owner
overruled the plan in one line: *"Import: drop the accept filter, say what each file was
read as, allow an override — no! do not drop the filter for bulk uploads. queue them in
the checks page."*

It was recorded on the task and not here, and the plan file itself was left alone on
purpose: it belongs to the planning agent, and editing under it is not this session's
call. That was the right restraint and the wrong record — a fold that lists two departures
the CODE made and omits the one the OWNER made reads as though nobody had noticed, which
is exactly what a rater concluded from it. The queue behind "queue them in the checks
page" is `docs/plans/` work and still open.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
