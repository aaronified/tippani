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

})
