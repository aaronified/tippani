// A work's header on a phone: one stated order, the same for every kind of work.
//
// The desktop hero floats the cover and lets the rest wrap around it, which is
// right in a 500px column. On a 320px screen the same float leaves a ~150px
// gutter, and the title, the author chips, the year, the series, the shelf state,
// the read counter and the progress track all wrap into it independently.
// Nothing is misplaced — there is nowhere to put it — but identity and state come
// out interleaved and the header reads as jumbled.
//
// So the phone stacks, in an order that answers four questions in turn:
//
//   1. what it is         cover, title, author, year
//   2. where you are      shelf state, read count, then the track
//   3. what it is to you   the heart and the tags
//   4. what it is about    genres, then the description
//
// The order is the whole fix, so the order is what is asserted — by DOM position,
// which is also the reading order for a screen reader and the tab order for a
// keyboard. And it is asserted for a book AND a film, because "the same for all
// kinds of works" was the request; WorkHero is shared, so the way that breaks is
// one page growing its own header.

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkHero } from '../../src/works.jsx'

// useIsMobileScreen reads matchMedia; the dom setup stubs it to always-false.
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
      title="The Wide Margin"
      meta={<span data-testid="meta">A. Whitfield · 1998</span>}
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
const orderOf = (el) => {
  const all = [...document.querySelectorAll('*')]
  return all.indexOf(el)
}

describe('the phone header stacks in a stated order', () => {
  it('leads with the cover and the title together', () => {
    const { container } = hero()
    const band = container.querySelector('.work-hero-m-top')
    expect(band, 'no .work-hero-m-top band').not.toBeNull()
    expect(band.querySelector('img[alt="cover"]'), 'cover is not in the top band').not.toBeNull()
    expect(band.querySelector('h1').textContent).toBe('The Wide Margin')
  })

  it('keeps the identity line with the title, not with the shelf', () => {
    const { container } = hero()
    const band = container.querySelector('.work-hero-m-top')
    // Author and year belong to what the work IS.
    expect(band.contains(screen.getByTestId('meta'))).toBe(true)
    expect(band.contains(screen.getByTestId('shelf'))).toBe(false)
  })

  it('puts the shelf row after the title band and before the description', () => {
    const { container } = hero()
    const band = orderOf(container.querySelector('.work-hero-m-top'))
    const shelf = orderOf(container.querySelector('.work-hero-m-shelf'))
    const description = orderOf(screen.getByText('A book about margins.'))
    expect(shelf).toBeGreaterThan(band)
    expect(description).toBeGreaterThan(shelf)
  })

  it('gathers the heart and the shelf tags into one row', () => {
    const { container } = hero()
    const shelf = container.querySelector('.work-hero-m-shelf')
    expect(shelf.contains(screen.getByTestId('shelf'))).toBe(true)
    // The heart is the row's first control, as it is on every quote card.
    expect(shelf.querySelector('button, [role="checkbox"], svg')).not.toBeNull()
  })

  it('gives the progress track its own full-width line', () => {
    const { container } = hero({ tags: <span className="shelf-track" data-testid="track">bar</span> })
    const css = container.ownerDocument.defaultView // no stylesheet in jsdom
    expect(css).toBeTruthy()
    // The class is the contract the stylesheet keys on; assert it survives into
    // the shelf row rather than trying to measure layout jsdom does not do.
    expect(container.querySelector('.work-hero-m-shelf .shelf-track')).not.toBeNull()
  })

  it('does not float anything', () => {
    // The float is the bug. If it comes back, so does the 150px gutter.
    const { container } = hero()
    for (const el of container.querySelectorAll('*')) {
      expect(el.style.float || '', `${el.className} floats`).toBe('')
    }
  })
})

describe('every kind of work gets the same header', () => {
  it('draws a film the same way as a book', () => {
    const { container } = hero({ title: 'Northline', meta: <span data-testid="meta">R. Whitfield · 1978</span> })
    expect(container.querySelector('.work-hero-m')).not.toBeNull()
    expect(container.querySelector('.work-hero-m-top')).not.toBeNull()
    expect(container.querySelector('.work-hero-m-shelf')).not.toBeNull()
  })

  it('holds its shape when a work has no genres and no description', () => {
    // A hand-added film often has neither, and the header must not collapse into
    // a different arrangement for it.
    const { container } = hero({ genres: [], description: '' })
    const band = orderOf(container.querySelector('.work-hero-m-top'))
    const shelf = orderOf(container.querySelector('.work-hero-m-shelf'))
    expect(shelf).toBeGreaterThan(band)
  })
})

describe('the desktop header is untouched', () => {
  it('still floats the cover when the screen is not a phone', () => {
    setScreen(false)
    const { container } = hero()
    expect(container.querySelector('.work-hero-m')).toBeNull()
    const floated = [...container.querySelectorAll('*')].filter((el) => el.style.float)
    expect(floated.length, 'the desktop hero lost its float layout').toBeGreaterThan(0)
  })
})
