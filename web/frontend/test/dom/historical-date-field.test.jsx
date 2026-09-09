// THE BOX THAT COULD NOT BE TYPED INTO.
//
// The owner's report: "i am unable to add 399BCE as a date now. this is weird. i
// cannot even add just 399. this was fine before. i have Seneca's quotes from c.
// 40." Two screenshots came with it, both showing the WHEN field outlined in red
// under the message "needs to be YYYY, YYYY-MM or YYYY-MM-DD", and both showing a
// NUMERIC KEYPAD.
//
// That keypad is the half of the defect the validator does not explain, and it is
// what this file is mostly about. The box carried inputMode="numeric" and stripped
// its value to /[^\d-]/ on every keystroke, so even with a validator that accepted
// "399 BCE" a reader could not have got the letters into it: the phone offered no
// keyboard that spells them and the field deleted them if they arrived anyway.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing beyond it: a date box holds a
// partial date, meaning a year, a year and month, or a full day. A `historical`
// one is a date in the world (a quote's occasion, a person's birth) and takes any
// year and either era. A plain one is a date in the reader's own life (a read log)
// and must keep refusing both — the app's own guarantee is that a stored date is a
// real one, and a book finished in the year 40 is a typo.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PartialDateField, YearField } from '../../src/ui.jsx'

const field = () => screen.getAllByRole('textbox')[0]
const tick = () => document.querySelector('input[type="checkbox"]')

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

describe('a date in history', () => {
  // The keypad first, because it is the part no validator change would have fixed.
  it('offers a keyboard that can spell an era', () => {
    mount({ historical: true })
    expect(field().getAttribute('inputmode'), 'a numeric keypad has no B, C or E on it').not.toBe('numeric')
  })

  it('lets the era survive being typed', () => {
    const { onChange } = mount({ historical: true })
    // One character at a time is how a reader types it, and a box that strips
    // non-digits eats each letter as it lands rather than at the end.
    for (const partial of ['399 B', '399 BC', '399 BCE']) {
      onChange.mockClear()
      fireEvent.change(field(), { target: { value: partial } })
      expect(onChange, partial).toHaveBeenCalledWith(partial)
    }
  })

  it('accepts the three dates the report named', () => {
    for (const good of ['399', '399BCE', 'c. 40']) {
      const { onChange } = mount({ historical: true, value: good })
      // Whatever the marker did, the box is not in its error state.
      expect(field().getAttribute('aria-invalid'), good).toBe(null)
      onChange.mockClear()
      cleanupRender()
    }
  })

  it('still refuses a date the calendar does not have', () => {
    mount({ historical: true, value: '399-02-30' })
    expect(field().getAttribute('aria-invalid'), 'February has never had 30 days').toBe('true')
  })
})

describe('a date in the reader’s own life', () => {
  // The bound is the whole difference between the two, so it is asserted as a
  // difference: the same string, accepted by one field and refused by the other.
  it('keeps refusing what a historical field now takes', () => {
    for (const historicalOnly of ['399', '399 BCE', '40']) {
      mount({ value: historicalOnly })
      expect(field().getAttribute('aria-invalid'), historicalOnly).toBe('true')
      cleanupRender()
    }
  })

  it('keeps its numeric keypad, having nothing to spell', () => {
    mount()
    expect(field().getAttribute('inputmode')).toBe('numeric')
  })

  it('keeps stripping, so nothing invalid can be typed into it', () => {
    const { onChange } = mount()
    fireEvent.change(field(), { target: { value: '18a90' } })
    expect(onChange).toHaveBeenCalledWith('1890')
  })
})

// The owner's second ask, in their words: "there SHould be an info dot on the year
// fields (keep it in the field, and not on the header) (all of them) to explain
// the formats and how to do circa (the button) and BCE (-)."
describe('the explanation', () => {
  const dot = () => document.querySelector('button[aria-label^="More information"]')

  it('rides in the box’s own row, not up on the label', () => {
    mount({ historical: true })
    const d = dot()
    expect(d, 'no info dot at all').toBeTruthy()
    // The label sits in the field's own header; the dot must not be its sibling
    // there. Sharing a parent with the INPUT is what "in the field" means.
    expect(d.parentElement.contains(field()), 'the dot is not in the input’s row').toBe(true)
  })

  it('names the era marker and the tick, because that is what it was asked for', () => {
    mount({ historical: true })
    fireEvent.click(dot())
    const said = document.body.textContent
    expect(said, 'no BCE example').toMatch(/BCE/)
    expect(said, 'no minus-sign form').toMatch(/-399/)
    expect(said, 'nothing about the tick').toMatch(/tick/i)
  })

  it('is on the year boxes too, which is what “all of them” meant', () => {
    render(<YearField label="Year" value="" onChange={() => {}} circaLabel="Approximate" />)
    const d = dot()
    expect(d, 'the year box has no info dot').toBeTruthy()
    expect(d.parentElement.querySelector('input.tp-input'), 'the dot left the box’s row').toBeTruthy()
  })

  it('does not offer an era to a field that would refuse one', () => {
    mount()
    fireEvent.click(dot())
    expect(document.body.textContent, 'a read log cannot be BCE').not.toMatch(/BCE/)
  })
})

// render() appends; these cases each want a fresh tree.
function cleanupRender() {
  document.body.innerHTML = ''
}
