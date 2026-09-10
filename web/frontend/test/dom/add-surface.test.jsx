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
  it('offers a work, a quote and a way to drop files, in three named groups', async () => {
    surface({ initialSection: 'standalone' })
    expect(await screen.findByText('What are you adding?')).toBeTruthy()
    for (const group of ['A work', 'A quote', 'Many at once']) {
      expect(screen.getByText(group), group).toBeTruthy()
    }
    // The owner's three groups, and the doors inside them. A board rides with the
    // works because it is a container you make before you file into it.
    for (const door of ['Book', 'Film', 'Show', 'Game', 'Board']) {
      expect(screen.getByRole('button', { name: door }), door).toBeTruthy()
    }
    for (const door of ['From a book', 'From a screen', 'Speech', 'Letter', 'Essay', 'Poem', 'Song', 'Proverb', 'Other']) {
      expect(screen.getByRole('button', { name: door }), door).toBeTruthy()
    }
  })

  it('becomes the form for the door pressed, and can be backed out of', async () => {
    surface({ initialSection: 'standalone' })
    fireEvent.click(await screen.findByRole('button', { name: 'Proverb' }))
    // THE PANEL BECOMES THE FORM: the chooser is gone, the title is the door's own
    // word, and the boxes are the proverb's.
    await waitFor(() => expect(screen.queryByText('What are you adding?')).toBeNull())
    expect(screen.getByText('Proverb')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Back to the list'))
    expect(await screen.findByText('What are you adding?')).toBeTruthy()
  })

  it('does not ask when the ＋ was pressed somewhere that already answered', async () => {
    // A book's own ＋ knows the work, so it knows the quote is a highlight. Asking
    // again is asking a question the reader answered by standing there.
    surface({ initialSection: 'quote', initialTarget: { type: 'book', id: 4 } })
    expect(await screen.findByText('The Dispossessed')).toBeTruthy()
    expect(screen.queryByText('What are you adding?')).toBeNull()
    // And with no chooser behind it there is nothing to go Back to — a Back here
    // would walk the reader into a list they never saw.
    expect(screen.queryByLabelText('Back to the list')).toBeNull()
  })

  it('lets a proverb board answer the kind question by standing in it', async () => {
    // 0037 gives a board two kinds and only one of them has behaviour behind it,
    // so this is the single case where a board can skip the chooser.
    surface({ initialSection: 'standalone', initialBoard: 7 })
    await waitFor(() => expect(screen.queryByText('What are you adding?')).toBeNull())
    expect(screen.getByText('Proverb')).toBeTruthy()
  })

  it('still asks on a plain board, which cannot know', async () => {
    surface({ initialSection: 'standalone', initialBoard: 3 })
    expect(await screen.findByText('What are you adding?')).toBeTruthy()
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
