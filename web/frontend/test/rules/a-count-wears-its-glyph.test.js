// A COUNT WEARS THE GLYPH OF WHAT IT COUNTS, AND THIS FILE IS THE LIST OF WHERE
// IT DOES NOT.
//
// THE RULE, in the owner's words: "when there is enough space (like in section
// subtitle or subheaders), the glyph will follow the text so the association is
// clear. where there is small space, like rows with buttons and lots of info,
// they will serve as a visual indicator of the nouns, just like they do for the
// verbs." `Tally` (ui.jsx) is both shapes; `showWord` picks between them.
//
// WHAT A SWEEP LIKE THIS ACTUALLY NEEDS GUARDING AGAINST is not the conversions —
// those are on the screen, and a journey presses them. It is the NEXT count: a
// string added to en.txt reading "{n} quotes" and rendered as a word, six months
// from now, on a screen nobody re-reads. So this asserts the LOCALE FILE against
// a table, and the table has one row per standalone count of a noun this app
// draws. A new one that is in neither column fails, and the author has to say
// which it is.
//
// A STANDALONE COUNT, AND ONLY THAT. "{n} quotes" on its own is a label and wears
// a glyph. "It goes to the bin with the {n} quotes saved from it" is a SENTENCE,
// and a drawing in the middle of one is a rebus — those are not in scope and the
// pattern below cannot match them, which is the point of anchoring it.
//
// MUTATION-VERIFIED: add `foo.count.other = {n} quotes` to en.txt and the first
// case names it; move a key from KEPT to GLYPHED without changing the code and
// the second case names the call site still passing it as a word.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { readSource, sourcesUnder } from '../src-files.js'

const SRC = process.env.TIPPANI_SRC
const EN = readFileSync(join(SRC, '..', '..', '..', 'internal/i18n/en.txt'), 'utf8')

// The nouns this app has a drawing for. A count of anything else keeps its word
// because there is nothing to put beside it — which is a fact about the icon set,
// so it lives here rather than being argued per site.
const DRAWN = '(?:quote|quotes|work|works|book|books|film|films|person|people|character|characters|tag|tags|skipped|dialogue|dialogues|film line|film lines)'
const STANDALONE = new RegExp(`^([a-z0-9._-]+) = (\\{n\\} ${DRAWN})$`, 'gm')

// KEPT — a standalone count still drawn as a word, each with the reason. Every
// one of these is a place a glyph cannot go rather than a place it was not worth
// putting.
const KEPT = {
  'settings.appearance.quote-measure.chars':
    'the "characters" here are LETTERS, not people — a measure in ems. The word is the only thing that says so, and the person glyph beside it would say the opposite.',
  'staging.flash.approved.skipped':
    'a flash message: one line of prose that appears and goes. A drawing in a sentence is a rebus.',
  'metadata.prune.confirm.people':
    'the body of a confirm dialog — a sentence the reader has to weigh before pressing something destructive.',
  'metadata.prune.confirm.characters': 'the same dialog, the other noun.',
  'metadata.count.dialogues':
    'its one remaining caller builds an <option> label, and an <option> holds text. A select cannot draw.',
  'identity.crumb.book': 'a breadcrumb assembled by joining strings with " · " before it reaches the screen.',
  'identity.crumb.film': 'the same crumb, the other medium.',
  'identity.crumb.works': 'the same crumb, its last segment.',
  'common.work-card.count.quote': 'the WORD a work card\'s Tally is given; the card draws the glyph.',
  'common.work-card.count.dialogue': 'the same, for a film.',
  'stats.super.quotes.label': 'a SuperTile takes its count as a string and prints it under a title; the tile is the one place on Stats that is a headline rather than a row.',
}

const baseOf = (k) => k.replace(/\.(one|other)$/, '')

describe('every standalone count of a noun this app draws', () => {
  it('is either wearing its glyph or listed here with a reason', () => {
    const found = new Set()
    for (const m of EN.matchAll(STANDALONE)) found.add(baseOf(m[1]))
    const loose = [...found].filter((k) => !(k in KEPT)).sort()
    expect(
      loose,
      'a count of something this app has a drawing for is being printed as a word. ' +
        'Give it a Tally (ui.jsx), or add it to KEPT above with the reason a glyph cannot go there',
    ).toEqual([])
  })

  it('has a reason that says something', () => {
    const empty = Object.entries(KEPT).filter(([, why]) => !why || why.length < 20).map(([k]) => k)
    expect(empty, 'an exception with no argument is not an exception').toEqual([])
  })

  it('does not keep a key nobody kept', () => {
    // A KEPT entry whose key has left en.txt is a reason for a decision that no
    // longer exists — the same drift every other table in this directory guards.
    const gone = Object.keys(KEPT).filter(
      (k) => !EN.includes(`\n${k} = `) && !EN.includes(`\n${k}.one = `) && !EN.includes(`\n${k}.other = `),
    )
    expect(gone, 'KEPT names a locale key that is not in en.txt any more').toEqual([])
  })
})

describe('the Tally itself', () => {
  const ui = readFileSync(join(SRC, 'ui.jsx'), 'utf8')
  const block = ui.slice(ui.indexOf('export function Tally('), ui.indexOf('export function Tally(') + 2600)

  it('names the glyph with the noun it stands in for', () => {
    // THE LABEL IS ON THE GLYPH, NOT ON THE WHOLE TALLY. Labelling the wrapper
    // `role="img"` reads correctly and makes every count in the app a second image
    // on its screen — `work-tile-marks.test.jsx`'s helper said "the bar is the only
    // role=img on a tile" and was right until it was not. The glyph alone is the
    // image: it is the part standing in for a word.
    expect(block, 'the glyph no longer carries the noun it stands in for')
      .toMatch(/aria-label=\{showWord \? undefined : word\}/)
    expect(block, 'the glyph is no longer an image, so its label says nothing')
      .toMatch(/role=\{showWord \? undefined : "img"\}/)
  })

  it('goes quiet where the word is painted', () => {
    // With `showWord` the noun is on the screen and in the text; a labelled glyph
    // beside it would say it twice.
    expect(block, 'the glyph is labelled even where the word is drawn beside it')
      .toMatch(/aria-hidden=\{showWord \? "true" : undefined\}/)
  })

  it('leaves the figure as ordinary text', () => {
    // THE NUMBER IS NOT HIDDEN AND NOT LABELLED. It is read, copied and found in
    // the page exactly as drawn — which is the half an `sr-only` word broke, and
    // the half a wrapper label would have swallowed.
    expect(block, 'the figure has been hidden from the page it is drawn on')
      .toMatch(/<span className="tally-n">\{n\}<\/span>/)
  })
})

describe('the glyph rule reaches the screens it was asked for', () => {
  // A COARSE CHECK THAT IS STILL WORTH HAVING. These are the files the sweep
  // converted; if one loses its Tally the count went back to being a word, and
  // the locale table above would not notice because the WORD is still passed to
  // the Tally that no longer exists.
  const CONVERTED = [
    'works.jsx', 'MetadataPage.jsx', 'BinPage.jsx', 'StatsPage.jsx',
    'identity.jsx', 'identityLocal.jsx', 'Movies.jsx', 'Settings.jsx',
  ]
  // `sourcesUnder` rather than a readdir of my own: the repo has ONE walk over
  // its source tree, and a second one that quietly finds nothing is a guard that
  // passes while checking nothing.
  const files = sourcesUnder()
  it.each(CONVERTED)('%s still draws one', (file) => {
    const hit = files.find((rel) => rel === file || rel.endsWith(`/${file}`))
    expect(hit, `${file} is not in src any more`).toBeTruthy()
    expect(readSource(hit), `${file} no longer draws a Tally`).toMatch(/<Tally\b/)
  })
})
