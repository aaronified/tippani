// What a pasted address is read AS, before it is committed — handoff §1.3.
//
// A key and a URL are one fact written twice, and the panel's promise is that it
// says which it made of what you typed before you press +. So the reading is a
// pure function and is tested as one: a box that decides silently is a box you
// check afterwards every time, and a box that decides WRONG silently is worse.
import { describe, expect, it } from 'vitest'
import { readLink } from '../../src/workLinks.jsx'

describe('reading a pasted link', () => {
  it('names the site when it knows it', () => {
    expect(readLink('https://www.imdb.com/title/tt0084787/').slug).toBe('imdb')
    expect(readLink('https://letterboxd.com/film/stalker/').slug).toBe('letterboxd')
    expect(readLink('https://openlibrary.org/works/OL1W').slug).toBe('openlibrary')
    expect(readLink('https://en.wikipedia.org/wiki/Stalker').slug).toBe('wikipedia')
    // FANDOM SITS ALONGSIDE WIKIPEDIA, NOT INSTEAD OF IT, and the old wikia.com
    // domain still redirects, so both spell the same site.
    expect(readLink('https://tardis.fandom.com/wiki/The_Doctor').slug).toBe('fandom')
    expect(readLink('https://memory-alpha.wikia.com/wiki/Spock').slug).toBe('fandom')
  })

  // GOOGLE BOOKS SPECIFICALLY. A google.com result is a search rather than a
  // record, and filing one under the name of a catalogue would be a lie about
  // what the link is.
  it('takes Google Books and leaves a Google search alone', () => {
    expect(readLink('https://books.google.com/books?id=abc').slug).toBe('google')
    expect(readLink('https://www.google.com/search?q=stalker').slug).toBe('')
  })

  // THE GLOBE IS NOT A FAILURE STATE. A review, an author's own site, a scan
  // somebody hosted — all legitimate, all kept whole.
  it('keeps anything else whole, under the globe', () => {
    const r = readLink('https://example.org/a-review')
    expect(r.slug).toBe('')
    expect(r.url).toBe('https://example.org/a-review')
    expect(r.host).toBe('example.org')
  })

  // Copying an address out of a browser's bar drops the scheme about half the
  // time. Refusing that is refusing the commonest paste there is.
  it('completes an address that arrived without its scheme', () => {
    expect(readLink('imdb.com/title/tt0084787').url).toBe('https://imdb.com/title/tt0084787')
    expect(readLink('imdb.com/title/tt0084787').slug).toBe('imdb')
    expect(readLink('  www.thetvdb.com/series/stalker  ').slug).toBe('tvdb')
  })

  it('answers nothing for what is not an address yet', () => {
    for (const bad of ['', '   ', 'stalker', 'https://', 'not a url']) {
      expect(readLink(bad), bad).toBeNull()
    }
  })

  // A HOSTNAME IS MATCHED, NOT A SUBSTRING. "imdb.com.example.org" is somebody
  // else's domain, and a link filed under IMDb's name because its name appears
  // in the string would be the app vouching for a site it has not looked at.
  it('matches the host and not the text', () => {
    expect(readLink('https://imdb.com.example.org/x').slug).toBe('')
    expect(readLink('https://example.org/imdb.com/x').slug).toBe('')
  })
})
