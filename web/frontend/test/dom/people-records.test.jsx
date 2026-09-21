// The People section of the metadata screen, keyed by RECORD.
//
// WHAT IT WAS. It listed `/people/names`: one row per printed spelling, filtered
// to one role. That answers "which names does my library print" — the right
// question for a re-verify sweep and the wrong one for a review list. Bulgakov
// spelled four ways was four rows of a quarter each; a record no work prints was
// not in the list at all; and the character list beside it, under the same
// heading, had been record-keyed since characters got a table.
//
// So the claims here are the ones that were false before and are the point of the
// change:
//
//   ONE ROW PER RECORD, with the other spellings named under it — otherwise a
//   merged list reads as if three names went missing.
//
//   THE COUNTS ARE THE RECORD'S. Works is credits plus cast appearances and
//   quotes is the two link columns, both per record.
//
//   THE NAME OPENS THE RECORD. The credits, the roles, the aliases, the merge and
//   the split were not reachable from this screen at all; the name opened the
//   enrichment modal, which edits a bio and a portrait under a (kind, name) pair.
//
//   ALL LEADS THE CHIPS. A role is DERIVED from a credit, so a record the reader
//   made by hand — or one whose last credit was deleted — belongs to no role, and
//   defaulting to Authors hid exactly the rows a review list exists to surface.
//
//   THE FACE IS THE PORTRAIT EDITOR. It was the word "· photo", which says a
//   portrait exists and shows neither it nor a way to change it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let RECORDS
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/people/records') return { ok: true, data: { people: RECORDS } }
    // The portrait call answers with the identity it resolved and the reference
    // pages that came with it — which is what makes the link save below happen at
    // all, and therefore what the assertion is about.
    if (method === 'POST' && path === '/people/portrait') {
      return { ok: true, data: { person: null, links: { imdb: 'nm0000001' } } }
    }
    return { ok: true, data: {} }
  }),
}))

const { PeopleConsole } = await import('../../src/MetadataPage.jsx')
const { MOBILE_SCREEN_QUERY } = await import('../../src/ui.jsx')

const rec = (over) => ({
  id: 1, name: 'Mikhail Bulgakov', sort_name: '', bio: '', image_path: '', born: '', died: '',
  links: '', source: '', source_id: '', kinds: ['author'], spellings: [], works: 0, quotes: 0, ...over,
})

beforeEach(() => {
  CALLS = []
  RECORDS = [
    rec({ id: 1, name: 'Mikhail Bulgakov', kinds: ['author'], spellings: ['M. Bulgakov', 'Михаил Булгаков'], works: 12, quotes: 128, image_path: 'people/mb.jpg' }),
    rec({ id: 2, name: 'Oleg Basilashvili', kinds: ['actor'], works: 3, quotes: 41 }),
    // A RECORD IN NO ROLE AT ALL, which is the row the old default hid: nothing
    // credits it, so nothing derives a role for it.
    // PROVIDER LINKS, on the one row no other case drives. They went on Oleg
    // first and broke the fetch case eight cases down: `fetchOne` skips its PUT
    // when the links it finds equal the ones already stored, so a record that
    // HAS links takes a different path through the act that case is about. A
    // fixture row is shared state.
    rec({
      id: 3, name: 'Somebody Nobody Credits', kinds: [], works: 0, quotes: 0,
      links: 'https://www.imdb.com/name/nm0001/\nhttps://www.wikidata.org/wiki/Q123',
    }),
  ]
})
afterEach(() => cleanup())

const mount = async () => {
  render(<PeopleConsole onFlash={() => {}} onSearch={() => {}} />)
  await screen.findByText('Mikhail Bulgakov')
}
// A ROW IS A DIV NOW, NOT A `tr`. The people console was an `ann-table` with five
// columns, two of which a phone dropped; it is a list of records drawn by
// `recordRow.jsx` — the same function the works and character consoles use, which
// is what stops this console's portrait and the character console's behaving
// differently. The row is located by the name it contains either way.
const row = (name) => screen.getByText(name).closest('.record-row')

describe('one row per record', () => {
  it('names the other spellings under the canonical one', async () => {
    await mount()
    // Without this the merged list reads as if two names went missing.
    expect(within(row('Mikhail Bulgakov')).getByText(/M\. Bulgakov/)).toBeTruthy()
    expect(within(row('Mikhail Bulgakov')).getByText(/Михаил Булгаков/)).toBeTruthy()
  })

  it('prints the record’s own works and quotes, not one spelling’s share', async () => {
    await mount()
    const r = row('Mikhail Bulgakov')
    // BOTH COUNTS, AND BY THE WORDS RATHER THAN THE DIGITS. The two numbers sit
    // side by side under the name now — an icon each and no noun, the owner's own
    // shape — so `getByText('12')` would no longer say WHICH count it found, and
    // a row that printed the works count twice would pass it. The accessible name
    // is what the icon stands for, and reading them is how this case tells the
    // two apart. It is also what a reader who cannot see the icons is told.
    const named = (re) => [...r.querySelectorAll('[aria-label]')]
      .some((n) => re.test(n.getAttribute('aria-label') || ''))
    expect(named(/^12 works/), 'the works count should be on the row, named').toBe(true)
    expect(named(/^128 quotes/), 'the quotes count should be on the row, named').toBe(true)
  })

  it('reads /people/records and never the spelling list', async () => {
    await mount()
    expect(CALLS.some(([m, p]) => m === 'GET' && p === '/people/records')).toBe(true)
    expect(CALLS.some(([, p]) => p.startsWith('/people/names'))).toBe(false)
  })

  it('finds a record by a spelling it is not called', async () => {
    await mount()
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'Михаил' } })
    await waitFor(() => expect(screen.queryByText('Oleg Basilashvili')).toBeNull())
    expect(screen.getByText('Mikhail Bulgakov')).toBeTruthy()
  })
})

describe('the role chips', () => {
  it('start on All, so a record in no role is visible', async () => {
    await mount()
    // The row the old author-first default hid. A role is derived from a credit,
    // so a record nothing credits belongs to no chip.
    expect(screen.getByText('Somebody Nobody Credits')).toBeTruthy()
  })

  it('filter to one role when asked', async () => {
    await mount()
    act(() => screen.getByText('Actors').click())
    await waitFor(() => expect(screen.queryByText('Mikhail Bulgakov')).toBeNull())
    expect(screen.getByText('Oleg Basilashvili')).toBeTruthy()
    expect(screen.queryByText('Somebody Nobody Credits')).toBeNull()
  })
})

describe('the two doors on a row', () => {
  it('opens the record panel from the name', async () => {
    await mount()
    act(() => within(row('Mikhail Bulgakov')).getByText('Mikhail Bulgakov').click())
    // The panel is pushed onto this console's own stack, so what is asserted is
    // that the record page is on screen rather than the enrichment modal.
    expect(await screen.findByText('The person')).toBeTruthy()
  })

  it('opens the portrait editor from the face', async () => {
    await mount()
    const face = within(row('Mikhail Bulgakov')).getByLabelText(/Portrait for Mikhail Bulgakov/)
    expect(face.querySelector('img')).toBeTruthy()
    // A record with no portrait still has the control — that is the row that needs
    // it — and it says so by being empty rather than by disappearing.
    //
    // ASKED OF WHAT IS DRAWN, not of a class the caller sets from the stored
    // path: that class could not tell an absent picture from one whose file has
    // gone, which is the whole reason it stopped being set. A stand-in on the
    // screen is a silhouette, and a silhouette is an svg.
    const empty = within(row('Oleg Basilashvili')).getByLabelText(/Portrait for Oleg/)
    expect(empty.querySelector('svg'), 'the empty portrait draws no stand-in').toBeTruthy()
    expect(empty.querySelector('img'), 'the empty portrait drew a picture').toBeNull()
  })
})

describe('fetching links onto a record', () => {
  it('writes them by id, never by name', async () => {
    await mount()
    // BY ITS ACCESSIBLE NAME, NOT BY ITS VISIBLE WORD. The fetch control is a row
    // action glyph now, like the ones on the works console — the word rides its
    // aria-label and its tooltip, which is what a screen reader and a hover both
    // get, and what this line reads.
    act(() => within(row('Oleg Basilashvili')).getByRole('button', { name: /fetch/i }).click())
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/portrait')).toBe(true))
    // PUT /people upserts by (kind, name) and lands on the lowest id where two
    // records share one — so fetching for the second of two namesakes wrote onto
    // the first. The record endpoint cannot make that mistake.
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people/id/2')).toBe(true))
    expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people')).toBe(false)
  })
})

// ── THE PROVIDER LINKS ARE ON THE ROW AT EVERY WIDTH.
//
// They were drawn behind `{!mobile && …}`, so on a phone — on the one screen
// whose whole subject is which providers a person is linked to — a reader could
// see none of them. The pack draws them as part of the row at every width.
//
// THE GATE WAS TREATING A SYMPTOM: five chips in a wrapping flex take three lines
// at 390px, so the row was fixed by deleting the content. `ProviderChips` scrolls
// under a measured fade now, which is the repo's rule for a row that can overflow.
//
// BOTH WIDTHS ARE ASSERTED, because "the chips are there on a phone" does not say
// the desk kept them — and a change that moved them out of one width into the
// other would pass a single-width case either way.
describe('a record’s provider links', () => {
  let realMatchMedia
  const asPhone = () => {
    realMatchMedia = window.matchMedia
    // Only the mobile query answers true: other hooks ask this same function
    // about reduced motion and must keep getting their own answer.
    window.matchMedia = (media) => ({
      matches: media === MOBILE_SCREEN_QUERY,
      media,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })
  }
  afterEach(() => { if (realMatchMedia) { window.matchMedia = realMatchMedia; realMatchMedia = undefined } })

  it('are on the row on a desk', async () => {
    await mount()
    const r = row('Somebody Nobody Credits')
    expect(within(r).getByRole('link', { name: /imdb/i }), 'the IMDb link should be on the row').toBeTruthy()
    expect(within(r).getByRole('link', { name: /wikidata/i })).toBeTruthy()
  })

  it('and on the row on a phone, which is where they used to vanish', async () => {
    asPhone()
    await mount()
    const r = row('Somebody Nobody Credits')
    expect(within(r).getByRole('link', { name: /imdb/i }), 'a phone reader cannot see which providers this person has')
      .toBeTruthy()
    expect(within(r).getByRole('link', { name: /wikidata/i })).toBeTruthy()
  })

  // AND THE ROW IS NOT A PARAGRAPH: the chips sit in one scrolling line rather
  // than wrapping. That the strip EXISTS is all this tier can say — jsdom loads
  // no stylesheet, so `getComputedStyle(...).flexWrap` here reads the initial
  // value whatever index.css declares. A case asserting `nowrap` in this file
  // passed with the rule changed to `wrap`, which is the vacuous pass the repo's
  // testing ruling exists to end. The `nowrap` itself is held in the tier that
  // reads the stylesheet: `x-scrollers-do-not-wrap.test.js`.
  it('sit in a scroller of their own rather than loose in the row', async () => {
    asPhone()
    await mount()
    expect(row('Somebody Nobody Credits').querySelector('.provider-chips'), 'the chips should be in a scroller')
      .toBeTruthy()
  })
})
