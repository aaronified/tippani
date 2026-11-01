// HOW MUCH CONTEXT A WORK'S QUOTES SHOW. A reader sets a rule on a work, is asked what to do
// with the quotes already there, answers, and the panel of a quote says the new window and
// where it came from. The answer to the prompt is what the server is told: narrowing never
// widens, clearing is the explicit second option.
//
// WHAT THIS KNOWS: the two addresses the rule and the panel use, the controls a person
// presses (a labelled slider, the prompt's buttons), and the panel's one line. The fake
// server below keeps a rule and answers the panel from it, so the panel's line moving is a
// consequence of what the screen asked, not of a canned answer.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let rule
const puts = []

vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    if (path === '/context-rules/book/3') {
      if (method === 'PUT') {
        puts.push(body)
        rule = { before: body.before, after: body.after }
        return { ok: true, data: { changed: 0 } }
      }
      return { ok: true, data: rule }
    }
    if (path.startsWith('/quotes/annotation/5/context')) {
      const span = { before: rule.before ?? 2, after: rule.after ?? 2 }
      const from = rule.before != null || rule.after != null ? 'work' : 'default'
      return {
        ok: true,
        data: { before: '', body: 'the quote', after: '', unit: 'paragraph', span, stored: { before: 9, after: 9 }, from },
      }
    }
    return { ok: true, data: {} }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
  putUpload: async () => ({ ok: true, data: {} }),
}))

const { ContextRule, ContextDialog } = await import('../../src/sources.jsx')

beforeEach(() => {
  cleanup()
  rule = { before: null, after: null }
  puts.length = 0
})

// Dragging a slider to a stop and letting go, the way a person does.
//
// THE RELEASE WAITS FOR THE NEW STOP TO BE DRAWN. The slider commits the value it last rendered when the
// pointer comes up, so a release that lands before the thumb's new position has rendered commits the OLD one,
// which changes nothing and asks nothing: the prompt this test is waiting for never appears. A person cannot
// release a thumb before it has moved; a test that fires both back to back on a starved CI machine can.
const slide = async (label, to) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value: String(to) } })
  await waitFor(() => expect(input.closest('.tp-slider').textContent).toContain(String(to)))
  fireEvent.pointerUp(input)
}

describe('a work’s context rule', () => {
  it('asks what to do with the quotes already there, and the panel then says where its window came from', async () => {
    render(<ContextRule scope="book" id={3} />)
    await screen.findByLabelText('Shown before a quote')
    await slide('Shown before a quote', 4)
    // Nothing is sent until the question is answered.
    expect(puts).toEqual([])
    fireEvent.click(await screen.findByText('Narrow quotes that show more'))
    await waitFor(() => expect(puts).toEqual([{ before: 4, after: null, enforce: 'clamp' }]))

    cleanup()
    render(<ContextDialog kind="annotation" id={5} onClose={() => {}} />)
    expect(await screen.findByText('4 before, 2 after · from this work')).toBeTruthy()
  })

  it('offers clearing the quotes’ own adjustments as its own answer, and resets to inherited', async () => {
    rule = { before: 4, after: null }
    render(<ContextRule scope="book" id={3} />)
    await screen.findByLabelText('Shown before a quote')
    fireEvent.click(screen.getByText('Reset to inherited'))
    fireEvent.click(await screen.findByText('Clear the per-quote adjustments on this work'))
    await waitFor(() => expect(puts).toEqual([{ before: null, after: null, enforce: 'clear' }]))

    cleanup()
    render(<ContextDialog kind="annotation" id={5} onClose={() => {}} />)
    // Back to the default, which says nothing about where it came from.
    expect(await screen.findByText('2 before, 2 after')).toBeTruthy()
  })

  it('changes nothing when the question is cancelled', async () => {
    render(<ContextRule scope="book" id={3} />)
    await screen.findByLabelText('Shown before a quote')
    await slide('Shown after a quote', 0)
    fireEvent.click(await screen.findByText('Cancel'))
    expect(puts).toEqual([])
    expect(rule).toEqual({ before: null, after: null })
  })
})
