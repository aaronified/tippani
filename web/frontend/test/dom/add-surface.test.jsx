// The add surface: one panel that asks what you are adding, then becomes that
// form alone.
//
// THE OWNER'S BRIEF: "redesign from ground up... we need to add various types of
// works, and also need to add various types of quotes. and then there is bulk
// imports. all these things need to be in the add surface." And on the forms:
// "each surface needs to only show their specific fields."
//
// `add-fields.test.js` checks the TABLE — which fields each kind claims. This
// checks that the rendered form obeys it, which is the half a table cannot prove:
// a door could offer every field in the table and draw a seventh anyway.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const posted = []
vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET' && path === '/books/4') return { ok: true, data: { id: 4, title: 'The Dispossessed', author: 'Le Guin' } }
    if (method === 'GET' && path === '/movies/9') return { ok: true, data: { id: 9, title: 'Stalker', media_type: 'movie', director: 'Tarkovsky' } }
    if (method === 'GET' && path === '/books') return { ok: true, data: { books: [{ id: 4, title: 'The Dispossessed', author: 'Le Guin' }] } }
    if (method === 'GET' && path === '/movies') return { ok: true, data: { movies: [{ id: 9, title: 'Stalker', media_type: 'movie' }] } }
    if (method === 'GET' && path === '/boards') return { ok: true, data: { boards: [{ id: 3, name: 'Others', kind: 'plain' }, { id: 7, name: 'Bengali proverbs', kind: 'proverb' }], total: 2 } }
    if (method === 'GET' && path === '/tags') return { ok: true, data: { tags: [{ name: 'craft' }] } }
    if (method === 'GET' && path === '/stickers') return { ok: true, data: { stickers: [] } }
    if (method === 'GET') return { ok: true, data: {} }
    posted.push({ path, body })
    return { ok: true, data: { id: 1 } }
  },
  errText: () => 'nope',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
  coverImgURL: () => '',
}))

const { default: AddSurface, QuoteForm } = await import('../../src/AddSurface.jsx')

const SECTIONS = { library: true, movies: true, quotes: true, anthologies: false }
const surface = (props = {}) =>
  render(<AddSurface open sections={SECTIONS} onClose={() => {}} onAdded={() => {}} onCaptured={() => {}} {...props} />)

const form = (door, props = {}) => {
  const state = {}
  render(<QuoteForm door={door} onSaved={() => {}} onSaveState={(s) => Object.assign(state, s)} {...props} />)
  return state
}

beforeEach(() => {
  posted.length = 0
  localStorage.clear()
})

describe('the chooser', () => {
  // THE FIRST SCREEN ASKS WHAT YOU ARE ADDING, not which form you want. The
  // owner's correction of the chooser I built before this one: "now i cannot
  // choose if i want to add a work, a board for quote, an anthology, a quote, or
  // import stuff. that should be the first screen."
  //
  // The old shape offered eleven DOORS in three groups — book, film, show, game,
  // board, highlight, line and the seven quote kinds. Those are forms, and it put
  // "a book" beside "a highlight" as alternatives when one is a thing you add to
  // the other.
  it('asks which of the five modes, and nothing else', async () => {
    surface({ initialSection: 'standalone' })
    expect(await screen.findByText('What are you adding?')).toBeTruthy()
    for (const mode of ['A work', 'A board', 'An anthology', 'A quote', 'Files']) {
      expect(screen.getByRole('button', { name: mode }), mode).toBeTruthy()
    }
    // And NOT the forms, which are the second question. A chooser offering both at
    // once is the shape that was wrong.
    for (const door of ['Speech', 'Letter', 'Proverb', 'From a book']) {
      expect(screen.queryByRole('button', { name: door }), door).toBeNull()
    }
  })

  // THE BUTTONS HAVE A SURFACE — the owner: "now the buttons look like just plain
  // text, for example." Bare `.tp-btn` is a 44px box with a transparent border
  // and no background at all; the paper comes from `.tp-btn-ghost` and
  // `.tp-btn-primary`. A rater stripped both class names off this row and all
  // 3,958 tests passed, so the reported regression was unguarded — which is the
  // whole reason for asserting a class name rather than a behaviour here.
  it('draws the choices as buttons, and marks the chosen one', async () => {
    surface({ initialSection: 'standalone' })
    const chosen = (name) => screen.getByRole('button', { name })
    // Before a mode is picked every one of them wears the unpressed face.
    for (const mode of ['A work', 'A board', 'A quote', 'Files']) {
      expect(chosen(mode).className, mode).toMatch(/\btp-btn-ghost\b/)
    }
    fireEvent.click(chosen('A board'))
    await screen.findByText('Which board')
    expect(chosen('A board').className).toMatch(/\btp-btn-primary\b/)
    expect(chosen('A board').getAttribute('aria-pressed')).toBe('true')
    expect(chosen('A work').className).toMatch(/\btp-btn-ghost\b/)
    // AND THE BOARD LIST ANSWERS THE SAME WAY. With every question on one screen
    // an answered board that looked identical to the ones passed over is the
    // same defect as a filter chip whose on-state class matches nothing.
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    await screen.findByText('What kind of quote')
    expect(chosen('Others').className).toMatch(/\btp-btn-primary\b/)
    expect(chosen('Bengali proverbs').className).toMatch(/\btp-btn-ghost\b/)
    // The kinds are buttons too, not a list of words.
    expect(chosen('Proverb').className).toMatch(/\btp-btn-ghost\b/)
  })

  // "if a work/board/anthology is chosen, i will also need to select the
  // work/board/anthology there" — `there`, on the same screen, because a mode with
  // no work named is not an answer.
  it('and asks which work on the same screen, once a work is the mode', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A work' }))
    expect(await screen.findByText('Which work')).toBeTruthy()
    // The mode row is still there, so changing your mind costs one press.
    expect(screen.getByRole('button', { name: 'A board' })).toBeTruthy()
  })

  it('and which board, with a way to make one that does not exist yet', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    expect(await screen.findByText('Which board')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bengali proverbs' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'A new board' })).toBeTruthy()
  })

  // A plain board cannot know whether the next line is a letter or a song (0037
  // gives a board two kinds), so it is asked — ON THE SAME SCREEN, under the
  // picker that answered the board. The owner's split: "step 1 (choosing what)
  // and step 2 (choosing which) should be in the first screen. step three
  // (entering annotations, of that is chosen) should be in secind screen."
  it('names the chosen board in the header, then offers the kinds', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    await waitFor(() => expect(screen.queryByText('What are you adding?')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Others' })).toBeTruthy()
    expect(screen.getByText('What kind of quote')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    // Still the board's name in the header — you always know where you are — with
    // the kind as the sub-line under it.
    expect(screen.getByRole('heading', { name: 'Others' })).toBeTruthy()
  })

  // EVERY QUESTION ON ONE SCREEN — the owner's reorder, and the reason there is
  // only one Back. Mode, container and kind are three answers deep and they are
  // all visible at once, each revealed by the one above it.
  it('keeps all three questions on the first screen, revealed in order', async () => {
    surface({ initialSection: 'standalone' })
    // Nothing but the modes until one is pressed.
    expect(await screen.findByRole('button', { name: 'A board' })).toBeTruthy()
    expect(screen.queryByText('Which board')).toBeNull()
    expect(screen.queryByText('What kind of quote')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'A board' }))
    expect(await screen.findByText('Which board')).toBeTruthy()
    // The board is named and the kind is still owed — so the kind list joins the
    // screen rather than replacing it, and the two earlier answers stay pressable.
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(screen.getByText('Which board')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'A quote' })).toBeTruthy()
  })

  // ONE BACK, BECAUSE THERE IS ONE SCREEN BEHIND. The owner: "there are two back
  // buttons now, both doing different things. streamline." The three-rung ladder
  // this replaces was the other half of that — walking back out of the form took
  // three presses through screens that are now one.
  it('and Back is a single press from the form to the first screen', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    fireEvent.click(screen.getByLabelText('Back to the list'))
    // Back on the one screen, with all three answers on it — and nothing further
    // to step back to, so the way out from here is Close.
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(screen.getByText('Which board')).toBeTruthy()
    expect(screen.queryByLabelText('Back to the list')).toBeNull()
  })

  // THE HEADER MENU IS GONE, and this case asserted it worked for one release.
  //
  // The owner asked for it — "a menu button to have a dropdown where users can
  // change the add mode" — and withdrew it over a screenshot of the built thing:
  // "remove this menu from the add surface. not needed since we have the back
  // button already." The dropdown's five rows WERE the chooser, and Back is what
  // returns to the chooser. Two controls doing one thing.
  //
  // THE CAPABILITY IS ASSERTED AND NOT ONLY THE ABSENCE. "The menu is gone" and
  // "the menu is gone and there is no way to the other modes" look the same from a
  // queryByLabelText, and only one of them is what was asked for.
  it('has no mode menu, because Back is the way to the other modes', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Others' }))
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Proverb' }))
    await screen.findByLabelText('Quote')
    expect(screen.queryByLabelText('Change what you are adding'), 'the mode menu came back').toBeNull()
    fireEvent.click(screen.getByLabelText('Back to the list'))
    // AND THE FIRST SCREEN IS WHERE THE MENU'S ROWS LIVE. It holds step 1 and step
    // 2 together — the modes and, under them, which work or board — so one Back
    // from the form lands on the list the dropdown was a copy of. That is the whole
    // of the owner's "we have the back button already", and asserting the mode is
    // REACHABLE is what keeps this from being a test that only deletes something.
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Files' }), 'the modes are not on the screen Back returns to').toBeTruthy()
  })

  // A CONTROL THAT DOES NOTHING IS WORSE THAN AN ABSENT ONE. `BoardForm` draws its
  // own footer pair and `BoardDoor` never passed `onCancel` down, so the
  // discarding half was wired to nothing — a rater pressed it and watched the
  // panel sit there, on the one surface the owner had just asked to have polished
  // and made consistent.
  it('and the new-board panel can be backed out of by its own Cancel', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'A board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'A new board' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    // Back on the first screen, at the step the header's own arrow would reach.
    expect(await screen.findByText('Which board')).toBeTruthy()
  })

  // The mode is offered and cannot act, which is the honest state for it: the
  // owner set anthologies aside — "anthology is due for a revamp" — and then asked
  // for the mode anyway. Leaving it out makes the first screen lie about what the
  // app holds; half-wiring it ships something misleading.
  it('says plainly that the anthology door is not open yet', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'An anthology' }))
    expect(await screen.findByText(/being reworked/i)).toBeTruthy()
  })

  it('does not ask when the ＋ was pressed somewhere that already answered', async () => {
    // A book's own ＋ knows the work, so it knows the quote is a highlight. Asking
    // again is asking a question the reader answered by standing there.
    surface({ initialSection: 'quote', initialTarget: { type: 'book', id: 4 } })
    // TWICE NOW, AND THE SECOND ONE IS THE HEADER. An opening target arrives as
    // {type, id} — enough to file the quote, not enough to name anything — so the
    // header drew an empty string while the form's work chip printed the title, on
    // what is probably the commonest way into this surface. `findAllByText` rather
    // than a count, because how many places print it is not what this case is about.
    expect((await screen.findAllByText('The Dispossessed')).length).toBeGreaterThan(0)
    expect(document.querySelector('.add-head-title')?.textContent, 'the header does not name the work')
      .toBe('The Dispossessed')
    expect(screen.queryByText('What are you adding?')).toBeNull()
    // And with no chooser behind it there is nothing to go Back to — a Back here
    // would walk the reader into a list they never saw.
    expect(screen.queryByLabelText('Back to the list')).toBeNull()
  })

  it('lets a proverb board answer the kind question by standing in it', async () => {
    // 0037 gives a board two kinds and only one of them has behaviour behind it,
    // so this is the single case where a board skips BOTH questions: the mode, and
    // the kind. The header is the board's own name.
    surface({ initialSection: 'standalone', initialBoard: 7 })
    await waitFor(() => expect(screen.queryByText('What are you adding?')).toBeNull())
    expect(await screen.findByRole('heading', { name: 'Bengali proverbs' })).toBeTruthy()
    // And it is the proverb form, not a list of kinds to pick from. Asserted on a
    // FIRST-SCREEN box: the region sits behind the disclosure, so looking for it
    // here would pass or fail on the disclosure rather than on the form.
    expect(screen.queryByText('What kind of quote')).toBeNull()
    expect(await screen.findByLabelText('Translation')).toBeTruthy()
  })

  it('still asks on a plain board, which cannot know', async () => {
    surface({ initialSection: 'standalone', initialBoard: 3 })
    // The mode and the container are both answered by standing there, so what is
    // left is the kind — and the header already names the board.
    expect(await screen.findByText('What kind of quote')).toBeTruthy()
    expect(screen.queryByText('What are you adding?')).toBeNull()
  })
})

describe('a form shows only its own fields', () => {
  it('never asks a proverb who said it, when, or where', async () => {
    form('proverb')
    await screen.findByLabelText('Quote')
    // The case the owner named first: "Hard drop anything that is not relevant
    // (writer of a movie, timestamp of a book, speaker of a proverb, etc)."
    for (const gone of ['Speaker', 'Written by', 'Occasion', 'Place', 'Sent to']) {
      expect(screen.queryByLabelText(gone), gone).toBeNull()
    }
    // Not even behind the disclosure — a hard drop is not a soft one.
    fireEvent.click(screen.getByText('Show every field'))
    for (const gone of ['Speaker', 'Occasion', 'Place']) {
      expect(screen.queryByLabelText(gone), gone).toBeNull()
    }
    // What it does ask: its two texts and where it is from.
    expect(screen.getByLabelText('Translation')).toBeTruthy()
    expect(screen.getByLabelText('Region')).toBeTruthy()
  })

  it('never asks a game for a runtime the server would throw away', async () => {
    // `normalizeLocator` clears both ends of a timestamp on a game, so a box for
    // one would be a box whose value is discarded without a word.
    const state = form('dialogue', { initialTarget: { type: 'movie', id: 9 } })
    await screen.findByLabelText('Quote')
    // The picker wears a MonoLabel over it rather than an aria-label on an input,
    // so this reads the words rather than the binding.
    expect(await screen.findByText('Which film, show or game')).toBeTruthy()
    expect(await screen.findByText('Stalker')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: "Let everything come true" } })
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    const body = posted[posted.length - 1].body
    // A film's line has both ends of its stretch and none of a game's locators.
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('timestamp_end')
    for (const gone of ['act', 'quest', 'dlc', 'season', 'episode']) {
      expect(body, gone).not.toHaveProperty(gone)
    }
  })

  // A SCREEN LINE TAKES SEVERAL SPEAKERS AND A BOOK HIGHLIGHT TAKES ONE, because
  // the two columns differ and both edit forms already agreed on which is which:
  // `annotations.character` holds a person, `dialogues.character` holds a
  // comma-joined list the film page has edited as tokens since it was written.
  //
  // The add surface took ONE name on both, which the owner's audit caught — "both
  // should offer the same entry support for the same fields". A two-speaker
  // exchange could be typed here as "A, B" and stored, but only the edit form
  // helped you do it.
  it('takes several speakers on a screen line, joined the way the column stores them', async () => {
    const state = form('dialogue', { initialTarget: { type: 'movie', id: 9 } })
    await screen.findByLabelText('Quote')
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'a line' } })
    const box = screen.getByLabelText('Character')
    // TokenInput commits a token on Enter, which is how the edit form takes them.
    for (const name of ['Stalker', 'Writer']) {
      fireEvent.change(box, { target: { value: name } })
      fireEvent.keyDown(box, { key: 'Enter' })
    }
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    expect(posted[posted.length - 1].body.character).toBe('Stalker, Writer')
  })

  it('and one speaker on a book highlight, because the column holds one', async () => {
    const state = form('annotation', { initialTarget: { type: 'book', id: 4 } })
    await screen.findByLabelText('Quote')
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'a line' } })
    // Behind the disclosure for a book — the owner put it there.
    fireEvent.click(screen.getByText(/Show every field/i))
    const box = await screen.findByLabelText('Character')
    // A single box, not a token box: typing a name and saving sends that name, and
    // Enter does not turn it into a chip.
    fireEvent.change(box, { target: { value: 'Shevek' } })
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    expect(posted[posted.length - 1].body.character).toBe('Shevek')
  })

  it('calls the same column by the word the kind uses', async () => {
    // One column, three words for it. "Speaker" over a poem's author would be the
    // interface guessing somebody said it aloud.
    form('speech')
    expect(await screen.findByLabelText('Speaker')).toBeTruthy()
    render(<QuoteForm door="poem" onSaved={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText('Written by')).toBeTruthy())
  })

  it("labels a song's source with all three things a song comes out of", async () => {
    // The owner's exact words: "song work label: Book / Movie / Album".
    form('song')
    expect(await screen.findByLabelText('Book / Movie / Album')).toBeTruthy()
  })

  it('holds the rare fields behind one disclosure rather than a second panel', async () => {
    form('letter')
    await screen.findByLabelText('Quote')
    // "letter: source title · source author : behind show all" — the owner's.
    expect(screen.queryByLabelText('Source title')).toBeNull()
    fireEvent.click(screen.getByText('Show every field'))
    expect(await screen.findByLabelText('Source title')).toBeTruthy()
    expect(screen.getByLabelText('Source author')).toBeTruthy()
  })
})

describe('what a form sends', () => {
  it('sends the kind it was opened as, without asking for it', async () => {
    // The door IS the answer to "what kind of quote is this" (0053's column), so
    // there is no Kind select anywhere on the form.
    const state = form('proverb')
    const box = await screen.findByLabelText('Quote')
    fireEvent.change(box, { target: { value: 'অতি সন্ন্যাসীতে গাজন নষ্ট' } })
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    const sent = posted[posted.length - 1]
    expect(sent.path).toBe('/quotes')
    expect(sent.body.kind).toBe('proverb')
  })

  it('omits every field the door hard-dropped rather than sending it empty', async () => {
    // A POST here is full-state. A field the form never drew must be ABSENT from
    // the body, not empty in it — otherwise a value that arrived by import is
    // cleared by a reader who was never shown a box for it.
    const state = form('proverb')
    fireEvent.change(await screen.findByLabelText('Quote'), { target: { value: 'a saying' } })
    await waitFor(() => expect(state.canSave).toBe(true))
    await state.save()
    const body = posted[posted.length - 1].body
    for (const gone of ['speaker', 'occasion', 'occasion_date', 'place', 'recipient', 'work_title', 'locator', 'source_author']) {
      expect(body, gone).not.toHaveProperty(gone)
    }
    // And what it did draw is there, including the two it shares with every kind.
    expect(body).toHaveProperty('translation')
    expect(body).toHaveProperty('region')
    expect(body.tags).toEqual([])
  })
})
