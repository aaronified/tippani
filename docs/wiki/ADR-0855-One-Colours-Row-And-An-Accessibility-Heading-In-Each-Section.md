# ADR-0855: One Colours row, and an Accessibility heading in each section

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

**THE PACK HAS ONE ROW WHERE THIS HAD TWO.** `settings-restructured.dc.html:2590` is
`{ k: 'colours', label: 'Colours', sub: 'Light ground · dark ground · accent. Tap a colour
for its options.' }` — one row, three choices. This app grew a row labelled **Ground**
showing only the current mode's swatches, and put the accent twenty rows below among the
size sliders. "Ground" is not a control's name anywhere in the pack; it appears once,
inside that sub-line. A word describing the choice had been promoted into the name of half
of it. The owner: *"Do not deviate so much that you start randomly inventing new stuff."*

The triads are not the invention — four light and four dark were asked for and approved.
Where they sat was. A rule divides the two kinds of swatch in the row, because a triad of
surfaces and a single colour would otherwise read as eight choices of one kind.

**THE FOOT OF THE SECTION WAS A LOST-PROPERTY DRAWER.** The accent, two cover-size
sliders, the global text size, two quote-reading dials, label density and the language
picker, in one flex wrap. *"What are the random stuff doing in the last two rows?"* Each
has gone where it is about something: the cover sliders to Sections (the pack puts its own
pair there), the language picker to the section named for it, and the accent up into
Colours. Label density stayed — it was always the pack's own group 4, "How much a control
says", which is what that group is called.

**AND THE ACCESSIBILITY DIALS GET A HEADING IN EACH SECTION THEY BELONG TO**, on the
owner's instruction. Contrast is one — `§6 access` in the source, added before this remake
and absent from the pack, which is exactly why it read as a stranger standing in the pack's
group 1. Text size and the two quote dials are the other three, under Language and font
beside the faces they resize. They are typesetting: how a QUOTE is set when you read one,
the leading between its lines and how wide its column runs. Their labels say that now;
"quote line length" was a phrase the owner could not place, which is the only test a label
has to pass.

**TWO DEFECTS THE CAPTURE FOUND AND THE SUITE DID NOT.** The face specimens printed
`vocab.face.newsreader.name` down the middle of the section — `chosen.name` is a locale key
and nothing resolved it. The test asserted each role's label and its sample and said
nothing about the name, so it passed. It now refuses any row whose text contains `vocab.`.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/index.css`,
`web/frontend/test/dom/language-faces.test.jsx`,
`web/frontend/test/journeys/changing-a-setting.journey.mjs`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
