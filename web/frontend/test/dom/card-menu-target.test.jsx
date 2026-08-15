// A card's context menu: the page holds still, and the card says it is the one.
//
// TWO FAULTS WITH ONE CAUSE. The menu is placed once, in script, at the point
// the press landed — anchored to a COORDINATE rather than to the card. That is
// the right way to place it, and it means two things nobody decided:
//
//   the page scrolls out from under it, so the menu ends up pinned over some
//   other card while its actions still belong to one now off screen; and
//
//   nothing on screen ever said which card it came from, which over a grid of
//   near-identical covers means pressing "delete" on faith.
//
// Both are asserted here through useCardMenu's own contract rather than through
// any one screen, because every card in the app goes through it.

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useCardMenu } from '../../src/ui.jsx'

function Card({ label }) {
  const { cardProps, menuClass, menu } = useCardMenu([
    { label: 'Delete', onClick: () => {} },
  ])
  return (
    <div {...cardProps} className={'hand-card ' + menuClass} data-testid={label}>
      {label}
      {menu}
    </div>
  )
}

const openMenuOn = (label) => {
  const card = screen.getByTestId(label)
  fireEvent.contextMenu(card, { clientX: 40, clientY: 40 })
  return card
}

describe('the card a context menu belongs to', () => {
  it('is marked, and only that one', () => {
    render(<><Card label="a" /><Card label="b" /></>)
    expect(screen.getByTestId('a').className).not.toContain('is-menu-target')

    openMenuOn('a')
    expect(screen.getByTestId('a').className).toContain('is-menu-target')
    // The mark answers "which one", so a second card wearing it would answer
    // nothing at all.
    expect(screen.getByTestId('b').className).not.toContain('is-menu-target')
  })

  it('drops the mark when the menu closes', () => {
    render(<Card label="a" />)
    openMenuOn('a')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('a').className).not.toContain('is-menu-target')
  })
})

describe('the page under an open card menu', () => {
  // Locked rather than re-anchored on scroll: a menu that chases its card is one
  // you can drag around the screen with the wheel, and it still leaves you
  // acting on something you can no longer see.
  it('does not scroll', () => {
    render(<Card label="a" />)
    expect(document.body.style.overflow).toBe('')
    openMenuOn('a')
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('scrolls again once the menu is gone', () => {
    render(<Card label="a" />)
    openMenuOn('a')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })

  // NOT TESTED HERE: that a menu opened over an open sheet leaves the page
  // locked when only the menu closes. That is useBodyScrollLock's refcount
  // rather than anything this change added, and the scenario needs two locks
  // held at once — which Escape, being a global dismiss, takes apart in the same
  // event. Asserting it through this hook would pin a situation I could not
  // actually produce, which is worse than leaving it to the lock's own contract.
})
