// THE FLAG THAT QUALIFIES A DATE, BESIDE THE DATE.
//
// The owner's ask: "Approx date moves beside the date field", and their ruling on
// how: "Parse it and tick the button."
//
// THE DEFECT UNDER IT IS A SWALLOWED GESTURE, and it is the half that cannot be
// seen in a screenshot. The date box accepts digits and a separator and silently
// drops everything else, so a reader typing the ordinary thing — `c. 1890` —
// watched the `c.` disappear, saw 1890 land, and had no way to learn that a
// checkbox elsewhere on the form was what they had meant. Nothing was broken and
// nothing said anything.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, that a partial date is a
// string of 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD', and that the flag is optional on
// the shared field — three other callers pass none of it and must be unchanged.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PartialDateField } from '../../src/ui.jsx'

const field = () => screen.getByPlaceholderText(/./)
const box = () => document.querySelector('input[type="checkbox"]')

const mount = (over = {}) => {
  const onChange = vi.fn()
  const onCirca = vi.fn()
  render(
    <PartialDateField
      label="Said when"
      value=""
      onChange={onChange}
      onCirca={onCirca}
      circaLabel="The date is approximate"
      {...over}
    />,
  )
  return { onChange, onCirca }
}

describe('typing an approximate date', () => {
  it('reads the marker the box used to delete, and keeps the digits', () => {
    const { onChange, onCirca } = mount()
    fireEvent.change(field(), { target: { value: 'c. 1890' } })
    expect(onCirca, 'the c. was dropped, as it always was').toHaveBeenCalledWith(true)
    expect(onChange, 'the year did not survive the parse').toHaveBeenCalledWith('1890')
  })

  it.each([
    ['circa 1890', '1890'],
    ['ca 1890', '1890'],
    ['ca. 1890', '1890'],
    ['~1890', '1890'],
    ['c.1890', '1890'],
  ])('and understands %s', (typed, kept) => {
    const { onChange, onCirca } = mount()
    fireEvent.change(field(), { target: { value: typed } })
    expect(onCirca, typed).toHaveBeenCalledWith(true)
    expect(onChange, typed).toHaveBeenCalledWith(kept)
  })

  // A NUMERIC BOX AND A SLIP. Ticking a flag off one stray letter is worse than
  // ignoring it, because the reader never asked and the box is where their eye
  // is not.
  it('but not off a bare letter, which in a number box is a slip', () => {
    const { onCirca } = mount()
    fireEvent.change(field(), { target: { value: 'c' } })
    expect(onCirca, 'a single stray keystroke ticked the flag').not.toHaveBeenCalled()
  })

  it('and not off a plain date', () => {
    const { onCirca } = mount()
    fireEvent.change(field(), { target: { value: '1890-04-02' } })
    expect(onCirca).not.toHaveBeenCalled()
  })

  it('and never turns the flag back off by itself', () => {
    // Parsing SETS it; only the reader clears it. A parse that also unset it would
    // untick the box on the next keystroke after it ticked it.
    const { onCirca } = mount({ circa: true })
    fireEvent.change(field(), { target: { value: '1890' } })
    expect(onCirca, 'typing a plain date silently cleared a flag the reader set').not.toHaveBeenCalled()
  })
})

describe('where the flag is drawn', () => {
  it('is inside the date field, not elsewhere on the form', () => {
    mount()
    // `closest('label')` is the field itself — PartialDateField renders one.
    expect(box(), 'no flag was drawn at all').toBeTruthy()
    expect(box().closest('label'), 'the flag is outside the field it qualifies')
      .toBe(screen.getByText('Said when').closest('label'))
  })

  it('and it still says what it is, with the field owning the outer label', () => {
    // The box cannot borrow the outer `label` — that one captions the date input —
    // so it carries its own name. Without this a screen reader announces an
    // unnamed checkbox.
    mount()
    expect(box().getAttribute('aria-label')).toBe('The date is approximate')
  })

  it('and a caller that passes no flag draws none', () => {
    // The three other callers — a person's birth and death, a work's date — have
    // nothing to be approximate about in this schema and must be untouched.
    render(<PartialDateField label="Born" value="" onChange={() => {}} />)
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0)
  })

  it('and clicking it still works the plain way', () => {
    const { onCirca } = mount()
    fireEvent.click(box())
    expect(onCirca).toHaveBeenCalledWith(true)
  })
})
