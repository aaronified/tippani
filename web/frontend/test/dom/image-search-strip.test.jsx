// The picture strip: the person panel's half of POST /images/search.
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
//
// IT DROVE THIS THROUGH `PersonModal` UNTIL THAT SCREEN WAS DELETED, and the
// move is not a port: the panel reaches the same mechanism through the pack's
// NAMED verb row, so the control here is `Fetch` rather than the old screen's
// inline "search images" link. Same request, same strip, a different press — and
// a test that had been rewritten to keep its old press would have been testing a
// button no reader can reach.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// BIO AND PORTRAIT BOTH SET, so the panel's own look-up effect stays quiet: it
// fires when either is missing, and a POST /people/portrait landing in the middle
// of this would reload the record under the strip.
const SAVED = {
  id: 7, kind: 'author', name: 'Anna Kavan', bio: 'A novelist.',
  born: '1901', died: '1968', links: '', source: 'manual', source_id: '',
  image_path: 'people/anna.jpg', aliases: [], credits: [], kinds: ['author'],
}

let IMAGES
let SOURCES
let SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    SENT.push({ method, path, body })
    if (method === 'GET' && path.startsWith('/people/id/')) {
      return { ok: true, data: SAVED }
    }
    if (path === '/images/search') {
      return { ok: true, data: { images: IMAGES, sources: SOURCES } }
    }
    return { ok: true, data: {} }
  }),
  DEMO: false,
}))

const { personPanel } = await import('../../src/identity.jsx')
const { t } = await import('../../src/i18n.js')

// The panel machinery renders through a portal from a descriptor; the body is
// what this file is about, so it is rendered directly — the same shape
// identity-panel.test.jsx uses for the cases that only read a sheet.
async function openPicture() {
  render(personPanel({ open: () => {} }, { id: 7, name: 'Anna Kavan' }).render())
  await screen.findByText('A novelist.')
  // NO DOOR TO OPEN FIRST. The pack draws the picture's three verbs spelled out
  // beside the portrait — Fetch · Upload · Paste URL — so the reader presses one
  // of them, where the old screen made them open an editor first.
  return screen.findByText(t('identity.picture.fetch.label'))
}

const fetchPicture = async () => fireEvent.click(await openPicture())

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
    await fetchPicture()

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
    await waitFor(() => expect(SENT.some((s) => s.method === 'PUT' && s.path.startsWith('/people/id/'))).toBe(true))
    const put = SENT.find((s) => s.method === 'PUT' && s.path.startsWith('/people/id/'))
    expect(put.body.image_url, 'the full-size original was not what got saved')
      .toBe('https://pics.test/kavan.jpg')
  })

  it('falls back to a web search in a tab when nothing is configured', async () => {
    await fetchPicture()
    await waitFor(() => expect(window.open).toHaveBeenCalled())
    expect(window.open.mock.calls[0][0]).toContain('Anna%20Kavan')
    // And no empty strip is drawn, which would read as "we looked and found
    // nothing" when the truth is that nobody was asked.
    expect(document.querySelector('.cover-pick')).toBeNull()
  })

  it('says so when a configured supplier finds nothing', async () => {
    SOURCES = { google: true, amazon: false }
    await fetchPicture()
    await screen.findByText(/Nothing came back/)
    expect(window.open).not.toHaveBeenCalled()
  })

  // The body is pinned exactly, not spot-checked: a field quietly added here is a
  // field the server will act on, and `person_id` in particular decides which
  // supplier the ladder can reach. It carries the person's OWN id — never a
  // supplier's — so that the server resolves the pinned identity from the
  // reader's own row rather than trusting whatever the page sent.
  it('asks for a portrait of this person, by their id, and nothing else', async () => {
    SOURCES = { google: true, amazon: false }
    await fetchPicture()
    await waitFor(() => expect(SENT.some((s) => s.path === '/images/search')).toBe(true))
    expect(SENT.find((s) => s.path === '/images/search').body).toEqual({
      kind: 'portrait', name: 'Anna Kavan', person_id: 7,
    })
  })
})
