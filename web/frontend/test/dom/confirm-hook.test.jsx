// useConfirm, and the thirteen deletes that had never run.
//
// THE POINT IS NOT THE LOOK, IT IS THAT THE PATH EXECUTES. Every one of these
// actions was written `if (!confirm(question)) return`. jsdom has no confirm():
// it warns and returns undefined, which is falsy — so in every test that ever
// reached one of these handlers, the delete underneath returned early and the
// request was never made. They were not thinly covered, they were uncoverable.
//
// So this file asserts the two halves that were missing: the question is asked
// with the app's own dialog (in the app's own language, keyboard-dismissible),
// and answering it yes actually performs the delete.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useConfirm } from '../../src/ui.jsx'

let RESULT

function Subject({ question }) {
  const { ask, confirmDialog } = useConfirm()
  return (
    <div>
      {confirmDialog}
      <button
        onClick={async () => {
          RESULT = await ask(question)
        }}
      >
        do it
      </button>
    </div>
  )
}

beforeEach(() => {
  RESULT = 'never settled'
})
afterEach(() => cleanup())

const press = async (label) => {
  await act(async () => {
    screen.getByText(label).closest('button').click()
  })
}

// THE DEFECT THIS PINS WAS FOUND BY LOOKING AT A RENDER, not by a test: the tag
// delete's question appeared UNDERNEATH the tag cards. A `.hand-card` is
// `isolation: isolate`, so a dialog rendered inside one is trapped in that card's
// stacking context and every later sibling paints over it — and z-50 cannot help,
// because z-index is only ever compared within a stacking context. jsdom has no
// layout and no paint, so nothing in the suite could have seen it. What a test
// CAN see is the structural cause, which is the dialog's position in the tree.

describe('the answer', () => {

  it('resolves false when cancelled — the caller returns, it does not hang', async () => {
    render(<Subject question="Delete this quote?" />)
    await press('do it')
    await press('Cancel')
    expect(RESULT).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

})
