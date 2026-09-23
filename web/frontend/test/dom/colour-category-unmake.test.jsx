// UN-MAKING A COLOUR CATEGORY, AND THE PROMISE THAT MUST SURVIVE IT.
//
// WHAT THIS IS. The pack gives every non-fixed category a trash act
// (metadata.dc.html:741); the card offered hide/offer and a colour revert, so a
// category somebody had made could not be un-made. A category is one of eight
// SLOTS rather than a row, so there is nothing to remove — "delete" means it
// stops being one you made: name, colour and hiding all back to what the app
// shipped.
//
// THREE CLAIMS, each a different way this could be wrong:
//   - IT IS OFFERED ONLY ON A SLOT SOMEBODY HAS TOUCHED. On an untouched one the
//     act would do nothing, and a control that does nothing teaches a reader that
//     the controls here are inert.
//   - IT CLEARS ALL THREE IN ONE SAVE. This is the part a hand-rolled version gets
//     wrong: `save` merges its patch over the values collected from the LIVE rows,
//     so a patch that cleared the name while the input still held it would have
//     the name written straight back.
//   - AND THE STORED TOKEN NEVER MOVES. It is this section's own promise — the one
//     that makes a Markdown export round-trip — so an un-make that renamed or
//     re-keyed anything would break re-import a year later and nothing would say
//     so at the time.
//
// MUTATION-VERIFIED: drop the `cleared` argument from the save and the name comes
// back; show the act unconditionally and the first case fails.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let PUTS = []
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') PUTS.push([path, body])
    return { ok: true, data: {} }
  }),
}))

const { ColourCategoriesCard } = await import('../../src/Settings.jsx')
const { applyColors } = await import('../../src/theme.js')
const { t } = await import('../../src/i18n.js')

// THE CARD READS THE APPLIED COLOURS, not a prop — the same arrangement the Theme
// card uses and for the same reason, so a control cannot be a render behind what
// the reader sees. So a case that needs a made-up category APPLIES it.
const mount = (prefs = {}) => {
  applyColors(prefs)
  render(<ColourCategoriesCard prefs={prefs} onSaved={() => {}} />)
}
const written = () => PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)?.[1]

// Slot 2 is the first non-fixed one — slot 1 is the fixed "no category" bucket.
const MADE = { catName2: 'Argument', catColor2: '#3b82f6', catHidden2: true }

beforeEach(() => {
  PUTS = []
  document.documentElement.removeAttribute('style')
})
afterEach(cleanup)

const unmakeButtons = () =>
  screen.queryAllByRole('button', { name: new RegExp(t('settings.colours.unmake.tip'), 'i') })

describe('un-making a colour category', () => {
  it('is not offered on a slot nobody has touched', () => {
    mount({})
    expect(unmakeButtons().length, 'an untouched slot should have nothing to un-make').toBe(0)
  })

  it('is offered once a slot has been named', () => {
    mount({ catName2: 'Argument' })
    expect(unmakeButtons().length, 'a named slot should offer to be un-made').toBe(1)
  })

  it('clears the name, the colour and the hiding in one save', async () => {
    mount(MADE)
    fireEvent.click(unmakeButtons()[0])
    // The confirm, because an act drawn with a bin glyph asks first.
    fireEvent.click(await screen.findByRole('button', { name: new RegExp('^' + t('settings.colours.unmake.cta') + '$', 'i') }))
    await waitFor(() => expect(written()).toBeTruthy())
    const sent = written()
    expect(sent.catName2, 'the name survived the un-make').toBe('')
    expect(sent.catColor2, 'the colour survived the un-make').toBe('')
    expect(sent.catHidden2, 'the hiding survived the un-make').toBe(false)
  })

  it('and says no quote changes, because none does', async () => {
    mount(MADE)
    fireEvent.click(unmakeButtons()[0])
    // THE CONFIRM'S OWN WORDS. The stored token never moves — a quote filed under
    // this colour stays filed under it — and a bin glyph implies the opposite, so
    // the dialog has to say so. A reader deciding whether to press reads this.
    expect(await screen.findByText(new RegExp('quotes filed under this colour stay under it', 'i')),
      'the confirm should say that nothing on a quote moves').toBeTruthy()
  })

  it('leaves every other slot alone', async () => {
    mount({ ...MADE, catName3: 'Aside' })
    const rows = unmakeButtons()
    expect(rows.length, 'two made slots should offer two un-makes').toBe(2)
    fireEvent.click(rows[0])
    fireEvent.click(await screen.findByRole('button', { name: new RegExp('^' + t('settings.colours.unmake.cta') + '$', 'i') }))
    await waitFor(() => expect(written()).toBeTruthy())
    expect(written().catName3, 'un-making one slot cleared another').toBe('Aside')
  })
})
