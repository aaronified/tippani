# Choosing the type

A Settings screen that lists every face the app uses, shows each one setting real
text, and lets it be swapped — for a bundled alternate or for a font you upload.

## What already exists

Verified against the tree at `fb6b065`.

| Thing | Where | State |
| :-- | :-- | :-- |
| The roles | `index.css` `:root` | Six: `--font-display`, `--font-ui`, `--font-mono`, `--font-hand`, `--font-bengali`, `--font-devanagari` |
| The faces | `package.json` (dev deps) | Newsreader, Hanken Grotesk, IBM Plex Mono, Caveat, Tiro Bangla, Tiro Devanagari Hindi — all `@fontsource`, all OFL |
| Loading | `main.jsx` | Static `@fontsource/*/400.css` imports; Vite emits per-subset woff2/woff with `unicode-range` |
| Runtime theming | `theme.js` | Already writes CSS custom properties onto `<html>` as inline styles — the exact mechanism a font swap needs |
| Uploads | `handleUploadSticker`, `handleUploadBoardImage` | `MaxBytesReader` → `io.ReadAll` → `metadata.StoreImage` → path in a row. Files live in `<DataDir>/MediaCover` |
| Preferences | `prefs` struct | Flat, and **compared with `!=` in `ui_test.go`** — so it must stay comparable. No maps, no slices. `CatName1..6` is the precedent for flat repetition |
| Canvas | `quoteImage.js` | `FONTS` names each face as a CSS font shorthand and `ensureFonts()` awaits `document.fonts` before drawing |

### What the verification changed

1. **`prefs` cannot hold a nested object.** `ui_test.go` compares the whole struct
   with `!=`, which only compiles while every field is comparable. Twelve flat
   fields, following `CatName1..6`.
2. **`metadata.StoreImage` cannot be reused.** It sniffs and validates *images*.
   A font needs its own store with its own magic-byte check.
3. **The canvas share-card is a second consumer.** `quoteImage.js` hard-codes face
   names in `FONTS`. A font swap that only rewrote CSS would produce share images
   in the old type — the same class of bug as a filter that changes one screen.

## The screen

Settings → **Type**. Six rows, one per role. Each row shows the role's real job
in its real face — the display face setting a quote, the mono face setting a
locator, the hand face setting a note — because a font list that shows every face
setting the same specimen sentence tells you nothing about the only question that
matters, which is how it looks doing *this*.

Each row offers: the **built-in**, **two bundled alternates**, or **Upload**.

### The alternates

All OFL or Apache-2.0, all free for any use, all chosen to sit inside the paper
and film aesthetics rather than to be a contrast:

| Role | Built-in | Alternates |
| :-- | :-- | :-- |
| display | Newsreader | Source Serif 4 · Literata |
| ui | Hanken Grotesk | Inter · Public Sans |
| mono | IBM Plex Mono | JetBrains Mono · Source Code Pro |
| hand | Caveat | Kalam · Gloria Hallelujah |
| bengali | Tiro Bangla | Baloo Da 2 · Hind Siliguri |
| devanagari | Tiro Devanagari Hindi | Baloo 2 · Hind |

**They are bundled, not fetched**, because Tippani never contacts the network on
its own and a font settings screen that phones Google Fonts would be the first
thing that did. The cost is stated and accepted: twelve more families in
`web/dist`. It is smaller than it sounds — `@fontsource` splits every face by
`unicode-range`, so a subset is only *downloaded* when a codepoint in its range
is actually rendered. What grows unconditionally is the CSS and the image, not
what the reader's browser fetches.

## Uploading a font

`POST /fonts` — multipart, one `file`, mirroring the sticker upload.

- **Format by magic bytes, not by extension.** `wOF2`, `wOFF`, `OTTO`, or
  `0x00010000` (TrueType). Anything else is refused. A `.woff2` that is a ZIP is
  the case the extension check misses.
- **Size cap** in the same style as `maxStickerUpload`. A CJK font is genuinely
  large; the cap has to be generous enough not to refuse one and mean enough not
  to be a disk-filling primitive.
- The server **stores bytes and never parses them**. Font parsers are a famously
  bad attack surface and the only thing that needs to read this file is the
  browser that asked for it.

### The script check

The request was that "a verifier will verify if the language / script is the
same" — replace the Bengali face with something that has no Bengali in it and
every Bengali quote in the library turns into boxes, silently, with no way to see
why from the screen that did it.

**It runs in the browser, by measurement, not by parsing.** Parsing `cmap`
server-side would mean a font-parsing module, and the dependency budget is three
direct Go modules. Parsing it *client*-side is worse: woff2 is Brotli-compressed,
so reaching the table means shipping a decompressor.

So: load the upload as a `FontFace`, render a representative string for the
target script to a canvas, and compare its metrics against the same string in a
control face. A font without the script substitutes the fallback and measures
identically; one with it does not. A second control string of codepoints no font
has (unassigned planes) calibrates what "substituted" measures like, which is
what keeps the check from passing everything.

This is a **warning, not a refusal**. It can be fooled in both directions — a
font with three Bengali glyphs passes — and refusing somebody's own font on the
strength of a metrics heuristic is worse than telling them what looks wrong.

## The style modifiers

Per role, defaulting to normal: **bold**, **italic**, **small caps**, **all caps**.
These map to `font-weight`, `font-style`, `font-variant-caps: small-caps` and
`text-transform: uppercase`, applied beside the family on the same custom
property set.

**"Monospace" is asked for and is not a style.** Whether a face is monospaced is
a property of its design, and no CSS makes a proportional face monospaced —
`font-family: monospace` replaces it with a different font entirely, which is
what the *role* picker already does. The nearest real thing is
`font-variant-numeric: tabular-nums`, which makes the *figures* line up in
columns and is genuinely wanted on a locator or a date. **Open question for the
author: ship it as "Lining figures", or drop it.** Shipping a control labelled
"monospace" that silently swaps the face would be a fourth name for the role
picker.

Not every modifier suits every role. All-caps on the display face turns every
quote into a shout, and small caps is meaningless in Bengali and Devanagari,
which have no case at all. The row offers what its script and job support.

## Storage

Twelve flat preference fields — `fontDisplay`, `fontDisplayStyle`, and so on —
merging through the existing partial-merge PUT. A value is either a built-in
token (`newsreader`, `literata`) or `upload:<id>`.

An unrecognised token **falls back to the built-in** rather than to nothing. A
preference that fails to parse must never leave the app with no font: that is
indistinguishable from a broken stylesheet and it would be silent.

## The parts that are easy to miss

- **The share image.** `quoteImage.js` names faces in `FONTS` and awaits them in
  `ensureFonts()`. Both read the resolved family, or share cards keep the old type.
- **The demo.** It runs with no server, so `upload:` can never resolve there and
  must degrade to the built-in rather than to a fallback serif.
- **The glossary.** `docs/ui-glossary.html` inlines the built CSS via
  `scripts/glossary-css.mjs`; adding twelve families changes it.
- **Deleting an uploaded font** that a preference still points at. Same shape as
  a sticker that a quote still wears.
