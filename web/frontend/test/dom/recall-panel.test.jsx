// PRESSING THE REPETITION MARK ASKS "HOW DO I REMEMBER THIS", AND GETS AN ANSWER.
//
// THE OWNER'S REQUEST, verbatim: "when i click on the spaced repetition icon in
// the quote cards, it should show a popup for the halflife status, and recall
// history (will need to create a recall history table), like the infodots (this
// is not an infodot, btw, so will not be restricted by the budget)."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how the panel was built:
//
//  * The mark is drawn on every quote card in the app — a book highlight, a film
//    line, and a standalone quote (a speech, a letter, a proverb). Those are
//    three different things to the schedule, which is keyed by (kind, id), so
//    asking about the wrong one asks about somebody else's card or about nothing.
//    The row itself is the only thing that knows which it is.
//  * The schedule is a CURRENT state and the log is one row per answer. They are
//    two ledgers: a Practice answer, and any skip, is in the log and moved
//    nothing. A panel that drew them alike would report an unmoved half-life as
//    a fault.
//  * The mark sits inside cards that are themselves pressable.
//  * The card already shows the state as a glyph and a tooltip. The panel is the
//    same fact at length; if the two disagree about a number, one of them is
//    lying and a reader cannot tell which.


import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Every path the panel asks for, in order, so a test can say which card was
// asked about without knowing how the request is spelled.
const asked = []
let answer = null

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    // A real card also asks which quotes of its work have stored context (so `In
    // context` can be absent where it would show nothing). That is the CARD's read and
    // not the panel's, and this list is what the PANEL asked about.
    if (!path.startsWith('/sources/context-ids')) asked.push(`${method} ${path}`)
    return answer ? { ok: true, data: answer } : { ok: false, status: 500 }
  }),
}))

const { ReviewDot, reviewKindOf, reviewStatus } = await import('../../src/ui.jsx')
// THE REAL CARDS, because every case above renders the mark on its own and a mark
// that works in isolation is not the claim. The owner presses it inside a card,
// where it sits in a row of other controls, inside an <article> that is itself
// pressable — see prompt 3: "is the button clickable (for all buttons)".
const { AnnotationCard } = await import('../../src/Library.jsx')
const { Frame } = await import('../../src/Movies.jsx')
const { t } = await import('../../src/i18n.js')

// The value beside a facts label, found BY THE LABEL FROM THE LOCALE rather than
// by an English literal — a test that matches "Next review" passes in one
// language and reports the panel broken in the other.
const factValue = (key) => {
  const dl = document.querySelector('.recall-facts')
  if (!dl) return null
  for (const row of dl.children) {
    if (row.querySelector('dt')?.textContent === t(key)) return row.querySelector('dd').textContent.trim()
  }
  return null
}

// EVERY DATE THE SCHEDULE READS IS RELATIVE TO NOW, AND THREE OF THEM WERE NOT.
//
// `reviewStatus` compares ELAPSED DAYS against the floored half-life, so a
// `last_reviewed_at` written as a calendar date is a fixture whose meaning
// changes while the file sits still. One went off: a card pinned to 2026-09-06
// with a 7d floor read "7d" every day until 2026-09-13, when elapsed reached 7
// and the label became "due now" with no span in it at all. Green for a week,
// then failing on a commit that touched nothing near it. The other two were the
// same shape with 18 days left to run.
//
// `created_at` is NOT this hazard and is left alone: the grace window it feeds
// is `elapsed < NEW_ITEM_DAYS`, and a fixture already outside it can only get
// further outside, because time moves one way.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')

// A card the reader has been quizzed on three times, with one lapse and one
// practice run that moved nothing.
const CARD = {
  kind: 'book',
  id: 7,
  reviewed: true,
  stability: 30,
  review_count: 3,
  lapse_count: 1,
  last_result: 'got',
  last_reviewed_at: daysAgo(12),
  created_at: '2026-01-01 09:00:00',
  excluded: false,
  due: false,
  due_in_days: 21,
  logged: 3,
  history: [
    { result: 'got', stability: 30, elapsed_days: 14, answered_at: daysAgo(12), mode: 'daily', counted: true },
    { result: 'skip', stability: 7, elapsed_days: 4, answered_at: daysAgo(26), mode: 'practice', counted: false },
    { result: 'forgot', stability: 7, elapsed_days: null, answered_at: daysAgo(30), mode: 'daily', counted: true },
  ],
}

// A highlight, a film line and a standalone quote, in the shape the list and
// search payloads actually send: the parent id is always there, and the third
// kind has no parent at all.
const HIGHLIGHT = { id: 7, book_id: 3, quote: 'the sleeper must awaken', created_at: '2026-01-01 09:00:00', reviewed: true, stability: 30, last_reviewed_at: daysAgo(12), last_result: 'got' }
const FILM_LINE = { id: 11, movie_id: 4, quote: 'a guy told me one time', created_at: '2026-01-01 09:00:00' }
const SPEECH = { id: 19, quote: 'give me blood', created_at: '2026-01-01 09:00:00' }

const mark = () => document.querySelector('.status-mark')
// fireEvent, not `.click()`: RTL wraps it in `act`, so the render the press
// causes has happened by the time the next line reads the document. A bare
// `.click()` leaves the assertion racing React and a closed panel reads as one
// that never closed.
const press = () => fireEvent.click(mark())
const panel = () => document.querySelector('[role="dialog"]')

beforeEach(() => {
  asked.length = 0
  answer = CARD
})
afterEach(() => cleanup())

describe('the mark is a door', () => {
  it('opens a panel when pressed, and shuts it when pressed again', async () => {
    render(<ReviewDot item={HIGHLIGHT} />)
    expect(panel(), 'a panel is open before anything was pressed').toBeFalsy()
    press()
    await waitFor(() => expect(panel(), 'pressing the recall mark opened nothing').toBeTruthy())
    press()
    expect(panel(), 'pressing it again left the panel open, so there is no way back out with the same control').toBeFalsy()
  })

  it('does not also open the quote it sits on', async () => {
    const hits = []
    render(
      <div onClick={() => hits.push('card')}>
        <ReviewDot item={HIGHLIGHT} />
      </div>,
    )
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    expect(hits, 'asking about a quote also opened it — these marks sit inside cards that are pressable').toEqual([])
  })
})

describe('what the panel says', () => {
  const text = () => panel().textContent.replace(/\s+/g, ' ')

  const open = async (item = HIGHLIGHT) => {
    render(<ReviewDot item={item} />)
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    await waitFor(() => expect(document.querySelectorAll('.recall-log li').length + (panel().querySelector('.recall-wait') ? 1 : 0)).toBeGreaterThan(0))
  }

  it('names an answer that moved nothing instead of crediting it with a half-life', async () => {
    await open()
    const rows = [...document.querySelectorAll('.recall-log li')]
    const idle = rows.find((r) => r.className.includes('is-idle'))
    expect(idle, 'a practice answer that moved nothing is drawn exactly like one that did').toBeTruthy()
    // The half-life cell holds a WORD there, not the number that still stood:
    // printing "7d" would say this answer arrived at it.
    const span = idle.querySelector('.recall-log-span').textContent
    expect(span, `an answer that moved nothing claims a half-life of ${span}`).not.toMatch(/\d/)
    // And the counted rows do carry a number, or the claim above is vacuous.
    const live = rows.filter((r) => !r.className.includes('is-idle'))
    expect(live.length, 'every row was drawn as having moved nothing').toBeGreaterThan(0)
    for (const r of live) {
      expect(r.querySelector('.recall-log-span').textContent, 'an answer that moved the schedule shows no half-life').toMatch(/\d/)
    }
    // AND ONE SENTENCE SAYS WHY. Weight alone would leave the reader with a
    // dimmer row and no reason for it — the channel this repo refuses to rely on.
    expect(document.querySelector('.recall-note'), 'nothing explains why some answers moved nothing').toBeTruthy()
  })

})
// PRESSED WHERE THE READER PRESSES IT — inside a whole card, not on its own.
//
// Every case above mounts `ReviewDot` bare. That answers "does the component
// work" and not "can this be pressed on a quote card", which is the question the
// owner's request is about and the one prompt 3 names: "is the button clickable
// (for all buttons)". A mark can be perfect in isolation and unreachable in
// situ — covered by a sibling control, inside a parent that swallows the click,
// or rendered with a row that never mounts.
describe('inside a real quote card', () => {
  const CARD_ROW = { id: 7, book_id: 3, quote: 'Only in silence the word', note: '', chapter: '1', location: '12', color: 'yellow', tags: [], favorite: false, created_at: '2026-01-01 09:00:00' }
  const FILM_ROW = { id: 9, movie_id: 4, quote: 'Here is looking at you, kid.', character: 'Rick Blaine', actor: 'Humphrey Bogart', timestamp: '01:02:03', color: 'blue', tags: [], favorite: false, created_at: '2026-01-01 09:00:00' }

  it('opens from a book highlight, and asks about that highlight', async () => {
    render(
      <AnnotationCard
        a={CARD_ROW} variant={0} tagMap={{}} editing={false}
        setEditingId={() => {}} save={() => {}} patch={async () => {}} remove={() => {}}
        actionsAlwaysVisible
      />,
    )
    expect(mark(), 'the recall mark is not on a rendered book card at all').toBeTruthy()
    press()
    await waitFor(() => expect(panel(), 'pressing the mark inside a real card opened nothing').toBeTruthy())
    expect(asked[0], `the card asked ${asked[0]}`).toContain('kind=book')
    expect(asked[0], `the card asked ${asked[0]}`).toContain('id=7')
  })

  it('opens from a film line, and asks about that line', async () => {
    render(
      <Frame
        d={FILM_ROW} tagMap={{}} editing={false}
        setEditingId={() => {}} save={() => {}} onPatch={async () => {}} remove={() => {}}
        actionsAlwaysVisible
      />,
    )
    expect(mark(), 'the recall mark is not on a rendered film card at all').toBeTruthy()
    press()
    await waitFor(() => expect(panel(), 'pressing the mark inside a real card opened nothing').toBeTruthy())
    expect(asked[0], `the card asked ${asked[0]}`).toContain('kind=screen')
    expect(asked[0], `the card asked ${asked[0]}`).toContain('id=9')
  })
})
