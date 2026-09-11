// EVERY FORMAT THE IMPORTER PARSES, AS ONE TABLE, because two surfaces draw it.
//
// It began inside ImportPage and belonged there while that screen was its only
// reader. The help guide now draws the same eight rows, and the plan's reason for
// putting them there is the reason this file exists: the list cannot drift from
// the parser table, because it IS the parser table. A second list written out in
// help.jsx would agree with the importers on the day it was typed and never again
// — and nothing would say so, because a help panel has no run to fail.
//
// DATA ONLY, NO RENDERING. The screen draws a `<select>` of these and the guide
// draws a list of them; neither shape belongs to the other, and a component here
// that tried to serve both would be a third opinion about what a source looks
// like. What both genuinely share is the table and the four ways of asking it for
// words, and that is all this file holds.

import { t } from './i18n.js'

// SOURCES is a HOW-TO LIST and nothing else — no file input, no accept colour,
// no per-card upload. `POST /import/auto` sniffs the bytes
// (internal/httpapi/import_auto.go), so the reader never answers "which of these
// is my file" before the app looks at it.
//
// `steps` is a COUNT rather than a list of strings: the keys are
// import.source.<kind>.step.1 … .N, so the table says how many there are and the
// locale file says what they are.
export const SOURCES = [
  { kind: 'markdown', ext: '.md', steps: 2 },
  { kind: 'readest', ext: '.json', steps: 2 },
  { kind: 'bookcision', ext: '.json', steps: 3 },
  { kind: 'hardcover-html', ext: '.html', steps: 3 },
  { kind: 'goodreads-html', ext: '.html', steps: 3 },
  { kind: 'imdb-quotes', ext: '.html', steps: 3 },
  { kind: 'kindle-notebook', ext: '.html', steps: 3 },
  { kind: 'kindle-clippings', ext: '.txt', steps: 3, caveat: true },
]

// Every extension any of them arrives as, for the input's `accept`. Derived
// rather than typed, so a source added above cannot be left out of it.
export const IMPORT_ACCEPT = [...new Set(SOURCES.map((s) => s.ext))].join(',') + ',.markdown,.htm,.text'

// The reader's words for one source, resolved at render — never at module load,
// because that is before applyLocale() has run.
export const sourceTitle = (kind) => t(`import.source.${kind}.title`)
export const sourceDesc = (kind) => t(`import.source.${kind}.desc`)
export const sourceSteps = (src) =>
  Array.from({ length: src.steps }, (_, i) => t(`import.source.${src.kind}.step.${i + 1}`))
export const sourceCaveat = (src) => (src.caveat ? t(`import.source.${src.kind}.caveat`) : '')
