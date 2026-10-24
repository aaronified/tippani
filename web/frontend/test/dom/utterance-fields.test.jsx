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

})

// ---- the kind (0053), and the field it replaced ------------------------------
//
// Same trap, fourth time. `kind` is on a full-state PUT, so a payload without it
// clears it — and the ♥ and the colour dots both save through utteranceState. The
// free-text `medium` it replaced has NO box any more, which makes it the more
// dangerous of the two: a form that stops showing a field usually stops sending
// it, and here that would delete a column the export still writes.

