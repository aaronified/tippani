// AN ID AND THE PAGE IT NAMES — the popup behind "Add a link".
//
// WHAT THIS GUARDS, and why a stylesheet-shaped test is not enough here: the
// value of this feature is that the reader does NOT have to know a provider's
// URL shape. IMDb files a person under /name/, TMDB under /person/, TheTVDB
// under /people/ — three words for one idea — and the app has known all three
// since it started fetching portraits. A typo in any of them gives a pill that
// opens nothing, which is worse than the free-text field it replaced, because it
// looks like it worked.
//
// SO THE PATTERNS ARE PINNED AGAINST THE SERVER'S OWN. internal/metadata/
// people.go builds exactly these when it resolves a portrait from TMDB. If the
// two ever disagree, one person ends up with two pills for the same page and no
// way to tell which is real — so this file asserts the client's strings and the
// Go file's are the same literal.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PROVIDER_ID_LINKS, buildProviderLink, creditKind, isOrganisation, isOrganisationKind, providerLinksFor } from '../../src/people.jsx'
import { PROVIDERS, parseLinks } from '../../src/people.jsx'

// The server file the person patterns are copied from.
const peopleGo = readFileSync(
  join(process.env.TIPPANI_SRC, '..', '..', '..', 'internal', 'metadata', 'people.go'),
  'utf8',
)

describe('the address a provider id builds', () => {
  it('is the server’s own pattern, literally', () => {
    // Each of these appears in people.go as the prefix it concatenates an id
    // onto. Asserted as substrings of the Go source rather than re-derived,
    // because the failure being guarded is the two drifting apart.
    expect(buildProviderLink('imdb', 'nm0000123')).toBe('https://www.imdb.com/name/nm0000123/')
    expect(peopleGo).toContain('https://www.imdb.com/name/')

    expect(buildProviderLink('tmdb', '1234')).toBe('https://www.themoviedb.org/person/1234')
    expect(peopleGo).toContain('https://www.themoviedb.org/person/')

    expect(buildProviderLink('tvdb', '99')).toBe('https://thetvdb.com/people/99')
    expect(peopleGo).toContain('https://thetvdb.com/people/')
  })

  it('sends an ASIN to the author page, never to a product', () => {
    // The owner's ruling, and the reason: an ASIN names a PRODUCT, so /dp/<asin>
    // would file a book under the person whose sheet the link is on. The author
    // page is the one Amazon URL that is about a person.
    const url = buildProviderLink('amazon', 'B001H6TVXK')
    expect(url).toBe('https://www.amazon.com/stores/author/B001H6TVXK')
    expect(url, 'an ASIN pointed at a product page').not.toContain('/dp/')
  })

  it('trims what was pasted, and refuses what would break the address', () => {
    expect(buildProviderLink('tmdb', '  1234 ')).toBe('https://www.themoviedb.org/person/1234')
    // STRONGER THAN THE ESCAPING THIS USED TO ASSERT. A slug id may hold letters,
    // digits and a URL path segment's own separators and nothing else, so a space
    // or a traversal is not an id of that space at all — it is refused rather
    // than percent-encoded into a page that does not exist.
    expect(buildProviderLink('igdb', 'ea seattle')).toBe('')
    expect(buildProviderLink('igdb', '../admin')).toBe('')
  })

  it('answers nothing for an empty id or an unknown provider', () => {
    expect(buildProviderLink('imdb', '')).toBe('')
    expect(buildProviderLink('imdb', '   ')).toBe('')
    expect(buildProviderLink('letterboxd', 'x')).toBe('')
  })
})

// THE FIXTURES ARE THE WIRE'S OWN SHAPE, and that is the point of this block.
// An earlier version of these tests passed `['studio']` as a role — a string the
// server cannot produce — and every case went green while the app called
// Electronic Arts a person on screen. `work_person.role` for a studio is
// `director`, because movies.director holds a film's director AND a game's studio
// and media_type is the only thing separating them. A fixture that invents a
// role invents the answer with it.
const credit = (role, mediaType = '') => ({ kind: 'movie', work_id: 5, role, media_type: mediaType })
const bookCredit = (role) => ({ kind: 'book', work_id: 1, role, media_type: '' })

describe('which person kind a credit row names', () => {
  it('calls a director on a game a studio, and one on a film a director', () => {
    expect(creditKind(credit('director', 'game'))).toBe('studio')
    expect(creditKind(credit('director', 'movie'))).toBe('director')
    expect(creditKind(credit('director', 'show'))).toBe('director')
    // No media type at all is not a game, so it is not a studio.
    expect(creditKind(credit('director'))).toBe('director')
  })

  it('leaves every other role as it stands', () => {
    expect(creditKind(credit('publisher', 'game'))).toBe('publisher')
    expect(creditKind(bookCredit('author'))).toBe('author')
    expect(creditKind(credit('actor', 'movie'))).toBe('actor')
    expect(creditKind({})).toBe('')
  })

  it('reads the role and the medium however they were cased or padded', () => {
    expect(creditKind({ role: ' Director ', media_type: 'GAME' })).toBe('studio')
  })
})

describe('whether a record names a company', () => {
  it('sees the studio a bare role read would miss', () => {
    expect(isOrganisation([credit('director', 'game')]), 'a game studio read as a person').toBe(true)
    expect(isOrganisation([credit('publisher', 'game')])).toBe(true)
  })

  it('does not mistake a film director or an author for one', () => {
    expect(isOrganisation([credit('director', 'movie')])).toBe(false)
    expect(isOrganisation([bookCredit('author')])).toBe(false)
    expect(isOrganisation([credit('actor', 'movie'), bookCredit('translator')])).toBe(false)
  })

  it('needs only one company credit among many', () => {
    expect(isOrganisation([bookCredit('author'), credit('director', 'game')])).toBe(true)
  })

  it('reads a record with no credits as a person', () => {
    // The safer default and the commoner case, argued at the predicate itself: a
    // company nobody has credited yet is a page with one wrong word on it, where
    // an author offered a company's id space is a list that cannot work.
    expect(isOrganisation([])).toBe(false)
    expect(isOrganisation(undefined)).toBe(false)
    expect(isOrganisation([null, {}])).toBe(false)
  })

  it('answers the KIND vocabulary separately, where a studio is its own word', () => {
    // Two vocabularies, and they are not the same list. `person_kinds` and the
    // `?kind=` endpoints call a studio a studio; work_person.role calls it a
    // director. PersonForm is handed a kind and asks this one.
    expect(isOrganisationKind('studio')).toBe(true)
    expect(isOrganisationKind(' Publisher ')).toBe(true)
    expect(isOrganisationKind('director')).toBe(false)
    expect(isOrganisationKind('author')).toBe(false)
    expect(isOrganisationKind('')).toBe(false)
  })
})

describe('which providers a record is offered', () => {
  const slugs = (credits) => providerLinksFor(credits).map(([, slug]) => slug)

  it('offers a person their own id spaces and no company one', () => {
    // `custom` leads every list — the owner's ruling, and it is the sheet's
    // default choice: an address the app has no id space for is still a link.
    expect(slugs([bookCredit('author')])).toEqual(['custom', 'imdb', 'tmdb', 'tvdb', 'amazon'])
    expect(slugs([credit('actor', 'movie')])).not.toContain('igdb')
    expect(slugs([credit('director', 'movie')]), 'a film director is a person').not.toContain('igdb')
  })

  it('offers a studio or a publisher the company id space instead', () => {
    // A STUDIO IS CREDITED THE WAY A PERSON IS — unit.role.studio has been in the
    // role vocabulary since it existed — so it gets the same sheet and the same
    // popup. What differs is the id space: nobody has an IMDb /name/ page for a
    // games studio.
    expect(slugs([credit('director', 'game')])).toEqual(['custom', 'igdb'])
    expect(slugs([credit('publisher', 'game')])).toEqual(['custom', 'igdb'])
    expect(slugs([credit('director', 'game')])).not.toContain('imdb')
  })

  it('treats a record with no credits yet as a person', () => {
    expect(slugs([])).toContain('imdb')
    expect(slugs(undefined)).toContain('imdb')
  })

  it('agrees with the predicate the rest of the screen reads', () => {
    // The two must not be able to disagree — that is why providerLinksFor asks
    // isOrganisation rather than re-deriving the answer.
    for (const credits of [
      [credit('director', 'game')], [credit('publisher', 'game')],
      [bookCredit('author')], [], [credit('actor', 'movie')],
    ]) {
      const wantKind = isOrganisation(credits) ? 'company' : 'person'
      for (const [forKind] of providerLinksFor(credits)) {
        // `any` is the custom row, which belongs to neither and is offered to both.
        if (forKind === 'any') continue
        expect(forKind, `${JSON.stringify(credits)} offered a ${forKind} id space`).toBe(wantKind)
      }
    }
  })
})

// One id PER SPACE that its own rule accepts. `abc123` used to stand in for all
// of them, and it is not an IMDb name, a TMDB number or an ASIN — which is
// exactly what the rules now say, so a single fixture would only prove the rules
// reject it.
const ID_THE_RULE_TAKES = {
  imdb: 'nm0000123', tmdb: '1234', tvdb: 'rajesh-khanna',
  amazon: 'B001H6TVXK', igdb: 'electronic-arts',
}

describe('what the link becomes once it is stored', () => {
  it('is recognised by the same table that reads a pasted URL', () => {
    // THE POPUP IS A TYPING AID, NOT A SECOND STORE. Every address it writes goes
    // into the same free-text `links` field, so the pills cannot tell a built
    // link from a pasted one — which is the whole reason to build it this way.
    for (const [kind, slug] of PROVIDER_ID_LINKS) {
      // The custom row builds no provider address at all — it stores the reader's
      // own, and which mark that draws is the pasted host's business.
      if (kind === 'any') continue
      const url = buildProviderLink(slug, ID_THE_RULE_TAKES[slug])
      expect(url, `${slug} refused its own example id`).not.toBe('')
      const { known } = parseLinks(url)
      expect(known[slug], `${slug} built an address its own matcher misses`).toBe(url)
    }
  })

  it('names only providers the recognising table already knows', () => {
    // A builder for a provider PROVIDERS cannot match would produce a link that
    // draws no mark and files under nothing.
    const recognised = new Set(PROVIDERS.map(([slug]) => slug))
    for (const [kind, slug] of PROVIDER_ID_LINKS) {
      if (kind === 'any') continue
      expect(recognised.has(slug), `${slug} builds links nothing recognises`).toBe(true)
    }
  })
})
