// BOARD AND CATEGORY NAME TWO DIFFERENT THINGS, AND THE OWNER SAID WHICH.
//
// The ruling, 13 September, verbatim:
//
//   "Category - colour categories
//    Board - the work equivalent for the quotes screen (like Bengali Proverbs
//    in the backup)"
//
// So a BOARD is what a standalone quote is filed on — it stands to a quote
// exactly as a WORK stands to a highlight, and "Bengali Proverbs" is one. A
// CATEGORY is a colour. Neither word is a loose synonym for "a screen with a
// grid on it", which is what the interface had drifted into: the phone dock's
// menu holding Library, Catalogue, Quotes and Anthologies was labelled
// "Boards", and three of those four are not boards at all.
//
// WHY A TEST AND NOT JUST A FIX. A vocabulary ruling decays the moment somebody
// writes one more sentence, because nothing about a wrong word fails. The
// schema cannot drift — `boards` is a table and `utterances.board_id` points at
// it — so the only place this can go wrong again is prose, and prose is what
// this file reads.
//
// A COVER IS NOT EVIDENCE, and the first draft of this scan thought it was.
// `settings.languages.card.info.body` says a language's mark "stands in for that
// language on a board's cover" — which is CORRECT: it is about a proverb, and a
// proverb lives on a board, and a board has a cover exactly as a book does. The
// scan flagged it because "cover" sat within forty characters of "board". A word
// shared by both things cannot tell them apart, so only the work-only nouns are
// evidence here.
//
// WHAT IT DOES NOT CLAIM. `BoardHead`/`boardHead.jsx` is the scaffold Library,
// Catalogue and Quotes all render through, and it keeps its name: renaming a
// component is a refactor the ruling did not ask for, and an internal name is
// not a word the reader meets. This guards the words a reader actually SEES.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SRC } from '../src-files.js'

const I18N = join(SRC, '..', '..', '..', 'internal', 'i18n')
const EN = readFileSync(join(I18N, 'en.txt'), 'utf8')
const BN = readFileSync(join(I18N, 'bn.txt'), 'utf8')

// Every `key = value` pair, as the reader would meet the value.
function entries(txt) {
  return txt.split('\n')
    .map((l) => l.match(/^([a-z][A-Za-z0-9.-]*) = (.*)$/))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2] }))
}

const EN_ENTRIES = entries(EN)

// "board" as a WORD, not as a piece of one — `clipboard`, `Dashboard` and
// `keyboard` all contain it and none of them mean this.
const BOARD_WORD = /(?<![a-z])boards?(?![a-z])/i

describe('the words the ruling settled', () => {
  it('never calls the Library or the Catalogue a board', () => {
    // The screens have their own names — `nav.tab.library.label` is "Library"
    // and `nav.tab.movies.label` is "Catalogue" — so there was never a reason
    // to borrow this one.
    const offenders = EN_ENTRIES.filter(({ value }) => {
      if (!BOARD_WORD.test(value)) return false
      return /\b(Library|Catalogue) board\b/i.test(value)
        || /\bboard\b[^.]{0,40}\b(book|film|show|title|shelf)s?\b/i.test(value)
        || /\b(book|film|show|title)s?\b[^.]{0,40}\bon its board\b/i.test(value)
    }).map(({ key }) => key)
    expect(offenders, 'a string calls the Library or the Catalogue a board').toEqual([])
  })

  it('and this scan can fail, so an empty result means something', () => {
    // THE FLOOR. Every assertion above compares against [], which a scan that
    // matches nothing also satisfies. These are the exact shapes that were in
    // en.txt before the ruling was applied.
    const planted = [
      { key: 'planted.one', value: 'never on the Library board or on a quote' },
      { key: 'planted.two', value: 'Right-click a book, film or show on its board — long-press on a phone' },
    ]
    for (const row of planted) {
      const hit = BOARD_WORD.test(row.value) && (
        /\b(Library|Catalogue) board\b/i.test(row.value)
        || /\bboard\b[^.]{0,40}\b(book|film|show|title|shelf)s?\b/i.test(row.value)
        || /\b(book|film|show|title)s?\b[^.]{0,40}\bon its board\b/i.test(row.value)
      )
      expect(hit, `the scan cannot see "${row.value.slice(0, 40)}…"`).toBe(true)
    }
  })

  it('keeps the dock menu over four sections named for what it holds', () => {
    // It holds Library, Catalogue, Quotes and Anthologies (SECTIONS, routes.js).
    // Only one of those four contains boards.
    expect(EN, 'the sections menu is labelled again with a word for one of its four')
      .not.toMatch(/^shell\.dock\.boards\.label/m)
    expect(EN, 'the sections menu lost its label').toMatch(/^shell\.dock\.sections\.label = Sections$/m)
    expect(BN, 'the Bengali sections menu lost its label').toMatch(/^shell\.dock\.sections\.label = /m)
  })

  it('and the app asks for the key that exists', () => {
    // A renamed key with a live call site to the old name renders a humanised
    // placeholder rather than failing, which is the hole `locale-complete`
    // leaves open — so this asks directly.
    const app = readFileSync(join(SRC, 'App.jsx'), 'utf8')
    expect(app, 'App.jsx still asks for the retired key').not.toContain('shell.dock.boards.label')
    expect(app, 'App.jsx does not ask for the sections label').toContain("t('shell.dock.sections.label')")
  })
})

describe('category means a colour, and only a colour', () => {
  it('every category string in the catalogue is about colour', () => {
    // `vocab.category.*` names the six colour slots; `settings.colours.*` and
    // `stats.colours.*` are the panels that rename and count them. If the word
    // ever spreads to mean a board or a shelf, this is where it shows.
    const cat = EN_ENTRIES.filter(({ value }) => /(?<![a-z])categor(y|ies)(?![a-z])/i.test(value))
    expect(cat.length, 'no category strings found — this guard is reading nothing').toBeGreaterThan(5)
    const stray = cat.filter(({ key, value }) =>
      /\bcategor(y|ies)\b/i.test(value) && /\b(board|shelf|shelves|work|book|film)s?\b/i.test(value))
      .map(({ key }) => key)
    expect(stray, 'a category string names something that is not a colour').toEqual([])
  })
})
