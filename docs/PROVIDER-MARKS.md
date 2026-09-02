# The site marks

Twelve marks, one per metadata supplier, vendored into
`web/frontend/src/providerMarks.js` as percent-encoded `data:` URIs and painted as CSS
masks. This file is the record of where each came from and under what licence, because
the repo's own precedent (`web/frontend/src/textures/README.md`) is that anything
third-party names its origin and the date it was recorded.

## Why the app carries brand marks at all

**It did not, and that was a decision.** `ui.jsx` said so in words: *"These are 16px
category glyphs (not brand logos — they match the hand-drawn stroke set and need no
licensing)."* Five suppliers had a hand-drawn glyph and the other seven fell through to a
question mark.

That reasoning held while a supplier's name appeared once, on a look-up row you were
already reading. It stops holding when **every field on a record carries the mark of
whoever wrote it**: at that density a reader is scanning for "which of these did Google
write", and a category glyph cannot answer it — five of the twelve were the same drawing.
A real mark is recognised without being read, which is the entire job here.

The licensing the old note avoided is the price, and it is paid in this file.

## Origins

| App slug | Mark | Source | Licence |
| --- | --- | --- | --- |
| `amazon` | Amazon, letterform only | Font Awesome 6.7.2 | CC BY 4.0 — attribution below |
| `fandom` | Fandom | Simple Icons | CC0-1.0 |
| `google` | Google | Simple Icons | CC0-1.0 |
| `igdb` | IGDB | Simple Icons | CC0-1.0 |
| `imdb` | IMDb | Simple Icons | CC0-1.0 |
| `letterboxd` | Letterboxd | Simple Icons | CC0-1.0 |
| `openlibrary` | Internet Archive | Simple Icons | CC0-1.0 |
| `tmdb` | The Movie Database | Simple Icons | CC0-1.0 |
| `tvdb` | TheTVDB | supplied by hand; in no open pack | see note |
| `wikidata` | Wikidata | Simple Icons | CC0-1.0 |
| `wikimedia` | Wikimedia Commons | Simple Icons | CC0-1.0 |
| `wikipedia` | Wikipedia | Simple Icons | CC0-1.0 |

Recorded 2026-08-31. Ten of the twelve are [Simple Icons](https://simpleicons.org),
released under CC0-1.0.

**Amazon is the letterform alone**, and both halves of that are deliberate.

*Why no smile.* Every published Amazon mark pairs the `a` with the smile beneath it, and
at the 18px this app draws a source mark the smile is a grey smear under the letter. The
design pack reached the same conclusion independently and shipped a raster stencil of the
`a`. Rendered side by side at 18px and 96px, the vector below is indistinguishable from
that stencil — for **466 bytes instead of 16,764**.

*Why Font Awesome and not Simple Icons.* Simple Icons **withdrew** Amazon at the
company's request. The withdrawn file is still CC0 wherever it was archived, and
re-vendoring something a rights holder asked to have removed is not a thing to do on a
licence technicality. Font Awesome still publishes the mark, under CC BY 4.0, which
wants attribution — so:

> Amazon mark: [Font Awesome Free 6.7.2](https://fontawesome.com) by @fontawesome,
> icons licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
> Modified: the smile's three subpaths were removed, leaving the letterform.

**TheTVDB is the only raster-free exception left** — it is in no open pack and was
supplied by hand with the design pack.

## These are not the attribution logos

A mark here is a **source indicator** — an 18px monochrome glyph, recoloured to the app's
ink, saying which supplier a field came from. An **attribution logo** is a different
object with a different job: the supplier's own file, in the supplier's own colours,
unmodified, displayed because their licence requires it. TMDB and TheTVDB both require
one; their files live in `docs/img/providers/` and are shown in the README's Attribution
section beside the wording each of them asks for. Nothing in this file satisfies that
obligation and nothing in it is meant to.

## Two substitutions, neither a mistake

- **`openlibrary` shows the Internet Archive's mark.** Open Library is an Internet
  Archive project and the Archive is the mark it publishes under. Simple Icons has no
  separate Open Library entry.
- **`wikimedia` shows Wikimedia Commons.** Commons is the media repository, which is what
  this source actually supplies to the app (cover and portrait images).

Both are commented at their entry in `providerMarks.js`, so nobody later reads them as
the wrong file pasted in.

## A mark is never a brand colour

Every value is an opaque black shape and is painted with `mask-image` over a
`background-color`. A mark therefore wears `--soft` at rest and `--ink` under the
pointer, like every other glyph in the app. Rendering one as an `<img>` would bring its
brand colour with it, and a dozen brand hues in one panel would be the loudest thing on
a screen made of paper.

They are **vendored, never hotlinked**. A panel that phones a dozen companies to draw
itself is exactly the outbound request this app promises not to make.

## Adding one

A supplier with no mark is not a bug — the caller falls back to the supplier's name.
To add one: take the CC0 SVG, percent-encode it into a `data:` URI, and add it to
`PROVIDER_MARKS` under **the app's own slug** (`vocab.source.<slug>.label` in
`internal/i18n/en.txt`), with a row here naming its origin.
