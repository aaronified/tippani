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
const CHANGELOG = readFileSync(join(I18N, '..', '..', 'CHANGELOG.md'), 'utf8')

// Every `key = value` pair, as the reader would meet the value.
function entries(txt) {
  return txt.split('\n')
    .map((l) => l.match(/^([a-z][A-Za-z0-9.-]*) = (.*)$/))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2] }))
}

const EN_ENTRIES = entries(EN)
const BN_ENTRIES = entries(BN)

// AND THE CHANGELOG, WHICH IS PROSE A READER MEETS AND WAS NOT BEING READ. The
// ruling landed with five entries in this very section calling the Library "a
// book's board" — one of them written an hour after the bullet announcing it.
//
// THE UNRELEASED SECTION ONLY, and that is the whole judgement here: a shipped
// entry describes what the app did when it shipped, and rewriting it would make
// the log a worse record of its own history. What is unreleased is still a
// promise, so it is still editable and still has to be right.
const UNRELEASED = (() => {
  const head = CHANGELOG.indexOf('## [Unreleased]')
  if (head < 0) return ''
  const next = CHANGELOG.indexOf('\n## [', head + 5)
  return CHANGELOG.slice(head, next < 0 ? undefined : next)
})()

// "board" as a WORD, not as a piece of one — `clipboard`, `Dashboard` and
// `keyboard` all contain it and none of them mean this.
const BOARD_WORD = /(?<![a-z])boards?(?![a-z])/i

// THE OFFENCE IN ONE FUNCTION, so the floor below runs the same code the ceiling
// does. Two copies of a predicate is how a floor comes to prove a pattern that
// nothing actually uses.
//
// THREE SHAPES, AND THEY ARE DIRECTIONAL ON PURPOSE. A work noun merely NEAR the
// word "board" is not evidence, and today's en.txt proves it twice: the widened
// scan that treats proximity as evidence flags "shows the whole board"
// (`quotes.help.languages.more`, where `shows` is a verb) and "shelf — a board"
// (`quotes.help.delete-board.more`, which calls a board a shelf — the ruling's
// own analogy, not a breach of it). Both are correct strings. That is the same
// lesson as the cover above, and it is why (c) asks for a preposition rather
// than for nearness.
// THE STRUCTURAL HALF, split out because it is the only half long prose can bear.
// (a) and (d) NAME the thing — a screen's name or a work noun glued straight onto
// the word. (b) and (c) below are proximity, and proximity is informative in a UI
// string, which is one sentence a reader meets whole, and NOT in a changelog
// paragraph, which is many. Turned on the changelog, (b) and (c) reported five
// entries of which THREE were correct: a language offered "on a film's own
// settings and on a board", a bug report saying "a board and an anthology were
// treated as a book", and a sentence about the Board menu beside the word book.
// Each is right, and each sat within forty characters of the other word. That is
// the cover lesson again, one file along.
function namesAScreenABoard(value) {
  if (!BOARD_WORD.test(value)) return false
  // (a) the screen itself, named as a board.
  return /\b(Library|Catalogue) board\b/i.test(value)
    // (d) THE POSSESSIVE, AND BARE ADJACENCY, WHICH NEED NO PREPOSITION AT ALL —
    // "a book's board", "the titles board". Added because a rater found one in
    // prose written an hour after the bullet announcing the ruling, and every
    // pattern here missed it: no screen name, no work noun after `board`, and
    // nothing between the two. Both apostrophes, because an editor supplies the
    // curly one.
    || /\b(book|film|show|title)s?(?:[’']s?)?\s+board\b/i.test(value)
}

function callsAScreenABoard(value) {
  if (!BOARD_WORD.test(value)) return false
  return namesAScreenABoard(value)
    // (b) a board said to HOLD works.
    || /\bboard\b[^.]{0,40}\b(book|film|show|title|shelf)s?\b/i.test(value)
    // (c) the same claim the other way round — a work said to SIT on one. This
    // used to be `on its board` and nothing else, so every other spelling of
    // one idea walked past it.
    || /\b(book|film|show|title)s?\b[^.]{0,25}\b(on|in|of|from|to)\s+(its|their|a|an|the)\s+board\b/i.test(value)
}

// THE BENGALI HALF, AND IT IS A DIFFERENT SCAN RATHER THAN A TRANSLATED ONE.
// This file read en.txt only for a revision, which left the ruling unguarded in
// half the app: a Bengali reader meets bn.txt and nothing looked at it.
//
// The English shapes do not transfer, because Bengali marks the relation with a
// genitive ending glued to the noun — গ্রন্থাগারের বোর্ড, "the Library's board" —
// rather than with word order and a preposition. Nor does proximity: the only two
// strings in bn.txt holding বোর্ড beside a work noun are both CORRECT.
// `quotes.help.boards.what` draws the ruling's own analogy (the Library is a list
// of books as this screen is a list of boards) and `common.help.selecting.more`
// is two clauses about two different selections. A scan wrong on every string it
// matches is a scan worth nothing, so this asks for the genitive.
//
// কীবোর্ড is "keyboard" and ক্লিপবোর্ড is "clipboard". Both END in বোর্ড and
// neither is one — Bengali writes no word boundary a regex could use here, so
// both are excluded by name instead.
const BN_BOARD = '(?<!কী)(?<!ক্লিপ)বোর্ড'
// গ্রন্থাগার is the Library, ক্যাটালগ the Catalogue.
const BN_SCREEN = new RegExp(`(গ্রন্থাগার|ক্যাটালগ)(ের|র)?\\s*${BN_BOARD}`)
// বই book, সিনেমা and চলচ্চিত্র film, শো show.
const BN_WORK = new RegExp(`(বই|সিনেমা|শো|চলচ্চিত্র)(য়ের|ের|র)?\\s*${BN_BOARD}`)
const callsAScreenABoardBn = (value) => BN_SCREEN.test(value) || BN_WORK.test(value)

describe('the words the ruling settled', () => {
  it('never calls the Library or the Catalogue a board', () => {
    // The screens have their own names — `nav.tab.library.label` is "Library"
    // and `nav.tab.movies.label` is "Catalogue" — so there was never a reason
    // to borrow this one.
    const offenders = EN_ENTRIES.filter(({ value }) => callsAScreenABoard(value)).map(({ key }) => key)
    expect(offenders, 'an English string calls the Library or the Catalogue a board').toEqual([])
  })

  it("and the changelog's unreleased entries say it too", () => {
    // Read a PARAGRAPH at a time rather than a line: the file is hard-wrapped, so
    // "a book's" can end one line and "board" begin the next, and a line-by-line
    // scan would miss exactly the shape that got past the first version of this.
    const offenders = UNRELEASED.split(/\n\s*\n/)
      .map((para) => para.replace(/\s+/g, ' ').trim())
      .filter((para) => para && namesAScreenABoard(para))
      .map((para) => para.slice(0, 70) + '…')
    expect(offenders, 'an unreleased changelog entry calls the Library or the Catalogue a board').toEqual([])
  })

  it('and the changelog scan is reading something', () => {
    // A section it could not find would be an empty string, and an empty string
    // satisfies the assertion above without looking at a word.
    expect(UNRELEASED.length, 'the [Unreleased] section was not found in CHANGELOG.md').toBeGreaterThan(1000)
    expect(namesAScreenABoard("The bulk editor on a book's board has offered Chapter #"),
      'the changelog scan cannot see the exact line a rater found').toBe(true)
    expect(namesAScreenABoard('Every tile on the Library board carried an eager img'),
      'the changelog scan cannot see the plainest spelling of all').toBe(true)
    // AND IT MUST NOT FIRE ON THE THREE CORRECT PARAGRAPHS proximity flagged.
    for (const value of [
      'a language shows on a film\u2019s own settings and on a board',
      'a board and an anthology were treated as a book by the card',
    ]) {
      expect(namesAScreenABoard(value), `the changelog scan flags correct prose: "${value}"`).toBe(false)
    }
  })

  it('and the Bengali says the same, in its own grammar', () => {
    const offenders = BN_ENTRIES.filter(({ value }) => callsAScreenABoardBn(value)).map(({ key }) => key)
    expect(offenders, 'a Bengali string calls the Library or the Catalogue a board').toEqual([])
  })

  it('and both scans can fail, so an empty result means something', () => {
    // THE FLOOR. Every assertion above compares against [], which a scan that
    // matches nothing also satisfies. The first two English rows are the exact
    // shapes that were in en.txt before the ruling was applied; the rest are the
    // spellings a rater got past the narrower version of this file.
    const en = [
      'never on the Library board or on a quote',
      'Right-click a book, film or show on its board — long-press on a phone',
      'Every book on the board can be opened from here',
      'each film sits on a board of its own',
      'Open any title on the board',
      "The bulk editor on a book's board has offered Chapter #",
      'A film’s board drew two columns',
      'the titles board',
    ]
    for (const value of en) {
      expect(callsAScreenABoard(value), `the English scan cannot see "${value.slice(0, 44)}…"`).toBe(true)
    }

    const bn = [
      'ক্যাটালগ বোর্ডে একটা সিনেমা খুঁজুন',
      'গ্রন্থাগারের বোর্ড থেকে বইটা সরান',
      'বইয়ের বোর্ডে ডান-ক্লিক করুন',
    ]
    for (const value of bn) {
      expect(callsAScreenABoardBn(value), `the Bengali scan cannot see "${value.slice(0, 24)}…"`).toBe(true)
    }

    // AND THE STRINGS IT MUST NOT FIRE ON, which is the other half of a floor
    // and the half this file has already got wrong once. A guard that reports a
    // correct sentence teaches the next reader to stop reading its output.
    for (const value of [
      'Group by Language then breaks the board into a section per language',
      'Nothing is deleted with the shelf — a board is where you filed something',
    ]) {
      expect(callsAScreenABoard(value), `the English scan flags a correct string: "${value.slice(0, 44)}…"`).toBe(false)
    }
    for (const value of ['কীবোর্ড শর্টকাট', 'ক্লিপবোর্ডে কপি করুন']) {
      expect(callsAScreenABoardBn(value), `the Bengali scan reads a keyboard as a board: "${value}"`).toBe(false)
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
