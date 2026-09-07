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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { rulesNaming } from '../css-rules.js'
import { sourcesUnder } from '../src-files.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Every path the panel asks for, in order, so a test can say which card was
// asked about without knowing how the request is spelled.
const asked = []
let answer = null

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    asked.push(`${method} ${path}`)
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
  last_reviewed_at: '2026-09-01 09:00:00',
  created_at: '2026-01-01 09:00:00',
  excluded: false,
  due: false,
  due_in_days: 21,
  logged: 3,
  history: [
    { result: 'got', stability: 30, elapsed_days: 14, answered_at: '2026-09-01 09:00:00', mode: 'daily', counted: true },
    { result: 'skip', stability: 7, elapsed_days: 4, answered_at: '2026-08-18 09:00:00', mode: 'practice', counted: false },
    { result: 'forgot', stability: 7, elapsed_days: null, answered_at: '2026-08-14 09:00:00', mode: 'daily', counted: true },
  ],
}

// A highlight, a film line and a standalone quote, in the shape the list and
// search payloads actually send: the parent id is always there, and the third
// kind has no parent at all.
const HIGHLIGHT = { id: 7, book_id: 3, quote: 'the sleeper must awaken', created_at: '2026-01-01 09:00:00', reviewed: true, stability: 30, last_reviewed_at: '2026-09-01 09:00:00', last_result: 'got' }
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

  // A ROW WITH NO ID CANNOT OPEN, AND MAY NOT SAY IT DID. `aria-expanded` is a
  // promise to a reader who cannot see whether it was kept; it was read off
  // `open` alone while the panel was gated on the id, so a press announced a
  // panel that never arrived.
  it('does not announce a panel it cannot open', () => {
    render(<ReviewDot item={{ book_id: 3, created_at: '2026-01-01 09:00:00' }} />)
    expect(mark().hasAttribute('aria-expanded'), 'a mark with no card behind it claims to be expandable').toBe(false)
    press()
    expect(panel(), 'a mark with no card behind it opened something').toBeFalsy()
    expect(mark().getAttribute('aria-expanded'), 'the press left the mark claiming a panel is open').toBeNull()
    // And it still swallows the press: the alternative is one row where pressing
    // the mark opens the quote and every other row where it does not.
    expect(asked, 'a mark with no card behind it asked the server about one').toEqual([])
  })

  it('is a control the app can see, and says which state it is in', () => {
    render(<ReviewDot item={HIGHLIGHT} />)
    // A <button>: `scripts/screenshots/controls.mjs` enumerates
    // `button, [role=button], a[href], summary`, and a mark that does something
    // while being none of those is a control no gate in this repo can reach.
    expect(mark()?.tagName, 'the recall mark does something and is not a control').toBe('BUTTON')
    expect(mark().getAttribute('aria-label') || '', 'the mark is drawn and never named').not.toBe('')
    expect(mark().getAttribute('aria-expanded'), 'nothing says the mark opens anything').toBe('false')
  })

  // The bubble on the mark and the panel's first line are the same sentence.
  // `Tooltip` already has the mechanism for this and documents it for exactly
  // this case ("An open InfoDot / Help sheet suppresses its own trigger's
  // bubble"); the mark has to USE it, which is a thing a reader only notices
  // when it is missing and the words are printed twice, a centimetre apart.
  it('stops repeating the state in a bubble over the panel that says it', async () => {
    render(<ReviewDot item={HIGHLIGHT} />)
    const tip = document.querySelector('.tp-tip-wrap')
    expect(tip, 'the mark carries no tooltip at all any more').toBeTruthy()
    expect(tip.className, 'the bubble is suppressed before anything was opened').not.toMatch(/\bis-open\b/)
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    expect(document.querySelector('.tp-tip-wrap').className,
      'the bubble still speaks over the open panel, so the state is printed twice a centimetre apart')
      .toMatch(/\bis-open\b/)
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

describe('it asks about the card it is drawn on', () => {
  // THE ONE THAT WOULD BREAK SILENTLY. Every kind answers 200 for SOME id, so a
  // panel asking about the wrong table shows a plausible history belonging to a
  // different quote.
  it.each([
    ['a book highlight', HIGHLIGHT, 'book', 7],
    ['a film line', FILM_LINE, 'screen', 11],
    ['a standalone quote', SPEECH, 'utterance', 19],
  ])('names %s by its own kind', async (_what, item, kind, id) => {
    render(<ReviewDot item={item} />)
    press()
    await waitFor(() => expect(asked.length, 'pressing the mark asked the server nothing').toBe(1))
    const path = asked[0]
    expect(path, `the panel asked about ${path} instead of ${kind}/${id}`).toContain(`kind=${kind}`)
    expect(path, `the panel asked about ${path} instead of ${kind}/${id}`).toContain(`id=${id}`)
  })

  // EVERY WAY OUT OF `reviewStatus` CARRIES THE HALF-LIFE, and this is the claim
  // rather than the shape of the code. It had three hand-typed copies of the
  // field and a comment asserting no branch could forget it; one of them had
  // already forgotten it, which is how the panel printed NaN. The states below
  // are the four the app knows, each reached by the input that produces it.
  it('answers with a usable half-life whichever state it reaches', () => {
    const days = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')
    const cases = {
      'the grace week': { created_at: days(2), reviewed: true, stability: 12, last_reviewed_at: days(1), last_result: 'got' },
      'never asked': { created_at: days(400), reviewed: false, stability: 0, last_reviewed_at: '', last_result: '' },
      holding: { created_at: days(400), reviewed: true, stability: 40, last_reviewed_at: days(1), last_result: 'got' },
      lapsed: { created_at: days(400), reviewed: true, stability: 8, last_reviewed_at: days(2), last_result: 'forgot' },
      'below the floor': { created_at: days(400), reviewed: true, stability: 1, last_reviewed_at: days(1), last_result: 'got' },
    }
    for (const [what, item] of Object.entries(cases)) {
      const st = reviewStatus(item)
      expect(Number.isFinite(st.half), `${what}: half is ${st.half}, so anything printing it draws NaN`).toBe(true)
      // AND IT IS FLOORED, in every state — the schedule never asks a card sooner
      // than its floor, so a smaller number would be a promise nothing keeps.
      expect(st.half, `${what}: half is ${st.half}, under the schedule's own floor`).toBeGreaterThanOrEqual(7)
      expect(st.tip, `${what}: the state has no tooltip`).toBeTruthy()
    }
  })

  it('reads the kind off the row and not off the screen', () => {
    // The same claim without a render, because this is the function the four
    // screens share instead of each passing a kind of their own.
    expect(reviewKindOf(HIGHLIGHT)).toBe('book')
    expect(reviewKindOf(FILM_LINE)).toBe('screen')
    expect(reviewKindOf(SPEECH)).toBe('utterance')
    // A row with neither parent is the third kind, which is what having no
    // parent MEANS — not an unknown.
    expect(reviewKindOf({}), 'a parentless row was not read as a standalone quote').toBe('utterance')
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

  it('shows one row per answer, in the order the server sent them', async () => {
    await open()
    const rows = [...document.querySelectorAll('.recall-log li')]
    expect(rows.length, 'the log came back with three answers and the panel drew a different number').toBe(3)
    // THE SERVER SENDS NEWEST FIRST and the panel does not get a second opinion
    // about a sequence the reader lived through. Checked by the DAY on each row
    // against the day on the answer at that position — the three differ, so
    // reversing or re-sorting cannot come out looking right.
    const days = rows.map((r) => r.querySelector('.recall-log-when').textContent)
    const wantDay = (i) => String(new Date(CARD.history[i].answered_at.replace(' ', 'T')).getDate())
    for (let i = 0; i < 3; i++) {
      expect(days[i], `row ${i} is dated ${days[i]}; the answer the server put there was ${CARD.history[i].answered_at}`)
        .toContain(wantDay(i))
    }
  })

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

  // A STORED HALF-LIFE UNDER THE FLOOR, which is the only case the floor exists
  // for and the only one where the two can disagree. The schedule never asks a
  // card sooner than the floor however small its stored value, so a panel that
  // printed the raw number would promise a review the quiz will not give — and
  // the tooltip a millimetre above it would say otherwise.
  it('agrees with the mark it was opened from about the half-life', async () => {
    const brittle = { ...HIGHLIGHT, stability: 3, last_reviewed_at: '2026-09-06 09:00:00' }
    answer = { ...CARD, stability: 3, history: CARD.history.slice(0, 1) }
    render(<ReviewDot item={brittle} />)
    const tip = mark().getAttribute('aria-label')
    const span = (tip.match(/(\d+)\s*(h|d|w|mo)\b/) || [])[0]
    expect(span, `the mark's own label names no half-life: ${tip}`).toBeTruthy()
    expect(span, 'the mark printed the stored half-life rather than the floored one, so this test cannot tell the two apart').toBe('7d')
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    await waitFor(() => expect(document.querySelector('.recall-facts')).toBeTruthy())
    const facts = document.querySelector('.recall-facts').textContent.replace(/\s+/g, ' ')
    expect(facts, `the mark says ${span} and the panel it opens says ${facts}`).toContain(span)
    expect(facts, 'the panel printed the stored half-life, which is below the floor the quiz actually schedules on').not.toMatch(/\b3d\b/)
  })

  // THE MARK AND THE PANEL CANNOT NAME TWO DIFFERENT STATES. The row a card was
  // drawn from carries the schedule as it stood when its list was fetched, and
  // the Daily Quiz moves it without the list hearing — so a shelf left open
  // while you did the quiz has marks that are a day behind. Once the panel has
  // asked and been told, the mark says what the server said.
  it('corrects the mark it was opened from', async () => {
    // The row says nobody has been quizzed on this; the server says it is held,
    // with a long half-life. Those draw different glyphs and read different
    // words.
    const stale = { id: 7, book_id: 3, quote: 'the sleeper must awaken', created_at: '2026-01-01 09:00:00' }
    render(<ReviewDot item={stale} />)
    const before = mark().getAttribute('aria-label')
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    await waitFor(() => expect(mark().getAttribute('aria-label'), 'the mark still names the state its list was fetched with, while the panel under it names another').not.toBe(before))
    const after = mark().getAttribute('aria-label')
    expect(panel().textContent.replace(/\s+/g, ' '), `the mark now says ${after} and the panel says something else`)
      .toContain(after.split(' ·')[0])
  })

  it('draws no facts about a card the quiz has never asked', async () => {
    answer = { ...CARD, reviewed: false, stability: 0, review_count: 0, lapse_count: 0, last_result: '', last_reviewed_at: '', due: false, due_in_days: null, logged: 0, history: [] }
    render(<ReviewDot item={SPEECH} />)
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    await waitFor(() => expect(panel().querySelector('.recall-wait')).toBeTruthy())
    // Four labelled zeroes would be four sentences about the same absent thing,
    // and the state line above already says it in one.
    expect(document.querySelector('.recall-facts'), 'a card with no half-life, no next review and no answers was given a facts table of zeroes').toBeFalsy()
    expect(document.querySelector('.recall-log li'), 'a card with no answers drew a log row').toBeFalsy()
  })

  // A QUOTE SAVED THIS WEEK AND ALREADY ANSWERED IS BOTH THINGS AT ONCE, and it
  // is the state the case above could not reach.
  //
  // `reviewStatus` has a grace-week branch — a quote added in the last seven days
  // reads "remembered" whatever its schedule says, mirroring the server — and
  // that branch returns BEFORE the verdict is computed. The panel's facts table
  // is gated on whether the card has been reviewed, which is a different question
  // from which branch answered it, so a quote saved four days ago and answered
  // once in scored practice went down the grace-week branch and the panel printed
  // "Half-life NaN mo" beside a mark saying "added this week".
  //
  // The fixture in the agreement case above is eight months old, so it never
  // enters the branch: the test asserting the mark and the panel agree about this
  // number could not reach the state where they disagree. This one starts there.
  it('names a real half-life for a quote that is inside its first week and already answered', async () => {
    const days = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ')
    const newborn = { id: 7, book_id: 3, quote: 'the sleeper must awaken', created_at: days(4), reviewed: true, stability: 12, last_reviewed_at: days(1), last_result: 'got' }
    answer = { ...CARD, created_at: days(4), stability: 12, last_reviewed_at: days(1), due_in_days: 11, history: CARD.history.slice(0, 1) }
    render(<ReviewDot item={newborn} />)
    press()
    await waitFor(() => expect(document.querySelector('.recall-facts')).toBeTruthy())
    const facts = document.querySelector('.recall-facts').textContent.replace(/\s+/g, ' ')
    expect(facts, `the panel printed ${facts} about a quote saved four days ago`).not.toMatch(/NaN|undefined|Infinity/)
    // And a real duration, not a blank where one belongs.
    expect(factValue('common.recall.half-life.label'), 'the half-life cell is empty for a quote inside its first week')
      .toMatch(/\d+\s*(h|d|w|mo)\b/)
  })

  // A CARD KEPT OUT OF THE QUIZ HAS NO NEXT REVIEW TO NAME. "In 21 days" is a
  // promise nothing is going to keep, and the reader who excluded it is exactly
  // the one who would not remember doing so.
  it('does not promise a review to a quote that is out of the quiz', async () => {
    answer = { ...CARD, excluded: true }
    render(<ReviewDot item={HIGHLIGHT} />)
    press()
    await waitFor(() => expect(document.querySelector('.recall-facts')).toBeTruthy())
    // The half-life is still a fact about the quote and stays; what may not stand
    // is a SPAN in the next-review cell, because that is a promise nothing will
    // keep. Any of the app's four duration shapes counts as one.
    const next = factValue('common.recall.due.label')
    expect(next, 'the panel drew no next-review row at all, so this test is measuring nothing').toBeTruthy()
    expect(next, `an excluded quote is told its next review is in ${next}`).not.toMatch(/\d+\s*(h|d|w|mo)\b/)
    // And the half-life cell IS a span, or the assertion above is vacuous.
    expect(factValue('common.recall.half-life.label'), 'the half-life is not a duration, so the check above proves nothing')
      .toMatch(/\d+\s*(h|d|w|mo)\b/)
    // And the history is untouched — hiding it would destroy a record the reader
    // made, which excluding a quote is not a request to do.
    expect(document.querySelectorAll('.recall-log li').length, 'excluding a quote hid the answers already given').toBe(3)
  })

  // THE PANEL IS A WINDOW ON THE LOG AND SAYS SO WHEN IT IS ONE. Thirty rows of a
  // two-hundred-answer history read as the whole story unless something states
  // otherwise; a history that fits needs no such sentence.
  it('says how much of a long history it is not showing, and nothing when it shows all of it', async () => {
    const short = () => document.querySelector('.recall-log-head').textContent.replace(/\s+/g, ' ')
    render(<ReviewDot item={HIGHLIGHT} />)
    press()
    await waitFor(() => expect(document.querySelector('.recall-log-head')).toBeTruthy())
    expect(short(), 'a history the panel shows entirely still claims to be a window on something bigger')
      .not.toMatch(/\d/)
    cleanup()

    answer = { ...CARD, logged: 214 }
    render(<ReviewDot item={HIGHLIGHT} />)
    press()
    await waitFor(() => expect(document.querySelector('.recall-log-head')).toBeTruthy())
    await waitFor(() => expect(short(), 'the panel shows 3 of 214 answers and says nothing about the other 211').toMatch(/214/))
    expect(short(), 'the note names the total but not how many are on the page').toMatch(/\b3\b/)
  })

  it('says so rather than showing an empty panel when the read fails', async () => {
    answer = null
    render(<ReviewDot item={HIGHLIGHT} />)
    press()
    await waitFor(() => expect(panel()).toBeTruthy())
    await waitFor(() => expect(text().length, 'the panel opened and stayed blank').toBeGreaterThan(3))
  })
})

// THE VERB LIVES IN THE MARK, NOT IN THE SCREENS — the repo's directive: "A
// control drawn by one component on two screens has ONE behaviour, and it lives
// in one function that both screens call — not in a line each, which is how one
// of them goes on being right while the other quietly stops."
//
// Read off the source, because the failure this guards against is a call site
// that opens the panel ITSELF: several screens draw this mark, and the one
// written differently is a screen where the answer is different and nothing on
// it says so.
describe('the behaviour is the mark\'s', () => {
  const src = (f) => readFileSync(join(process.env.TIPPANI_SRC || 'src', f), 'utf8')

  // THE FILES COME FROM THE TREE, NOT FROM A LIST HERE. A hard-coded five was
  // both too many and too few: two of them draw no mark at all, so the loop was
  // reading files to skip them, and a SIXTH screen added next year would not have
  // been read at all. `sourcesUnder` walks the source and throws if the walk comes
  // back implausibly small, so an empty sweep cannot report a clean one.
  const jsx = () => sourcesUnder((n) => n.endsWith('.jsx'), 20)

  it('is handed nothing by any screen that draws it', () => {
    const offenders = []
    const drawn = jsx().filter((f) => /<ReviewDot\b/.test(src(f)))
    expect(drawn.length, 'no file in the tree draws the recall mark, so this sweep is passing over nothing').toBeGreaterThan(1)
    for (const f of drawn) {
      const body = src(f)
      for (const m of body.matchAll(/<ReviewDot\b([^>]*)>/g)) {
        // `item` says WHICH quote and `side` is where the tooltip points. Anything
        // else is a screen deciding what the mark does.
        const props = [...m[1].matchAll(/([A-Za-z][A-Za-z0-9]*)=/g)].map((p) => p[1])
        const extra = props.filter((p) => p !== 'item' && p !== 'side')
        if (extra.length) offenders.push(`${f}: <ReviewDot ${extra.join(' ')}>`)
      }
    }
    expect(offenders, 'a screen is telling the recall mark what to do, so the other screens drawing it do something else').toEqual([])
  })

  // A NEW CONTROL MAY NOT LAND UNDER THE TOUCH FLOOR.
  //
  // `scripts/screenshots/controls-baseline.json` holds the backup shelf at 300
  // controls under 44px at 390px — the narrowed in-card marks are most of them —
  // and that count is a ratchet: it may fall and never rise. The mark BECAME a
  // control in this change, drawn on every quote card across five surfaces, so a
  // short box on it would push that number past its ceiling on its own.
  //
  // WHAT IS CHECKED AND WHY IT IS THIS AND NOT "44 EVERYWHERE". The floor is a
  // PHONE rule — `controls.mjs` measures it at 390 and not at 1280, because a
  // desk pointer does not need it — so the mark's desktop box is deliberately
  // smaller and written as `max(<px floor>, <em>)`, the repo's pattern for a box
  // that must hold scaling text. What may not exist is a BARE px box under the
  // floor: that shape applies at every width, phone included, and there is no
  // narrower rule for the phone one to override. The 44px phone box itself is the
  // next case's business, and the browser probe is what proves the count held.
  //
  // AND THE SELECTOR IS READ WHOLE. Both cases below went through `cssRules`
  // after a rater slid `.hand-card .status-mark` into the MIDDLE of an existing
  // selector list and every one of 3,584 tests stayed green: the old split took
  // the last line of the list, so a selector with anything after it was
  // invisible. `test/css-rules.js` carries the argument.
  it('is never given a bare px box under the touch floor', () => {
    const FLOOR = 44
    const bad = []
    for (const r of rulesNaming(src('index.css'), 'status-mark')) {
      for (const d of r.body.matchAll(/\b(width|height|min-width|min-height)\s*:\s*([^;]+)/g)) {
        const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(d[2])
        if (px && Number(px[1]) < FLOOR) bad.push(`${r.sel} { ${d[1]}: ${d[2].trim()} }`)
      }
    }
    expect(bad,
      'these size the recall mark under the 44px floor at every width — the backup shelf already holds 300 controls under that floor as a ratchet, and a control added to the app may not raise it')
      .toEqual([])
  })

  // AND THE PHONE BOX IS THE FULL FLOOR, which is where the ratchet is measured.
  // The narrowing the ♥ takes at that width is what puts 300 marks under the
  // floor; this one may not join them, so it wears the pair rule's 44 and skips
  // the narrowing — 10px of reach the eye cannot see, in the direction the pack
  // asks for.
  // EVERY QUOTE-CARD ACTION ROW CARRIES IT, and the guard is a sweep because the
  // failure is an OMISSION. Library's `ActionRow`, Movies' `Frame` and Home's
  // favourite tile each draw the same row — ♥, copy, share, the colour dots and
  // the ⋯ — and Home's own comment already records what happens when they drift:
  // "a reader who has learned the row on a book's page should not have to
  // re-learn it here — which is exactly what shipped for one release". It
  // happened again here: the mark moved into that row on two of the three and
  // Home kept the old one, with no way to reach a quote's history from the
  // favourites board.
  //
  // Read off the source, because rendering those three needs three screens' worth
  // of props and the claim is about which files draw the mark at all.
  it('is drawn on every action row that draws the rest of that row', () => {
    // The row is identified by the two controls that have always been in it,
    // rather than by a class: `Hearts` beside `QuoteActions` is that row and
    // nothing else in the app is. Over the whole tree, so a screen added later is
    // swept rather than needing to be remembered here.
    const rows = jsx().filter((f) => {
      const body = src(f)
      return /<Hearts\b/.test(body) && /<QuoteActions\b/.test(body)
    })
    expect(rows.length, 'no file draws that action row, so this sweep is measuring nothing').toBeGreaterThan(1)
    const missing = rows.filter((f) => !/<ReviewDot\b/.test(src(f)))
    expect(missing,
      'these draw a quote card\'s action row without the recall mark, so the history is reachable from some screens and not others')
      .toEqual([])
  })

  it('keeps the whole floor at phone width instead of the narrowing beside it', () => {
    const narrowed = rulesNaming(src('index.css'), 'status-mark')
      .filter((r) => /\b(?:min-)?width\s*:\s*(?:[123]?\d)px/.test(r.body))
      .map((r) => r.sel)
    expect(narrowed,
      'the recall mark takes the in-card narrowing, so every quote card on five surfaces adds one control under the touch floor and the 390px ratchet rises')
      .toEqual([])
  })

  it('is sized in the same rule as the mark beside it, so the pair cannot drift', () => {
    // The ♥ and the recall mark stand a gap apart in the same card row and are
    // both things a thumb aims at. Their box is declared ONCE for the pair; two
    // copies is how one of them changes and the other quietly does not.
    const css = src('index.css')
    const pair = /\.heart,\s*\n\s*\.status-mark\s*\{/.test(css)
    expect(pair, 'the recall mark has its own phone-width box instead of the one the heart beside it shares').toBe(true)
    // And it is a button's box: no border, no background of its own.
    expect(/\.status-mark\s*\{[^}]*border:\s*0/.test(css), 'the mark became a button and kept the browser\'s chrome').toBe(true)
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
