// WHAT EACH LINK PROVIDER WILL ACCEPT, AND WHAT IT MUST NOT.
//
// THE RULE THIS ENFORCES, in the owner's words: "curated providers should have
// input controls (like numeric for TMDB). check each provider and enforce their
// rules" — and, before that, "do check before you enforce". Both halves are
// tested here, and the second is the one worth stating: a validator that refuses
// a VALID id is worse than no validator at all, because the reader is holding the
// right answer and the app will not take it. So every case below names a real
// address shape from the site it belongs to, and the rejections are things that
// address shape cannot be.
//
// IT ASKS THE RULES, NOT THE FORM. Which pill is chosen, what the hint says and
// how the ✓ is worded are the form's business and change with the copy; whether
// `nm0000007` is a TMDB person id is a fact about TMDB.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  PROVIDER_ID_LINKS, acceptProviderID, buildProviderLink, detectProviderLink, providerRule,
} from '../../src/people.jsx'

const CURATED = PROVIDER_ID_LINKS.filter(([kind]) => kind !== 'any').map(([, slug]) => slug)

// The catalogue itself, because the examples are keys and the thing under test is
// what the READER is shown. Read rather than imported so a missing key is a
// failure here instead of an empty string that quietly skips a case.
const EN = Object.fromEntries(
  readFileSync(join(process.env.TIPPANI_SRC, '..', '..', '..', 'internal', 'i18n', 'en.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.includes(' = ') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf(' = ')).trim(), l.slice(l.indexOf(' = ') + 3)]),
)

describe('an id space takes its own ids', () => {
  it.each([
    ['imdb', 'nm0000007', 'nm0000007'],
    ['imdb', 'nm10538207', 'nm10538207'],
    ['tmdb', '10859', '10859'],
    // TMDB's own addresses carry a slug tail; the number alone resolves, so the
    // tail is dropped rather than stored.
    ['tmdb', '10859-ryan-reynolds', '10859'],
    ['tvdb', 'rajesh-khanna', 'rajesh-khanna'],
    ['tvdb', '297400', '297400'],
    ['amazon', 'B001H6TVXK', 'B001H6TVXK'],
    ['amazon', 'b001h6tvxk', 'B001H6TVXK'],
    ['igdb', 'electronic-arts', 'electronic-arts'],
  ])('%s takes %s', (slug, typed, want) => {
    expect(acceptProviderID(slug, typed)).toBe(want)
    expect(buildProviderLink(slug, typed), `${slug} built no address for a valid id`).not.toBe('')
  })

  it('takes the whole page address as well as the id, on every provider', () => {
    // A READER HOLDING A PAGE IS HOLDING THE ID. Refusing the address and
    // demanding the fragment is asking them to do by hand what the app can read.
    expect(acceptProviderID('imdb', 'https://www.imdb.com/name/nm0000007/')).toBe('nm0000007')
    expect(acceptProviderID('tmdb', 'https://www.themoviedb.org/person/10859-ryan-reynolds')).toBe('10859')
    expect(acceptProviderID('tvdb', 'https://thetvdb.com/people/rajesh-khanna')).toBe('rajesh-khanna')
    expect(acceptProviderID('amazon', 'https://www.amazon.com/stores/author/B001H6TVXK')).toBe('B001H6TVXK')
    expect(acceptProviderID('igdb', 'https://www.igdb.com/companies/electronic-arts')).toBe('electronic-arts')
  })

  it('refuses another space’s id rather than building a page that is not there', () => {
    // The defect this rule exists for: `nm0000007` under TMDB used to build
    // /person/nm0000007 and store it, and the only way to find out was to press
    // the pill.
    expect(buildProviderLink('tmdb', 'nm0000007')).toBe('')
    expect(buildProviderLink('imdb', '10859')).toBe('')
    expect(buildProviderLink('amazon', '123')).toBe('')
  })

  it('refuses what could reach a different page than it names', () => {
    for (const slug of CURATED) {
      expect(buildProviderLink(slug, '../admin'), `${slug} took a traversal`).toBe('')
      expect(buildProviderLink(slug, 'a b'), `${slug} took a space`).toBe('')
    }
  })

  it('refuses nothing at all, on every provider', () => {
    for (const slug of [...CURATED, 'custom']) {
      expect(buildProviderLink(slug, ''), slug).toBe('')
      expect(buildProviderLink(slug, '   '), slug).toBe('')
    }
  })
})

describe('the custom row', () => {
  it('takes an ordinary web address, which is the whole reason it exists', () => {
    // "the add links doesn't let me enter any link i want. there should be a
    // custom option."
    expect(buildProviderLink('custom', 'https://en.wikipedia.org/wiki/Rajesh_Khanna'))
      .toBe('https://en.wikipedia.org/wiki/Rajesh_Khanna')
    expect(buildProviderLink('custom', 'harrypotter.fandom.com/wiki/Harry_Potter'))
      .toBe('https://harrypotter.fandom.com/wiki/Harry_Potter')
  })

  it('is not a way to store something that is not a link', () => {
    expect(buildProviderLink('custom', 'javascript:alert(1)')).toBe('')
    expect(buildProviderLink('custom', 'data:text/html,x')).toBe('')
    expect(buildProviderLink('custom', 'not an address')).toBe('')
  })

  it('is offered whatever the record is', () => {
    // A company has no IMDb /name/ page and a person no IGDB company page, but
    // both can be written up anywhere.
    const kinds = new Set(PROVIDER_ID_LINKS.filter(([, s]) => s === 'custom').map(([k]) => k))
    expect(kinds).toEqual(new Set(['any']))
  })
})

describe('a curated address pasted into the custom row', () => {
  // "if i paste a curated link in the custom input, the app should recognise it
  // and file accordingly."
  it.each([
    ['https://www.imdb.com/name/nm0000007/', 'imdb', 'nm0000007'],
    ['https://www.themoviedb.org/person/10859-ryan-reynolds', 'tmdb', '10859'],
    ['https://thetvdb.com/people/rajesh-khanna', 'tvdb', 'rajesh-khanna'],
    ['https://www.amazon.com/stores/author/B001H6TVXK', 'amazon', 'B001H6TVXK'],
    ['https://www.igdb.com/companies/electronic-arts', 'igdb', 'electronic-arts'],
  ])('files %s under its own provider', (url, slug, id) => {
    expect(detectProviderLink(url)).toEqual({ slug, id })
  })

  it('leaves anything else alone, so the custom row keeps it verbatim', () => {
    expect(detectProviderLink('https://en.wikipedia.org/wiki/Rajesh_Khanna')).toBeNull()
    expect(detectProviderLink('nm0000007'), 'a bare id has no host to file it by').toBeNull()
    expect(detectProviderLink('')).toBeNull()
  })

  it('does not file an IMDb TITLE page as a person', () => {
    // /title/ and /name/ are different id spaces on one host, and only one of
    // them belongs on a person's record.
    expect(detectProviderLink('https://www.imdb.com/title/tt0066763/')).toBeNull()
  })
})

describe('what the field tells the reader', () => {
  it('gives every provider a rule and a worked example', () => {
    // "also write the rule below the field, along with a real example on how to
    // derive from the full link." A provider with no example is a provider whose
    // reader is guessing which part of an address to keep.
    for (const [, slug, , hintKey] of PROVIDER_ID_LINKS) {
      expect(EN[hintKey], `${slug} has no rule under its field`).toBeTruthy()
      expect(EN[providerRule(slug).example], `${slug} has no worked example`).toBeTruthy()
    }
  })

  it('asks for a numeric keyboard where the id is a number', () => {
    // The owner's "input controls (like numeric for TMDB)".
    expect(providerRule('tmdb').inputMode).toBe('numeric')
    expect(providerRule('custom').inputMode).toBe('url')
  })

  it('every example is an id its own rule accepts', () => {
    // A worked example the app would then refuse is worse than none. The examples
    // read "<address> → <id>", so both halves are checked.
    for (const [kind, slug] of PROVIDER_ID_LINKS) {
      if (kind === 'any') continue
      const example = EN[providerRule(slug).example]
      expect(example, `${slug}: no example string in the catalogue`).toBeTruthy()
      const [addr, id] = example.split('→').map((x) => x.trim())
      expect(id, `${slug}: the example does not show which part to keep`).toBeTruthy()
      expect(acceptProviderID(slug, id), `${slug}: its own example id is refused`).toBe(id)
      expect(acceptProviderID(slug, addr), `${slug}: its own example address does not yield the id`).toBe(id)
    }
  })
})
