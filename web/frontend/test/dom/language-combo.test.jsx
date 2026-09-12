// THE LANGUAGE COMBOBOX, and the one property that makes it usable at ninety-one.
//
// A LIST THIS LONG IS ONLY AS GOOD AS ITS FIRST TEN. The box opens on focus and an
// empty query passes every row before the cap (suggest.jsx's `!q ||` and
// `.slice(0, cap)`), so what a reader sees BEFORE TYPING is the head of the list —
// and ninety-one languages in file order would open on English, Spanish, French,
// Portuguese and six more European ones, in an app whose owner's library is Bengali.
// Their own languages leading is therefore not a nicety; it is the difference between
// a dropdown that answers and one that has to be typed past.
//
// AND IT REMAINS AN OFFER. Every language column in this app is free text. The box
// suggests; a language nobody has heard of is typed and stored exactly as typed, and
// nothing here may refuse, blank or coerce it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/search/vocabulary') return { ok: true, data: { languages: ['Sylheti', 'Bengali'] } }
    return { ok: true, data: {} }
  }),
}))

const { LanguageCombo } = await import('../../src/suggest.jsx')
const { resetSessionCaches } = await import('../../src/sessionCaches.js')

// The vocabulary is cached at MODULE scope, so without this the first case fills it
// and every case after reads what that one left — which is how a suite starts passing
// in one order and failing in another.
beforeEach(() => resetSessionCaches?.())

const box = () => screen.getByRole('combobox')
const rows = () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent)

// STATEFUL, because Combo is CONTROLLED: it filters on the `value` it is handed, so
// a host that pins value="" leaves the query permanently empty and every case below
// silently tests the unfiltered first ten. That is a test passing for the wrong
// reason, which is worse than one failing.
function Host({ onChange = () => {} }) {
  const [v, setV] = useState('')
  return (
    <LanguageCombo
      label="Language"
      value={v}
      onChange={(next) => { setV(next); onChange(next) }}
      placeholder="type one"
    />
  )
}

describe('the language box', () => {
  it('opens on the reader’s own languages before anything is typed', async () => {
    render(<Host />)
    await waitFor(() => expect(box()).toBeTruthy())
    fireEvent.focus(box())
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    // THE LIBRARY FIRST, and Sylheti proves it is the library rather than the list:
    // iso639.js has never heard of Sylheti, so it can only have come from the
    // vocabulary — and it leads, ahead of ninety-one alphabetically-earlier names.
    expect(rows()[0]).toContain('Sylheti')
  })

  it('offers the rest of the list once the reader types past their own', async () => {
    render(<Host />)
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'quech' } })
    await waitFor(() => expect(rows().some((r) => r.includes('Quechua'))).toBe(true))
  })

  it('shows a language’s own name for itself under the English one', async () => {
    render(<Host />)
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'bengali' } })
    // An exact hit is dropped by Combo, so ask for a prefix of it.
    fireEvent.change(box(), { target: { value: 'bengal' } })
    await waitFor(() => expect(rows().some((r) => r.includes('বাংলা'))).toBe(true))
  })

  it('says a language’s name once when it has no other name to give', async () => {
    // "A row says a thing once." Sylheti is not in iso639.js, so displayName hands
    // back what the reader typed — and printing that under itself would be the row
    // saying its own name twice.
    render(<Host />)
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: 'sylhet' } })
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    const row = rows().find((r) => r.includes('Sylheti'))
    expect(row.match(/Sylheti/g)).toHaveLength(1)
  })

  it('hands the caller a string, and never refuses one it has not heard of', async () => {
    const seen = []
    render(<Host onChange={(v) => seen.push(v)} />)
    fireEvent.change(box(), { target: { value: 'Kentish' } })
    expect(seen).toEqual(['Kentish'])
    expect(typeof seen[0]).toBe('string')
  })
})
