# ADR-0874: Settings, the owner's own pass: cards per subsection, and four fixes to Theme and Sections

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted

Reviewed on their phone, against the screens as shipped. Every item below is theirs.

**A SUBSECTION IS A CARD NOW, ON EVERY SETTINGS SCREEN.** A section used to be ONE card
holding four or five groups separated by 22px of air. At 954px that is a tall sheet of paper
with headings ruled across it and nothing but whitespace saying where one subject stops —
"1 · LIGHT AND DARK" and "2 · WHAT IT IS MADE OF" read as paragraphs of one document rather
than two things you can deal with separately. The instruction: *"you can make subsection wise
cards. For all screens. In desktop, some cards will be full width … and some half."* The
chrome MOVES rather than doubling: the wrapper gives up its border, fill and padding to the
groups inside it, scoped by `:has()` so no other card in the app is touched. Theme measures
1004 / 1004 / 493 / 493 at 1280 and four stacked 366s at 390.

**THE THREE COLOUR DOORS WERE DRAWN IN TWO SHAPES.** Light and Dark were rounded rectangles
and Accent was a circle, in one row offering one kind of choice. *"The colours (light dark and
accent) are all the same shape. Follow the prototype there."* The pack draws all three as a
single round swatch (`settings-restructured.dc.html:433`); the ground's three surfaces survive
the reshaping as concentric rings, because a ground is the desk, the furniture and the page
and one flat circle would show a third of the decision.

**THE MATERIAL GRID WAS SMALLER ON THE BIGGER SCREEN.** Measured: `auto-fill` with a 104px
floor put SEVEN columns across a 954px card and left the eighth set alone on a second row, at
126px a tile — while the same grid on a 390px phone drew two columns at 152px. A tile is a
room you are being shown, and shrinking it as the screen grows is the opposite of what the
space is for. Two columns and four divide the eight sets into whole rows at both widths, and
the desk's tile comes out at 231px.

**"SET AS A PAIR" WAS ATTACHED TO THE WRONG CONTROL.** It sat on the group head, directly
above a mode toggle where you pick exactly one of three — *"That seems misplaced. User only
selects one."* It is on the Colours row now, which is where the pair is, and says what the
mode row does to it: you are looking at whichever the row above is on, and the other is
waiting for when it is.

**AND THE LABEL TOGGLE HAD A CARD TO ITSELF.** One switch, one heading and a full measure for
"How much a control says". It is an accessibility dial by the same argument contrast is —
neither changes what the app can do, both change how much of itself it spells out — so it
joined Accessibility, and Theme went from five groups to four.

**THE PHONE'S TOPBAR SAID MORE THAN THE DESK'S.** The crumb took the wordy pill, "3 changed",
while the desktop rail beside the same sections shows a bare "3": the narrower screen carried
the longer label. It takes the number now, and the title, count and info dot are spaced 8px
apart the way the desktop crumb row already spaces them — they were inline siblings with
nothing between them.

**SECTIONS GOT A GRIP, AND THE PHONE GOT BOXES.** Two arrows, a two-word toggle and a
section's name do not fit 390px. The traditional six-dot handle is the sorter — *"the
traditional six dots button is easily identifiable as a sorter drag bar"* — at the row's left
edge, where a list says take hold of me, and on a phone it is the ONLY sorter. The arrows stay
on the desk because they are the KEYBOARD's way to reorder; a grip answers no key. The
Hide/Show pair stays there too, and a phone gets a tick in a quarter of the width.

**THE REORDER IS POINTER EVENTS, NOT THE DRAG-AND-DROP API**, and that is not a preference:
`dragstart` never fires from a finger on any mobile browser, and this grip is the phone's only
sorter. An implementation a finger cannot drive would have left the phone unable to reorder
anything at all.

**AND THE SLIDER MOVED OUT FROM UNDER THE FINGER.** Measured on a phone with the page scrolled
to its foot — which is exactly where the poster slider is, being the last thing on the screen
— dragging 150 → 95 shortened the document 1298 → 1227, so the browser clamped `scrollTop`
390 → 383 and the slider rose 7px mid-drag.

**IT WAS NOT THE SPECIMEN PUSHING IT, AND ONLY MEASURING SHOWED THAT.** The specimen is below
the slider, so its growth pushes what is under it and never the row above; at mid-screen the
slider held at 414px through a 250px swing in page height. The whole effect is the clamp, and
only at the bottom. So while the reader is holding the control the specimen reserves the
tallest box it could need, the document's height stops changing, and nothing clamps — verified
at 468px through a full-range drag. It relaxes on release; the residual 7px settle happens
after the finger is off, which is what the instruction asked for.

*Unreleased — `web/frontend/src/Settings.jsx`, `web/frontend/src/prefRow.jsx`,
`web/frontend/src/reorder.js`, `web/frontend/src/ui.jsx`, `web/frontend/src/sectionRail.jsx`,
`web/frontend/src/App.jsx`, `web/frontend/src/index.css`,
`web/frontend/test/journeys/sizing-a-cover-on-a-phone.journey.mjs`,
`internal/i18n/en.txt`, `internal/i18n/bn.txt`.*

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
