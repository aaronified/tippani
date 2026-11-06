// THE ✓ ON A FORM DIALOG: lit by a count of what changed, or by `true` when the form cannot count its
// own draft. A "1" that was always 1 (the quote edit dialog, the signature sheet) said nothing, so
// those light the tick and wear no badge; a form that can count still wears its number.
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

const { FormModal, useFormHost } = await import('../../src/ui.jsx')

function Body() {
  const host = useFormHost('')
  return <form id={host?.formId}><input aria-label="x" /></form>
}

const dialog = (dirty) =>
  render(
    <FormModal open title="Edit" onClose={() => {}} dirty={dirty}>
      <Body />
    </FormModal>,
  )

const slot = () => document.querySelector('.tp-tick-slot')
const badge = () => document.querySelector('.tp-tick-count')

describe('the ✓ on a form dialog', () => {
  it('is not armed when nothing has changed', () => {
    dialog(0)
    expect(slot().classList.contains('is-armed')).toBe(false)
    expect(badge()).toBeNull()
  })

  it('is armed and shows the count when the form counted its changes', () => {
    dialog(3)
    expect(slot().classList.contains('is-armed')).toBe(true)
    expect(badge().textContent).toBe('3')
  })

  it('is armed without a badge when the form cannot count', () => {
    dialog(true)
    expect(slot().classList.contains('is-armed')).toBe(true)
    expect(badge()).toBeNull()
  })
})
