// The pages a record can address, and the sites deliberately not among them.
//
// WHAT THIS PINS. `providerURL` is now the ONE place the app writes a provider
// address: the three Details id rows call it and so does the pickable list, so a
// wrong template here is a wrong link in two places at once. And the list of
// sites it covers is a design decision with reasons per site — a slug-addressed
// site cannot be derived from a numeric id, a work stores no Wikipedia id, and a
// guessed Amazon marketplace is a real URL for a different edition. Those are the
// kind of omission somebody "fixes" later by adding a template that looks
// plausible, so each is asserted rather than only commented.
import { describe, expect, it } from 'vitest'
import { derivedLinks, providerURL } from '../../src/workLinks.jsx'

describe('a provider address derived from a record', () => {
  it('addresses a film and a show differently on both screen suppliers', () => {
    // The same id means a different path per medium on both sites, which is the
    // whole reason these are functions of the record and not of the id.
    expect(providerURL('tmdb', { tmdb_id: 603, media_type: 'movie' }))
      .toBe('https://www.themoviedb.org/movie/603')
    expect(providerURL('tmdb', { tmdb_id: 603, media_type: 'show' }))
      .toBe('https://www.themoviedb.org/tv/603')
    expect(providerURL('tvdb', { tvdb_id: 71663, media_type: 'show' }))
      .toBe('https://thetvdb.com/dereferrer/series/71663')
    expect(providerURL('tvdb', { tvdb_id: 71663, media_type: 'movie' }))
      .toBe('https://thetvdb.com/dereferrer/movie/71663')
  })

  it('reads an Open Library key whichever half of it was stored', () => {
    // The API calls it a path and hands back `/works/OL1W`; a reader typing it in
    // writes the half they can see.
    expect(providerURL('openlibrary', { openlibrary_id: '/works/OL1W' }))
      .toBe('https://openlibrary.org/works/OL1W')
    expect(providerURL('openlibrary', { openlibrary_id: 'OL1W' }))
      .toBe('https://openlibrary.org/works/OL1W')
  })

  it('falls back to the number off the back cover', () => {
    // /isbn/<n> redirects to the edition, so a book with no OL key still has a
    // page — which is the case worth offering, because it is most books.
    expect(providerURL('openlibrary', { isbn: '978-0-441-01359-3' }))
      .toBe('https://openlibrary.org/isbn/9780441013593')
    // A key beats an ISBN: it names the record, where the number names a printing.
    expect(providerURL('openlibrary', { openlibrary_id: '/works/OL1W', isbn: '9780441013593' }))
      .toBe('https://openlibrary.org/works/OL1W')
  })

  it('escapes a volume id rather than pasting it into a query', () => {
    expect(providerURL('google', { google_id: 'a b&c' }))
      .toBe('https://books.google.com/books?id=a%20b%26c')
  })

  it('offers the wiki and not a page on it', () => {
    // 0055 stores WHICH wiki a work lives on and nothing stores its article
    // title, so the front page is the honest answer rather than a guessed slug.
    expect(providerURL('fandom', { fandom_wiki: 'dune' })).toBe('https://dune.fandom.com')
  })

  it('answers nothing for a record with no id, and for a site it does not address', () => {
    for (const slug of ['tmdb', 'tvdb', 'imdb', 'fandom', 'openlibrary', 'google']) {
      expect(providerURL(slug, {}), `${slug} on an empty record`).toBe('')
    }
    // NOT OVERSIGHTS. letterboxd and igdb address records by slug and the row
    // stores a number; a work carries no wikipedia/wikidata/wikimedia id at all;
    // and an Amazon marketplace guessed as .com is a real page for a different
    // edition, which is wrong in the way that looks right.
    for (const slug of ['letterboxd', 'igdb', 'wikipedia', 'wikidata', 'wikimedia', 'amazon']) {
      expect(providerURL(slug, { igdb_id: 9, asin: 'B000FC0SIM', isbn: '9780441013593' }),
        `${slug} must not be guessed`).toBe('')
    }
    expect(providerURL('nonesuch', { title: 'x' })).toBe('')
  })
})

describe('the list a reader picks from', () => {
  const film = { tmdb_id: 603, tvdb_id: 71663, imdb_id: 'tt0133093', media_type: 'movie', fandom_wiki: 'matrix' }

  it('is what the record can address and has not linked', () => {
    const all = derivedLinks(film, '')
    expect(all.map((r) => r.slug)).toEqual(['imdb', 'tmdb', 'tvdb', 'fandom'])
    // ALREADY LINKED DROPS OUT rather than drawing as ticked or greyed: a row you
    // cannot press is the roster of absences again, one item at a time.
    const some = derivedLinks(film, 'https://www.themoviedb.org/movie/603')
    expect(some.map((r) => r.slug)).toEqual(['imdb', 'tvdb', 'fandom'])
  })

  it('is empty when the record has nothing pinned', () => {
    expect(derivedLinks({ title: 'A Novel' }, '')).toEqual([])
  })

  it('drops a site only for the address it holds, not for the site', () => {
    // Two different pages on one site is a legitimate thing to have — the same
    // rule PasteLink states — so holding one TheTVDB page does not hide the
    // canonical one if they differ.
    const other = derivedLinks(film, 'https://thetvdb.com/dereferrer/series/71663')
    expect(other.map((r) => r.slug)).toContain('tvdb')
  })

  it('follows the app own provider order rather than the record fields', () => {
    const book = { google_id: 'vol1', openlibrary_id: '/works/OL1W' }
    // PROVIDERS lists openlibrary before google, whatever order the row's
    // columns happen to be in.
    expect(derivedLinks(book, '').map((r) => r.slug)).toEqual(['openlibrary', 'google'])
  })
})
