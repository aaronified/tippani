// The three edition rows the Details form gained with 0061 — subtitle,
// publisher and extent — plus the two languages, storable since 0047 and never
// once editable from a screen.
//
// WHAT A ROW HAS TO DO TO EXIST. It has to be there, it has to save what was
// typed, and — because every PUT in this app is full-state — it has to leave the
// rest of the record standing. The last one is what the languages failed for
// three releases: the hero printed them, an import filled them, and the reader's
// next save of any other field wiped both.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      return { ok: true, data: { ...ITEM, ...body } }
    }
    if (method === 'GET' && path.endsWith('/cast')) {
      return { ok: true, data: { cast: [], actor_role: 'none' } }
    }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const ITEM = {
  id: 7, title: 'The Master and Margarita', author: 'Mikhail Bulgakov',
  translator: '', editor: '', isbn: '', asin: '', description: '',
  published_year: 1967, published_circa: false,
  language: 'English', orig_language: 'Russian',
  subtitle: '', publisher: 'Penguin Classics', pages: 503,
  genres: [], series: '', series_index: 0, favorite: false,
}

beforeEach(() => {
  PUTS = []
  resetPanelHistory()
})

const panel = () =>
  render(
    <PanelHarness
      panel={(stack) => workDetailsPanel(stack, { kind: 'book', item: ITEM, onChanged: () => {}, onDelete: null })}
    />,
  )

const shown = () => waitFor(() => expect(screen.getByRole('button', { name: /Edit Title/i })).toBeTruthy())
const openRow = (label) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`Edit ${label}`, 'i') }))
const typeIn = (label, text) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}$`, 'i')), { target: { value: text } })

describe('a book\'s edition fields', () => {
  it('are rows on the form, showing what is stored', async () => {
    panel()
    await shown()
    // Read off the SCREEN and not off the spec list: a field named in a table and
    // never rendered would satisfy any assertion about the table.
    for (const label of ['Subtitle', 'Publisher', 'Pages', 'Language', 'Original language']) {
      expect(screen.getByRole('button', { name: new RegExp(`Edit ${label}`, 'i') })).toBeTruthy()
    }
    expect(screen.getByText('Penguin Classics')).toBeTruthy()
    expect(screen.getByText('503')).toBeTruthy()
    expect(screen.getByText('Russian')).toBeTruthy()
  })

  it('save what was typed, and restate everything else while doing it', async () => {
    panel()
    await shown()
    openRow('Subtitle')
    typeIn('Subtitle', 'A Novel')
    fireEvent.click(screen.getByRole('button', { name: /^Save Subtitle$/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))
    const body = PUTS[0].body
    expect(body.subtitle).toBe('A Novel')
    // THE REST OF THE RECORD, in the same body. This is the assertion that would
    // have caught the languages: it is not enough for the new field to arrive.
    expect(body.publisher).toBe('Penguin Classics')
    expect(body.pages).toBe(503)
    expect(body.language).toBe('English')
    expect(body.orig_language).toBe('Russian')
    expect(body.title).toBe('The Master and Margarita')
  })

  it('send a page count as a whole number, whatever was typed', async () => {
    panel()
    await shown()
    openRow('Pages')
    // A COUNT IS NOT A NUMBER. `series_index` is deliberately fractional; the
    // server's `pages` is an int, and 480.5 fails the JSON decode before any
    // validation gets to say something a reader could act on.
    typeIn('Pages', '480.6')
    fireEvent.click(screen.getByRole('button', { name: /^Save Pages$/i }))
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.pages).toBe(481)
  })
})
