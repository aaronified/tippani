# ADR-0690: Brand marks, which reverses a decision written in the source

Source of truth: this wiki page.

- **Area:** [§17 Verification, Release Engineering and Provenance](ADR-Index.md#area-17)
- **Status:** Accepted

- **Decided** — twelve suppliers' own marks, vendored, painted as masks at `--soft`.
- **Reversal** — `ui.jsx` said the opposite, in words: *"These are 16px category glyphs
  (not brand logos — they match the hand-drawn stroke set and need no licensing)."* That
  reasoning held while a supplier was named once, on a look-up row you were already
  reading. It stops holding when every field carries one: at that density the reader is
  scanning for "which of these did Google write", and a category glyph cannot answer it —
  five of the twelve suppliers shared one drawing. A real mark is recognised without being
  read. The licensing the old note avoided is the price, and it is paid in
  `docs/wiki/Provider-marks.md`.
- **Masks, never `<img>`.** Each mark is an opaque black shape over a `background-color`,
  so it wears the row's ink and one file serves both themes. A dozen brand hues in one
  panel would be the loudest thing on a screen made of paper.
- **Vendored, never hotlinked** — a panel that phones a dozen companies to draw itself is
  exactly the outbound request this app promises not to make.
- **Two substitutions, both deliberate**: Open Library shows the Internet Archive's mark
  (Open Library is an Archive project and that is the mark it publishes under), and
  Wikimedia shows Wikimedia Commons (the media repository, which is what that source
  supplies). Both are commented at their entry so neither reads as the wrong file pasted in.
- **Amazon is the letterform alone, from Font Awesome.** Every published Amazon mark pairs
  the `a` with the smile, and at 18px the smile is a grey smear — rendered side by side,
  the letterform alone is indistinguishable from the design pack's 16.7KB raster stencil
  for **466 bytes**. Font Awesome rather than Simple Icons because Simple Icons WITHDREW
  Amazon at the company's request: the archived file is still CC0, and re-vendoring
  something a rights holder asked to have removed is not a thing to do on a technicality.

See also: [ADR Index](ADR-Index.md) · [Design decisions](Design-decisions.md) · [Home](Home.md)
