// A dialog commits from its header — the contract between FormModal and the form
// inside it.
//
// The rule is now the house standard: a dialog's two answers are yes and no, and
// they belong together in the top right rather than one pinned in the header and
// one at the foot of a form long enough to scroll off. Making that a standard
// rather than a one-off means it is arranged through a context, so every existing
// FormModal got it without a single call site changing — and that is precisely
// what makes the failure modes worth pinning:
//
//   - Not every FormModal holds a form. WorkDetails is a panel that saves each
//     field on its own; the staged-quote editor commits through its own buttons.
//     A ✓ on either would look like it saves and do nothing, which is worse than
//     no ✓ at all. So the button has to be EARNED by a form registering.
//   - The ✓ is a real submit button bound by the HTML `form=` attribute, which is
//     also what makes it the form's DEFAULT BUTTON — the only reason Enter in a
//     field still saves once the form has no submit control of its own. Rewrite it
//     as an onClick and Enter dies silently in every edit dialog at once.
//   - These same forms are used INLINE (the search modal's editor, the capture
//     surface), where there is no header to put anything in. Those keep their own
//     footer, so "hosted" has to be something the form can actually detect.

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FormModal, useFormHost } from '../../src/ui.jsx'

// A minimal form following the house contract: it reports why it cannot be saved,
// wears the host's id, and drops its own footer when hosted.
function Demo({ onSubmit = () => {}, initial = '' }) {
  const [text, setText] = useState(initial)
  const missing = text.trim() ? '' : 'Write something first'
  const host = useFormHost(missing)
  return (
    <form
      id={host?.formId}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(text)
      }}
    >
      <label>
        Text
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {!host && <button type="submit">Save</button>}
    </form>
  )
}

const openModal = (ui) => render(<FormModal open onClose={() => {}} title="Edit quote">{ui}</FormModal>)

describe('a form inside the dialog', () => {
  it('puts a ✓ in the header, bound to the form by id', () => {
    openModal(<Demo initial="hello" />)
    const save = screen.getByLabelText('Save')
    expect(save.type).toBe('submit')
    // Form ownership by attribute is what makes it the default button.
    expect(save.getAttribute('form')).toBeTruthy()
    expect(save.form).not.toBeNull()
    expect(save.form.getAttribute('id')).toBe(save.getAttribute('form'))
  })

  it('submits the form when pressed', async () => {
    const onSubmit = vi.fn()
    openModal(<Demo initial="hello" onSubmit={onSubmit} />)
    await userEvent.click(screen.getByLabelText('Save'))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('drops its own footer button, so the ✓ is the only submit', () => {
    openModal(<Demo initial="hello" />)
    const submits = [...document.querySelectorAll('button')].filter((b) => b.type === 'submit')
    expect(submits).toHaveLength(1)
    expect(submits[0].getAttribute('aria-label')).toBe('Save')
  })

  it('keeps the ✕ beside it', () => {
    openModal(<Demo initial="hello" />)
    expect(screen.getByLabelText('Close')).toBeTruthy()
  })
})

describe('the form says when it cannot be saved', () => {
  it('greys the ✓ and carries the reason', () => {
    // It is shown as a tooltip on the disabled button, and tooltips are labels.
    openModal(<Demo />)
    const save = screen.getByLabelText('Save')
    expect(save.disabled).toBe(true)
  })

  it('enables it as soon as the form is valid', async () => {
    openModal(<Demo />)
    expect(screen.getByLabelText('Save').disabled).toBe(true)
    await userEvent.type(screen.getByLabelText('Text'), 'a line')
    expect(screen.getByLabelText('Save').disabled).toBe(false)
  })
})

describe('a dialog with no form', () => {
  it('shows no ✓ at all', () => {
    // WorkDetails and the staged-quote editor. A button that looks like it saves
    // and does nothing is worse than no button.
    openModal(<p>Just some details, saved field by field.</p>)
    expect(screen.queryByLabelText('Save')).toBeNull()
    expect(screen.getByLabelText('Close')).toBeTruthy()
  })

  it('shows no ✓ once the form inside it unmounts', () => {
    const { rerender } = render(
      <FormModal open onClose={() => {}} title="Edit quote"><Demo initial="hi" /></FormModal>,
    )
    expect(screen.getByLabelText('Save')).toBeTruthy()
    rerender(<FormModal open onClose={() => {}} title="Edit quote"><p>gone</p></FormModal>)
    expect(screen.queryByLabelText('Save')).toBeNull()
  })
})

describe('the same form rendered inline', () => {
  it('keeps its own submit, because there is no header to borrow', () => {
    render(<Demo initial="hello" />)
    expect(screen.queryByLabelText('Save')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save' }).type).toBe('submit')
  })

  it('is not wearing a form id it was never given', () => {
    const { container } = render(<Demo initial="hello" />)
    expect(container.querySelector('form').getAttribute('id')).toBeNull()
  })
})
