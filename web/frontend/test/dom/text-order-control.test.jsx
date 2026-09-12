// THE CONTROL THAT MAKES 0073 REACHABLE.
//
// bac3863f stored `text_order` on books, films and boards and made every card,
// table row and search hit obey it — and shipped with NO WAY TO SET IT. The column
// was always '', so the feature was invisible and every test about it passed. This
// file is the half that says a reader can actually change it.
//
// THE OWNER'S SPEC: "There will be per work control over whether the cards are to
// show 1) translations above quotations, 2) quotations above translation, 3) no
// translation, 4) no quotations… the work controls will supercede the metadata
// controls."
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
}))

const { TextOrderField } = await import('../../src/textOrderField.jsx')
const { TEXT_ORDERS, TEXT_ORDER_DEFAULT } = await import('../../src/textOrder.js')

// The words the chips wear, so a case can name a state the way a reader sees it.
const WORD = {
  'trans-only': 'translation only',
  'trans-first': 'translation first',
  'quote-first': 'quotation first',
  'quote-only': 'quotation only',
}

const field = (props = {}) => {
  const onChange = vi.fn()
  render(<TextOrderField value="" onChange={onChange} {...props} />)
  return onChange
}

// CHIPS, AND IT WAS A SLIDER. The owner replaced it — "Sliders are for when we
// have a gradient, not when we have 4-5 distinct options!" — and the four
// guarantees below are unchanged by that: they are all about WHICH STATE the
// control shows, which is a fact about the component and not about the widget.
// Only the reading of it moved, from a range's numeric `value` to which chip is
// checked.
const chips = () => [...document.querySelectorAll('[role="radio"]')]
const showing = () => chips().find((b) => b.getAttribute('aria-checked') === 'true')

describe('the four states, as one chooser', () => {
  it('draws a chip for each state and no more', () => {
    field()
    // FOUR, NOT FIVE. Inherit is not a fifth state of the text — it is the absence
    // of an opinion — so it gets the revert glyph below and not a chip here.
    expect(chips()).toHaveLength(TEXT_ORDERS.length)
    // Exactly one of them answers at a time, which is the property `radiogroup`
    // exists to state and four independent `aria-pressed` buttons could not.
    expect(chips().filter((b) => b.getAttribute('aria-checked') === 'true')).toHaveLength(1)
  })

  it('an unset work shows what it would inherit, rather than a guess', () => {
    field({ value: '', inherited: 'trans-first' })
    expect(showing().textContent).toBe('translation first')
  })

  it('and the app default when it inherits nothing', () => {
    field()
    expect(showing().textContent).toBe(WORD[TEXT_ORDER_DEFAULT])
  })

  it('a set work shows its own state', () => {
    field({ value: 'quote-only' })
    expect(showing().textContent).toBe('quotation only')
  })

  it('and choosing one reports that state, not an index', () => {
    // The old control handed back a position on an axis and the field turned it
    // into a state. A chip IS the state, so nothing in between can mistranslate it.
    const onChange = field({ value: 'quote-only' })
    fireEvent.click(chips().find((b) => b.textContent === 'translation only'))
    expect(onChange).toHaveBeenCalledWith('trans-only')
  })
})

// INHERIT NEEDS ITS OWN WAY BACK, and this is where a work differs from a LANGUAGE
// row in Settings: there, "equal to the master" and "not set" are the same thing,
// so choosing the master's own value clears the row. A work has the language rung
// between it and the master, so no single value means "follow my settings".
describe('telling a set control from an unset one', () => {
  it('an unset work says so in words, and offers no revert', () => {
    field()
    expect(screen.getByText(/Following your settings/)).toBeTruthy()
    expect(screen.queryByLabelText('Follow my settings')).toBeNull()
  })

  it('a set work offers the revert, and drops the sentence', () => {
    field({ value: 'trans-only' })
    expect(screen.getByLabelText('Follow my settings')).toBeTruthy()
    // A row says a thing once: the glyph is already there, so the sentence beside
    // it would be the same fact twice.
    expect(screen.queryByText(/Following your settings/)).toBeNull()
  })

  it('and the revert clears it rather than setting a state', () => {
    const onChange = field({ value: 'trans-only' })
    fireEvent.click(screen.getByLabelText('Follow my settings'))
    // '' and not TEXT_ORDER_DEFAULT: the control shows the same chip either way
    // and they are different meanings on a card — one falls through to the language and then
    // the master, the other stops the ladder at this work.
    expect(onChange).toHaveBeenCalledWith('')
  })
})
