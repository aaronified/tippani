// CORRECTIONS FROM THE FILE, a section of Checks.
//
// WHAT THIS KNOWS: the addresses the section reads and presses, the words on screen, and
// what a person can do. Buckets show their count before they open; applying a bucket
// sends what the reader saw; a quote the reader edited is marked; either verb is one
// press; and the section draws NOTHING when no quote differs from its file.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent = []
let list = {}
let reply = { applied: 1 }

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (method === 'GET' && path === '/corrections') return { ok: true, data: list }
    sent.push({ method, path, body })
    return { ok: true, data: reply }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
}))

const { default: CorrectionsPage } = await import('../../src/CorrectionsPage.jsx')

const P = (over) => ({
  kind: 'screen',
  id: 1,
  work_id: 7,
  work_title: 'Amelie',
  quote: 'Voila, the cafe is closed.',
  proposed: 'Voilà, the café is closed.',
  from: 'Voila,',
  to: 'Voilà,',
  bucket: 'accents',
  distance: 0,
  ...over,
})

const buckets = (rows) =>
  ['accents', 'one-word'].map((id) => ({ id, count: rows.filter((r) => r.bucket === id).length, edited: 0 }))

beforeEach(() => {
  cleanup()
  sent.length = 0
  reply = { applied: 1 }
  const proposals = [
    P({}),
    P({ id: 2, quote: 'Cafe au lait', proposed: 'Café au lait', from: 'Cafe', to: 'Café', edited: true }),
    P({ id: 3, bucket: 'one-word', quote: 'Remember the fifth of Novembr', proposed: 'Remember the fifth of November', from: 'Novembr', to: 'November' }),
  ]
  list = { buckets: buckets(proposals), proposals, wrong_file: [] }
})

describe('corrections from the file on Checks', () => {
  it('names each bucket with its count before it opens, and draws nothing when nothing differs', async () => {
    render(<CorrectionsPage embedded />)
    await screen.findByText(/Accents · 2/)
    expect(screen.getByText(/One word differs · 1/)).toBeTruthy()
    expect(screen.queryByText('Voilà, the café is closed.')).toBeNull()

    cleanup()
    list = { buckets: [], proposals: [], wrong_file: [] }
    const empty = render(<CorrectionsPage embedded />)
    await waitFor(() => expect(empty.container.textContent).toBe(''))
  })

  it('opens a bucket to the quote beside the file\'s words and marks the one the reader edited', async () => {
    render(<CorrectionsPage embedded />)
    fireEvent.click(await screen.findByRole('button', { name: /Accents · 2/ }))
    expect(screen.getAllByText('Voilà,').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Voila,').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('correction-edited')).toHaveLength(1)
  })

  it('applies a bucket in one press, sending what the reader saw and that it is bulk', async () => {
    render(<CorrectionsPage embedded />)
    const group = await screen.findByTestId('corrections-accents')
    fireEvent.click(group.querySelectorAll('button')[1]) // "Take the file's 2"
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].path).toBe('/corrections/accept')
    expect(sent[0].body.bucket).toBe('accents')
    expect(sent[0].body.bulk).toBe(true)
    expect(sent[0].body.items.map((i) => i.id)).toEqual([1, 2])
    expect(sent[0].body.items[0]).toEqual({
      kind: 'screen',
      id: 1,
      quote: 'Voila, the cafe is closed.',
      proposed: 'Voilà, the café is closed.',
    })
  })

  it('keeps the reader\'s words for one quote with its own press, which is not bulk', async () => {
    render(<CorrectionsPage embedded />)
    fireEvent.click(await screen.findByRole('button', { name: /One word differs · 1/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Keep my words for this quote' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].path).toBe('/corrections/ignore')
    expect(sent[0].body.items).toHaveLength(1)
    expect(sent[0].body.items[0].id).toBe(3)
  })

})
