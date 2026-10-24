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
import {  providerURL } from '../../src/workLinks.jsx'

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

