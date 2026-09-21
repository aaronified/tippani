// THE CREDIT ON A SKIPPED WORK CARRIES ITS PHOTOGRAPH.
//
// WHY THIS IS A UNIT AND NOT A JOURNEY. The journey beside it drives the real
// screen against a real server, and that fixture has no portraits — every image
// fetch in this container answers 403 — so the assertion it could make is "a chip
// appeared", which is exactly what the defect looked like. A grey stand-in and a
// person nobody has fetched yet are the same picture. Putting a path in front of
// the component is the only way to tell the two apart, and that means answering
// the request here.
//
// WHAT WENT WRONG: the server sent the credit as a bare name, so `person` was
// never passed and `PersonChip` had nothing to draw. Both halves are guarded —
// the path arriving is `review_excluded_test.go`'s, and this is the path being
// handed on.
//
// MUTATION-VERIFIED: drop the `person=` prop from the PersonChip in NeverAsked
// and the first case goes red; the second stays green, which is the point of
// having it — a stand-in is still the right answer for a credit with no row.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

let ANSWER
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === '/review/excluded') return { ok: true, data: ANSWER }
    return { ok: true, data: {} }
  }),
}))

const { NeverAsked } = await import('../../src/Settings.jsx')

const oneWork = (people) => ({
  total: 1,
  groups: [{
    work_id: 7, kind: 'book', title: 'The Long Walk', art: '',
    people, quotes_total: 4, quotes: [{ id: 1, kind: 'book', text: 'a line' }],
  }],
})

beforeEach(() => { cleanup() })

describe('a credit on a skipped work', () => {
  it('draws the photograph the server sent with it', async () => {
    ANSWER = oneWork([{ name: 'Slavomir Rawicz', image_path: 'rawicz.jpg' }])
    render(<NeverAsked />)
    await waitFor(() => expect(screen.getByText('The Long Walk')).toBeTruthy())
    // THE PICTURE, not the chip. A chip appears either way — that is the whole
    // reason the defect was invisible — so what is asserted is that something is
    // drawing the file the server named.
    const face = await waitFor(() => {
      const img = [...document.querySelectorAll('img')].find((i) => /rawicz\.jpg/.test(i.getAttribute('src') || ''))
      expect(img, 'nothing on the row is drawing the photograph the server sent').toBeTruthy()
      return img
    })
    expect(face.getAttribute('src')).toMatch(/rawicz\.jpg/)
  })

  it('draws a stand-in where nobody has fetched the person yet', async () => {
    ANSWER = oneWork([{ name: 'Unfetched', image_path: '' }])
    render(<NeverAsked />)
    await waitFor(() => expect(screen.getByText('The Long Walk')).toBeTruthy())
    // The name is still on the screen and still a door; what is absent is a
    // picture, which is the honest answer rather than a failure. A SHORT name, and
    // that is not arbitrary: the chip clips a long one to eighteen characters —
    // the app's one ruled-on truncation — so a realistic name here would fail this
    // assertion for a reason that has nothing to do with faces.
    expect(document.body.textContent).toContain('Unfetched')
    expect([...document.querySelectorAll('img')].some((i) => (i.getAttribute('src') || '').includes('people')))
      .toBe(false)
  })
})
