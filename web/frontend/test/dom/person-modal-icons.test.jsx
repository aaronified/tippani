// Every control on the author/actor metadata screen carries a glyph.
//
// PersonModal was the last screen in the app whose controls were words alone —
// `Add details`, `refetch links`, `search images ↗`, `remove photo`, `Rename
// everywhere` — while the cards, the tables and the bulk bar had all moved to
// glyph-plus-label. That is exactly the class of drift 1.6.0 was about: each
// button is fine on its own and the screen is the odd one out, which is
// invisible unless you put two screens side by side.
//
// The assertion is "this control contains an <svg>", not "this control contains
// IconRefresh". Pinning the identity of the glyph would make every future
// redrawing a test edit, and the thing worth holding is that no control here is
// wordless-and-glyphless — the icons.test.jsx suite already holds that each
// glyph is distinct from every other.
//
// One thing here is NOT a glyph question and is asserted anyway: the underline.
// `.tp-link` underlines the whole control and text-decoration cannot be
// cancelled by a descendant, so a glyph dropped into a link gets a rule struck
// through it and the button reads as struck out. `.tp-link-icon` moves the
// underline onto a span around the words, and the only way to know a call site
// took that path is to look for the span.

import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// A saved person, so PersonView renders rather than the empty state, and the
// auto-enrich effect has nothing missing to go and fetch.
const SAVED = {
  id: 7,
  kind: 'author',
  name: 'Anna Kavan',
  bio: 'A novelist.',
  born: '1901',
  died: '1968',
  links: 'https://en.wikipedia.org/wiki/Anna_Kavan',
  source: 'lookup',
  source_id: 'OL123A',
  image_path: 'people/anna.jpg',
}

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.startsWith('/people?')) {
      return { ok: true, data: { exists: true, person: SAVED } }
    }
    return { ok: true, data: {} }
  }),
  DEMO: false,
}))

const { PersonModal } = await import('../../src/people.jsx')

// open() mounts the modal and waits out the load, which is one state tick — the
// GET resolves and `loading` goes false. Without the await every case would
// assert against the "loading…" body.
async function open(props = {}) {
  const out = render(<PersonModal kind="author" name="Anna Kavan" onClose={() => {}} {...props} />)
  await screen.findByText('A novelist.')
  return out
}

// glyph(name) finds a control by its accessible name and answers whether it has
// a drawing in it. getByRole throws on a miss, so a renamed control fails loudly
// rather than reporting "no icon".
const glyph = (name) => !!screen.getByRole('button', { name }).querySelector('svg')

describe('the saved-person view', () => {
  it('draws a glyph on Delete and on Edit', async () => {
    await open()
    expect(glyph(/^Delete$/), 'Delete had no glyph').toBe(true)
    expect(glyph(/^Edit$/), 'Edit had no glyph').toBe(true)
    cleanup()
  })

  it('draws one on refetch links, with the underline off the glyph', async () => {
    await open()
    const b = screen.getByRole('button', { name: /refetch links/i })
    expect(b.querySelector('svg'), 'refetch links had no glyph').toBeTruthy()
    // The words carry the rule, not the control — see .tp-link-icon.
    expect(b.className).toContain('tp-link-icon')
    expect(b.querySelector('span')?.textContent).toBe('refetch links')
    cleanup()
  })
})

describe('the edit form behind it', () => {
  async function openForm() {
    await open()
    screen.getByRole('button', { name: /^Edit$/ }).click()
    await screen.findByRole('button', { name: /^Save$/ })
  }

  it('draws a glyph on Cancel, Save and Rename everywhere', async () => {
    await openForm()
    expect(glyph(/^Cancel$/), 'Cancel had no glyph').toBe(true)
    expect(glyph(/^Save$/), 'Save had no glyph').toBe(true)
    expect(glyph(/Rename everywhere/), 'Rename everywhere had no glyph').toBe(true)
    cleanup()
  })

  it('keeps the words on Rename everywhere at every width', async () => {
    await openForm()
    // keepLabel, and the negative half matters more than the positive: with
    // has-btn-icon the button is squared to 44px under data-labels="off" while
    // its words are still inside it. Renaming a name across a whole library is
    // not a thing to have to have learned a glyph for.
    const b = screen.getByRole('button', { name: /Rename everywhere/ })
    expect(b.querySelector('.btn-label-fixed')).toBeTruthy()
    expect(b.className).not.toContain('has-btn-icon')
    cleanup()
  })

  it('draws one on remove photo and on search images', async () => {
    await openForm()
    for (const name of [/remove photo/i, /search images/i]) {
      const b = screen.getByRole('button', { name })
      expect(b.querySelector('svg'), `${name} had no glyph`).toBeTruthy()
      expect(b.className).toContain('tp-link-icon')
    }
    // The ↗ it replaced: an arrow doing a glyph's job, and the only one of its
    // kind left in the app.
    expect(screen.getByRole('button', { name: /search images/i }).textContent).not.toContain('↗')
    cleanup()
  })
})

describe('the empty state', () => {
  it('draws a glyph on Add details', async () => {
    vi.resetModules()
    const api = await import('../../src/api.js')
    api.json.mockImplementation(async (method, path) =>
      method === 'GET' && path.startsWith('/people?')
        ? { ok: true, data: { exists: false } }
        : { ok: true, data: {} },
    )
    render(<PersonModal kind="author" name="Nobody" onClose={() => {}} />)
    const b = await screen.findByRole('button', { name: /Add details/ })
    expect(b.querySelector('svg'), 'Add details had no glyph').toBeTruthy()
    cleanup()
  })
})
