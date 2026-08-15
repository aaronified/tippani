// The mark on a row the Daily Quiz will not draw (1.14.2).
//
// THE ONE THAT MATTERS IS INHERITANCE. `review_excluded` on the row is the easy
// half and was already on every list response; a card that reads only that flag
// shows nothing at all on the forty highlights of a book somebody excluded, and
// those are precisely the rows the mark exists for. The deck's own rule
// (reviewSource.where, server-side) drops a child whose PARENT is excluded, so a
// card reading one flag disagrees with the quiz about the commonest case.
//
// Asserted against skipReason rather than against a screen, because four
// surfaces render this — a book's highlights, a film's lines, a work tile and
// every search hit — and the thing they must agree on is the rule, not a layout.
// The rendering half below then pins the two facts a layout CAN get wrong: that
// the mark is absent (not merely invisible) on an ordinary row, and that the
// in-button variant leaves no focus stop behind.

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuizSkipMark, skipReason } from '../../src/ui.jsx'

describe('why the quiz will not draw this', () => {
  it('says nothing about a row that is in the deck', () => {
    expect(skipReason({ id: 1 }, 'book')).toBe('')
    expect(skipReason({ id: 1, review_excluded: false, work_review_excluded: false }, 'book')).toBe('')
  })

  it('names the row itself when the row is the reason', () => {
    expect(skipReason({ review_excluded: true }, 'book')).toBe('Not in the quiz')
  })

  // The load-bearing case: own flag FALSE, parent flag true. A card that read
  // `review_excluded` alone shows nothing here, and the quiz has already
  // stopped asking.
  it('names the work when the work is the reason', () => {
    expect(skipReason({ review_excluded: false, work_review_excluded: true }, 'book'))
      .toBe('Skipped with its book')
    expect(skipReason({ review_excluded: false, work_review_excluded: true }, 'film'))
      .toBe('Skipped with its film')
    // A series is not a film, and the row does not carry media_type — the
    // caller does, which is why the noun is a prop.
    expect(skipReason({ work_review_excluded: true }, 'show')).toBe('Skipped with its show')
  })

  // The row's own flag wins the wording: "Not in the quiz" is true either way,
  // and blaming the book for a decision made about the quote would send anybody
  // trying to undo it to the wrong control.
  it('blames the row, not the work, when both are set', () => {
    expect(skipReason({ review_excluded: true, work_review_excluded: true }, 'book'))
      .toBe('Not in the quiz')
  })

  // A standalone quote has no parent to inherit from, so the caller names none.
  // The fallback exists so a future kind cannot render the word "undefined".
  it('falls back to a generic noun rather than an empty one', () => {
    expect(skipReason({ work_review_excluded: true })).toBe('Skipped with its work')
  })

  // Every label here is inside the house ceiling. A tooltip is one line on a
  // phone and this one competes with the status dot's beside it.
  it('keeps every label to five words', () => {
    const labels = [
      skipReason({ review_excluded: true }),
      skipReason({ work_review_excluded: true }, 'book'),
      skipReason({ work_review_excluded: true }, 'show'),
    ]
    for (const l of labels) expect(l.split(' ').length).toBeLessThanOrEqual(5)
  })
})

describe('the mark itself', () => {
  it('is absent from a row the quiz will draw', () => {
    const { container } = render(<QuizSkipMark item={{ id: 1 }} parent="book" />)
    expect(container.querySelector('.quiz-skip-mark')).toBeNull()
  })

  it('stands on a row inheriting its work exclusion, and says why', () => {
    render(<QuizSkipMark item={{ id: 1, work_review_excluded: true }} parent="book" />)
    expect(screen.getByLabelText('Skipped with its book')).not.toBeNull()
  })

  // `quiet` is for a mark inside a <button> — a work tile, a search hit. A
  // focusable element nested in a button is invalid HTML and the browsers
  // disagree about which control a tap belongs to, so the focus stop has to go.
  // The accessible name does NOT: it folds into the button's name instead.
  it('leaves no focus stop inside a button, and stays named', () => {
    render(<QuizSkipMark item={{ review_excluded: true }} quiet />)
    const mark = screen.getByLabelText('Not in the quiz')
    expect(mark.getAttribute('tabindex')).toBeNull()
    expect(mark.getAttribute('role')).toBe('img')
  })

  it('is reachable by keyboard everywhere else', () => {
    render(<QuizSkipMark item={{ review_excluded: true }} />)
    expect(screen.getByLabelText('Not in the quiz').getAttribute('tabindex')).toBe('0')
  })
})
