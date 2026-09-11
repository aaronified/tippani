// EDITING A ROW BEFORE IT IS APPROVED, WHICH IS WHAT THE QUEUE IS FOR.
//
// THE OWNER, on this part of the backlog: "so once you complete the metadata tasks,
// do the import review. that is a serious backlog right now." And the queue's own
// argument, written in the importer: "an import guesses, and the queue is where a
// wrong guess gets corrected."
//
// A FIELD THE ROW SHOWS AND THE FORM CANNOT TOUCH BREAKS THAT ARGUMENT. StagedRow
// prints every locator a row carries so the reader can check it before approving —
// and for three of them, checking was all they could do: the correction had to wait
// until after approval, on a different screen, which is the repair the queue exists
// to make unnecessary.
//
// AND THE WHOLE SCREEN HAD NO DOM TEST AT ALL, which is why the gap lasted. Adding
// the fields without this file would be adding them the same way.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Every POST the form makes, so a case can read what actually went up rather than
// that a button was pressed.
const posted = []
// Every GET path, so a case can say WHICH work was asked about rather than that
// something was.
const asked = []

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET') asked.push(path)
    if (method === 'POST' && path === '/import/staged/bulk') {
      posted.push(body)
      return { ok: true, data: { updated: 1 } }
    }
    if (method === 'GET' && path === '/import/staged') {
      return { ok: true, data: { pending: 1, batches: [], ...(queued || { works: [WORK], quotes: [QUOTE] }) } }
    }
    // The destination work's own rows, which is what a staged row's editor should
    // be offering. Asked for by target_id, never by the staged work's own id: the
    // staged row is not in the library yet and has no cast of its own.
    if (method === 'GET' && path === '/movies/42/cast') {
      return { ok: true, data: { cast: [{ character: 'Kim Kitsuragi', actor: 'Jullian Champenois' }] } }
    }
    if (method === 'GET' && path === '/movies/42/packs') {
      return { ok: true, data: { packs: [{ name: 'The Final Cut' }] } }
    }
    if (method === 'GET') return { ok: true, data: {} }
    return { ok: true, data: {} }
  },
  errText: (r, fallback) => (r.data && r.data.error) || fallback,
  coverImgURL: () => '',
}))

// A GAME'S LINE, because it is the row that carries all three of the fields this
// file is about: a pack, a range that ends, and a language the file did not state.
// `target_id` IS THE LIBRARY WORK this staged work will land on. A staged work that
// matched nothing has none, and then there is nothing to suggest from — the case at
// the bottom of this file is about exactly that.
const WORK = { id: 1, kind: 'movie', title: 'Disco Elysium', media_type: 'game', quotes: 1, batch_id: 7, target_id: 42 }
const QUOTE = {
  id: 11, staged_work_id: 1, batch_id: 7,
  quote: 'Somewhere in the drywall, the Pale is waiting.',
  chapter: '', chapter_no: 0, location: '', character: 'Kim Kitsuragi', actor: '',
  // A SEASON THE FILE GAVE, and it is here to be left alone. The seed and the
  // diff read it through one function now; when they were two lists the seed put
  // it in as a NUMBER and the diff compared it against a string, so every row
  // with a season re-sent its season on every save.
  season: 3, episode: 7,
  timestamp: '01:02:03', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}

// A STANDALONE GROUP, which is how the queue holds quotes that belong to no book
// and no film: `kind: 'quotes'` and no target. Its rows are placed by who said
// them and on what occasion — never by a chapter or a timestamp.
const QUOTE_WORK = { id: 2, kind: 'quotes', title: '', quotes: 1, batch_id: 7, target_id: 0 }
const LOOSE_QUOTE = {
  id: 12, staged_work_id: 2, batch_id: 7,
  quote: 'The banality of evil.',
  chapter: '', chapter_no: 0, location: '', character: '', actor: '',
  speaker: 'Hannah Arendt', occasion: '', place: '', region: '',
  recipient: '', work_title: '', locator: '', source_author: '',
  timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}
// Which fixture `/import/staged` answers with, set per case.
let queued = null

const { default: StagingPage } = await import('../../src/StagingPage.jsx')

const noop = () => {}
const page = async (fixture = null) => {
  posted.length = 0
  asked.length = 0
  queued = fixture
  render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} onApproved={noop} />)
  // The row lands before anything can be pressed.
  await screen.findByText(fixture ? /banality of evil/ : /the Pale is waiting/)
}

// Open the editor on the one staged row. The pencil is the row's edit affordance;
// finding it by role keeps this from depending on which glyph it wears.
//
// `settle` is a box this row is CERTAIN to have, and it differs by group — which
// is the whole point of the two field sets. Waiting on the wrong one would hang
// for the timeout and report "did not render" over a form that rendered fine.
const openEditor = async (settle = 'DLC') => {
  const edit = await screen.findByRole('button', { name: /edit/i })
  fireEvent.click(edit)
  await screen.findByLabelText(settle)
}

// WHAT THE DESTINATION ALREADY KNOWS, OFFERED WHERE IT IS MOST NEEDED.
//
// The add and edit forms have offered the library's own values since #92. A staged
// row's editor offered none — which is backwards: the queue is the ONE place a value
// is most likely to be a near-miss of an existing one, because an importer wrote it
// and not a person. "Ch. 4" against the library's "Chapter 4" is two chapters as far
// as every grouping in the app is concerned.
describe('the values the destination work already holds', () => {
  it('offers the work’s own cast on the character box', async () => {
    await page()
    await openEditor()
    const box = screen.getByLabelText('Character')
    fireEvent.change(box, { target: { value: 'kim' } })
    fireEvent.focus(box)
    // THE ACTOR IS WHAT IS ASSERTED, not the character — and that is the stronger
    // claim as well as the workable one. The staged row already prints
    // "Kim Kitsuragi" on its own locator line, so finding that text proves nothing
    // about the popover (and `findByText` throws on the two of them). The actor
    // appears ONLY as the suggestion's second line, which is the thing CastCombo
    // exists to draw: it is how a reader knows the name matched a real cast row
    // rather than being kept as loose text.
    expect(await screen.findByText('Jullian Champenois')).toBeTruthy()
  })

  it('and the work’s own packs on the DLC box', async () => {
    await page()
    await openEditor()
    const box = screen.getByLabelText('DLC')
    fireEvent.change(box, { target: { value: 'final' } })
    fireEvent.focus(box)
    expect(await screen.findByText('The Final Cut')).toBeTruthy()
  })

  it('and asks the DESTINATION, never the staged row', async () => {
    // A staged work is not in the library yet: it has no cast and no id anything
    // could be fetched by. `target_id` is the work it will BECOME part of, and
    // asking by the staged id would 404 quietly and leave every box empty.
    await page()
    await openEditor()
    expect(asked.some((p) => p === '/movies/42/cast'), 'the cast came from the wrong id').toBe(true)
    expect(asked.some((p) => p.startsWith('/movies/1/')), 'the staged work’s own id was fetched').toBe(false)
  })
})

describe('a staged row, before it is approved', () => {
  it('offers the three locators the endpoint has always accepted', async () => {
    // `POST /import/staged/bulk` has taken timestamp_end, dlc and language since
    // 0070/0071 (see stagedBulkReq). The form offered none of the three, so the
    // queue held a value the reader could read and not fix.
    await page()
    await openEditor()
    expect(screen.getByLabelText('Ends'), 'a range cannot be closed in the queue').toBeTruthy()
    expect(screen.getByLabelText('DLC'), 'a game line cannot be given its pack in the queue').toBeTruthy()
    expect(screen.getByLabelText('Language'), 'the field an import most often lacks cannot be filled').toBeTruthy()
  })

  it('and sends all three under the names the endpoint decodes', async () => {
    // THE NAME IS THE WHOLE OF THE WIRING. The endpoint decodes each field as a
    // pointer, so a misspelt key is silently left alone and the save reports
    // success having stored nothing — the same trap the IGDB pair's cases were
    // written for.
    await page()
    await openEditor()
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '01:04:00' } })
    fireEvent.change(screen.getByLabelText('DLC'), { target: { value: 'The Final Cut' } })
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'English' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].timestamp_end).toBe('01:04:00')
    expect(posted[0].dlc).toBe('The Final Cut')
    expect(posted[0].language).toBe('English')
  })

  it('and sends nothing it was not asked to change', async () => {
    // The form posts only what moved, and that is not tidiness: assigning a
    // location or a timestamp RE-BASES its as-imported snapshot server-side, so
    // re-sending an untouched value destroys the undo a location formula relies
    // on. A new field joining the list is a new way to trip that.
    await page()
    await openEditor()
    fireEvent.change(screen.getByLabelText('DLC'), { target: { value: 'The Final Cut' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].dlc).toBe('The Final Cut')
    expect('timestamp' in posted[0], 'an untouched timestamp was re-sent, re-basing its snapshot').toBe(false)
    expect('season' in posted[0], 'an untouched season was re-sent').toBe(false)
    expect('episode' in posted[0], 'an untouched episode was re-sent').toBe(false)
    expect('timestamp_end' in posted[0], 'an untouched range end was re-sent').toBe(false)
    expect('language' in posted[0], 'an untouched language was re-sent').toBe(false)
  })

  // TYPING A VALUE BACK TO WHAT IT WAS IS NOT A CHANGE, and the two counts are
  // where that breaks: the queue sends them as NUMBERS and an input hands back a
  // STRING, so 3 and '3' are the same season and different values. The form reads
  // both sides through one function that returns a string for exactly this, and
  // without it a reader who opened the season box and thought better of it would
  // post a season they never meant to set.
  it('and a value typed back to what it was is not a change', async () => {
    await page()
    await openEditor()
    const box = screen.getByLabelText('Season')
    fireEvent.change(box, { target: { value: '4' } })
    fireEvent.change(box, { target: { value: '3' } }) // back to what the file said
    fireEvent.change(screen.getByLabelText('DLC'), { target: { value: 'The Final Cut' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect('season' in posted[0], 'a season typed back to its own value was posted as a change').toBe(false)
  })
})

// WHICH BOXES A ROW GETS, and the two answers are the only two the queue knows.
//
// This form drew one set for every row: a staged proverb was offered a chapter, a
// season and a timestamp — three fields that cannot apply to it — and no way at
// all to say who said it or on what occasion. The row PRINTS the speaker and the
// occasion, so a reader could read what the importer guessed and not touch it.
describe('the boxes a staged row is given', () => {
  it('places a row bound for a work by where it is in that work', async () => {
    await page()
    await openEditor()
    for (const label of ['Chapter name', 'Episode name', 'Act', 'Quest']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    // And not by an occasion, which a line with a book or a film behind it does
    // not have — the add surface hard drops these for the same reason.
    expect(screen.queryByLabelText('Occasion'), 'a work row was offered an occasion').toBeNull()
    expect(screen.queryByLabelText('Region'), 'a work row was offered a region').toBeNull()
  })

  it('and a standalone row by who said it, where, and on what occasion', async () => {
    await page({ works: [QUOTE_WORK], quotes: [LOOSE_QUOTE] })
    await openEditor('Occasion')
    for (const label of ['Speaker', 'Occasion', 'Place', 'Region', 'To', 'Source title', 'Page', 'Source author']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    // A quote that belongs to nothing has no chapter and no runtime to be at.
    for (const label of ['Chapter name', 'Timestamp', 'Season', 'DLC']) {
      expect(screen.queryByLabelText(label), `a standalone row was offered ${label}`).toBeNull()
    }
  })

  // LANGUAGE IS ON BOTH, because every row has one and an import is where it is
  // most often missing — a clippings export of a Bengali novel arrives with none.
  // TWO CASES RATHER THAN ONE WITH TWO RENDERS: testing-library tears down between
  // `it`s and not inside one, so a second render leaves two queues in the document
  // and every getByRole finds two of everything.
  it('and a work row is asked its language', async () => {
    await page()
    await openEditor()
    expect(screen.getByLabelText('Language')).toBeTruthy()
  })

  it('and so is a standalone one', async () => {
    await page({ works: [QUOTE_WORK], quotes: [LOOSE_QUOTE] })
    await openEditor('Occasion')
    expect(screen.getByLabelText('Language')).toBeTruthy()
  })

  it('and a standalone row sends its own locators under the right names', async () => {
    await page({ works: [QUOTE_WORK], quotes: [LOOSE_QUOTE] })
    await openEditor('Occasion')
    fireEvent.change(screen.getByLabelText('Occasion'), { target: { value: 'the Eichmann trial' } })
    fireEvent.change(screen.getByLabelText('Place'), { target: { value: 'Jerusalem' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].occasion).toBe('the Eichmann trial')
    expect(posted[0].place).toBe('Jerusalem')
    // AND NOTHING FROM THE OTHER SET. A standalone row has no chapter box, so a
    // `chapter` key in the body would be the form posting a field it never drew.
    expect('chapter' in posted[0], 'a field the form never drew was posted').toBe(false)
    expect('speaker' in posted[0], 'an untouched speaker was re-sent').toBe(false)
  })
})
