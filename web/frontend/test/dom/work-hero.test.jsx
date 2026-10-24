// A work's header — ONE arrangement, one stated order, every width, every kind of
// work.
//
// THIS FILE USED TO PIN THE PHONE'S OWN ARRANGEMENT, and the reason it no longer
// does is the point of the change it now guards. There were three heroes: a float
// for a wide page, a stack for a phone, a column for the two-column frame, chosen
// in JavaScript. Three copies of the same nine facts drift exactly as three copies
// do — the film side only ever called one of them, so a film never got the column
// at all, and the year lived in the credit line on one side and nowhere on the
// other. The design pack settles it: its hero is ONE markup at every width and
// only the cover's placement branches, which is a stylesheet's job.
//
// So what is asserted here is stronger than what was asserted before. It is not
// "the phone stacks in this order" — it is that there is only one order and every
// caller gets it. The order answers four questions in turn:
//
//   1. what it is        the cover, the kind, the year, the title
//   2. what it is about  its genres
//   3. what it holds     the count
//   4. where you are     the shelf state, with progress on the cover's own foot
//
// then the people, the description and the verbs. Asserted by DOM position, which
// is also the reading order for a screen reader and the tab order for a keyboard.

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkHero } from '../../src/works.jsx'

// The hooks that used to pick an arrangement are gone; matchMedia is stubbed
// anyway so a stray reader cannot make the test depend on a width.
const setScreen = (isMobile) => {
  window.matchMedia = (media) => ({
    matches: isMobile,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
const realMatchMedia = window.matchMedia
beforeEach(() => setScreen(true))
afterEach(() => { window.matchMedia = realMatchMedia })

const hero = (over = {}) =>
  render(
    <WorkHero
      cover={<img alt="cover" src="x" />}
      kindRow={<span data-testid="kind">Book · 1998</span>}
      title="The Wide Margin"
      meta={<span data-testid="meta">A. Whitfield</span>}
      counts={<span data-testid="counts">12 quotes</span>}
      favorite={false}
      onFavorite={() => {}}
      tags={<span data-testid="shelf">reading ×2</span>}
      genres={['essays', 'memoir']}
      description="A book about margins."
      {...over}
    />,
  )

// Where a node sits in the rendered document, so "before" and "after" are
// document order rather than anything about styling.
const orderOf = (el) => [...document.querySelectorAll('*')].indexOf(el)

describe('one header, one order', () => {
  it('runs kind → title → genres → count → shelf, in that order', () => {
    const { container } = hero()
    const seq = [
      orderOf(screen.getByTestId('kind')),
      orderOf(container.querySelector('h1')),
      orderOf(screen.getByText('essays')),
      orderOf(screen.getByTestId('counts')),
      orderOf(screen.getByTestId('shelf')),
    ]
    expect(seq, `out of order: ${seq.join(' ')}`).toEqual([...seq].sort((a, b) => a - b))
  })
})

describe('the compact bar knows which screen it is on', () => {
  it('leaves exactly one copy of the title in the document on a phone', () => {
    // The cost of the bar is a second copy of the name. A phone must not pay it
    // for something it will never show.
    const { container } = hero()
    expect(container.querySelectorAll('h1, .work-hero-mini-title')).toHaveLength(1)
  })
})

