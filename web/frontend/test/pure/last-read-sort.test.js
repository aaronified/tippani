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

import { describe, expect, it } from 'vitest'
import { byLastRead } from '../../src/ui.jsx'

const w = (title, last_read_at = '') => ({ title, last_read_at })
const order = (list) => [...list].sort(byLastRead).map((x) => x.title)

describe('byLastRead', () => {
  it('puts the most recent first', () => {
    expect(order([w('older', '2019-01-04'), w('newer', '2024-06-02'), w('middle', '2021-08-08')]))
      .toEqual(['newer', 'middle', 'older'])
  })

  it('puts everything unread after everything read', () => {
    // Not "sorted somewhere sensible" — after. A shelf where the unread are
    // interleaved by accident looks like a shuffle, and a shelf where they come
    // first is the opposite of what was asked for.
    expect(order([w('never'), w('read', '2020-01-01'), w('also never'), w('read again', '2023-01-01')]))
      .toEqual(['read again', 'read', 'also never', 'never'])
  })

  it('orders the unread by title rather than leaving them as found', () => {
    // "No date" is not a tie worth breaking randomly. A stable alphabetical tail
    // is something you can look a title up in; an arbitrary one is not.
    expect(order([w('Zeno'), w('Anna'), w('Marcus')])).toEqual(['Anna', 'Marcus', 'Zeno'])
  })

  it('treats a missing field and an empty string alike', () => {
    // The server omits the key entirely for a work with no dated read, and sends
    // '' for some — both mean the same thing and neither may sort as a date.
    const missing = { title: 'missing' }
    expect(order([w('read', '2020-01-01'), missing, w('empty', '')]))
      .toEqual(['read', 'empty', 'missing'])
  })

  it('reads partial dates as the strings they are', () => {
    // '2019-05' is a more precise claim than '2019', and there is nothing to do
    // with the imprecision but order it consistently. Parsing these into Dates
    // would invent a January morning nobody recorded — the same mistake the
    // occasion dates are written to avoid.
    expect(order([w('year only', '2019'), w('month', '2019-05'), w('day', '2019-05-02')]))
      .toEqual(['day', 'month', 'year only'])
  })

  it('does not confuse a longer string for a later date', () => {
    // The trap in comparing partial dates as text: '2019-12-31' is longer than
    // '2020', and a comparator that fell back to length or to a numeric parse of
    // the first token would get this pair backwards.
    expect(order([w('older', '2019-12-31'), w('newer', '2020')])).toEqual(['newer', 'older'])
  })

  it('is a total order, so the sort is stable across runs', () => {
    // Two works read on the same day, or two never read: the comparator must
    // return something other than 0 for distinct titles, or the order depends on
    // the engine's sort and the board reshuffles itself on a re-render.
    const same = [w('b', '2020-01-01'), w('a', '2020-01-01')]
    expect(order(same)).toEqual(['a', 'b'])
    expect(byLastRead(w('a', '2020-01-01'), w('b', '2020-01-01'))).toBeLessThan(0)
  })
})
