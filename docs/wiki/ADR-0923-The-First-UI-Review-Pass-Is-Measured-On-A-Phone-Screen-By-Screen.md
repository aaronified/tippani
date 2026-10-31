# ADR-0923: The first UI review pass is measured on a phone, screen by screen

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted (first pass; the review is not finished)
- **Refines:** [ADR-0921](ADR-0921-A-Quote-Card-s-Row-Is-One-Line-On-A-Phone.md), [ADR-0922](ADR-0922-The-Context-Block-On-A-Quote-Form-Starts-Folded.md)

**Why.** [#57](https://github.com/aaronified/tippani/issues/57): the owner found the interface "bogus" on a phone, and the new
source and context screens had never been looked at on one. The two concrete defects (#60, #59) were fixed by an agent that could
not open a browser. This pass looked at them in one.

**How it was measured.** A scratch server was seeded with the screenshot fixture and given a library folder holding two EPUBs with
long paths, so the Source files, Found files and Times and places screens had something to show. Screens were captured at 390 px,
1280 px and 390 px with every type dial at its top (`TYPE_FACTOR_MAX`), in Edge, because `controls.mjs` always runs in a Chrome
engine and the machine's Firefox is Zen (`C:\Program Files\Zen Browser\zen.exe`, which launches under puppeteer when
`MOZ_NO_REMOTE=1` is set). `scripts/screenshots/run-controls.sh` was run at phone width.

**Checked and holding.**

- **#60:** a quote card's action row is one line at 390 px: the ring, the heart, the colour and the ⋯. Copy and Share are behind
  the ⋯.
- **#59:** the context block on the edit form is folded and reads "In context" with a chevron, directly under the quote.
- Nothing scrolls sideways on any screen captured at 390 px, at 1280 px or at the top type size.
- Captured and read: Home, Library, Catalogue, Quotes, Anthologies, Stats, Bin, Profile, Metadata, Settings, a film, a show, Source
  files, Checks (found files and Times and places), a work's quotes and the edit form.

**Found and fixed.**

- **A found file's path was squeezed.** On Checks, the card gave the path a column about 200 px wide beside Accept and Refuse. The
  row is now the same shape as the work panel's found-file row: title, path on the full width, the two buttons under it.
- **A link that wraps centred its second line.** A link is a `<button>`. Source files draws a work's title as one, so a long title
  sat centred while a short one sat left. `.tp-link` now aligns left.
- **A section head left its info dot alone on a line.** The heading and its count filled the line, so the dot wrapped. They now
  take what the control leaves.
- **An anthology tile's name ran under its ⋯ button**, and at the top type size the two-column grid broke names in the middle of a
  word. The name keeps out from under the button, and the grid's column floor is the larger of 150 px and nine rems, so a reader
  who has turned the type up gets one wide column.
- **Metadata's "Scan for duplicate works" hung out of its card at the top type size.** The verb may now be narrower than its own
  words and wraps.
- **Locators and Found files:** the arrow between "Now" and "File says" and the one after a file's title had no space on either
  side, and Times and places printed the file's own words under a quote that was identical to them. The words show only where they
  differ.

These are stylesheet rules (pinned by `test/rules/a-wrapped-link-and-a-section-head-keep-their-place.test.js`, because jsdom has no
layout) and one behaviour (`test/dom/locators-section.test.jsx`).

**Looked at and left alone.**

- **A name or a row of chips cut off at the edge** (a Bin entry's text, Metadata's issue chips, Settings' selectors). These scroll
  sideways under a fade on purpose (`NameScroll`, `useEdgeScroll`), so that a shortened name never looks like a short one.
- **Film detail's "Ascending"**, which the controls check calls a control that does nothing. The fixture's film has one quote, and
  reversing a list of one changes nothing. It is the harness meeting a one-row list. It could disable itself on a list shorter than
  two; that is a design choice and was not made.

**Not covered, and why.**

- The desktop pass of `controls.mjs` failed on every surface here with "Attempted to use detached Frame", which is not understood,
  so only its phone pass is read. The touch-floor and glyph-with-words counts it printed (138 and 14) are not compared with
  `controls-baseline.json`, and the baseline was **not** changed; a comparison against the 3.4.2 build was started to say which
  counts are new.
- The Firefox harnesses (`typescale`, `metadata-layout`, `frame-scroll`, `panel-depth`) were not run.
- Not captured: the work details' source section, an episode's file, the Add surface.

See also: [Source files and context](Source-Files-And-Context.md) · [ADR index](ADR-Index.md) · [Home](Home.md)
