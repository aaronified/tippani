// The demo shim's standalone-quote answers (ROADMAP §24).
//
// The demo is a real build target (VITE_DEMO=1) with no backend, so every
// endpoint the UI calls has to exist here. Its own comment records how that
// goes wrong: the Devices card broke because an unhandled path fell through to
// `default: [200, {}]`, the component read a list field that was not there, and
// the whole Settings page went down with it.
//
// The shapes are asserted against what the SERVER answers, not against what
// reads nicely, because a shim that is close but not identical is a bug that
// can only be found in the demo.

import { describe, expect, it } from 'vitest'
import { route } from '../../src/demo/install.js'

const get = (path, qs = '') => route('GET', path, new URLSearchParams(qs), null)

describe('GET /quotes', () => {
  it('answers under `utterances`, the table, not `quotes`, the route', () => {
    const [status, body] = get('/quotes')
    expect(status).toBe(200)
    // The friendlier key would look right in the shim and leave the screen
    // permanently empty, because that is not what the server sends.
    expect(Array.isArray(body.utterances)).toBe(true)
    expect(body.quotes).toBeUndefined()
    expect(body.utterances.length).toBeGreaterThan(0)
  })

  it('carries the occasion, which is all this kind has instead of a work', () => {
    const [, body] = get('/quotes')
    const bose = body.utterances.find((u) => u.speaker === 'Subhas Chandra Bose')
    expect(bose).toBeTruthy()
    expect(bose.occasion).toBe('Burma Radio broadcast')
    expect(bose.occasion_date).toBe('1944')
    expect(bose.place).toBe('Burma')
    expect(bose.medium).toBe('radio')
  })

  // utteranceState reads the sticker fields with `??`, so undefined and null
  // are not interchangeable: undefined would be indistinguishable from unset.
  it('sends the sticker fields as null rather than leaving them out', () => {
    const [, body] = get('/quotes')
    for (const u of body.utterances) {
      expect(u.sticker_id).toBeNull()
      expect(u.sticker_x).toBeNull()
      expect(u.sticker_y).toBeNull()
    }
  })

  it('keeps a proverb — no speaker, no occasion — in the list', () => {
    const [, body] = get('/quotes')
    const proverb = body.utterances.find((u) => u.quote.startsWith('Least said'))
    expect(proverb).toBeTruthy()
    expect(proverb.speaker).toBe('')
    expect(proverb.occasion).toBe('')
  })

  it('filters the way the screen asks it to', () => {
    expect(get('/quotes', 'color=blue')[1].utterances).toHaveLength(1)
    expect(get('/quotes', 'favorite=1')[1].utterances).toHaveLength(1)
    expect(get('/quotes', 'tag=freedom')[1].utterances).toHaveLength(1)
    expect(get('/quotes', 'speaker=Subhas Chandra Bose')[1].utterances).toHaveLength(2)
    expect(get('/quotes', 'color=orange')[1].utterances).toHaveLength(0)
  })
})

describe('search', () => {
  it('returns the three sections SearchPage renders', () => {
    const [, body] = get('/search', 'q=freedom')
    // A section the page reads must be an array even when empty, or `.map`
    // throws on the first render rather than showing nothing.
    expect(Array.isArray(body.quotes)).toBe(true)
    expect(Array.isArray(body.speakers)).toBe(true)
    expect(Array.isArray(body.notes.quotes)).toBe(true)
    expect(body.quotes.length).toBeGreaterThan(0)
  })

  it('finds a quote by its occasion, which is its title', () => {
    const [, body] = get('/search', 'q=Burma')
    expect(body.quotes.map((u) => u.id).sort()).toEqual([1, 2])
  })

  it('groups by speaker the way authors and actors are grouped', () => {
    const [, body] = get('/search', 'q=Bose')
    expect(body.speakers).toHaveLength(1)
    expect(body.speakers[0].name).toBe('Subhas Chandra Bose')
    expect(body.speakers[0].quotes).toHaveLength(2)
  })

  it('honours scope=quotes', () => {
    const [, body] = get('/search', 'q=freedom&scope=quotes')
    expect(body.quotes.length).toBeGreaterThan(0)
    expect(body.annotations).toHaveLength(0)
    expect(body.books).toHaveLength(0)
  })

  it('leaves every section an empty array for an empty query', () => {
    const [, body] = get('/search', 'q=')
    expect(body.quotes).toEqual([])
    expect(body.speakers).toEqual([])
    expect(body.notes.quotes).toEqual([])
  })
})

describe('stats', () => {
  it('counts standalone quotes in the totals and the favourites', () => {
    const [, body] = get('/stats')
    expect(body.quotes).toBe(4)
    // One favourite quote, on top of whatever the other two kinds contribute.
    expect(body.favorites).toBeGreaterThanOrEqual(1)
  })

  it('counts every kind that wears a colour', () => {
    const [, body] = get('/stats')
    const total = Object.values(body.colors).reduce((n, x) => n + x, 0)
    // The chart is headed "Highlight colours" and counts itself in quotes, so
    // it has to mean all three kinds — the bug fixed server-side in this release.
    expect(total).toBeGreaterThanOrEqual(4)
  })
})

// ---- what a SEARCH hit carries (1.14.2) -------------------------------------
//
// Found while adding the quiz mark to the five hit shapes: the shim's annHit
// and dlgHit had no `color`, and the server's have had one since 1.7.1 — the
// release whose whole subject was that a quote is the same object wherever it
// is listed. So the demo's search results drew every book highlight and every
// film line in the fallback border grey while the real app drew six named
// categories, and nothing could have caught it: the shim answers 200 with a
// plausible object and the component reads a field that is simply not there.
//
// Exactly the `created_at`/`created` class the file header already names.
describe('the shapes /search answers with', () => {
  const hits = (q) => route('GET', '/search', new URLSearchParams({ q }), null)[1]

  it('gives a book highlight its colour category', () => {
    const h = hits('margins').annotations[0]
    expect(h).toBeTruthy()
    // The VALUE, not merely a defined field: 'yellow' is the storage default,
    // so asserting truthiness would pass for a shim that had lost the mapping
    // and was reporting slot 1 for everything.
    expect(h.color).toBe('yellow')
  })

  it('gives a film line its colour category', () => {
    const h = hits('mistake').dialogues[0] || hits('the').dialogues[0]
    expect(h).toBeTruthy()
    expect(typeof h.color).toBe('string')
    expect(h.color).not.toBe('')
  })

  // The quiz mark's own fields, on all five shapes, for the same reason.
  it('says whether the quiz will draw it, on the row and on its work', () => {
    const r = hits('quiet')
    const h = r.annotations[0]
    expect(h).toBeTruthy()
    expect(h.review_excluded).toBe(true) // highlight 2 is skipped on its own account
    expect(h.work_review_excluded).toBe(false) // its book is not
  })
})
