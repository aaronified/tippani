// "Quiz me on this book" — from the one screen that is entirely about one work.
//
// THE ENGINE WAS NEVER THE MISSING PART. `review_theme.go` has taken `?book=` and
// `?movie=` since themed practice shipped, `usePractice()` exists, and the action
// registry has carried a Practise entry marked works-only all along. All of it was
// wired from a person's panel and from a colour tile on Stats — and from nowhere
// on a work's own page.
//
// IT USED TO BE A SOURCE SCAN, and that is what changed. It read Library.jsx and
// Movies.jsx and asserted they contained the literal
// `const { practise, practiceDialog } = usePractice()`, the literal
// `practise({ book: book.id, label: book.title })`, and the literal
// `{practiceDialog}`. Three assertions that the code is present, none of which
// survives renaming a variable and none of which would notice a dialog rendered
// where nothing can see it, a themed round asking for the wrong work, or a button
// wired to a handler that throws.
//
// So this presses the button and reads what the round asks the server for. The
// defect it was written to catch — an ABSENCE, nothing rendered and nothing thrown
// — is caught by looking for the control and failing to find it, which is what
// `getByLabelText` does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS

const BOOK = {
  id: 4, title: 'A Wizard of Earthsea', author: 'Le Guin', genres: [], series: '',
  status: '', favorite: 0, annotation_count: 2, cover_path: '',
}
const MOVIE = {
  id: 5, title: 'Stalker', director: 'Tarkovsky', media_type: 'movie', genres: [],
  favorite: 0, dialogue_count: 2, poster_path: '',
}

// The library every case starts from. Held as a named function and re-installed
// in beforeEach, because a case that needs a different server (the anthology
// ones) replaces the implementation and would otherwise leave it replaced for
// everything after it — a mock that leaks between cases fails whichever case
// happens to run next, which reads as a bug in that case.
const defaultJson = async (method, url) => {
  CALLS.push([method, url])
  if (url === '/books') return { ok: true, status: 200, data: { books: [BOOK] } }
  if (url.startsWith('/books/')) return { ok: true, status: 200, data: BOOK }
  if (url === '/movies') return { ok: true, status: 200, data: { movies: [MOVIE] } }
  if (url.startsWith('/movies/')) return { ok: true, status: 200, data: MOVIE }
  if (url.startsWith('/annotations')) return { ok: true, status: 200, data: { annotations: [] } }
  if (url.startsWith('/dialogues')) return { ok: true, status: 200, data: { dialogues: [] } }
  if (url.startsWith('/review/practice')) return { ok: true, status: 200, data: { items: [] } }
  // The lists a work page loads beside its own record. Named rather than left
  // to the catch-all, because the catch-all answers `{}` and a screen that maps
  // over `data.tags` throws on it — which fails as a crash somewhere else
  // entirely and reads like a bug in the thing under test.
  if (url === '/tags') return { ok: true, status: 200, data: { tags: [] } }
  if (url.startsWith('/stickers')) return { ok: true, status: 200, data: { stickers: [] } }
  if (url.startsWith('/people')) return { ok: true, status: 200, data: { people: [] } }
  if (url.startsWith('/cast')) return { ok: true, status: 200, data: { cast: [] } }
  if (url.startsWith('/boards')) return { ok: true, status: 200, data: { boards: [] } }
  if (url.startsWith('/anthologies')) return { ok: true, status: 200, data: { anthologies: [] } }
  return { ok: true, status: 200, data: {} }
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn((method, url) => defaultJson(method, url)),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, data: null })),
}))

// The screens, imported once at module scope. A dynamic import inside a case
// evaluates the module in whatever context that case is running in, and these
// modules touch window.matchMedia the moment they load — see theme.js.
const { default: Library } = await import('../../src/Library.jsx')
const { default: Movies } = await import('../../src/Movies.jsx')
const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const { buildScreenActions } = await import('../../src/ui.jsx')
const api = await import('../../src/api.js')

beforeEach(() => {
  CALLS = []
  api.json.mockImplementation(defaultJson)
})
afterEach(() => cleanup())

const press = async (el) => {
  await act(async () => { el.click() })
}

// Each screen: how to open a work on it, what the control is called, and the
// query the round must carry.
const SCREENS = [
  {
    name: 'the Library',
    open: async () => {
      render(<Library openId={BOOK.id} onOpen={() => {}} onClose={() => {}} onOpenMovie={() => {}}
        creditSeparators=",;&" onAdd={() => {}} dataNonce={0} />)
      await screen.findByText('A Wizard of Earthsea')
    },
    aria: 'Practise this book',
    menu: 'Practise this book',
    query: 'book=4',
  },
  {
    name: 'the Catalogue',
    open: async () => {
      render(<Movies openId={MOVIE.id} onOpen={() => {}} onClose={() => {}} onOpenBook={() => {}}
        creditSeparators=",;&" onAdd={() => {}} dataNonce={0} />)
      await screen.findByText('Stalker')
    },
    aria: 'Practise this title',
    menu: 'Practise this title',
    query: 'movie=5',
  },
]

// The ANTHOLOGY is the sixth theme, and the one that shipped unreachable: the
// engine had taken `?anthology=` since migration 0043 and no screen had a button
// to set it. It is here rather than beside its parameter test because "the theme
// works and nothing sets it" is the same feature nobody can use, and the only
// place that shows is the screen.
const ANTHOLOGY = { id: 3, title: 'Lines for a bad week', entry_count: 2 }
const ENTRIES = [
  { id: 1, kind: 'quote', item_id: 11, quote: 'A borrowed line', position: 1 },
  { id: 2, kind: 'quote', item_id: 12, quote: 'Another one', position: 2 },
]

describe('an anthology', () => {
  const open = async () => {
    api.json.mockImplementation(async (method, url) => {
      CALLS.push([method, url])
      if (url === '/anthologies') return { ok: true, status: 200, data: { anthologies: [ANTHOLOGY] } }
      if (url.startsWith('/anthologies/')) {
        return { ok: true, status: 200, data: { anthology: ANTHOLOGY, entries: ENTRIES } }
      }
      if (url.startsWith('/review/practice')) return { ok: true, status: 200, data: { items: [] } }
      if (url === '/tags') return { ok: true, status: 200, data: { tags: [] } }
      return { ok: true, status: 200, data: {} }
    })
    render(<AnthologiesPage openId={ANTHOLOGY.id} onOpen={() => {}} onClose={() => {}}
      onOpenBook={() => {}} onOpenMovie={() => {}} />)
    await screen.findByText('Lines for a bad week')
  }

  it('offers to quiz you on it, and the round carries the anthology', async () => {
    await open()
    await press(screen.getByText('Practise').closest('button'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    const asked = CALLS.find(([, url]) => url.startsWith('/review/practice'))
    expect(asked, 'the round never asked the server for any cards').toBeTruthy()
    expect(asked[1], 'the round is not themed on this anthology').toContain('anthology=3')
  })

  it('will not offer a round over an anthology with nothing in it', async () => {
    // A themed round with no cards is a dialog that opens on an apology. The
    // control says so by being disabled rather than by answering with one.
    api.json.mockImplementation(async (method, url) => {
      if (url.startsWith('/anthologies/')) {
        return { ok: true, status: 200, data: { anthology: { ...ANTHOLOGY, entry_count: 0 }, entries: [] } }
      }
      if (url === '/tags') return { ok: true, status: 200, data: { tags: [] } }
      return { ok: true, status: 200, data: {} }
    })
    render(<AnthologiesPage openId={ANTHOLOGY.id} onOpen={() => {}} onClose={() => {}}
      onOpenBook={() => {}} onOpenMovie={() => {}} />)
    await screen.findByText('Lines for a bad week')
    expect(screen.getByText('Practise').closest('button').disabled).toBe(true)
  })
})

for (const s of SCREENS) {
  describe(`a work opened from ${s.name}`, () => {
    it('offers to quiz you on it', async () => {
      await s.open()
      expect(screen.getByLabelText(s.aria), `no Practise control on ${s.name}`).toBeTruthy()
    })

    it('starts a round themed on THIS work, not on the whole library', async () => {
      await s.open()
      await press(screen.getByLabelText(s.aria))
      // The dialog is rendered — a hook whose dialog nobody draws is a button
      // that does nothing, and that is exactly what this used to check by looking
      // for `{practiceDialog}` in the file.
      await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
      const asked = CALLS.find(([, url]) => url.startsWith('/review/practice'))
      expect(asked, 'the round never asked the server for any cards').toBeTruthy()
      expect(asked[1], `the round is not themed on this work`).toContain(s.query)
    })

    it('and the ⋯ menu offers it too, which is the only door on a phone', async () => {
      // The phone's bottom dock replaces the desktop hero row, so a control added
      // to only the hero is missing on a phone entirely — the same gap that left
      // a work page with no Search for four releases. buildScreenActions() is
      // exactly what the ⋯ calls when it opens, so this asks the menu rather than
      // asserting a `label:` line exists in the file.
      await s.open()
      const labels = buildScreenActions().map((a) => a.label)
      expect(labels, `Practise is missing from ${s.name}'s ⋯ menu`).toContain(s.menu)
    })

    it('and the round says which work it is about', async () => {
      // The label is the reader's only confirmation that they got the round they
      // asked for rather than the general deck.
      await s.open()
      await press(screen.getByLabelText(s.aria))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(s.query.startsWith('book') ? 'A Wizard of Earthsea' : 'Stalker')).toBeTruthy()
    })
  })
}
