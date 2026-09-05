// A SUPPLIER IS THE SAME PICTURE WHEREVER IT IS NAMED.
//
// THE RULE, which is CLAUDE.md's glyph rule read one step further: the app draws
// one mark per metadata supplier — Google Books, Open Library, Amazon, TMDB,
// TheTVDB, IGDB — and a screen that names a supplier names it with that mark.
// "A lookalike next to the real glyph is two pictures of one thing", and a
// supplier named in words on one screen and drawn on the next is the same fault
// with the two halves further apart.
//
// WHERE THIS BIT. The marks were on the match rows and on the tag saying which
// supplier wrote a field, and NOT on the screen where a reader meets a supplier
// for the first time and decides whether to give it a key. So the first time a
// mark appeared it was a picture nobody had been introduced to. The owner's
// report: "i can see no metadata source icons in details or metadata fetch
// sections."
//
// AND WHAT IS *NOT* A DEFECT, stated so the next reader does not chase it: a
// field with no provenance draws no tag. Provenance is recorded when something
// fetches or edits a field, so a record nothing has touched has none, and an
// empty tag would be a claim about where a value came from that the app cannot
// make. That is `FieldList`'s own reasoning and it stands.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path.startsWith('/admin/keys')) {
      return { ok: true, data: { tmdb_key_set: false, google_books_key_set: false } }
    }
    if (path.startsWith('/metadata/status')) return { ok: true, data: {} }
    return { ok: true, data: {} }
  }),
}))

const { SOURCE_META, SourceIcon } = await import('../../src/ui.jsx')
const { MetadataSources } = await import('../../src/MetadataSources.jsx')

afterEach(() => cleanup())

describe('every supplier the app can talk to', () => {
  it('has a drawing of its own, not a name in a sentence', () => {
    // The vocabulary itself. Six suppliers, six marks — an app that can name a
    // supplier and not draw it is one screen away from printing the slug.
    const slugs = Object.keys(SOURCE_META)
    expect(slugs.length, 'the supplier vocabulary has emptied out').toBeGreaterThan(4)
    for (const slug of slugs) {
      const { container, unmount } = render(<SourceIcon source={slug} />)
      expect(container.querySelector('svg'), `${slug} has no mark of its own`).toBeTruthy()
      unmount()
    }
  })

  it('and an unknown one still draws something rather than nothing', () => {
    // A supplier the app has not met — an operator's own, a slug from a newer
    // server — must not leave a hole where every other row has a picture.
    const { container } = render(<SourceIcon source="something-new" />)
    expect(container.querySelector('svg'), 'an unrecognised supplier draws no mark at all').toBeTruthy()
  })
})

describe('the screen where a reader meets a supplier', () => {
  // The keys are admin-only, so the reader who meets a supplier here is one.
  const card = () => {
    render(<MetadataSources user={{ is_admin: true }} onPreferences={() => {}} />)
    return document.body
  }

  it('draws each one’s mark beside the key it unlocks', () => {
    card()
    const marks = [...document.querySelectorAll('.src-mark')]
    expect(marks.length,
      'the screen that names every supplier draws none of their marks').toBeGreaterThan(3)
  })

  it('and the mark says which supplier it is, for a reader who cannot see it', () => {
    card()
    for (const m of document.querySelectorAll('.src-mark')) {
      const said = m.getAttribute('aria-label') || ''
      expect(said.length, 'a supplier mark announces nothing').toBeGreaterThan(0)
    }
  })

  it('names TMDB and TheTVDB among them, which are the two a film needs', () => {
    card()
    const said = [...document.querySelectorAll('.src-mark')]
      .map((m) => m.getAttribute('aria-label') || '').join(' | ')
    expect(said, 'the film suppliers are not marked').toMatch(/TMDB/i)
    expect(said).toMatch(/TVDB/i)
  })
})
