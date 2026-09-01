// A panel that holds a form draws the key that commits it — and one that does not
// draws nothing.
//
// THE FAILURE THIS EXISTS FOR is silent and total. A form in this app does not
// draw its own ✓: `useFormHost` registers the form with whatever chrome is above
// it, wears that chrome's form id, and reports a reason it cannot be saved yet;
// the chrome draws one submit key bound to that id. For a long time the only
// chrome that did this was FormModal. Moving a form onto the panel stack
// therefore returned null from useFormHost, left the <form> with no id, and
// deleted the only control that submits it — with nothing thrown, nothing logged
// and every existing test still green, because the tests that would have noticed
// were being rewritten around the new shell in the same change.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useFormHost } from '../../src/ui.jsx'
import { PanelHarness, resetPanelHistory } from '../panel-harness.jsx'

// A form exactly as a real one is written: it asks the host for an id, reports
// whether it is ready, and wears the id it is given.
function TinyForm({ reason = '', onSubmit }) {
  const host = useFormHost(reason)
  return (
    <form id={host?.formId} onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <p>the form body</p>
    </form>
  )
}

const save = () => screen.queryByLabelText('Save')

// TWO WAITS, AND BOTH ARE REAL PROPERTIES OF THE STACK rather than test
// artefacts. open() pushes on the next frame, because it walks history back
// first and the push has to wait for the pop to land — so the panel's body
// arrives asynchronously. And the ✓ arrives one render AFTER the body: the form
// inside registers itself in an effect, which is the only way the chrome can
// learn there is anything to commit.
const opened = () => waitFor(() => expect(screen.getByText(/the form body|just a list/)).toBeTruthy())
const savedKey = () => screen.findByLabelText('Save')

beforeEach(() => { cleanup(); resetPanelHistory() })

describe('a panel that hosts a form', () => {
  it('draws the key, and pressing it submits the form', async () => {
    const onSubmit = vi.fn()
    render(<PanelHarness panel={{ title: 'Details', render: () => <TinyForm onSubmit={onSubmit} /> }} />)
    await opened()
    const key = await savedKey()
    expect(key, 'the panel drew no save key, so the form cannot be submitted at all').toBeTruthy()
    // BOUND BY ID, not by being inside the form: the key lives in the panel's
    // header and the form lives in its body, so `form={formId}` is the only thing
    // joining them. A key that is merely present but unbound submits nothing.
    expect(key.getAttribute('form')).toBeTruthy()
    expect(document.querySelector('form').id).toBe(key.getAttribute('form'))
    fireEvent.click(key)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('draws no key at all for a panel with no form in it', async () => {
    render(<PanelHarness panel={{ title: 'Links', render: () => <p>just a list</p> }} />)
    await opened()
    // A settling frame, so "not yet" cannot pass for "never".
    await new Promise((r) => setTimeout(r, 30))
    expect(save(), 'a list of rows has nothing to commit and must not offer to').toBeNull()
  })

  it('disables the key and says why, while the form says it is not ready', async () => {
    render(
      <PanelHarness panel={{ title: 'Details', render: () => <TinyForm reason="A title is required" onSubmit={() => {}} /> }} />,
    )
    await opened()
    // Disabled is the assertion; the reason rides as a tooltip on the key, and a
    // tooltip needs a hint host and a hover clock to appear — which is
    // Tooltip's own test's subject, not this one's. form-modal-header.test.jsx
    // draws the same line for the same reason.
    expect((await savedKey()).disabled).toBe(true)
  })

  it('enables the key once the form says it is ready', async () => {
    render(
      <PanelHarness panel={{ title: 'Details', saveTip: 'Save every open row', render: () => <TinyForm onSubmit={() => {}} /> }} />,
    )
    await opened()
    expect((await savedKey()).disabled).toBe(false)
  })
})

// The port's own case, kept apart from the ported ones on purpose.
//
// details-save-all.test.jsx and supplier-ids.test.jsx were both rewritten onto
// the harness in the same change that moved WorkDetails onto the stack. Every
// assertion in them survived verbatim, which is the point — but a regression in
// the SHELL could still hide inside a rewrite of the tests that watch it. So the
// shell has a case of its own that no port touched.
describe('the work detail lives on the stack', () => {
  it('opens as a panel titled Details, with a ✓ its form registered', async () => {
    const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
    render(
      <PanelHarness
        panel={(stack) =>
          workDetailsPanel(stack, {
            kind: 'book',
            item: { id: 1, title: 'Solaris', genres: [] },
            onChanged: () => {},
            onDelete: null,
          })
        }
      />,
    )
    await waitFor(() => expect(document.querySelector('.tp-panel')).toBeTruthy())
    // A panel, not a dialog card: the two are different chrome and the whole
    // move was from one to the other.
    expect(document.querySelector('.tp-panel-title').textContent).toBe('Details')
    expect(document.querySelector('.hand-card.hc-r2'), 'still a FormModal').toBeNull()
    // And the key the port would otherwise have deleted in silence.
    expect(await screen.findByLabelText('Save')).toBeTruthy()
  })
})
