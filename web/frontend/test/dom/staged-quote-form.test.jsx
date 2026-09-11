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

// THE FIXTURES ARE SHAPED LIKE WHAT THE SERVER SENDS, and the first cut of this
// file was not. It set `kind: 'movie'` plus a `media_type` field — and
// `stagedWorkRow` HAS NO media_type. A staged work's kind IS the medium:
// `importMediaType()` (import_movies.go:79-85) answers "show", "game" or "movie"
// and import_staging.go:336 stores exactly that. So the suite was green over a
// shape the server never sends, while the code it guarded routed every show and
// every game down the books branch.
//
// `target_id` IS THE LIBRARY WORK a staged work will land on. A staged work that
// matched nothing has none, and then there is nothing to suggest from.

// A GAME. Its line is placed by an act, a quest and a pack, and by no timestamp at
// all — the server clears both ends on a game, so a box for one would post a value
// that is thrown away without a word.
const WORK = { id: 1, kind: 'game', title: 'Disco Elysium', quotes: 1, batch_id: 7, target_id: 42 }
const QUOTE = {
  id: 11, staged_work_id: 1, batch_id: 7,
  quote: 'Somewhere in the drywall, the Pale is waiting.',
  chapter: '', chapter_no: 0, location: '', character: 'Kim Kitsuragi', actor: '',
  act: '', quest: '', episode_name: '',
  season: null, episode: null,
  timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}

// A SHOW, which is the only medium with a season, an episode and an episode name —
// and the one that proves `kind` is read rather than assumed, because a show and a
// game are both "movie rows" in the library and must not draw the same boxes.
//
// A SEASON THE FILE GAVE, here to be left alone: the seed and the diff read it
// through one function, and when they were two lists the seed put it in as a NUMBER
// and the diff compared it against a string, so every row with a season re-sent its
// season on every save.
const SHOW_WORK = { id: 3, kind: 'show', title: 'Breaking Bad', quotes: 1, batch_id: 7, target_id: 42 }
const SHOW_QUOTE = {
  id: 13, staged_work_id: 3, batch_id: 7,
  quote: 'I am the one who knocks.',
  chapter: '', chapter_no: 0, location: '', character: 'Walter White', actor: '',
  act: '', quest: '', episode_name: '',
  season: 3, episode: 7,
  timestamp: '01:02:03', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}

// A BOOK, whose line is placed by a chapter and a page — and by nothing a screen
// has. This is the owner's own hard-drop example: "timestamp of a book".
const BOOK_WORK = { id: 4, kind: 'book', title: 'The Dispossessed', quotes: 1, batch_id: 7, target_id: 42 }
const BOOK_QUOTE = {
  id: 14, staged_work_id: 4, batch_id: 7,
  quote: 'There was a wall.',
  chapter: '', chapter_no: 0, location: 'p. 1', character: '', actor: '',
  act: '', quest: '', episode_name: '',
  season: null, episode: null,
  timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}

// A STANDALONE GROUP, which is how the queue holds quotes that belong to no book
// and no film: `kind: 'quotes'` and no target. WHICH boxes it gets is then the
// QUOTE's own kind (0053) — a speech is placed by an occasion and a date, a proverb
// by a region and nothing else.
const QUOTE_WORK = { id: 2, kind: 'quotes', title: '', quotes: 1, batch_id: 7, target_id: 0 }
const LOOSE_QUOTE = {
  id: 12, staged_work_id: 2, batch_id: 7,
  kind: 'speech',
  quote: 'The banality of evil.',
  chapter: '', chapter_no: 0, location: '', character: '', actor: '',
  speaker: 'Hannah Arendt', occasion: '', place: '', region: '',
  recipient: '', work_title: '', locator: '', source_author: '',
  occasion_date: '', occasion_circa: false,
  season: null, episode: null,
  timestamp: '', timestamp_end: '', dlc: '', language: '',
  color: 'yellow', favorite: false, tags: [],
}

// Which fixture `/import/staged` answers with, set per case.
let queued = null

const { default: StagingPage, WRITABLE_FIELDS } = await import('../../src/StagingPage.jsx')
// The resolver, under its own name: this file imports `t` from nowhere, so the
// labels come from the same place the panel reads them.
const { t: label } = await import('../../src/i18n.js')

const noop = () => {}

// The four shelves, each as {works, quotes, text, settle}: what the queue answers,
// the words on the row, and a box that shelf is CERTAIN to have. `settle` is what
// openEditor waits on, and it differs by kind — which is the whole point. Waiting
// on the wrong one hangs for the timeout and reports "did not render" over a form
// that rendered fine, which is how the first cut of this file hid a real bug.
const GAME = { works: [WORK], quotes: [QUOTE], text: /the Pale is waiting/, settle: 'DLC' }
const SHOW = { works: [SHOW_WORK], quotes: [SHOW_QUOTE], text: /the one who knocks/, settle: 'Episode name' }
const BOOK = { works: [BOOK_WORK], quotes: [BOOK_QUOTE], text: /There was a wall/, settle: 'Chapter name' }
const LOOSE = { works: [QUOTE_WORK], quotes: [LOOSE_QUOTE], text: /banality of evil/, settle: 'Occasion' }

const page = async (shelf = GAME) => {
  posted.length = 0
  asked.length = 0
  queued = { works: shelf.works, quotes: shelf.quotes }
  render(<StagingPage embedded onPending={noop} onOpenBook={noop} onOpenMovie={noop} onApproved={noop} />)
  // The row lands before anything can be pressed.
  await screen.findByText(shelf.text)
}

// Open the editor on the one staged row. The pencil is the row's edit affordance;
// finding it by role keeps this from depending on which glyph it wears.
const openEditor = async (shelf = GAME) => {
  const edit = await screen.findByRole('button', { name: /edit/i })
  fireEvent.click(edit)
  await screen.findByLabelText(shelf.settle)
}

// `at` opens one shelf and its editor — every case below starts this way.
const at = async (shelf) => {
  await page(shelf)
  await openEditor(shelf)
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
    await at(GAME)
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
    await at(GAME)
    const box = screen.getByLabelText('DLC')
    fireEvent.change(box, { target: { value: 'final' } })
    fireEvent.focus(box)
    expect(await screen.findByText('The Final Cut')).toBeTruthy()
  })

  it('and asks the DESTINATION, never the staged row', async () => {
    // A staged work is not in the library yet: it has no cast and no id anything
    // could be fetched by. `target_id` is the work it will BECOME part of, and
    // asking by the staged id would 404 quietly and leave every box empty.
    await at(GAME)
    expect(asked.some((p) => p === '/movies/42/cast'), 'the cast came from the wrong id').toBe(true)
    expect(asked.some((p) => p.startsWith('/movies/1/')), 'the staged work’s own id was fetched').toBe(false)
  })
})

describe('a staged row, before it is approved', () => {
  it('offers the three locators the endpoint has always accepted', async () => {
    // `POST /import/staged/bulk` has taken timestamp_end, dlc and language since
    // 0070/0071 (see stagedBulkReq). The form offered none of the three, so the
    // queue held a value the reader could read and not fix.
    //
    // TWO SHELVES, because the three do not share one. A game has a pack and NO
    // timestamp at either end — the server clears both on a game — so a fixture
    // carrying all three at once would be a row the app cannot produce.
    await at(GAME)
    expect(screen.getByLabelText('DLC'), 'a game line cannot be given its pack in the queue').toBeTruthy()
    expect(screen.getByLabelText('Language'), 'the field an import most often lacks cannot be filled').toBeTruthy()
    expect(screen.queryByLabelText('Ends'), 'a game was offered a range it cannot have').toBeNull()
  })

  it('and a show closes a range', async () => {
    await at(SHOW)
    expect(screen.getByLabelText('Ends'), 'a range cannot be closed in the queue').toBeTruthy()
  })

  it('and sends all three under the names the endpoint decodes', async () => {
    // THE NAME IS THE WHOLE OF THE WIRING. The endpoint decodes each field as a
    // pointer, so a misspelt key is silently left alone and the save reports
    // success having stored nothing — the same trap the IGDB pair's cases were
    // written for.
    await at(GAME)
    fireEvent.change(screen.getByLabelText('DLC'), { target: { value: 'The Final Cut' } })
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'English' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].dlc).toBe('The Final Cut')
    expect(posted[0].language).toBe('English')
  })

  it('and a show sends its range end under the same rule', async () => {
    await at(SHOW)
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '01:04:00' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].timestamp_end).toBe('01:04:00')
  })

  it('and sends nothing it was not asked to change', async () => {
    // The form posts only what moved, and that is not tidiness: assigning a
    // location or a timestamp RE-BASES its as-imported snapshot server-side, so
    // re-sending an untouched value destroys the undo a location formula relies
    // on. A new field joining the list is a new way to trip that.
    await at(SHOW)
    fireEvent.change(screen.getByLabelText('Episode name'), { target: { value: 'Ozymandias' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].episode_name).toBe('Ozymandias')
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
    await at(SHOW)
    const box = screen.getByLabelText('Season')
    fireEvent.change(box, { target: { value: '4' } })
    fireEvent.change(box, { target: { value: '3' } }) // back to what the file said
    fireEvent.change(screen.getByLabelText('Episode name'), { target: { value: 'Ozymandias' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect('season' in posted[0], 'a season typed back to its own value was posted as a change').toBe(false)
  })
})

// WHICH BOXES A ROW GETS — FOUR ANSWERS, NOT TWO, and both of the first two were
// wrong.
//
// This form began by drawing ONE set on every row: a staged proverb was offered a
// chapter, a season and a timestamp, and nothing with which to say who said it. The
// repair for that branched on "is this standalone", which fixed the proverb and left
// a BOOK row holding a timestamp, a season, an act and a DLC — the owner's own
// example of a hard drop, "timestamp of a book".
//
// The answer is the table the add surface already reads. A staged work's kind IS its
// medium (importMediaType), so `fieldKeys(door, { mediaType })` answers here exactly
// as it does there, and these cases are that table's four shapes.
//
// EACH CASE ASSERTS BOTH DIRECTIONS. A list of boxes that must be present catches a
// field going missing; only the list that must be ABSENT catches the failure this
// screen actually had, which was drawing everything for everybody.
describe('the boxes a staged row is given', () => {
  it('places a book line by its chapter and its page, and by nothing a screen has', async () => {
    await at(BOOK)
    for (const label of ['Chapter name', 'Chapter #', 'Location', 'Character', 'Language']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    for (const label of ['Timestamp', 'Season', 'Act', 'DLC', 'Occasion']) {
      expect(screen.queryByLabelText(label), `a book row was offered ${label}`).toBeNull()
    }
  })

  it('and a game line by its act, its quest and its pack', async () => {
    await at(GAME)
    for (const label of ['Character', 'Actor', 'Act', 'Quest', 'DLC', 'Language']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    // No timestamp at either end: the server clears both on a game, so a box for
    // one would post a value thrown away without a word.
    for (const label of ['Timestamp', 'Ends', 'Chapter name', 'Season', 'Occasion']) {
      expect(screen.queryByLabelText(label), `a game row was offered ${label}`).toBeNull()
    }
  })

  it('and a show line by its season, its episode and that episode’s name', async () => {
    await at(SHOW)
    for (const label of ['Character', 'Season', 'Episode', 'Episode name', 'Timestamp', 'Ends']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    for (const label of ['Act', 'Quest', 'DLC', 'Chapter name', 'Occasion']) {
      expect(screen.queryByLabelText(label), `a show row was offered ${label}`).toBeNull()
    }
  })

  it('and a standalone row by who said it, where, and on what occasion', async () => {
    await at(LOOSE)
    // A SPEECH's own locators (0053 puts the kind on the quote). `Region` and `To`
    // are a proverb's and a letter's, so a speech must NOT have them — the same
    // table that grants these withholds those.
    for (const label of ['Speaker', 'Occasion', 'Place', 'Source title', 'Source author', 'Language']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
    for (const label of ['Chapter name', 'Timestamp', 'Season', 'DLC', 'Region', 'To']) {
      expect(screen.queryByLabelText(label), `a speech was offered ${label}`).toBeNull()
    }
  })

  // WHEN IT WAS SAID, which the row PRINTS and could not repair. `occasion_date` is
  // on the locator line (StagedRow's `bits`), so a reader could see that a parser
  // had read "c. 40" as a year and do nothing about it — the same state the other
  // eleven were in, and the reason the commit that fixed them overclaimed by saying
  // "every locator".
  //
  // THE BOX HOLDS THE PHRASE AND THE COLUMN HOLDS THE CANONICAL FORM, which is what
  // this case is really for: type "399 BCE" and the body must carry '-0399'. Sending
  // the phrase would sort every ancient quote wrongly and silently.
  it('and a date typed as a phrase is sent in the form the column sorts by', async () => {
    await at(LOOSE)
    // BY PLACEHOLDER, not by label: PartialDateField wraps the input AND the
    // circa checkbox in one <label>, so its accessible name is the whole pair.
    fireEvent.change(screen.getByPlaceholderText(/399 BCE/), { target: { value: '399 BCE' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].occasion_date, 'the typed phrase was stored instead of the canonical form').toBe('-0399')
    // ITS FLAG RIDES WITH IT. A date sent without its circa is a date stated more
    // precisely than the reader meant, so a change to either sends both.
    expect('occasion_circa' in posted[0], 'the date went without its circa flag').toBe(true)
  })

  it('and pressing circa alone is a change, even with the date untouched', async () => {
    await at(LOOSE)
    fireEvent.click(screen.getByLabelText('The date is approximate'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].occasion_circa, 'the circa toggle did not reach the endpoint').toBe(true)
  })

  // A KIND NOBODY RECOGNISES STILL GETS AN EDITOR. `stagedDoor` reads the quote's
  // own kind (0053) and hands it to `fieldsFor`, which answers `{ main: [], more:
  // [] }` for anything it does not know — so an unchecked value drew ZERO locator
  // boxes and left a form offering nothing but colour, favourite and tags. That
  // reads as broken rather than as an unrecognised kind.
  //
  // `importQuoteKind` 400s a kind outside the seven, so the only way in is a
  // restored archive written by something else — which is exactly the reader who
  // must not lose their boxes.
  it('and a kind outside the seven falls back to the door that drops nothing', async () => {
    await at({ ...LOOSE, quotes: [{ ...LOOSE_QUOTE, kind: 'epigram' }] })
    for (const label of ['Speaker', 'Occasion', 'Place', 'Language']) {
      expect(screen.getByLabelText(label), label).toBeTruthy()
    }
  })

  it('and a standalone row sends its own locators under the right names', async () => {
    await at(LOOSE)
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

// THE BULK PANEL, WHICH HAD NO TEST AT ALL — and that is not a gap in coverage so
// much as the exact hole the drift fell through. It listed eight fields while the
// row editor listed twenty-one, and the field that had fallen out was `language`:
// the one most likely to be uniformly wrong across a whole imported file, which is
// what a bulk editor is FOR. A rater removed `language` from the list again and all
// four thousand frontend tests stayed green.
//
// SO IT IS CHECKED AGAINST WRITABLE_FIELDS ITSELF rather than against a list
// written here. A second copy of the field names in a test is the same defect one
// layer out: it would agree on the day it was typed and never again.
describe('the bulk field panel', () => {
  // Select a row and open the panel. `Edit fields…` is the bar's own control.
  const openPanel = async (shelf = GAME) => {
    await page(shelf)
    fireEvent.click(await screen.findByLabelText('Select this staged quote'))
    fireEvent.click(await screen.findByRole('button', { name: /edit fields/i }))
    await screen.findByText(/Edit 1 selected/)
  }

  it('draws every field the endpoint can write, bar the date', async () => {
    await openPanel()
    const missing = WRITABLE_FIELDS
      .filter(([key]) => key !== 'when')
      .filter(([, labelKey]) => !screen.queryByText(label(labelKey)))
      .map(([key]) => key)
    expect(missing, 'fields the row editor offers and the bulk panel does not').toEqual([])
  })

  // AND THE DATE IS ABSENT ON PURPOSE, asserted so the exclusion stays a decision
  // rather than becoming an oversight: a canonical date and a circa flag travelling
  // together cannot be said by a checkbox and a text box.
  it('and leaves the date out, because a checkbox cannot say "about 399 BCE"', async () => {
    await openPanel()
    expect(screen.queryByText(label('quotes.form.when.label')), 'the date joined the bulk panel').toBeNull()
  })

  it('and posts under the names the endpoint decodes', async () => {
    await openPanel()
    // Tick `language` and give it a value — the field whose absence started this.
    const row = screen.getByText(label('common.field.language.label')).closest('label')
    fireEvent.click(row.querySelector('input[type="checkbox"]'))
    fireEvent.change(row.querySelector('input.tp-input'), { target: { value: 'Bengali' } })
    fireEvent.click(screen.getByRole('button', { name: /apply to 1/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect(posted[0].language, 'the bulk panel posted under a key the endpoint ignores').toBe('Bengali')
  })

  // AND A NAME ASKS THE KEYBOARD FOR CAPITALS HERE TOO. The row editor said
  // `nameCase` per box and this panel said it nowhere, so one field asked the
  // keyboard for two different things depending on which control a reader reached
  // for. The mark is on WRITABLE_FIELDS, so the two cannot disagree again.
  it('and a name box asks for capitals, while a page reference does not', async () => {
    await openPanel()
    const boxFor = (labelKey) =>
      screen.getByText(label(labelKey)).closest('label').querySelector('input.tp-input')
    expect(boxFor('common.field.speaker.label').getAttribute('autocapitalize')).toBe('words')
    expect(boxFor('common.field.work-title.label').getAttribute('autocapitalize')).toBe('words')
    // Prose and positions must NOT: "the funeral of his brother" is not improved by
    // capitals, and neither is p. 142.
    expect(boxFor('common.field.location.label').getAttribute('autocapitalize')).toBeNull()
    expect(boxFor('common.field.occasion.label').getAttribute('autocapitalize')).toBeNull()
  })

  // AN UNTICKED FIELD IS NOT A CLEARED ONE, which is the whole reason this panel
  // uses checkboxes rather than blank boxes: a blank box cannot say the difference
  // between "leave it" and "empty it", and forty rows is a bad place to guess.
  it('and writes nothing for a field nobody ticked', async () => {
    await openPanel()
    const row = screen.getByText(label('common.field.language.label')).closest('label')
    fireEvent.click(row.querySelector('input[type="checkbox"]'))
    fireEvent.change(row.querySelector('input.tp-input'), { target: { value: 'Bengali' } })
    fireEvent.click(screen.getByRole('button', { name: /apply to 1/i }))

    await waitFor(() => expect(posted.length).toBe(1))
    expect('chapter' in posted[0], 'an unticked field was written anyway').toBe(false)
    expect('act' in posted[0], 'an unticked field was written anyway').toBe(false)
  })
})
