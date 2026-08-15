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
import { fireEvent, render, screen } from '@testing-library/react'
import { WorkCard } from '../../src/works.jsx'
import { actionsFor, bulkActionsFor } from '../../src/actions.jsx'

const BOOK = { id: 4, title: 'The Chicago Manual of Style', author: 'UCP', annotation_count: 12 }

// Right-click is the desktop door; long-press and Shift+F10 are the other two,
// and all three land in useCardMenu, which has its own tests.
function openMenu(item = BOOK, props = {}) {
  render(<WorkCard kind="book" item={item} onOpen={() => {}} onChanged={() => {}} {...props} />)
  fireEvent.contextMenu(screen.getByTitle(item.title))
}

const labels = () => screen.getAllByRole('menuitem').map((n) => n.textContent.trim())

describe('the menu a cover opens', () => {
  it('offers the things the bar offers one selected book', () => {
    openMenu(BOOK, { onEdit: () => {} })
    const shown = labels()
    expect(shown).toContain('Fill gaps')
    expect(shown).toContain('Skip in quiz')
    expect(shown).toContain('Edit')
    expect(shown).toContain('Delete')
  })

  // The flip, on the card this time. The tile already wears the matching mark
  // (QuizSkipMark), so a menu item that always read "Skip in quiz" would be
  // offering to do a thing the glyph beside it says is already done.
  it('reads Add to quiz on a book that is already out of it', () => {
    openMenu({ ...BOOK, review_excluded: true })
    expect(labels()).toContain('Add to quiz')
    expect(labels()).not.toContain('Skip in quiz')
  })

  it('has no Copy or Share, because a cover is not a quote', () => {
    openMenu()
    expect(labels()).not.toContain('Copy')
    expect(labels()).not.toContain('Share')
  })

  // The registry's rule, exercised through the component: a board that cannot
  // reload after a write passes no `onChanged`, and the writes are then absent
  // rather than present and silently ineffective.
  //
  // THIS ASSERTED AN EMPTY MENU until 1.15.0, which was the same statement only
  // as long as every action on a work was a write. Practise is the first that is
  // not — it opens a themed round over the book, which reads the quote pool and
  // changes nothing this tile draws — so gating it on a reload callback would be
  // coupling a read to a write for the symmetry of it. The rule the name states
  // is the one checked: no writes.
  it('offers nothing that writes when the board cannot reload', () => {
    render(<WorkCard kind="book" item={BOOK} onOpen={() => {}} />)
    fireEvent.contextMenu(screen.getByTitle(BOOK.title))
    for (const write of ['Fill gaps', 'Skip in quiz', 'Add to quiz', 'Edit', 'Delete']) {
      expect(labels()).not.toContain(write)
    }
    expect(labels()).toEqual(['Practise'])
  })

  it('offers a themed round over the book itself', () => {
    openMenu()
    expect(labels()).toContain('Practise')
  })

  it('starts a selection from the menu, and says which way round it is', () => {
    const toggle = vi.fn()
    const selection = { isSelected: () => false, toggle, active: false, extendTo: vi.fn() }
    openMenu(BOOK, { selection })
    expect(labels()[0]).toBe('Select')
    fireEvent.click(screen.getByText('Select'))
    expect(toggle).toHaveBeenCalledWith(BOOK.id, 'book')
  })
})

describe('deleting one work from its cover', () => {
  // One tap and no typed phrase, unlike the bar — and the dialog has to say what
  // goes with it, because a cover gives no hint that twelve quotes are attached.
  it('asks first, and names what the bin will be holding', () => {
    openMenu()
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByRole('dialog').textContent).toContain('12 quotes')
    expect(screen.getByRole('dialog').textContent).toContain('Undo')
  })

  it('says it in the singular when there is one', () => {
    openMenu({ ...BOOK, annotation_count: 1 })
    fireEvent.click(screen.getByText('Delete'))
    const said = screen.getByRole('dialog').textContent
    expect(said).toContain('1 quote saved')
    expect(said).not.toContain('1 quotes')
  })

  // An empty book has no subtree to warn about, and a sentence about "the 0
  // quotes saved from it" is worse than no sentence.
  it('drops the clause entirely for a work with nothing saved from it', () => {
    openMenu({ ...BOOK, annotation_count: 0 })
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByRole('dialog').textContent).not.toContain('0 quote')
  })
})

describe('the card and the bar cannot drift', () => {
  // The invariant, restated at the component's own level: everything the bar
  // can do to a selection of exactly one work is reachable from that work's
  // card. Set fields and Shelf are the stated exceptions — the first is
  // bulk-only by rule (over one work the full form is strictly better), the
  // second needs a submenu a card menu has no shape for.
  it.each(['book', 'movie'])('%s', (kind) => {
    const ctx = {
      fillGaps: vi.fn(), setShelf: vi.fn(), setFields: vi.fn(),
      setReview: vi.fn(), edit: vi.fn(), remove: vi.fn(),
    }
    const onCard = new Set(actionsFor(kind, BOOK, ctx).map((a) => a.id))
    for (const a of bulkActionsFor(kind, [BOOK], ctx)) {
      if (a.id === 'set-fields' || a.id === 'shelf') continue
      expect(onCard.has(a.id), `${kind}: the bar can ${a.id} and the card cannot`).toBe(true)
    }
  })
})
