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
  it('leads with the cover, then says what the work is, then names it', () => {
    const { container } = hero()
    const split = container.querySelector('.work-hero-split')
    expect(split, 'no .work-hero-split').not.toBeNull()
    expect(split.querySelector('img[alt="cover"]')).not.toBeNull()
    expect(orderOf(screen.getByTestId('kind'))).toBeLessThan(orderOf(container.querySelector('h1')))
  })

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

  it('puts the people, the description and the verbs after all of that', () => {
    const { container } = hero({ actions: <button type="button">Practise</button> })
    const shelf = orderOf(screen.getByTestId('shelf'))
    expect(orderOf(screen.getByTestId('meta'))).toBeGreaterThan(shelf)
    expect(orderOf(screen.getByText('A book about margins.'))).toBeGreaterThan(orderOf(screen.getByTestId('meta')))
    expect(orderOf(container.querySelector('.work-hero-actions'))).toBeGreaterThan(shelf)
  })

  it('keeps the identity line with the title, not with the shelf', () => {
    const { container } = hero()
    const facts = container.querySelector('.work-hero-facts')
    // What the work IS lives in the facts block under the title.
    expect(facts.contains(screen.getByTestId('kind'))).toBe(true)
    // Who made it is its own row below — a person is an object, not a fact.
    expect(facts.contains(screen.getByTestId('meta'))).toBe(false)
  })

  it('draws the heart on the title line, where its position is learnable', () => {
    const { container } = hero()
    const titleRow = container.querySelector('.work-hero-title')
    expect(titleRow.querySelector('h1')).not.toBeNull()
    expect(titleRow.querySelector('.heart')).not.toBeNull()
  })

  it('does not float anything', () => {
    // THE FLOAT IS THE BUG THIS ARRANGEMENT DOES NOT HAVE. Floating the actions
    // right is what tore a book's name in half — "Moby-Dick; or, The" on one line,
    // five buttons, then the rest of it — and needed `clear: right`, a measured
    // guard and a whole browser harness to catch. The pack has no float; the verbs
    // are a row at the foot, where they cannot cut into anything.
    const { container } = hero({ actions: <button type="button">Practise</button> })
    for (const el of container.querySelectorAll('*')) {
      expect(el.style.float || '', `${el.className} floats`).toBe('')
    }
  })
})

describe('progress rides the cover, not a row of its own', () => {
  it('welds a strip to the foot of the cover when there is progress', () => {
    const { container } = hero({ progress: 0.62 })
    const bar = container.querySelector('.work-hero-cover-wrap .work-hero-shelfbar')
    expect(bar, 'the strip is not inside the cover wrapper').not.toBeNull()
    expect(bar.querySelector('span').style.width).toBe('62%')
  })

  it('gives the shelf track a line of its own, in the row with the chips', () => {
    // The class is the contract the stylesheet keys on. A 168px bar allowed to
    // wrap like a chip puts the state, the track and the ×N counter on three
    // lines in no particular order — the bug a phone-only rule used to fix and
    // that a 300px column reproduces.
    const { container } = hero({
      tags: (
        <>
          <span>reading</span>
          <span className="shelf-track">bar</span>
        </>
      ),
    })
    expect(container.querySelector('.work-hero-state .shelf-track')).not.toBeNull()
  })

  it('draws nothing at all when there is no progress', () => {
    // A 0% track on a book you have not opened is a bar that says nothing.
    expect(hero({ progress: null }).container.querySelector('.work-hero-shelfbar')).toBeNull()
  })

  it('clamps a value that arrived wrong rather than drawing past the cover', () => {
    expect(hero({ progress: 4 }).container.querySelector('.work-hero-shelfbar span').style.width).toBe('100%')
    expect(hero({ progress: -1 }).container.querySelector('.work-hero-shelfbar span').style.width).toBe('0%')
  })
})

describe('every kind of work gets the same header', () => {
  it('draws a film exactly as it draws a book', () => {
    // The way this breaks is one screen growing its own header, which is what
    // happened before: the film page called a different component and never got
    // the column arrangement at all. There is only one component now — so the
    // assertion is that a film's props produce the same structure, not that two
    // implementations agree.
    const book = hero().container.querySelector('.work-hero').className
    const film = hero({
      title: 'Northline',
      kindRow: <span data-testid="kind">Film · 1978</span>,
      meta: <span data-testid="meta">R. Whitfield</span>,
    }).container
    expect(film.querySelector('.work-hero').className).toBe(book)
    expect(film.querySelector('.work-hero-split')).not.toBeNull()
    expect(film.querySelector('.work-hero-facts')).not.toBeNull()
  })

  it('holds its shape when a work has no genres, no description and no credits', () => {
    // A hand-added film often has none of them, and the header must not collapse
    // into a different arrangement for it.
    const { container } = hero({ genres: [], description: '', meta: null })
    expect(container.querySelector('.work-hero-split')).not.toBeNull()
    expect(orderOf(screen.getByTestId('counts'))).toBeGreaterThan(orderOf(container.querySelector('h1')))
  })

  it('does not draw a credits row, or its +N, when there is nobody in it', () => {
    const { container } = hero({ meta: null, onPeople: () => {}, peopleCount: 3 })
    expect(container.querySelector('.work-hero-credits')).toBeNull()
    expect(container.querySelector('.work-hero-more')).toBeNull()
  })

  it('keeps the +N OUTSIDE the scroller, so it cannot scroll away', () => {
    // The two affordances are a pair and have to be separable: the fade says
    // swipe, the button says tap for all of it. A button that moves with the
    // swipe reads as a fourth person.
    const { container } = hero({ onPeople: () => {}, peopleCount: 3 })
    const more = container.querySelector('.work-hero-more')
    expect(more).not.toBeNull()
    expect(container.querySelector('.work-hero-credit-row').contains(more)).toBe(false)
  })
})
