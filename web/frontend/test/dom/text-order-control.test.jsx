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

const field = (props = {}) => {
  const onChange = vi.fn()
  render(<TextOrderField value="" onChange={onChange} {...props} />)
  return onChange
}

const slider = () => document.querySelector('input[type="range"]')

describe('the four states, as one slider', () => {
  it('draws a stop for each state and no more', () => {
    field()
    const el = slider()
    expect(el, 'the control is not a slider').toBeTruthy()
    expect(Number(el.min)).toBe(0)
    // FOUR STOPS, NOT FIVE. Inherit is not more or less of the original than the
    // four, so putting it on the axis would break the one property that makes the
    // axis a slider: each stop shows strictly more of the original than the last.
    expect(Number(el.max)).toBe(TEXT_ORDERS.length - 1)
  })

  it('an unset work sits at what it would inherit, rather than at a guess', () => {
    field({ value: '', inherited: 'trans-first' })
    expect(Number(slider().value)).toBe(TEXT_ORDERS.indexOf('trans-first'))
  })

  it('and at the app default when it inherits nothing', () => {
    field()
    expect(Number(slider().value)).toBe(TEXT_ORDERS.indexOf(TEXT_ORDER_DEFAULT))
  })

  it('a set work sits at its own state', () => {
    field({ value: 'quote-only' })
    expect(Number(slider().value)).toBe(TEXT_ORDERS.indexOf('quote-only'))
  })
})

// INHERIT NEEDS ITS OWN WAY BACK, and this is where a work differs from a LANGUAGE
// row in Settings: there, "equal to the master" and "not set" are the same thing,
// so moving the slider onto the master clears the row. A work has the language rung
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
    // '' and not TEXT_ORDER_DEFAULT: those are the same bytes to a slider and
    // different meanings on a card — one falls through to the language and then
    // the master, the other stops the ladder at this work.
    expect(onChange).toHaveBeenCalledWith('')
  })
})
