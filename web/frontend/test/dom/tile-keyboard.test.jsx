// A CONTROL THAT ANSWERS A POINTER AND IGNORES A KEYBOARD.
//
// Home's two count tiles — "N books · M highlights", "N films · M lines" — are
// divs carrying `role="button"`, `tabIndex={0}` and an onClick, and carried no key
// handler at all. So a reader using a keyboard could tab to a thing that
// announces itself to their screen reader as a button, press Enter, press Space,
// and get nothing. That is worse than a plain div: the div makes no promise.
//
// WHY IT SURVIVED. Nothing in the suite presses a key on a role="button" that is
// not a <button>, and the two ratchets that would care — the icon and label
// sweeps — read what a control SAYS rather than what it DOES. flow.jsx got this
// right when it was written, which is how the repair is written too: one exported
// `onActivate`, used by both, rather than a third hand-copied pair of lines.
//
// The cases below press the keys rather than asserting the attribute, because the
// attribute is what was already there and correct.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/annotations')) return { ok: true, data: { annotations: [] } }
    if (path.startsWith('/dialogues')) return { ok: true, data: { dialogues: [] } }
    if (path.startsWith('/quotes')) return { ok: true, data: { utterances: [] } }
    if (path.startsWith('/movies')) return { ok: true, data: { movies: [] } }
    if (path.startsWith('/on-this-day')) return { ok: true, data: { quotes: [] } }
    if (path.startsWith('/stickers')) return { ok: true, data: { stickers: [] } }
    if (path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (path.startsWith('/tags')) return { ok: true, data: { tags: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Home } = await import('../../src/Home.jsx')
const { onActivate } = await import('../../src/ui.jsx')

let goLibrary, goMovies

const mount = async () => {
  goLibrary = vi.fn()
  goMovies = vi.fn()
  render(
    <Home
      user={{ username: 'alice', preferences: {} }}
      stats={{ books: 4, annotations: 40, movies: 2, dialogues: 20 }}
      onOpenBook={() => {}}
      onOpenMovie={() => {}}
      onGoLibrary={goLibrary}
      onGoMovies={goMovies}
      onGoQuotes={() => {}}
      onPending={() => {}}
      onReviewImport={() => {}}
    />,
  )
  await act(async () => {})
}

// Found by ROLE, which is the whole complaint: these say "button" to a screen
// reader, so a test that finds them any other way is not asking the question the
// reader asked.
const tiles = () => screen.getAllByRole('button').filter((el) => el.className.includes('hand-card'))

afterEach(() => cleanup())

describe('the Home count tiles', () => {
  it('are announced as buttons', async () => {
    await mount()
    expect(tiles().length).toBe(2)
  })

  it('open the library when Enter is pressed on the first', async () => {
    await mount()
    fireEvent.keyDown(tiles()[0], { key: 'Enter' })
    expect(goLibrary, 'Enter on a tile that calls itself a button did nothing').toHaveBeenCalled()
  })

  it('open the library when Space is pressed on the first', async () => {
    await mount()
    fireEvent.keyDown(tiles()[0], { key: ' ' })
    expect(goLibrary).toHaveBeenCalled()
  })

  it('open the films screen from the second', async () => {
    // BOTH TILES, because they were written twice and a fix applied once would
    // leave a page where one of two identical-looking tiles works.
    await mount()
    fireEvent.keyDown(tiles()[1], { key: 'Enter' })
    expect(goMovies).toHaveBeenCalled()
    expect(goLibrary, 'the wrong tile fired').not.toHaveBeenCalled()
  })

  it('ignore a key that is not an activation', async () => {
    await mount()
    fireEvent.keyDown(tiles()[0], { key: 'a' })
    fireEvent.keyDown(tiles()[0], { key: 'Tab' })
    expect(goLibrary).not.toHaveBeenCalled()
  })
})

describe('onActivate', () => {
  it('stops Space scrolling the page', async () => {
    // On a div, Space is the browser's scroll and not the control's activation, so
    // a handler that fires without preventing the default answers the reader twice
    // — once by opening the screen and once by scrolling the one they left.
    const fn = vi.fn()
    const preventDefault = vi.fn()
    onActivate(fn)({ key: ' ', preventDefault })
    expect(preventDefault).toHaveBeenCalled()
  })

  it('returns nothing when there is nothing to activate', () => {
    // Handed undefined it returns undefined rather than a handler that swallows
    // Enter and Space on an element with no action — which is what a `() => {}`
    // default would have done.
    expect(onActivate(undefined)).toBe(undefined)
  })
})
