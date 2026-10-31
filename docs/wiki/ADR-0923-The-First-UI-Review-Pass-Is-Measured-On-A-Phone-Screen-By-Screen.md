# ADR-0923: The first UI review pass is measured on a phone, screen by screen

Source of truth: this wiki page.

- **Area:** [Later decisions, in the order they were made](ADR-Index.md#later-decisions)
- **Status:** Accepted (first pass; the review is not finished)
- **Refines:** [ADR-0921](ADR-0921-A-Quote-Card-s-Row-Is-One-Line-On-A-Phone.md), [ADR-0922](ADR-0922-The-Context-Block-On-A-Quote-Form-Starts-Folded.md)

**Why.** [#57](https://github.com/aaronified/tippani/issues/57): the owner found the interface "bogus" on a phone, and the new
source and context screens had never been looked at on one. The two concrete defects (#60, #59) were fixed by an agent that could
not open a browser. This pass looked at them in one.

**How it was measured.** A scratch server was seeded with the screenshot fixture and given a library folder holding an EPUB with a
long path, so the Source files screens had something to show. Screens were captured at 390 px, 1280 px and 390 px with every type
dial at its top (`TYPE_FACTOR_MAX`), in Edge, because the machine had no Firefox. `scripts/screenshots/run-controls.sh` was also
run at phone width in Edge.

**Checked and holding.**

- **#60:** a quote card's action row is one line at 390 px: the ring, the heart, the colour and the ⋯. Copy and Share are behind
  the ⋯.
- **#59:** the context block on the edit form is folded and reads "In context" with a chevron, directly under the quote.
- Nothing scrolls sideways on any screen captured at 390 px, at 1280 px or at the top type size.

**Found and fixed.**

- **A found file's path was squeezed.** On Checks, the card beside Accept and Refuse gave the path a column about 200 px wide. The
  row is now the same shape as the work panel's found-file row: title, path on the full width, the two buttons under it.
- **A link that wraps centred its second line.** A link is a `<button>`. Source files draws a work's title as one, so a long title
  sat centred while a short one sat left. `.tp-link` now aligns left.
- **A section head left its info dot alone on a line.** The heading and its count filled the line, so the dot wrapped. They now
  take what the control leaves.

The last two are stylesheet rules and are pinned by a rules test, because jsdom has no layout.

**Not covered, and why.**

- The desktop pass of `run-controls.sh` failed on every surface in Edge ("detached Frame"). It is a Firefox harness; only its phone
  pass gave results. Its baselines (`controls-baseline.json`) were recorded in Firefox, so its "small" and "labelled" counts from
  Edge were not compared with them and the baseline was **not** changed.
- It also reported one control that does nothing and does not say so: **Film detail, "Ascending"**. It has not been looked into.
- The `typescale` and `metadata-layout` harnesses were not run.
- Locators ("Times and places from files") drew nothing for the fixture, so that section was not seen.
- Not every screen was captured. Captured: Source files, Checks (found files), a work's quotes, the edit form, and the Metadata
  and Settings screens' top. Not captured: Catalogue, Stats, Anthologies, Bin, Profile, the work's source section, a show.

See also: [Source files and context](Source-Files-And-Context.md) · [ADR index](ADR-Index.md) · [Home](Home.md)
