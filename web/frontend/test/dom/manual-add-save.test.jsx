// The Add-manually popup commits from its header, and that has to keep being a
// real form submission.
//
// The form used to end in a primary text button. It ends in nothing now: the ✓
// lives in the dialog header beside the close ✕, outside the <form> element it
// commits, wired back to it by the HTML `form=` attribute.
//
// That attribute is doing more work than it looks. `type="submit"` + `form=<id>`
// makes the header button the form's DEFAULT BUTTON — the first submit button
// whose form owner is that form — and the default button is the only reason
// Enter in a field still submits a form with several text inputs. Rewrite the ✓
// as an onClick handler and Enter silently stops working: no error, no warning,
// just a key that used to save.
//
// So these tests pin the wiring rather than the pixels: that the form carries the
// id, that the button is a submit pointed at it, that pressing it runs the form's
// own onSubmit, and that it is unavailable exactly while there is nothing to save.

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ManualTab } from '../../src/Library.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: { id: 7, title: 'Middlemarch' } })),
}))

const FORM_ID = 'manual-add-form'

// The header as ManualPopup builds it: a submit ✓ pointed at the form by id, and
// a plain ✕ that is not a submit control at all.
function Harness({ onAdded = () => {}, initialTitle = '' }) {
  const [title, setTitle] = useState(initialTitle)
  return (
    <div>
      <button type="submit" form={FORM_ID} aria-label="Save" disabled={!title.trim()}>✓</button>
      <button type="button" aria-label="Close">✕</button>
      <ManualTab formId={FORM_ID} title={title} setTitle={setTitle} onAdded={onAdded} />
    </div>
  )
}

describe('the form is addressable from outside itself', () => {
  it('carries the id the header button points at', () => {
    const { container } = render(<ManualTab formId={FORM_ID} title="" setTitle={() => {}} onAdded={() => {}} />)
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form.id).toBe(FORM_ID)
  })

  it('has no submit control of its own left inside it', () => {
    // If one came back it would become the default button instead of the ✓, and
    // the header would quietly stop being the thing that saves.
    const { container } = render(<ManualTab formId={FORM_ID} title="Middlemarch" setTitle={() => {}} onAdded={() => {}} />)
    const inside = [...container.querySelectorAll('form button')]
    expect(inside.filter((b) => b.type === 'submit')).toHaveLength(0)
  })

  it('no longer offers the old text button', () => {
    render(<ManualTab formId={FORM_ID} title="Middlemarch" setTitle={() => {}} onAdded={() => {}} />)
    expect(screen.queryByRole('button', { name: /add book/i })).toBeNull()
  })
})

describe('the header ✓ submits the form', () => {
  it('is a submit button owned by the form, not a click handler', () => {
    render(<Harness initialTitle="Middlemarch" />)
    const save = screen.getByLabelText('Save')
    expect(save.type).toBe('submit')
    expect(save.getAttribute('form')).toBe(FORM_ID)
    // The form owner is what makes it the default button, and therefore what
    // makes Enter-to-submit work.
    expect(save.form?.id).toBe(FORM_ID)
  })

  it('runs the form’s own onSubmit when pressed', async () => {
    const onAdded = vi.fn()
    render(<Harness initialTitle="Middlemarch" onAdded={onAdded} />)
    await userEvent.click(screen.getByLabelText('Save'))
    expect(onAdded).toHaveBeenCalledWith({ id: 7, title: 'Middlemarch' })
  })

  it('is greyed out with no title, and says why in words', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Save').disabled).toBe(true)
    // A disabled glyph explains nothing on its own.
    expect(screen.getByText(/a title is required to save/i)).toBeTruthy()
  })

  it('drops the explanation once there is a title', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('Title'), 'Middlemarch')
    expect(screen.getByLabelText('Save').disabled).toBe(false)
    expect(screen.queryByText(/a title is required to save/i)).toBeNull()
  })
})
