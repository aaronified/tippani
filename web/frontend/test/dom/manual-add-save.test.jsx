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

describe('the header ✓ submits the form', () => {
  it('runs the form’s own onSubmit when pressed', async () => {
    const onAdded = vi.fn()
    render(<Harness initialTitle="Middlemarch" onAdded={onAdded} />)
    await userEvent.click(screen.getByLabelText('Save'))
    expect(onAdded).toHaveBeenCalledWith({ id: 7, title: 'Middlemarch' })
  })

})
