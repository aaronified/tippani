# ADR-0711: The work detail is two columns, and it opts out of the window's scroll

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

*The first real page overhaul of the v3.1 design pass. Departures from the pack are
named here because a screen that quietly disagrees with its own handoff is worse than
one that argues with it.*

- **This screen is full-bleed; `--container-max` does not apply to it.** The 880px
  measure cap on the stream already does the job the container cap was doing — bound the
  line length — so the container would only have been bounding the hero and the gutters.
  **The cost is stated rather than discovered:** `--container-max`'s own comment says the
  page body and the top bar must not disagree about where the gutter is, and on this
  screen they now do. This sets the pattern for Library, Quotes and Catalogue.
- **The document is locked at ≥1180px** — `html[data-scroll='screen']`, published by
  `useScreenOwnsScroll` and stamped by the shell — so the two columns can scroll
  independently. The phone keeps window scrolling: `100dvh` inside `overflow:hidden` is
  the most reliable mobile layout bug there is, and URL-bar collapse and pull-to-refresh
  come free with the window.
- **~~The arrangement is chosen in JavaScript, not hidden in CSS.~~ Reversed, and the
  reasoning was sound about the wrong thing.** `WorkHeroAny` picked `WorkHeroColumn` or
  `WorkHero` from one media query, on the grounds that rendering both and hiding one puts
  **two `<h1>`s** in the document. That is true, and it only applies when there ARE two of
  them. There were three — a float for a wide page, a stack for a phone, a column for this
  frame — and three copies of nine facts drift exactly as three copies do: the film side
  only ever called one, so a film never got the column at all, and the year lived in the
  credit line on one side and nowhere on the other.

  The design pack settles it against the way this was built: its `heroCol` carries the
  same children at every width and only `heroSplit` changes, from a stack to a row. So
  there is **one `WorkHero`, one markup, one `<h1>`**, and the arrangement is three lines
  of stylesheet — stacked in this frame and on a phone, beside its facts in between. A
  book, a film, a show and a game differ in what they pass IN (the kind word, the credit
  roles, the shelf verbs, the accent), never in what draws it, which is the owner's rule
  for every work detail: always the same source, hardwired, so they cannot fall out of
  sync. `frame-scroll.mjs` measures the arrangement at 1440, 900 and 390 rather than
  trusting the media query fired.

  **The float went with it**, and the pack never had one. Floating the actions right is
  what tore a book's name in half — *Moby-Dick; or, The* on one line, five buttons, then
  the rest of it — a defect that needed `clear: right`, a measured guard and a whole
  browser harness to catch. The verbs are a row at the foot of the header now, where they
  cannot cut into anything.
- **`← Library` is gone at two columns.** The breadcrumb reads `tippani / <title>` and the
  rail says Library; a third way out earned nothing but a row. This settles one of the two
  redundancies the top-bar phase flagged and explicitly left to the screen passes.
- **`--detail-pad` is `max(1.6em, 22px)` because the edge fade is a `mask-image`, and a
  mask CLIPS as well as fades.** A cover's drop-shadow inside that band would be cut off —
  which throws nothing, and simply makes covers look flat on this screen and nowhere else.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
