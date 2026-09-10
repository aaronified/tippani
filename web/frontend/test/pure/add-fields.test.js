// The per-kind field spec, checked against what the owner actually signed off.
//
// THESE ARE NOT WORDING TESTS. Each case below is a rule the owner stated in their
// own words, and the assertion is on the FIELD KEYS a door offers — the thing that
// decides what a reader is asked for. A test that checked labels would pass while
// a proverb form asked who said it.
import { describe, expect, it } from 'vitest'
import {
  ALL_DOORS,
  QUOTE_KIND_DOORS,
  doorForBoard,
  fieldKeys,
  fieldsFor,
  showsField,
  splitPair,
} from '../../src/addFields.js'

// The globals, quoted from the owner's message so a later reader can check the
// table against the instruction rather than against this test's opinion of it:
//
//   "quote, note, tags, and colour always stays up … these fields will exist for
//    everyone."
//   "sticker goes hidden in 'show all fields' for all instances."
//   language: "it should be everywhere, behind show all."
const QUOTE_DOORS = [...QUOTE_KIND_DOORS, 'annotation', 'dialogue']

describe('the fields every kind of quote asks for', () => {
  it('always puts the quote, the note, the tags and the colour on the first screen', () => {
    const offenders = QUOTE_DOORS.flatMap((door) => {
      const { main } = fieldsFor(door, { mediaType: 'movie' })
      return ['quote', 'note', 'tags', 'color'].filter((f) => !main.includes(f)).map((f) => `${door}:${f}`)
    })
    expect(offenders).toEqual([])
  })

  it('always hides the sticker and the language behind Show all fields', () => {
    const offenders = QUOTE_DOORS.flatMap((door) => {
      const { main, more } = fieldsFor(door, { mediaType: 'movie' })
      return ['sticker', 'language'].filter((f) => main.includes(f) || !more.includes(f)).map((f) => `${door}:${f}`)
    })
    expect(offenders).toEqual([])
  })

  // "except for quotes, language & translation also stays hidden everywhere" — so
  // the translation leads on a standalone quote and hides on the two that hang off
  // a work. This is the one global with an exception in it, which is exactly why
  // it gets its own case.
  it('leads with the translation on a standalone quote and hides it on a work quote', () => {
    for (const door of QUOTE_KIND_DOORS) {
      expect(fieldsFor(door).main, door).toContain('translation')
    }
    for (const door of ['annotation', 'dialogue']) {
      const { main, more } = fieldsFor(door, { mediaType: 'movie' })
      expect(main, door).not.toContain('translation')
      expect(more, door).toContain('translation')
    }
  })

  // The instruction that had to be read twice: "character … goes to show all
  // fields" for a book, and "wherever character is applicable, that stays in main
  // screen" globally. Applicable = it is the medium's own locator.
  it('puts who-said-it on the first screen of a screen line and behind the fold on a book highlight', () => {
    for (const mediaType of ['movie', 'show', 'game']) {
      expect(fieldsFor('dialogue', { mediaType }).main, mediaType).toContain('character')
    }
    const book = fieldsFor('annotation')
    expect(book.main).not.toContain('character')
    expect(book.more).toContain('character')
  })

  it('files a standalone quote directly under the quote and who said it', () => {
    // The owner's, verbatim: "for quotes, board will always be just below quote
    // and spoken by/written by."
    for (const door of QUOTE_KIND_DOORS) {
      const { main } = fieldsFor(door)
      const board = main.indexOf('board')
      expect(board, `${door} does not offer a board`).toBeGreaterThan(-1)
      const before = main.slice(0, board)
      expect(before.every((f) => f === 'quote' || f === 'speaker'), `${door} puts ${before} above the board`).toBe(true)
    }
  })

  // A board is where a quote is FILED, and a work quote is filed by its work — so
  // offering one would be two answers to one question.
  it('never offers a board on a quote that already has a work', () => {
    for (const door of ['annotation', 'dialogue']) {
      expect(fieldKeys(door, { mediaType: 'movie' }), door).not.toContain('board')
    }
  })
})

describe('what each kind refuses to ask', () => {
  // The case the owner named first and the one that proves the exercise: "Hard
  // drop anything that is not relevant (writer of a movie, timestamp of a book,
  // speaker of a proverb, etc)."
  it('never asks a proverb who said it, when, or where', () => {
    for (const f of ['speaker', 'occasion', 'when', 'place', 'recipient', 'source_author']) {
      expect(showsField('proverb', f), f).toBe(false)
    }
  })

  it('never asks a book highlight for a timestamp, and never asks a film line for a chapter', () => {
    for (const f of ['timestamp', 'timestamp_end', 'season', 'episode', 'act', 'quest', 'dlc', 'speaker', 'occasion']) {
      expect(showsField('annotation', f), f).toBe(false)
    }
    for (const f of ['chapter', 'chapter_no', 'location', 'speaker', 'work_title']) {
      expect(showsField('dialogue', f, { mediaType: 'movie' }), f).toBe(false)
    }
  })

  // The server CLEARS a timestamp on a game (normalizeLocator, 0047/0070), so a
  // box for one would be a box whose value is thrown away without a word. This is
  // the one hard drop that is a server fact rather than a taste.
  it('never asks a game for a runtime, and never asks a film for an act', () => {
    for (const f of ['timestamp', 'timestamp_end', 'season', 'episode', 'episode_name']) {
      expect(showsField('dialogue', f, { mediaType: 'game' }), f).toBe(false)
    }
    for (const f of ['act', 'quest', 'dlc']) {
      expect(showsField('dialogue', f, { mediaType: 'movie' }), f).toBe(false)
    }
    // And a show keeps its episode locators while a film does not.
    for (const f of ['season', 'episode', 'episode_name']) {
      expect(showsField('dialogue', f, { mediaType: 'show' }), f).toBe(true)
      expect(showsField('dialogue', f, { mediaType: 'movie' }), f).toBe(false)
    }
  })

  it("drops an essay's occasion and its addressee, on the owner's word", () => {
    // "essay doesnt need occasion" and "drop useless items: like to for essay".
    expect(showsField('essay', 'occasion')).toBe(false)
    expect(showsField('essay', 'recipient')).toBe(false)
    // And its source author, which would be a second name for the one already in
    // `speaker`: an essay's source is the essay.
    expect(showsField('essay', 'source_author')).toBe(false)
    // What it does keep is the citation and the year.
    for (const f of ['work_title', 'locator', 'when']) {
      expect(fieldsFor('essay').main, f).toContain(f)
    }
  })

  it('gives a letter its addressee and its dateline, and buries the edition', () => {
    const { main, more } = fieldsFor('letter')
    expect(main).toContain('recipient')
    expect(main).toContain('place') // "Letter shows Place"
    // "letter: source title · source author : behind show all"
    expect(more).toContain('work_title')
    expect(more).toContain('source_author')
    expect(showsField('letter', 'region')).toBe(false)
  })

  it('gives a speech and a letter the source pair, because Socrates reaches us through Plato', () => {
    // The owner's case for the field existing at all.
    expect(showsField('speech', 'source_author')).toBe(true)
    expect(showsField('letter', 'source_author')).toBe(true)
    expect(showsField('speech', 'work_title')).toBe(true)
  })

  it('leads verse with its title, not an occasion, and keeps the occasion reachable', () => {
    // 0068: "it has a title rather than an occasion".
    for (const door of ['poem', 'song']) {
      const { main, more } = fieldsFor(door)
      expect(main, door).toContain('work_title')
      expect(main, door).not.toContain('occasion')
      // The owner chose to keep occasion and place rather than drop them.
      expect(more, door).toContain('occasion')
      expect(more, door).toContain('place')
      expect(more, door).toContain('locator') // a stanza or a line
    }
    // A poem and a song ask the same things: kept as two entries so either can
    // diverge later, but they must not have drifted by accident today.
    expect(fieldKeys('poem')).toEqual(fieldKeys('song'))
  })

  // "other" means the reader could not say what this is, so nothing about it can
  // be predicted — and a form that hard-dropped a field there would be predicting.
  it('hard-drops nothing at all on "other"', () => {
    const everyField = new Set(QUOTE_KIND_DOORS.flatMap((d) => fieldKeys(d)))
    const other = new Set(fieldKeys('other'))
    expect([...everyField].filter((f) => !other.has(f))).toEqual([])
  })
})

describe('the table itself', () => {
  it('places every field once, so nothing draws twice', () => {
    const offenders = []
    for (const door of ALL_DOORS) {
      for (const mediaType of door === 'dialogue' ? ['movie', 'show', 'game'] : [undefined]) {
        const keys = fieldKeys(door, { mediaType })
        const seen = new Set()
        for (const k of keys) {
          if (seen.has(k)) offenders.push(`${door}${mediaType ? ':' + mediaType : ''}:${k}`)
          seen.add(k)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('hands back frozen lists, so one form cannot reorder the next', () => {
    const { main } = fieldsFor('proverb')
    expect(Object.isFrozen(main)).toBe(true)
    expect(fieldsFor('proverb').main).toEqual(main)
  })

  it('reads the pairs the owner asked to share a line', () => {
    // "location and chapter no. will share one line."
    expect(fieldsFor('annotation').main).toContain('chapter_no+location')
    expect(splitPair('chapter_no+location')).toEqual(['chapter_no', 'location'])
    expect(splitPair('quote')).toEqual(['quote'])
    // And the flattened view is what a payload builder reads.
    expect(fieldKeys('annotation')).toContain('location')
    expect(fieldKeys('annotation')).toContain('chapter_no')
  })

  it('treats an unknown door as offering nothing rather than throwing', () => {
    // The chooser can be reached with no door chosen, and a form asked for fields
    // before a door is picked must render empty rather than crash the surface.
    expect(fieldsFor(undefined)).toEqual({ main: [], more: [] })
    expect(fieldsFor('nonsense')).toEqual({ main: [], more: [] })
    expect(showsField('nonsense', 'quote')).toBe(false)
  })

  it('lets a proverb board answer the kind question, and a plain board ask it', () => {
    // 0037 gives a board two kinds and argues against a third, so exactly one
    // board kind can skip the chooser.
    expect(doorForBoard({ kind: 'proverb' })).toBe('proverb')
    expect(doorForBoard({ kind: 'plain' })).toBe(null)
    expect(doorForBoard(null)).toBe(null)
    expect(doorForBoard({})).toBe(null)
  })
})
