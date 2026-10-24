// A work's own context menu (1.14.2).
//
// WHAT WAS EMPTY WAS THE REGISTRY, NOT THE GESTURE. WorkCard passed `[]` to
// useCardMenu with a comment saying a menu offering nothing would teach a
// gesture and then refuse it — true, and a fair reading of the state it was
// written in. The state was that `bulkActionsFor` grew a work branch in 1.11.1
// and `actionsFor` stayed quote-only, so the selection bar could skip a book in
// the quiz, fill its gaps, edit it and delete it with exactly ONE thing
// selected, and the tile that one was selected from could do none of them.
//
// So the assertions that matter here are about the pair, not about the menu: the
// bar and the card read one registry and act through one hook, and anything the
// bar can do to a selection of one is on the card it came from.

import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { WorkCard } from '../../src/works.jsx'
import { actionsFor, bulkActionsFor } from '../../src/actions.jsx'

const BOOK = { id: 4, title: 'The Chicago Manual of Style', author: 'UCP', annotation_count: 12 }

// Right-click is the desktop door; long-press and Shift+F10 are the other two,
// and all three land in useCardMenu, which has its own tests.
function openMenu(item = BOOK, props = {}) {
  render(<WorkCard kind="book" item={item} onOpen={() => {}} onChanged={() => {}} {...props} />)
  fireEvent.contextMenu(screen.getByTitle(item.title))
}


describe('deleting one work from its cover', () => {
  // A TYPED PHRASE, THE BAR'S OWN, and the dialog still has to say what goes with
  // it — a cover gives no hint that twelve quotes are attached, and the phrase
  // says how many BOOKS are going, never how much is going with them.
  //
  // One test over all three counts rather than three: the gesture and the
  // assertion target (the one dialog's text) are identical per row and only the
  // count and the wording it should produce differ, so the aggregate names EVERY
  // count whose sentence came out wrong at once. cleanup() runs per row so
  // getByRole('dialog') still matches exactly one.

  // THE GUARD, AND THAT IT IS A GUARD RATHER THAN A LABEL. The dialog naming a
  // phrase while accepting the button anyway is the failure worth a test: it
  // reads exactly like a working control and destroys the book on one press.
  //
  // The dialog's own presence is what is asserted, not a delete spy — the tile
  // deletes through useBulkOps rather than through a prop, and reaching in to
  // stub that would test the stub. A dialog that is still open did not delete.
  it('will not delete until the phrase is typed', () => {
    openMenu({ ...BOOK, annotation_count: 12 })
    fireEvent.click(screen.getByText('Delete'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('delete 1 book')

    const confirm = within(dialog).getByText('Delete it').closest('button')
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(screen.queryByRole('dialog')).not.toBeNull()

    // Case and surrounding space are forgiven — the phrase is a speed bump, not
    // a spelling test, and an autocapitalising phone keyboard would otherwise
    // make it unanswerable.
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  Delete 1 Book ' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // A dialog dismissed and reopened must ask again. It would not if the typed
  // text outlived the close — the second open would arrive already satisfied,
  // which is a typed guard you only ever have to type once.
  
})

// THE FILE THESE QUOTES CAME FROM. The card offers to attach one, a game never does
// (the owner's: "games have no equivalent"), and a show asks which episode first
// because a subtitle covers one. What is pressed and what the server is sent is
// what a person does; no function or module is named.

