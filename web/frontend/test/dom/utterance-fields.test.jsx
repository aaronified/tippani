// The five fields a standalone quote carries (0047), and the trap they were caught
// in for three releases.
//
// THE BUG THIS FILE EXISTS FOR IS NOT A MISSING FIELD. It is that the missing field
// was DESTRUCTIVE: every PUT from this screen is full-state, so a field absent from
// the form's payload — or from the row-to-state mapper the ♥, the colour dots and
// the selection bar all save through — is not left alone, it is emptied. An imported
// letter's recipient survived exactly until somebody opened the quote to fix a typo,
// or hearted it.
//
// Quotes.jsx already carried two comments saying precisely this, about the two sets
// of fields that had been forgotten before these. That is what makes it worth a test
// rather than a third comment.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { UtteranceForm, utteranceState } = await import('../../src/Quotes.jsx')
const { t } = await import('../../src/i18n.js')

// One quote with every one of the five set, as an import leaves it.
const FULL = {
  id: 4,
  quote: 'a letter home',
  speaker: 'Rabindranath Tagore',
  occasion: 'a letter',
  occasion_date: '1890',
  occasion_circa: true,
  place: 'Shilaidaha',
  medium: 'letter',
  language: 'Bengali',
  region: 'Sylhet',
  recipient: 'Indira Devi',
  work_title: 'Chhinnapatra',
  locator: 'letter 12',
  category: 'other',
  board_id: 3,
}

describe('the five fields a standalone quote carries', () => {
  it('are on the form, filled from the quote', () => {
    render(<UtteranceForm initial={FULL} onSubmit={() => null} submitLabel="Save" boards={[{ id: 3, name: 'Letters' }]} />)
    expect(screen.getByDisplayValue('Sylhet')).toBeTruthy()
    expect(screen.getByDisplayValue('Indira Devi')).toBeTruthy()
    expect(screen.getByDisplayValue('Chhinnapatra')).toBeTruthy()
    expect(screen.getByDisplayValue('letter 12')).toBeTruthy()
    // The date's precision flag is a checkbox rather than a box, and it is ticked
    // because the quote says so.
    expect(screen.getByText(t('quotes.form.circa.label'))).toBeTruthy()
    const circa = document.querySelector('input[type="checkbox"]')
    expect(circa.checked, 'the approximate-date flag did not load').toBe(true)
  })

  it('are sent back on save, rather than cleared by their absence', async () => {
    let sent = null
    render(
      <UtteranceForm
        initial={FULL}
        onSubmit={(fields) => {
          sent = fields
          return null
        }}
        submitLabel="Save"
        boards={[{ id: 3, name: 'Letters' }]}
      />,
    )
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    // THE ASSERTION THE BUG WOULD HAVE FAILED. Every one of the five, unchanged.
    expect(sent.region).toBe('Sylhet')
    expect(sent.recipient).toBe('Indira Devi')
    expect(sent.work_title).toBe('Chhinnapatra')
    expect(sent.locator).toBe('letter 12')
    expect(sent.occasion_circa).toBe(true)
  })

  it('survive a heart, a colour or a bulk action, which save through the mapper', () => {
    // utteranceState is what the card's own controls PUT. A field it omits is a
    // field a colour dot silently empties, which is the shape of every version of
    // this bug: the reader is not editing the quote at all.
    const state = utteranceState(FULL)
    expect(state.region).toBe('Sylhet')
    expect(state.recipient).toBe('Indira Devi')
    expect(state.work_title).toBe('Chhinnapatra')
    expect(state.locator).toBe('letter 12')
    expect(state.occasion_circa).toBe(true)
  })

  it('carry an empty value through rather than an undefined one', () => {
    // A quote with none of them set must send '' and not undefined: the server takes
    // the key at its word, and `undefined` disappears in JSON — which is how a field
    // gets cleared by a request that meant to leave it alone.
    const state = utteranceState({ id: 1, quote: 'x' })
    for (const k of ['region', 'recipient', 'work_title', 'locator']) {
      expect(state[k], k).toBe('')
    }
    expect(state.occasion_circa).toBe(false)
  })
})

// ---- the kind (0053), and the field it replaced ------------------------------
//
// Same trap, fourth time. `kind` is on a full-state PUT, so a payload without it
// clears it — and the ♥ and the colour dots both save through utteranceState. The
// free-text `medium` it replaced has NO box any more, which makes it the more
// dangerous of the two: a form that stops showing a field usually stops sending
// it, and here that would delete a column the export still writes.
describe('what kind of quote it is', () => {
  const kindBox = () => screen.getByLabelText(t('quotes.form.kind.label'))

  it('is a chosen word, not a typed one', () => {
    render(<UtteranceForm initial={{ ...FULL, kind: 'letter' }} onSubmit={() => null} submitLabel="Save" boards={[]} />)
    // The old box is gone: a free-text medium is what produced one shelf per
    // spelling on a board that groups by it.
    expect(screen.queryByDisplayValue('letter'), 'the free-text medium box is still there').toBeNull()
    // And the chooser shows the word for the stored value.
    expect(kindBox().textContent).toContain(t('vocab.quote-kind.letter.label'))
  })

  it('sends the kind it was given, and the medium it no longer shows', async () => {
    let sent = null
    render(
      <UtteranceForm
        initial={{ ...FULL, kind: 'letter' }}
        onSubmit={(f) => { sent = f; return null }}
        submitLabel="Save"
        boards={[]}
      />,
    )
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.kind, 'the kind was dropped from the payload').toBe('letter')
    // THE HALF THAT IS EASY TO GET WRONG. `medium` has no control on this form and
    // must still ride out unchanged, or saving a typo deletes a value the export
    // is still writing and the card is still showing.
    expect(sent.medium, 'the retired field was cleared by the form that stopped showing it').toBe('letter')
  })

  it('changing it sends the new word', async () => {
    let sent = null
    render(
      <UtteranceForm
        initial={{ ...FULL, kind: '' }}
        onSubmit={(f) => { sent = f; return null }}
        submitLabel="Save"
        boards={[]}
      />,
    )
    // Select is this app's own dropdown, not a native <select>: open the panel and
    // click the row. fireEvent.change does nothing to it.
    fireEvent.click(kindBox())
    fireEvent.click(screen.getByText(t('vocab.quote-kind.proverb.label')))
    fireEvent.click(screen.getByText('Save'))
    await vi.waitFor(() => expect(sent).not.toBeNull())
    expect(sent.kind).toBe('proverb')
  })

  it('utteranceState carries both, which is what the ♥ saves through', () => {
    const body = utteranceState({ ...FULL, kind: 'essay' })
    expect(body.kind, 'recolouring a card would clear the kind').toBe('essay')
    expect(body.medium, 'recolouring a card would clear the old medium').toBe('letter')
  })
})
