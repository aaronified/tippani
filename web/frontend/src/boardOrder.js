// HOW A BOARD OF QUOTES IS ORDERED AND BUCKETED, FOR EVERY KIND OF WORK.
//
// WHY IT IS NOT IN A SCREEN. It was in two, answering the same question twice
// and differently: Library.jsx sorted by default|date|chapter|location|length|
// category, Movies.jsx by favorite|character|episode|timestamp with everything
// else falling through to the quote's text. Neither covered what its own kind
// declares in workKinds.js — a film's sortDims names `default`, `date`, `length`
// and `category`, and the film board implemented none of the four — and the
// film's copy only ever ran on the TABLE view, so the same board sorted in the
// table and did not in the two views a reader actually reads in.
//
// THE DIMENSIONS ARE THE KIND'S, NOT THIS FILE'S. Every function here takes the
// list it is allowed to answer for, because a board must not offer `chapter` for
// a film or `quest` for a book — and a grouping that silently fell through to a
// default bucket is how a board comes out arranged by something no control says.
//
// MISSING SINKS RATHER THAN FLOATS, on every dimension that can be absent, and
// that is a partition rather than a sentinel: see hasValue.

import { t } from './i18n.js'
import { categoryName } from './theme.js'
import { ANNOTATION_COLORS, fmtDate } from './ui.jsx'
import { KINDS } from './workKinds.js'

// annDate prefers the source/original date (noted_at, set on import or manual
// add) and falls back to the row's created_at.
export function annDate(a) {
  return a.noted_at || a.created_at || ''
}

// locSortVal pulls the first number out of a location ("p.142" -> 142) so the
// table sorts locations numerically; missing locations sink to the bottom.
export function locSortVal(a) {
  const m = String(a.location || '').match(/\d+/)
  return m ? parseInt(m[0], 10) : -1
}

// WHICH DIMENSIONS EXIST is workKinds.js's answer and not this file's — a book
// offers chapter and location, a show episode, a game act and quest — so nothing
// here holds a list. What every kind shares is `default`: the order the server
// sent (created_at DESC), which stays a named option rather than being folded
// into `date` because it is what pinning rides on (a quote saved a moment ago
// sits on top until something else is chosen) and because it is the only one of
// these that is not a property of the quote at all.
//
// sortValue is the comparable for one dimension.
//
// STRINGS THROUGHOUT WHERE A DIMENSION MIXES KINDS, because the comparator uses
// `<` and JavaScript will happily tell you that '' is less than 2. A chapter is
// a number for some quotes and a name for others; encoding the rank in the first
// character keeps "numbered chapters, then named ones" a fact about the value
// rather than a fact about the comparator.
function sortValue(a, col) {
  switch (col) {
    case 'quote': return (a.quote || a.note || '').toLowerCase()
    // Sorted on the NUMBER when there is one, which is the point of splitting it
    // out: text put chapter 10 between 1 and 2. Numbered chapters come first, in
    // order; named ones follow alphabetically, which is the only order they have.
    case 'chapter':
      return a.chapter_no != null
        ? `0${Math.max(0, a.chapter_no).toFixed(4).padStart(16, '0')}`
        : `1${(a.chapter || '').toLowerCase()}`
    case 'location': return locSortVal(a)
    case 'character': return (a.character || '').toLowerCase()
    // A SHOW'S READING ORDER IS SEASON, THEN EPISODE, THEN THE CLOCK, and it is
    // one comparable rather than three because the comparator takes one. Season 0
    // is a real season — specials — so it sorts where it belongs rather than
    // being treated as absent, and a half-located line (a season with no episode)
    // sinks within its season rather than to the end of the board: '~' outranks
    // every digit, which is what Infinity was doing in the film board's own copy.
    case 'episode': {
      const rank = (n) => (n == null ? '~' : `0${Math.max(0, n).toFixed(4).padStart(16, '0')}`)
      return `${rank(a.season)}${rank(a.episode)}${a.timestamp || ''}`
    }
    case 'timestamp': return a.timestamp || ''
    case 'act': return (a.act || '').toLowerCase()
    case 'quest': return (a.quest || '').toLowerCase()
    case 'date': return annDate(a)
    case 'favorite': return a.favorite ? 1 : 0
    // LENGTH IS OF THE WORDS, not of the row: a note is not part of how long a
    // quote is, and a two-line quote with a page of notes under it is still a
    // short quote. A note-only row has no quote and sorts as nothing.
    case 'length': return (a.quote || '').length
    // The colour WHEEL's order and not the word's, because the swatches are drawn
    // in that order everywhere else in the app and a category list that ran
    // blue-orange-pink-yellow would be a second answer to "which order are the
    // colours in".
    case 'category': return Math.max(0, ANNOTATION_COLORS.indexOf(a.color || 'yellow'))
    default: return 0
  }
}

// hasValue — whether this quote has anything to be ordered by on this dimension.
//
// MISSING SINKS RATHER THAN FLOATS, AND IN BOTH DIRECTIONS, which is why it is a
// partition and not a sentinel. A quote with no location is not "location zero",
// and a board that opened with every unlocated quote on top would look broken;
// flip the arrow and a sentinel would put them all on top of the OTHER end
// instead, which is the same complaint in a mirror. Three dimensions can be
// absent: a chapter, a locator and a date. A colour and a length always exist.
function hasValue(a, col) {
  if (col === 'chapter') return a.chapter_no != null || !!(a.chapter || '').trim()
  if (col === 'location') return locSortVal(a) >= 0
  if (col === 'date') return !!annDate(a)
  // The four a line can be missing. A game has no timestamp and a film has no
  // act, so on the board that offers the dimension its absence is a real answer:
  // these sink rather than sorting as the empty string, which would put every
  // unlocated line at one end and look like a broken board.
  if (col === 'character') return !!(a.character || '').trim()
  if (col === 'episode') return a.season != null || a.episode != null
  if (col === 'timestamp') return !!(a.timestamp || '').trim()
  if (col === 'act') return !!(a.act || '').trim()
  if (col === 'quest') return !!(a.quest || '').trim()
  return true
}

// sortAnnotations orders a board. `default` keeps the server's order, reversed
// when the direction is flipped — "recent" ascending is oldest first, which is a
// real thing to ask for and the only honest reading of the arrow.
export function sortAnnotations(rows, sort) {
  const arr = [...rows]
  if (sort.col === 'default') return sort.dir === 'asc' ? arr : arr.reverse()
  const dir = sort.dir === 'asc' ? 1 : -1
  const has = arr.filter((a) => hasValue(a, sort.col))
  const missing = arr.filter((a) => !hasValue(a, sort.col))
  has.sort((a, b) => {
    const x = sortValue(a, sort.col)
    const y = sortValue(b, sort.col)
    if (x < y) return -dir
    if (x > y) return dir
    // The id breaks every tie, so a board with forty quotes on one page is in a
    // stable order rather than whatever the sort happened to do this time.
    return a.id - b.id
  })
  return has.concat(missing)
}

// dayOf floors a timestamp to its day. Grouping by the instant a quote was added
// would make every group hold one quote, which is a list with headings.
function dayOf(a) {
  return String(annDate(a) || '').slice(0, 10)
}

// groupAnnotations buckets a board, in the order each dimension is actually read
// in — and that is why this is not groupWorks.
//
// `groupWorks` orders its buckets by LABEL, which is right for a shelf of series
// and authors and wrong for all four of these: chapters run in reading order,
// colours run in the order the swatches are drawn, days run newest first, and
// tags run by how many quotes wear them. Four dimensions, four orders, none of
// them alphabetical — bending groupWorks to take them would have been a fifth
// option on a function that already takes eight, and the result would order a
// shelf and a board by rules neither call site could read off it.
//
// A quote with several tags appears under each of them, exactly as a book with
// several genres does. Everything else is single-valued, and a quote missing the
// value lands in a residual bucket that always sinks to the end.
export function groupAnnotations(rows, dim, dims = KINDS.book.groupDims) {
  if (dim === 'none' || !dims.includes(dim)) return null
  const map = new Map()
  const add = (key, label, row, order, residual) => {
    let g = map.get(key)
    if (!g) {
      g = { key, label, items: [], order, residual: !!residual }
      map.set(key, g)
    }
    g.items.push(row)
  }
  // A CHAPTER'S NAME, BY ITS NUMBER, so that one chapter is one group even when
  // only some of its quotes were saved with the name typed in. Without it the
  // heading is whatever the first row of that chapter happened to carry, and a
  // chapter half-named splits into two groups a reader cannot tell apart.
  const chapterNames = new Map()
  if (dim === 'chapter') {
    for (const a of rows) {
      const nm = (a.chapter || '').trim()
      if (a.chapter_no != null && nm && !chapterNames.has(a.chapter_no)) chapterNames.set(a.chapter_no, nm)
    }
  }
  for (const a of rows) {
    if (dim === 'chapter') {
      const n = a.chapter_no
      const name = n != null ? (chapterNames.get(n) || '') : (a.chapter || '').trim()
      if (name || n != null) {
        // THE PACK'S THREE CASES, and the app had two of them (`book-detail.dc.html`
        // :2566). A chapter with a number AND a name printed the name alone, so the
        // heading lost the one thing that puts the groups in the order they are in:
        // a board grouped by chapter came out sorted by a number it never showed.
        //
        // A SECTION WITH NO NUMBER IS NOT A CHAPTER — it is a named part of the book,
        // an Epilogue or an Afterword — so it is called by its name alone. The pack
        // says it in those words, and "Ch Epilogue" says nothing true.
        const label = n == null
          ? name
          : name
            ? t('board.group.chapter.named.label', { n, name })
            : t('board.group.chapter.numbered.label', { n })
        // KEYED ON THE NUMBER, not on the label, for the reason the name map above
        // exists: the group is the chapter, and two spellings of one chapter's name
        // are one chapter.
        // Numbered chapters in reading order; named ones after them, alphabetical.
        add(n != null ? `ch#${n}` : `ch:${label}`, label, a, n != null ? n : Number.MAX_SAFE_INTEGER, false)
      } else add('~none', t('board.group.chapter.none.label'), a, Infinity, true)
    } else if (dim === 'character' || dim === 'act' || dim === 'quest') {
      // THREE FREE-TEXT DIMENSIONS, ONE BRANCH. A character, an act and a quest
      // are all a name the reader typed, so the bucket is the name and the order
      // is alphabetical — there is no other order a name has. Keyed on the
      // folded spelling so "HAL" and "Hal" are one character, and labelled with
      // the first spelling seen rather than the folded one, because a heading
      // should read the way the reader wrote it.
      const raw = (a[dim] || '').trim()
      if (raw) add(raw.toLowerCase(), raw, a, 0, false)
      else add('~none', t(`board.group.${dim}.none.label`), a, Infinity, true)
    } else if (dim === 'episode') {
      // A SEASON AND AN EPISODE ARE ONE HEADING. Grouping on the episode alone
      // would put season 2's third episode in with season 1's, which is a board
      // claiming two different runs are one.
      const s = a.season
      const n = a.episode
      if (n != null) {
        add(
          `ep#${s ?? ''}:${n}`,
          s != null ? t('board.group.episode.seasoned.label', { s, n }) : t('board.group.episode.numbered.label', { n }),
          a,
          (s ?? 0) * 100000 + n,
          false,
        )
      } else add('~none', t('board.group.episode.none.label'), a, Infinity, true)
    } else if (dim === 'color') {
      const tok = a.color || 'yellow'
      add(tok, categoryName(tok), a, Math.max(0, ANNOTATION_COLORS.indexOf(tok)), false)
    } else if (dim === 'tag') {
      const tags = a.tags || []
      if (tags.length) tags.forEach((tg) => add(tg, tg, a, 0, false))
      else add('~none', t('board.group.tag.none.label'), a, Infinity, true)
    } else {
      // DATE, and it is the last branch rather than a named one because it is the
      // only dimension every kind has. A dim this function does not know cannot
      // reach here: the guard at the top refuses anything the kind did not
      // declare.
      const d = dayOf(a)
      if (d) add(d, fmtDate(d), a, -new Date(`${d}T00:00:00`).getTime(), false)
      else add('~none', t('board.group.date.none.label'), a, Infinity, true)
    }
  }
  const out = [...map.values()]
  out.sort((x, y) => {
    if (x.residual !== y.residual) return x.residual ? 1 : -1
    // Tags have no order of their own, so the biggest group leads — the same
    // rule a shelf grouped by genre uses, and for the same reason.
    if (dim === 'tag') return y.items.length - x.items.length || x.label.localeCompare(y.label)
    return x.order - y.order || x.label.localeCompare(y.label)
  })
  return out
}

