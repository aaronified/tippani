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

import { describe, expect, it } from 'vitest'
import { byYear } from '../../src/ui.jsx'
import { t, applyLocale } from '../../src/i18n.js'

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

  // One fact, one word. The menu entry is the same on both shelves because it
  // asks the same question, and two spellings of it would read as two sorts.
  it('names the sort the same on both shelves', () => {
    applyLocale('en')
    expect(t('library.sort.year.label')).toBe(t('movies.sort.year.label'))
  })
})
