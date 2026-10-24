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
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', () => ({
  json: async () => ({ ok: true, data: {} }),
  errText: () => 'nope',
  coverImgURL: () => '',
  upload: async () => ({ ok: true, data: {} }),
  uploadWithProgress: async () => ({ ok: true, data: {} }),
}))

const { TextOrderField } = await import('../../src/textOrderField.jsx')

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

describe('the four states, as one chooser', () => {
  it('and choosing one reports that state, not an index', () => {
    // The old control handed back a position on an axis and the field turned it
    // into a state. A chip IS the state, so nothing in between can mistranslate it.
    const onChange = field({ value: 'quote-only' })
    fireEvent.click(chips().find((b) => b.textContent === 'translation only'))
    expect(onChange).toHaveBeenCalledWith('trans-only')
  })
})

