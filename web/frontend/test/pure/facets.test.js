// The `field:value` grammar — the client half of a feature whose server half
// deliberately does not know the syntax exists.
//
// These are the assertions that keep the two halves honest. The server takes
// `&tag=stoicism` and has never heard of a colon; if this file stops producing
// what search_facets.go accepts, nothing errors — the search just quietly means
// something other than what the chips say it means.

import { describe, expect, it } from 'vitest'
import {
  addChip,
  BOARD_ONLY_FACETS,
  chipText,
  FACET_NAMES,
  facetField,
  facetOptions,
  facetParams,
  facetValue,
  facetValues,
  liftFacet,
  makeChip,
  narrowFacetOptions,
  publishSearchSeed,
  readFacetDraft,
  removeChipAt,
  sameChip,
  searchQueryString,
  seedableChips,
  takeSearchSeed,
  unescapeFacetColons,
  withFacet,
  withFacetValues,
  workSeedChip,
} from '../../src/facets.js'

const VOCAB = {
  tags: ['death', 'dawn', 'stoicism', 'gardening'],
  genres: ['Fantasy', 'Science Fiction'],
  series: ['Earthsea', 'Hainish'],
  authors: ['Neil Gaiman', 'Terry Pratchett', 'Ursula K. Le Guin'],
  speakers: ['Rabindranath Tagore'],
  actors: ['Humphrey Bogart'],
  directors: ['Michael Curtiz'],
  shelves: ['reading', 'completed'],
  colours: [
    { key: 'yellow', name: 'yellow' },
    { key: 'blue', name: 'doubt' },
    { key: 'pink', name: 'joy' },
  ],
}

describe('the field registry', () => {
  // The names have to agree with the ones parseSearchFacets accepts, or a chip
  // renders happily and comes back a 400.
  it('names exactly the fields the server takes', () => {
    expect(FACET_NAMES).toEqual([
      'tag', 'colour', 'author', 'speaker', 'actor', 'director',
      'genre', 'series', 'shelf', 'year', 'favourite', 'note', 'wishlist',
      'book', 'movie',
    ])
  })

  it('records which facets intersect and which union', () => {
    // The plan's rule, and the one readers ask about: two tags narrow, two
    // colours widen.
    expect(facetField('tag').combine).toBe('and')
    expect(facetField('genre').combine).toBe('and')
    expect(facetField('colour').combine).toBe('or')
    expect(facetField('author').combine).toBe('or')
  })

  it('is case-insensitive about a field name', () => {
    expect(facetField('TAG').name).toBe('tag')
    expect(facetField('Colour').name).toBe('colour')
  })

  it('does not invent fields', () => {
    expect(facetField('tags')).toBe(null)
    expect(facetField('')).toBe(null)
    expect(facetField(undefined)).toBe(null)
  })
})

describe('readFacetDraft', () => {
  it('sees nothing in ordinary free text', () => {
    expect(readFacetDraft('')).toBe(null)
    expect(readFacetDraft('the obstacle is the way')).toBe(null)
  })

  it('opens on a known field and a colon', () => {
    expect(readFacetDraft('tag:')).toEqual({ field: 'tag', value: '', start: 0 })
    expect(readFacetDraft('tag:sto')).toEqual({ field: 'tag', value: 'sto', start: 0 })
  })

  // An unknown field is not a facet. `note:` IS one, but `notes:` is somebody
  // typing about their notes and must stay free text.
  it('ignores a colon after a word that is not a field', () => {
    expect(readFacetDraft('notes:x')).toBe(null)
    expect(readFacetDraft('http://example.com')).toBe(null)
  })

  it('requires a word boundary before the field', () => {
    // "vintage:" ends in "tag:" and is not a facet.
    expect(readFacetDraft('vintage:1970')).toBe(null)
  })

  it('keeps the free text that came before it', () => {
    const d = readFacetDraft('kestrel tag:sto')
    expect(d).toEqual({ field: 'tag', value: 'sto', start: 8 })
  })

  // THE REASON THE DRAFT RUNS TO THE END OF THE STRING. Splitting on whitespace
  // would make a two-word value unreachable: the space after "Le" would end the
  // token and the draft would be `author:Le` forever.
  it('lets a value contain spaces', () => {
    expect(readFacetDraft('author:Le Guin').value).toBe('Le Guin')
    expect(readFacetDraft('author:Ursula K. Le Guin').value).toBe('Ursula K. Le Guin')
  })

  it('takes the last field when there are two', () => {
    const d = readFacetDraft('tag:death colour:do')
    expect(d.field).toBe('colour')
    expect(d.value).toBe('do')
  })

  it('reads a capitalised field name', () => {
    expect(readFacetDraft('Tag:sto').field).toBe('tag')
  })

  // `book` and `movie` are chip fields but not GRAMMAR: they are seeded from a
  // work's own page and carry an id the reader has no way to know. There is no
  // vocabulary of titles, so typing one could only ever open an empty dropdown
  // — and leaving them in the grammar would make `movie:blade runner` a draft
  // rather than the search for Blade Runner that it plainly is.
  it('does not read the seeded work fields as typed', () => {
    expect(readFacetDraft('book:')).toBe(null)
    expect(readFacetDraft('movie:blade runner')).toBe(null)
    expect(readFacetDraft('the book: of the new sun')).toBe(null)
    // They are still valid chip fields, and still go on the wire.
    expect(facetField('book').name).toBe('book')
    expect(facetParams([{ field: 'book', value: '42', label: 'x' }])).toEqual([['book', '42']])
  })
})

describe('escaping the colon', () => {
  // THE GRAMMAR HAS TO HAVE A WAY OUT OF ITSELF. Thirteen ordinary English words
  // became operators the moment this shipped — `note:`, `series:`, `year:` are
  // things a reader writes in a note, and "author: unknown" is a phrase somebody
  // could well be searching their own library for. Without an escape those are
  // unsearchable, and unsearchable SILENTLY: the box opens a dropdown and the
  // words never reach the query.
  it('takes a backslash before the colon as "these are just words"', () => {
    expect(readFacetDraft('note\\:')).toBe(null)
    expect(readFacetDraft('note\\: to self')).toBe(null)
    expect(readFacetDraft('author\\: unknown')).toBe(null)
  })

  it('escapes only the one it is attached to', () => {
    // An escaped field does not turn the rest of the box back into plain text.
    const d = readFacetDraft('note\\: to self tag:sto')
    expect(d.field).toBe('tag')
    expect(d.value).toBe('sto')
  })

  // An escaped field is not a boundary either. The draft still runs to the end
  // of the string, so an escaped colon typed after an open one is part of the
  // value being typed — which is the same rule as everywhere else, and the
  // alternative (an escape that silently ends the draft) would be a second rule
  // to learn for no gain.
  it('does not end an open draft', () => {
    const d = readFacetDraft('tag:sto note\\:')
    expect(d.field).toBe('tag')
    expect(d.value).toBe('sto note\\:')
  })

  it('puts the colon back before the words are searched', () => {
    expect(unescapeFacetColons('note\\: to self')).toBe('note: to self')
    expect(unescapeFacetColons('author\\: unknown')).toBe('author: unknown')
  })

  // A backslash the reader typed for its own sake is a character they mean to
  // look for, so only the ones in front of a known field's colon come off.
  it('leaves every other backslash alone', () => {
    expect(unescapeFacetColons('c:\\\\windows')).toBe('c:\\\\windows')
    expect(unescapeFacetColons('a \\\\ b')).toBe('a \\\\ b')
    expect(unescapeFacetColons('notes\\: plural')).toBe('notes\\: plural')
  })

  it('is a no-op on text with nothing to unescape', () => {
    expect(unescapeFacetColons('the obstacle is the way')).toBe('the obstacle is the way')
    expect(unescapeFacetColons('')).toBe('')
    expect(unescapeFacetColons(null)).toBe('')
  })
})

describe('liftFacet — the token leaves the box', () => {
  // This is the moment the plan describes: choosing a value lifts the token out
  // of the box into a chip beneath it. What is left behind is the free text.
  it('empties the box when the facet was the whole of it', () => {
    expect(liftFacet('tag:sto', readFacetDraft('tag:sto'))).toBe('')
  })

  it('leaves the preceding free text, without a trailing space', () => {
    expect(liftFacet('kestrel tag:sto', readFacetDraft('kestrel tag:sto'))).toBe('kestrel')
  })

  it('leaves a two-word value nothing behind either', () => {
    const text = 'author:Le Guin'
    expect(liftFacet(text, readFacetDraft(text))).toBe('')
  })

  it('is a no-op without a draft', () => {
    expect(liftFacet('plain words', null)).toBe('plain words')
  })
})

describe('facetOptions', () => {
  it('offers the library vocabulary for a plain field', () => {
    expect(facetOptions('tag', VOCAB)).toEqual([
      { value: 'death', label: 'death' },
      { value: 'dawn', label: 'dawn' },
      { value: 'stoicism', label: 'stoicism' },
      { value: 'gardening', label: 'gardening' },
    ])
  })

  // The 1.7.1 rename, and the reason the vocabulary endpoint returns pairs: the
  // chip must read `colour:doubt` while the query sends `blue`.
  it('separates a colour name from the word it is stored as', () => {
    expect(facetOptions('colour', VOCAB)).toEqual([
      { value: 'yellow', label: 'yellow' },
      { value: 'blue', label: 'doubt' },
      { value: 'pink', label: 'joy' },
    ])
  })

  it('offers yes and no for the flags', () => {
    for (const f of ['favourite', 'note', 'wishlist']) {
      expect(facetOptions(f, VOCAB).map((o) => o.value)).toEqual(['yes', 'no'])
    }
  })

  // A year has no vocabulary and cannot have one, so the dropdown offers back
  // what was typed — a confirmation rather than a list.
  it('offers a year back to you once it is a number', () => {
    expect(facetOptions('year', VOCAB, '1974')).toEqual([{ value: '1974', label: '1974' }])
    expect(facetOptions('year', VOCAB, '19')).toEqual([{ value: '19', label: '19' }])
    expect(facetOptions('year', VOCAB, '')).toEqual([])
    expect(facetOptions('year', VOCAB, 'nineteen')).toEqual([])
  })

  it('survives a vocabulary that has not arrived yet', () => {
    expect(facetOptions('tag', {})).toEqual([])
    expect(facetOptions('tag', undefined)).toEqual([])
  })

  it('offers nothing for a field that does not exist', () => {
    expect(facetOptions('nonsense', VOCAB)).toEqual([])
  })
})

describe('narrowFacetOptions', () => {
  const tags = facetOptions('tag', VOCAB)
  const authors = facetOptions('author', VOCAB)
  const labels = (os) => os.map((o) => o.label)

  it('offers everything before you type', () => {
    expect(labels(narrowFacetOptions(tags, ''))).toEqual(['death', 'dawn', 'stoicism', 'gardening'])
  })

  it('narrows on a prefix', () => {
    expect(labels(narrowFacetOptions(tags, 'sto'))).toEqual(['stoicism'])
    expect(labels(narrowFacetOptions(tags, 'da'))).toEqual(['dawn'])
    // "gardening" contains "de", so it comes too — behind the word that starts
    // with it.
    expect(labels(narrowFacetOptions(tags, 'de'))).toEqual(['death', 'gardening'])
  })

  // A single letter reaches the substring rank too, and the order it comes back
  // in is the whole ranking on display: the two words that START with d, in
  // vocabulary order, then the one that merely contains one.
  it('offers prefixes before substrings', () => {
    expect(labels(narrowFacetOptions(tags, 'd'))).toEqual(['death', 'dawn', 'gardening'])
  })

  it('is case- and accent-insensitive', () => {
    expect(labels(narrowFacetOptions(tags, 'STO'))).toEqual(['stoicism'])
    expect(labels(narrowFacetOptions(authors, 'ursula'))).toEqual(['Ursula K. Le Guin'])
  })

  // A name is several words and the reader types the memorable one.
  it('matches a prefix of any word, not only the first', () => {
    expect(labels(narrowFacetOptions(authors, 'guin'))).toEqual(['Ursula K. Le Guin'])
    expect(labels(narrowFacetOptions(authors, 'prat'))).toEqual(['Terry Pratchett'])
  })

  it('tolerates one typo', () => {
    expect(labels(narrowFacetOptions(tags, 'stoicsm'))).toEqual(['stoicism'])
    expect(labels(narrowFacetOptions(tags, 'gardning'))).toEqual(['gardening'])
    expect(labels(narrowFacetOptions(authors, 'gaimen'))).toEqual(['Neil Gaiman'])
  })

  // THE RANKING GUARANTEE, and the reason this function ranks rather than
  // filters. "deth" is one edit from "death" and a literal prefix of
  // "dethrone". A flat "prefix OR within budget" filter would return them in
  // vocabulary order and let the typo-correction win by accident of sorting.
  // A word that STARTS with what you typed must never sit below a word that
  // merely resembles it — you can always type one more letter to reach the
  // fuzzy one, and you cannot type your way out of a list that reordered itself.
  it('puts an exact prefix above a fuzzy match on a different word', () => {
    const os = [{ value: 'a', label: 'death' }, { value: 'b', label: 'dethrone' }]
    expect(labels(narrowFacetOptions(os, 'deth'))).toEqual(['dethrone', 'death'])
  })

  it('puts a prefix above a substring', () => {
    const os = [{ value: 'a', label: 'undeath' }, { value: 'b', label: 'death' }]
    expect(labels(narrowFacetOptions(os, 'death'))).toEqual(['death', 'undeath'])
  })

  // Two characters is too little signal to correct: at that length almost every
  // option in a library is one edit away, so the budget is zero and only real
  // prefixes and substrings survive.
  it('forgives nothing on a two-character stub', () => {
    expect(labels(narrowFacetOptions(tags, 'xy'))).toEqual([])
  })

  it('offers nothing rather than everything when nothing matches', () => {
    expect(narrowFacetOptions(tags, 'zzzzzzzz')).toEqual([])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ value: `t${i}`, label: `tag${i}` }))
    expect(narrowFacetOptions(many, 'tag')).toHaveLength(8)
    expect(narrowFacetOptions(many, '', 3)).toHaveLength(3)
  })

  it('narrows a renamed colour by its NAME, not its storage word', () => {
    const colours = facetOptions('colour', VOCAB)
    expect(labels(narrowFacetOptions(colours, 'dou'))).toEqual(['doubt'])
    // The stored word is not what is on screen, so it is not what is searched.
    expect(labels(narrowFacetOptions(colours, 'blu'))).toEqual([])
  })
})

describe('chips', () => {
  it('carries the wire value and the visible label separately', () => {
    const chip = makeChip('colour', { value: 'blue', label: 'doubt' })
    expect(chip).toEqual({ field: 'colour', value: 'blue', label: 'doubt' })
    expect(chipText(chip)).toBe('colour:doubt')
    expect(facetParams([chip])).toEqual([['colour', 'blue']])
  })

  it('defaults the label to the value when there is only one of them', () => {
    expect(makeChip('tag', { value: 'stoicism' }).label).toBe('stoicism')
  })

  it('compares by wire value, never by label', () => {
    const a = { field: 'colour', value: 'blue', label: 'doubt' }
    const b = { field: 'colour', value: 'blue', label: 'the blue one' }
    expect(sameChip(a, b)).toBe(true)
    expect(sameChip(a, { field: 'colour', value: 'pink', label: 'doubt' })).toBe(false)
  })

  it('refuses to add the same chip twice', () => {
    const one = [{ field: 'tag', value: 'stoicism', label: 'stoicism' }]
    expect(addChip(one, { field: 'tag', value: 'stoicism', label: 'stoicism' })).toBe(one)
    expect(addChip(one, { field: 'tag', value: 'death', label: 'death' })).toHaveLength(2)
  })

  it('removes by position, so two chips of one field stay independent', () => {
    const chips = [
      { field: 'colour', value: 'blue', label: 'doubt' },
      { field: 'colour', value: 'pink', label: 'joy' },
    ]
    expect(removeChipAt(chips, 0)).toEqual([chips[1]])
  })
})

describe('one field of a chip list', () => {
  // These are what let the board's filter sheet keep its checkboxes over a chip
  // list: each control still gets a value and a setter of the shape it always
  // took, with one object underneath all of them.
  const chips = [
    { field: 'genre', value: 'Fantasy', label: 'Fantasy' },
    { field: 'shelf', value: 'reading', label: 'reading' },
    { field: 'shelf', value: 'paused', label: 'paused' },
  ]

  it('reads a single value, or nothing', () => {
    expect(facetValue(chips, 'genre')).toBe('Fantasy')
    expect(facetValue(chips, 'series')).toBe('')
    expect(facetValue([], 'genre')).toBe('')
    expect(facetValue(undefined, 'genre')).toBe('')
  })

  it('reads every value of a multi-valued field', () => {
    expect(facetValues(chips, 'shelf')).toEqual(['reading', 'paused'])
    expect(facetValues(chips, 'genre')).toEqual(['Fantasy'])
    expect(facetValues([], 'shelf')).toEqual([])
  })

  it('sets a field, replacing what was there', () => {
    expect(withFacet(chips, 'genre', 'History').filter((c) => c.field === 'genre'))
      .toEqual([{ field: 'genre', value: 'History', label: 'History' }])
  })

  it('adds a field that was not there', () => {
    expect(withFacet([], 'genre', 'Fantasy'))
      .toEqual([{ field: 'genre', value: 'Fantasy', label: 'Fantasy' }])
  })

  // Every "All" option and every un-pressed chip sends the empty string, so it
  // has to mean "take this off" rather than "match nothing".
  it('removes a field when the value goes empty', () => {
    expect(withFacet(chips, 'genre', '').some((c) => c.field === 'genre')).toBe(false)
    expect(withFacet(chips, 'shelf', '').some((c) => c.field === 'shelf')).toBe(false)
  })

  // Rebuilding the list instead would send a changed genre to the end of the
  // row, which moves the × the reader was aiming at.
  it('keeps a field in its place when its value changes', () => {
    expect(withFacet(chips, 'genre', 'History').map((c) => c.field))
      .toEqual(['genre', 'shelf', 'shelf'])
  })

  it('sets every value of a multi-valued field at once, in place', () => {
    const next = withFacetValues(chips, 'shelf', ['completed'])
    expect(next.map((c) => `${c.field}:${c.value}`)).toEqual(['genre:Fantasy', 'shelf:completed'])
  })

  it('empties a multi-valued field with an empty list', () => {
    expect(withFacetValues(chips, 'shelf', []).map((c) => c.field)).toEqual(['genre'])
    expect(withFacetValues(chips, 'shelf', undefined).map((c) => c.field)).toEqual(['genre'])
  })
})

describe('seeding from where you were', () => {
  // The board holds chips natively now, so the whole board-to-search mapping is
  // dropping the three the server cannot answer.
  it('hands the search box the board’s own filters', () => {
    const board = [
      { field: 'genre', value: 'Fantasy', label: 'Fantasy' },
      { field: 'shelf', value: 'reading', label: 'reading' },
      { field: 'favourite', value: 'yes', label: 'yes' },
    ]
    expect(seedableChips(board)).toEqual(board)
  })

  // THE DELIBERATE GAP. A board's "noted" means the BOOK has a highlight
  // carrying a note; the `note:` facet means the QUOTE has one. Sending one as
  // the other means note=yes with books in scope, and a book has no note
  // column — so the facet would empty the books section and pressing Search on
  // a filtered board would return nothing. `tagged` is the same shape and
  // `media` has no facet at all, so all three stop at the boundary.
  it('drops the board filters the server has no facet for', () => {
    expect(BOARD_ONLY_FACETS).toEqual(['tagged', 'noted', 'media'])
    const board = [
      { field: 'genre', value: 'Fantasy', label: 'Fantasy' },
      { field: 'tagged', value: 'yes', label: 'yes' },
      { field: 'noted', value: 'yes', label: 'yes' },
      { field: 'media', value: 'show', label: 'show' },
    ]
    expect(seedableChips(board)).toEqual([{ field: 'genre', value: 'Fantasy', label: 'Fantasy' }])
  })

  // The guarantee that gap exists for: nothing the board can be filtered by
  // reaches /search as a name it would reject with a 400.
  it('never seeds a field the server does not know', () => {
    const everything = [...FACET_NAMES, ...BOARD_ONLY_FACETS].map((field) => ({ field, value: 'x', label: 'x' }))
    for (const c of seedableChips(everything)) expect(FACET_NAMES).toContain(c.field)
  })

  it('seeds nothing from an unfiltered board', () => {
    expect(seedableChips([])).toEqual([])
    expect(seedableChips()).toEqual([])
  })

  it('shows a work’s title and sends its id', () => {
    expect(workSeedChip('book', 42, 'The Dispossessed'))
      .toEqual({ field: 'book', value: '42', label: 'The Dispossessed' })
    expect(workSeedChip('movie', 7, 'Stalker'))
      .toEqual({ field: 'movie', value: '7', label: 'Stalker' })
  })

  it('seeds no work chip before the page has loaded', () => {
    // Better a search of everything than a chip reading "#undefined".
    expect(workSeedChip('book', null, '')).toBe(null)
    expect(workSeedChip('book', undefined, undefined)).toBe(null)
  })

  it('falls back to the id when a work has no title', () => {
    expect(workSeedChip('book', 42, '').label).toBe('#42')
  })

  it('hands the seed to whoever asks, and clears', () => {
    publishSearchSeed([{ field: 'shelf', value: 'reading', label: 'reading' }])
    expect(takeSearchSeed()).toHaveLength(1)
    publishSearchSeed([])
    expect(takeSearchSeed()).toEqual([])
  })

  it('never hands back something that is not a list', () => {
    // The board publishes in an effect; a bug there must not make the shell
    // throw on the next press of Search.
    publishSearchSeed(null)
    expect(takeSearchSeed()).toEqual([])
    publishSearchSeed('shelf:reading')
    expect(takeSearchSeed()).toEqual([])
  })
})

describe('removing a seeded chip widens the search', () => {
  // The promise the whole seeding idea rests on: narrowing is free because
  // widening is one click. Asserted end to end — a seeded board becomes chips,
  // becomes a query string, and dropping a chip visibly drops a parameter.
  const seeded = seedableChips(withFacetValues(withFacet([], 'genre', 'Fantasy'), 'shelf', ['reading']))

  it('starts narrowed', () => {
    expect(searchQueryString({ scope: 'books', chips: seeded }))
      .toBe('scope=books&genre=Fantasy&shelf=reading')
  })

  it('widens by exactly the chip removed', () => {
    expect(searchQueryString({ scope: 'books', chips: removeChipAt(seeded, 1) }))
      .toBe('scope=books&genre=Fantasy')
  })

  it('is back to the whole shelf once every chip is off', () => {
    expect(searchQueryString({ scope: 'books', chips: [] })).toBe('scope=books')
  })
})

describe('searchQueryString', () => {
  it('sends free text, scope and one parameter per chip', () => {
    const qs = searchQueryString({
      q: 'revolution',
      scope: 'books',
      chips: [
        { field: 'tag', value: 'stoicism', label: 'stoicism' },
        { field: 'colour', value: 'blue', label: 'doubt' },
      ],
    })
    expect(qs).toBe('q=revolution&scope=books&tag=stoicism&colour=blue')
  })

  // Two chips of one field are two parameters of the same name — that is how a
  // multi-valued facet is expressed, and how the server tells intersection from
  // union.
  it('repeats a name rather than joining values', () => {
    const qs = searchQueryString({
      chips: [
        { field: 'tag', value: 'stoicism', label: 'stoicism' },
        { field: 'tag', value: 'death', label: 'death' },
      ],
    })
    expect(qs).toBe('scope=all&tag=stoicism&tag=death')
  })

  // The chips-only search: picking a value emptied the box, and that request
  // must still be well-formed. The server stopped requiring `q` for exactly this.
  it('omits q entirely when the box is empty', () => {
    expect(searchQueryString({ q: '   ', scope: 'quotes', chips: [{ field: 'tag', value: 'x', label: 'x' }] }))
      .toBe('scope=quotes&tag=x')
  })

  it('escapes values rather than pasting them in', () => {
    const qs = searchQueryString({ chips: [{ field: 'author', value: 'Gaiman & Pratchett', label: 'x' }] })
    expect(qs).toBe('scope=all&author=Gaiman+%26+Pratchett')
  })

  it('defaults to searching everything', () => {
    expect(searchQueryString()).toBe('scope=all')
  })
})
