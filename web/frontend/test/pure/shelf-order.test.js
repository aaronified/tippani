import { describe, expect, it } from 'vitest'
import { byLastRead, byYear, shuffleSeeded } from '../../src/ui.jsx'
import { t } from '../../src/i18n.js'
import { groupAnnotations, sortAnnotations } from '../../src/boardOrder.js'
import { KINDS } from '../../src/workKinds.js'

// "Last read" / "Last watched" — ordering a shelf by when you last had the
// thing in your hands.
//
// The interesting half is not the ordering, it is the ABSENCES. Most libraries
// here are mostly unread: this app exists to keep quotes, and a book can be
// shelved, quoted and never once logged as read. So the majority of rows have
// no date at all, and where those land is the whole design of the sort — a
// comparator that leaves them wherever they fall answers a question nobody
// asked, and does it without failing.
//
// Dates are partial by design ('2019' | '2019-05' | '2019-05-02') and compared
// as strings, which is the property the schema was built around. That is worth
// a test of its own: it is the kind of thing that works until someone reaches
// for new Date() to be helpful.
describe('last read sort', () => {
  const w = (title, last_read_at = '') => ({ title, last_read_at })
  const order = (list) => [...list].sort(byLastRead).map((x) => x.title)

  describe('byLastRead', () => {
    // One test over all six shelves rather than six: every case is the same
    // order(list) call compared to an expected order of titles, and asserting the
    // whole table at once names every shelf that came out wrong instead of dying
    // on the first. Each row keeps the name of the it() it used to be.
    it('orders a shelf by when it was last in your hands', () => {
      const cases = [
        {
          name: 'puts the most recent first',
          list: [w('older', '2019-01-04'), w('newer', '2024-06-02'), w('middle', '2021-08-08')],
          want: ['newer', 'middle', 'older'],
        },
        // Not "sorted somewhere sensible" — after. A shelf where the unread are
        // interleaved by accident looks like a shuffle, and a shelf where they come
        // first is the opposite of what was asked for.
        {
          name: 'puts everything unread after everything read',
          list: [w('never'), w('read', '2020-01-01'), w('also never'), w('read again', '2023-01-01')],
          want: ['read again', 'read', 'also never', 'never'],
        },
        // "No date" is not a tie worth breaking randomly. A stable alphabetical tail
        // is something you can look a title up in; an arbitrary one is not.
        {
          name: 'orders the unread by title rather than leaving them as found',
          list: [w('Zeno'), w('Anna'), w('Marcus')],
          want: ['Anna', 'Marcus', 'Zeno'],
        },
        // The server omits the key entirely for a work with no dated read, and sends
        // '' for some — both mean the same thing and neither may sort as a date.
        {
          name: 'treats a missing field and an empty string alike',
          list: [w('read', '2020-01-01'), { title: 'missing' }, w('empty', '')],
          want: ['read', 'empty', 'missing'],
        },
        // '2019-05' is a more precise claim than '2019', and there is nothing to do
        // with the imprecision but order it consistently. Parsing these into Dates
        // would invent a January morning nobody recorded — the same mistake the
        // occasion dates are written to avoid.
        {
          name: 'reads partial dates as the strings they are',
          list: [w('year only', '2019'), w('month', '2019-05'), w('day', '2019-05-02')],
          want: ['day', 'month', 'year only'],
        },
        // The trap in comparing partial dates as text: '2019-12-31' is longer than
        // '2020', and a comparator that fell back to length or to a numeric parse of
        // the first token would get this pair backwards.
        {
          name: 'does not confuse a longer string for a later date',
          list: [w('older', '2019-12-31'), w('newer', '2020')],
          want: ['newer', 'older'],
        },
      ]
      const got = cases.map(({ name, list }) => [name, order(list)])
      expect(got).toEqual(cases.map(({ name, want }) => [name, want]))
    })
  })
})

// "Year" — ordering a shelf by when the work itself came out.
//
// A shelf of books is not a shelf of films, and the difference is the whole
// reason this has a test. Films start in 1888 and every one of them has a year;
// books start in antiquity and most of the interesting ones are guesses. So the
// two facts a year sort has to get right here are the two that never come up on
// a modern medium: a year can be BEFORE the era, and a great many rows have no
// year at all.
//
// Those two collide. The column stores BCE as a negative (migration 0030) and
// has stored "nobody recorded one" as 0 since it was created — so on the number
// line the absence sits BETWEEN the two eras. A sort that just subtracts puts
// the one book nobody has dated in the middle of the shelf, above Plato and
// below Woolf, and it does that without failing anything.
//
// The other thing worth pinning is that the two shelves agree. A book's column
// is `published_year` and a film's is `release_year`; the same list of years
// must come out in the same order whichever of the two names it, because the
// reader is pressing the same word on the same menu.
describe('year sort', () => {
  const pub = (title, published_year, published_circa = 0) => ({ title, published_year, published_circa })
  const shelf = (list) => [...list].sort(byYear((b) => b.published_year)).map((x) => x.title)

  describe('sorting a shelf by the year it came out', () => {
    it('orders the shelf newest first, undated last, and the era the right way round', () => {
      const cases = [
        {
          name: 'puts the newest first',
          list: [pub('older', 1890), pub('newest', 2019), pub('middle', 1954)],
          want: ['newest', 'middle', 'older'],
        },
        // Not "somewhere sensible" — after everything. A shelf that scatters the
        // undated through the dated looks like a shuffle and answers nothing.
        {
          name: 'puts every undated book after every dated one',
          list: [pub('no year', 0), pub('dated', 1954), pub('also none', 0), pub('dated too', 1890)],
          want: ['dated', 'dated too', 'also none', 'no year'],
        },
        // THE CASE THE NUMBER LINE GETS WRONG. 0 is not a year, it is an absence,
        // and it has to leave the range rather than sit in the middle of it.
        {
          name: 'files the undated below the ancient, not between the eras',
          list: [pub('Plato', -380), pub('undated', 0), pub('Woolf', 1925)],
          want: ['Woolf', 'Plato', 'undated'],
        },
        {
          name: 'reads a negative year as before the era, so 63 BCE precedes 380 BCE',
          list: [pub('380 BCE', -380), pub('63 BCE', -63), pub('44 BCE', -44)],
          want: ['44 BCE', '63 BCE', '380 BCE'],
        },
        // A missing column is the same claim as a zero. The wire sends 0, but a
        // capture card that never asked the question sends nothing at all.
        {
          name: 'treats a missing year as an absent one',
          list: [pub('nothing', undefined), pub('null', null), pub('dated', 1890)],
          want: ['dated', 'nothing', 'null'],
        },
        // Alphabetical inside a year, so a year with forty books in it is a list
        // you can look something up in.
        {
          name: 'breaks a tie alphabetically',
          list: [pub('Zeno', 1954), pub('Anna', 1954), pub('Mira', 1954)],
          want: ['Anna', 'Mira', 'Zeno'],
        },
        // 0030: circa is display-only. An estimate is still that year for every
        // purpose except how it is written down, and a circa that moved a row
        // would put the shelf and the timeline into disagreement about one book.
        {
          name: 'ignores circa',
          list: [pub('estimate', -380, 1), pub('exact', -380), pub('later', 1890)],
          want: ['later', 'estimate', 'exact'],
        },
      ]
      const got = cases.map((c) => ({ name: c.name, order: shelf(c.list) }))
      expect(got).toEqual(cases.map((c) => ({ name: c.name, order: c.want })))
    })

    // The books shelf and the films shelf press the same word on the same menu, so
    // they must not be two orderings. Same years, two column names, one answer.
    it('gives a film shelf and a book shelf the same order for the same years', () => {
      const years = [1890, 0, -380, 2019, 1954]
      const books = years.map((y, i) => ({ title: `w${i}`, published_year: y }))
      const films = years.map((y, i) => ({ title: `w${i}`, release_year: y }))
      expect([...films].sort(byYear((m) => m.release_year)).map((x) => x.title)).toEqual(
        [...books].sort(byYear((b) => b.published_year)).map((x) => x.title),
      )
    })
  })
})

// THE DIMENSIONS A FILM, A SHOW AND A GAME ORDER AND GROUP BY.
//
// WHY A SECOND ORDER FILE. annotation-order.test.js covers the book's — chapter,
// location, the three that can be absent — and it covered them against a sorter
// that only a book board called. The film board had its OWN comparator, which
// knew four dimensions, sent the other four to alphabetical-by-quote-text, and
// ran on the table view alone; the two views a reader actually reads in were
// served in whatever order the server sent. Folding the two means the film's
// dimensions are now the shared sorter's problem, and these are the cases that
// say so.
//
// THE DIMENSION LIST IS THE KIND'S. groupAnnotations refuses a dimension the kind
// did not declare, which is the guard that stops a film board grouping by
// chapter — so every case here passes the kind's own list rather than letting a
// default answer for it.
describe('board order', () => {
  const SHOW = KINDS.show.groupDims
  const GAME = KINDS.game.groupDims
  const ids = (rows) => rows.map((r) => r.id)
  const asc = (col) => ({ col, dir: 'asc' })
  const desc = (col) => ({ col, dir: 'desc' })

  describe('a run is ordered by season, then episode, then the clock', () => {
    const rows = [
      { id: 1, season: 2, episode: 1, timestamp: '00:10:00' },
      { id: 2, season: 1, episode: 10, timestamp: '00:05:00' },
      { id: 3, season: 1, episode: 2, timestamp: '00:30:00' },
      { id: 4, season: 1, episode: 2, timestamp: '00:01:00' },
      { id: 5, season: 0, episode: 1, timestamp: '00:00:30' },
    ]

    it('puts episode 10 after episode 2 and not between 1 and 2', () => {
      // The film board's own copy got this right; a string sort would not, which
      // is why the comparable pads.
      expect(ids(sortAnnotations(rows, asc('episode')))).toEqual([5, 4, 3, 2, 1])
    })
  })

  describe('grouping a board that is not a book', () => {
    it('makes a season and an episode one heading', () => {
      const g = groupAnnotations(
        [
          { id: 1, season: 2, episode: 3 },
          { id: 2, season: 1, episode: 3 },
          { id: 3, season: 1, episode: 3 },
          { id: 4 },
        ],
        'episode',
        SHOW,
      )
      // Season 1 episode 3 and season 2 episode 3 are two runs, not one.
      expect(g.filter((x) => !x.residual).length).toBe(2)
      expect(g[0].items.map((r) => r.id)).toEqual([2, 3])
      expect(g[0].label).toMatch(/1/)
      expect(g[0].label).toMatch(/3/)
      expect(g.at(-1).label).toBe('No episode')
    })
  })
})

// A wall that reorders when you arrive and holds still while you work.
//
// Home's favourites are shuffled on purpose — the section is a re-surfacing wall,
// not a feed. They were shuffled with Fisher–Yates on every LOAD, and every
// in-place edit reloads them, so recolouring one quote redealt the whole wall:
// the four tiles on screen became four different tiles and the card you had just
// acted on was gone. That reads as the app losing the change.
//
// "Shuffle less often" only moves the problem to whichever reload is left. The
// property that actually fixes it is the one asserted here: A CARD'S POSITION
// DEPENDS ONLY ON THE SEED AND ITS OWN KEY. Nothing about the rest of the list can
// move it — which is precisely what a walk-the-list shuffle cannot promise, since
// dropping one member changes the permutation entirely.
describe('seeded shuffle', () => {
  const items = (n) => Array.from({ length: n }, (_, i) => ({ key: `quote:${i + 1}` }))
  const keys = (list) => list.map((x) => x.key)

  describe('the order it holds', () => {
    it('survives a card leaving — everything else stays in the same relative order', () => {
      // THE ONE FISHER–YATES CANNOT DO, and the reason this is a per-item rank.
      // Un-hearting a favourite removes it from the next load's list; every other
      // tile must stay where the reader last saw it.
      const before = items(40)
      const full = keys(shuffleSeeded(before, 4242))
      const gone = full[7]
      const rest = keys(shuffleSeeded(before.filter((x) => x.key !== gone), 4242))
      expect(rest).toEqual(full.filter((k) => k !== gone))
    })
  })
})
