// The board mounts a window, not a library.
//
// A shelf of four hundred books built 401 tiles and 7,492 elements on a page
// that shows eighteen — measured in a browser, at 707ms of blocking work for the
// tiles alone, and 31 megabytes of covers requested for the ones nobody had
// scrolled to. The list is still fetched and filtered whole (every chip, sort and
// count reads all of it); only the DOM is bounded.
//
// THE FAILURE THIS GUARDS IS SILENT IN BOTH DIRECTIONS. A window that never grows
// looks exactly like a working board until you scroll past sixty; a window that
// was quietly removed looks exactly like a working board until the library is
// large. So both halves are asserted, and the browser-less fallback with them:
// without IntersectionObserver a board cannot observe its own end, and a
// permanently truncated library is worse than a slow one.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const BOOKS = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1,
  title: `Book ${String(i + 1).padStart(3, '0')}`,
  author: 'Le Guin',
  genres: [],
  series: '',
  status: '',
  favorite: 0,
  annotation_count: 1,
  tagged_count: 0,
  noted_count: 0,
  cover_path: `cover-${i + 1}.jpg`,
}))

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, url) => {
    if (method === 'GET' && url === '/books') return { ok: true, status: 200, data: { books: BOOKS } }
    return { ok: false, status: 500, data: null }
  }),
  downloadPost: vi.fn(async () => ({ ok: false, status: 500, data: null })),
}))

// The stub in setup-dom.js constructs and never fires. This one keeps the
// callbacks, so a test can say "the end of the list came into view".
const observers = []
let RealIO
beforeEach(() => {
  observers.length = 0
  RealIO = globalThis.IntersectionObserver
  globalThis.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb
      observers.push(this)
    }
    observe(el) {
      this.el = el
    }
    unobserve() {}
    disconnect() {
      const i = observers.indexOf(this)
      if (i >= 0) observers.splice(i, 1)
    }
    takeRecords() {
      return []
    }
  }
})
afterEach(() => {
  globalThis.IntersectionObserver = RealIO
})

const mount = async () => {
  const Library = (await import('../../src/Library.jsx')).default
  render(<Library openId={null} onOpen={() => {}} onClose={() => {}} onOpenMovie={() => {}} creditSeparators=",;&" onAdd={() => {}} dataNonce={0} />)
  await screen.findByText('Book 001')
}

// The sentinel is the last <li> of the grid and carries no tile, so counting
// tiles means counting the covers' own alt text rather than list items.
const tiles = () => screen.queryAllByRole('img', { name: /cover/i }).length

const reachTheEnd = async () => {
  await act(async () => {
    for (const o of [...observers]) o.cb([{ isIntersecting: true, target: o.el }])
  })
}

describe('the library board is windowed', () => {
  it('mounts one page of tiles, not the whole shelf', async () => {
    await mount()
    expect(tiles()).toBe(60)
    expect(screen.queryByText('Book 100')).toBeNull()
  })

  it('grows when the end of the board is reached', async () => {
    await mount()
    await reachTheEnd()
    expect(tiles()).toBe(120)
    await reachTheEnd()
    expect(tiles()).toBe(150)
    expect(screen.getByText('Book 150')).toBeTruthy()
  })

  it('stops observing once the whole shelf is mounted', async () => {
    await mount()
    await reachTheEnd()
    await reachTheEnd()
    expect(tiles()).toBe(150)
    // Nothing left to grow into: the sentinel is gone, so there is no observer
    // left holding the board's last element alive.
    expect(observers.length).toBe(0)
  })

  it('renders the whole shelf where there is no IntersectionObserver', async () => {
    globalThis.IntersectionObserver = undefined
    await mount()
    // The widening lands in the effect that would otherwise have installed the
    // observer, one commit after the list arrives.
    await act(async () => {})
    expect(tiles()).toBe(150)
  })

  it('loads covers lazily, so an unscrolled board asks for what it shows', async () => {
    await mount()
    const covers = screen.getAllByRole('img', { name: /cover/i })
    expect(covers.length).toBeGreaterThan(0)
    for (const img of covers) expect(img.getAttribute('loading')).toBe('lazy')
  })
})
