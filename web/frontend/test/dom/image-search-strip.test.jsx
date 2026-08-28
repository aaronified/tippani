// The picture strip: the people console's half of POST /images/search.
//
// TWO BEHAVIOURS ARE WORTH HOLDING and neither is visible from the server side.
//
// The button does two different things depending on what the install has, and
// the reason it is one button is that "find a picture" is one intention. An
// install with a supplier shows candidates in the app; an install with none does
// exactly what it did before this feature existed and opens a web search in a
// tab. Getting that backwards is silent: a reader with nothing configured would
// press it and watch nothing happen.
//
// And the strip DRAWS one URL while STAGING another. A web image search returns
// pictures from hosts the page's img-src cannot name in advance, so the
// thumbnail is what is drawn and the original is what gets saved. Drawing the
// original is a broken frame; saving the thumbnail is a 150px portrait.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const SAVED = {
  id: 7, kind: 'author', name: 'Anna Kavan', bio: 'A novelist.',
  born: '1901', died: '1968', links: '', source: 'manual', source_id: '', image_path: '',
}

let IMAGES
let SOURCES
let SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (method === 'GET' && path.startsWith('/people?')) {
      return { ok: true, data: { exists: true, person: SAVED } }
    }
    if (path === '/images/search') {
      return { ok: true, data: { images: IMAGES, sources: SOURCES } }
    }
    return { ok: true, data: {} }
  }),
  DEMO: false,
}))

const { PersonModal } = await import('../../src/people.jsx')

async function openForm() {
  render(<PersonModal kind="author" name="Anna Kavan" onClose={() => {}} />)
  await screen.findByText('A novelist.')
  fireEvent.click(screen.getByText('Edit'))
  return screen.findByText('search images')
}

beforeEach(() => {
  SENT = []
  IMAGES = []
  SOURCES = { google: false, amazon: false }
  window.open = vi.fn()
  cleanup()
})

describe('finding a picture for a person', () => {
  it('shows the candidates when a supplier is configured', async () => {
    IMAGES = [
      { url: 'https://pics.test/kavan.jpg', thumb: 'https://encrypted-tbn0.gstatic.com/t', source: 'google' },
    ]
    SOURCES = { google: true, amazon: false }
    await openForm()
    fireEvent.click(screen.getByText('search images'))

    const img = await waitFor(() => {
      const el = document.querySelector('.cover-pick img')
      expect(el, 'no candidate was drawn').toBeTruthy()
      return el
    })
    // DRAWN: the thumbnail, which is the only one the page is allowed to load.
    expect(img.getAttribute('src')).toBe('https://encrypted-tbn0.gstatic.com/t')
    expect(window.open).not.toHaveBeenCalled()

    // STAGED: the original, which is what the server will fetch and store.
    fireEvent.click(img.closest('button'))
    await waitFor(() => expect(document.querySelector('.cover-pick')).toBeNull())
    const field = [...document.querySelectorAll('input')].find((i) => i.value.startsWith('https://pics.test'))
    expect(field, 'the full-size original was not staged for saving').toBeTruthy()
  })

  it('falls back to a web search in a tab when nothing is configured', async () => {
    await openForm()
    fireEvent.click(screen.getByText('search images'))
    await waitFor(() => expect(window.open).toHaveBeenCalled())
    expect(window.open.mock.calls[0][0]).toContain('Anna%20Kavan')
    // And no empty strip is drawn, which would read as "we looked and found
    // nothing" when the truth is that nobody was asked.
    expect(document.querySelector('.cover-pick')).toBeNull()
  })

  it('says so when a configured supplier finds nothing', async () => {
    SOURCES = { google: true, amazon: false }
    await openForm()
    fireEvent.click(screen.getByText('search images'))
    await screen.findByText(/Nothing came back/)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('asks for a portrait of this person and nothing else', async () => {
    SOURCES = { google: true, amazon: false }
    await openForm()
    fireEvent.click(screen.getByText('search images'))
    await waitFor(() => expect(SENT.some((s) => s.path === '/images/search')).toBe(true))
    expect(SENT.find((s) => s.path === '/images/search').body).toEqual({ kind: 'portrait', name: 'Anna Kavan' })
  })
})
