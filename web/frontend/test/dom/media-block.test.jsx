// The media block states the size of the picture it is actually drawing.
//
// WHY THIS IS WORTH A TEST. The number is not decoration: it is the one fact a
// reader uses to decide whether to replace their cover, and the ink on it is a
// promise that Fetch can do something about it. Three of the four states it can
// be in are easy to get wrong in the same direction — a picture still loading, a
// picture the page is forbidden to draw, and no picture at all all measure zero
// if you are not careful, and only ONE of them is a small cover.

import { describe, expect, it, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { COVER_MIN_W, MediaBlock, PORTRAIT_MIN_SIDE } from '../../src/ui.jsx'

// jsdom never fetches, so the load is staged by hand — which is also the only
// way to say what the bytes measured.
function drawn(w, h) {
  const img = document.querySelector('.tp-media-pic img')
  expect(img, 'the block drew no picture').toBeTruthy()
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true })
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true })
  fireEvent.load(img)
  return img
}

const dims = () => document.querySelector('.tp-media-dims')

beforeEach(cleanup)

describe('the media block', () => {
  it('states what the picture measured', () => {
    render(<MediaBlock src="/covers/a.jpg" label="Cover" />)
    drawn(1000, 1500)
    expect(dims().textContent).toBe('1000×1500 px')
    expect(dims().className).not.toMatch(/is-low/)
  })

  it('inks the size when Fetch could replace it', () => {
    render(<MediaBlock src="/covers/small.jpg" label="Cover" />)
    drawn(COVER_MIN_W - 1, 9000)
    expect(dims().textContent).toBe(`${COVER_MIN_W - 1}×9000 px`)
    expect(dims().className).toMatch(/is-low/)
  })

  it('leaves it alone at the floor exactly', () => {
    render(<MediaBlock src="/covers/edge.jpg" label="Cover" />)
    drawn(COVER_MIN_W, 10)
    expect(dims().className).not.toMatch(/is-low/)
  })

  it('says 0×0 for no picture, and inks that too', () => {
    render(<MediaBlock src="" label="Cover" />)
    expect(dims().textContent).toBe('0×0 px')
    expect(dims().className).toMatch(/is-low/)
    expect(document.querySelector('.tp-media-pic .ph'), 'no placeholder').toBeTruthy()
  })

  // The one the naive version gets wrong: a pasted URL the page's img-src
  // forbids has a perfectly good size that this page cannot read.
  it('says nothing at all about a picture it could not draw', () => {
    render(
      <MediaBlock src="https://elsewhere.test/a.jpg" label="Cover" blocked={<span className="tp-media-blocked">will fetch on save</span>} />,
    )
    fireEvent.error(document.querySelector('.tp-media-pic img'))
    expect(dims(), 'a picture that would not load is not a picture of size zero').toBeNull()
    expect(screen.getByText('will fetch on save')).toBeTruthy()
  })

  it('forgets the last picture when it is handed a new one', () => {
    const { rerender } = render(<MediaBlock src="/covers/a.jpg" label="Cover" />)
    drawn(1200, 1800)
    expect(dims().textContent).toBe('1200×1800 px')
    rerender(<MediaBlock src="/covers/b.jpg" label="Cover" />)
    expect(dims(), 'it is still stating the previous cover’s pixels').toBeNull()
    drawn(300, 450)
    expect(dims().textContent).toBe('300×450 px')
    expect(dims().className).toMatch(/is-low/)
  })

  it('judges a face on its shorter side, and draws a silhouette when there is none', () => {
    render(<MediaBlock shape="round" src="/covers/wide.jpg" floor={PORTRAIT_MIN_SIDE} />)
    drawn(4000, PORTRAIT_MIN_SIDE - 1)
    expect(dims().className).toMatch(/is-low/)
    cleanup()
    render(<MediaBlock shape="round" src="" floor={PORTRAIT_MIN_SIDE} />)
    expect(document.querySelector('.tp-media-pic.is-round .tp-media-face')).toBeTruthy()
    expect(document.querySelector('.tp-media-pic .ph'), 'a hatch where a silhouette belongs').toBeNull()
  })

  it('puts every verb in the grid, and nothing else there', () => {
    render(
      <MediaBlock
        src=""
        label="Cover"
        verbs={[<button key="a">Fetch</button>, <button key="b">Search</button>, <button key="c">Upload</button>, <button key="d">Paste</button>]}
      />,
    )
    expect(document.querySelectorAll('.tp-media-verbs > .tp-media-verb')).toHaveLength(4)
  })

  // An empty drawer area is not an area. Every caller's extras are conditional,
  // so the false branches must not lay out a row and its gap.
  it('grows no extra row for conditions that are all false', () => {
    render(
      <MediaBlock src="" label="Cover">
        {false}
        {null}
      </MediaBlock>,
    )
    expect(document.querySelector('.tp-media-extra')).toBeNull()
  })
})
