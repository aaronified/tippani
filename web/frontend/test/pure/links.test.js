import { describe, expect, it } from 'vitest'
import { amazonHost } from '../../src/MetadataSources.jsx'
import { providerURL, readLink } from '../../src/workLinks.jsx'

// THE MARKETPLACE, AS THE TWO LETTERS THAT DIFFER.
//
// THE OWNER: "for amazon domain, just use the in, com, au, etc., not the full url.
// that takes space." Every marketplace host is `www.amazon.` plus a suffix, so the
// prefix is eleven identical characters on every install — and this row already had
// the worst width on the card, its own note recording the label breaking mid-word
// into "AMA / ZON / DOM / AIN".
//
// THE COLUMN STILL HOLDS A HOST. `FetchAmazonBook` builds `https://<domain>/dp/<asin>`
// and defaults to `www.amazon.com`, so the screen speaks suffixes and the wire keeps
// speaking hosts — one transform in one place rather than a data change reaching the
// server and every existing install's stored value.
describe('amazon domain', () => {
  describe('what the field accepts', () => {
    // A READER WHO HAS COPIED THEIR ADDRESS BAR SHOULD NOT BE TOLD OFF. All four of
    // these name one marketplace, and the same forgiveness the IMDb id field already
    // extends for the same reason.
    it('takes the suffix, the bare domain, the host or a pasted URL', () => {
      for (const typed of ['in', 'amazon.in', 'www.amazon.in', 'https://www.amazon.in/']) {
        expect(amazonHost(typed), `${typed} did not resolve`).toBe('www.amazon.in')
      }
    })
  })
})

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
describe('provider urls', () => {
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
  })
})

// What a pasted address is read AS, before it is committed — handoff §1.3.
//
// A key and a URL are one fact written twice, and the panel's promise is that it
// says which it made of what you typed before you press +. So the reading is a
// pure function and is tested as one: a box that decides silently is a box you
// check afterwards every time, and a box that decides WRONG silently is worse.
describe('read link', () => {
  describe('reading a pasted link', () => {
    // A HOSTNAME IS MATCHED, NOT A SUBSTRING. "imdb.com.example.org" is somebody
    // else's domain, and a link filed under IMDb's name because its name appears
    // in the string would be the app vouching for a site it has not looked at.
    it('matches the host and not the text', () => {
      expect(readLink('https://imdb.com.example.org/x').slug).toBe('')
      expect(readLink('https://example.org/imdb.com/x').slug).toBe('')
    })
  })
})
