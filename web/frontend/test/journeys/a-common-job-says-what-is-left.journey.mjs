// A reader opens Settings › Jobs, and each library job on the Common jobs card says
// how much of the library it could still fill in.
//
// THE OWNER'S ASK, 30 September, of the card: "This card should also know about
// what all are pending (from metadata)." So a fill says how many works it can find
// at a supplier have a field it writes still empty, and how many more need a source
// first; a people fetch says the number on the People console's Fetch missing; and
// a covers pass says how many books have no cover and how many films have a TMDB
// poster on record and none stored.
//
// NARROWER THAN METADATA'S FLAGS, AND THAT IS WHAT THIS HOLDS. A rating found the
// card counting every work Metadata does not call complete under the fill (the
// golden library's 41, every one unpinned, so the fill could close none of them)
// and every missing picture under the covers pass, films it never walks included.
// A second rating found the next layer: the fill does find a game with no id, by
// its exact IGDB title, once IGDB can be asked; the covers pass fetches only a
// TMDB poster named in the record a film was added from; and "Nothing missing"
// beside a Metadata badge of 41 was two answers to one question. So the case reads
// how each count moves as the library changes: works the fill can find and ones it
// cannot, a game before and after IGDB is set up, and a pinned book with nothing
// left to fill.
//
// WHY A JOURNEY. The counts are read off the same rows Metadata draws, and the only
// proof that they move with the library is a real library changing under them. A
// dom test of the card would be handed the rows it counts, which is the half that
// was never in doubt.
//
// SETUP KNOWS `POST /books` with `title` and `isbn`, `POST /movies` with `title`
// and `media_type`, `GET /books` and its `books`, `id`, `title` and `cover_path`,
// `PUT /books/{id}` with the fields the fill writes, `PUT /admin/metadata-keys`
// with `igdb_client_id` and `igdb_secret` (this world is offline, so nothing is
// asked), `GET /people/records` and its `people` and `id` fields, and
// `PUT /people/id/{id}` with `links`, to give one person a provider link and no
// portrait. In the golden library every person lacks both, so a count of people
// with no links, with no photo, or with either would all read 69 and a card that
// counted the wrong one would pass. With one link the three are 68, 69 and 69.
//
// THE MUTATIONS, each built and run and put back (commonJobs.jsx, libraryGaps.js):
//   - the Pending line taken out of CommonJob: red, "missing a portrait or links"
//     never appears;
//   - the fill counting every work Metadata does not call complete: red, "the fill
//     row over a library it can find nothing in: expected '41 works with a gap it
//     can fill · 41 …'";
//   - the fill's gap check taken out (every pinned book counted): red, "a pinned
//     book with nothing empty is counted by the fill: expected 6 to be 5";
//   - games with no id not counted when IGDB can be asked: red, "the games with no
//     id still need a source: expected 0 to be greater than 0";
//   - the covers pass counting films with no poster on record: red, "expected 4 to
//     be 2";
//   - the covers count multiplied by zero: red, "expected 0 to be 2";
//   - the people count made `lacksLinks` where it is `fetchable`: red, "the people
//     fetch says a different number than Fetch missing";
//   - the fill's own "Nothing it can fill" back to "Nothing missing": red, "expected
//     'Nothing missing · 41 works need a sou…'";
//   - the fill's works that need a source not drawn: red, "expected 0 to be greater
//     than 0".

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const FILL = 'Fill gaps in every work'
const COVERS = 'Fetch covers and details'
const PEOPLE = 'Fetch missing people'

// What a row says it has left, read off the first line under its title that
// answers it: its count ("N works …" or a "Nothing …" that stands alone), and for
// the fill the works it cannot find ("· N works need a source first").
async function left(title) {
  const lines = (await app.onScreen()).split('\n').map((l) => l.trim())
  const at = lines.indexOf(title)
  expect(at, `the card has no ${title} row`).toBeGreaterThanOrEqual(0)
  const line = lines.slice(at + 1, at + 5).find((l) => /^nothing /i.test(l) || /^\d+ (?:works?|person|people) /.test(l))
  expect(line, `the ${title} row says nothing about what is left`).toBeTruthy()
  const blocked = line.match(/(\d+) works? need a source first/)
  return { n: /^nothing /i.test(line) ? 0 : Number(line.match(/^\d+/)[0]), blocked: blocked ? Number(blocked[1]) : 0, line }
}

async function card() {
  await app.goto('/settings/jobs')
  await app.see(FILL)
  await app.see('missing a portrait or links')
  return { fill: await left(FILL), covers: await left(COVERS), people: await left(PEOPLE) }
}

it('each library job on the Common jobs card says what it could still fill in', async () => {
  const { people } = await app.setup('GET', '/people/records')
  await app.setup('PUT', `/people/id/${people[0].id}`, { links: 'https://www.wikidata.org/wiki/Q42' })

  // EVERY WORK IN THE GOLDEN LIBRARY IS UNPINNED, so the fill can find none of
  // them, and it says so rather than "Nothing missing" over a library Metadata
  // flags end to end.
  const before = await card()
  expect(before.fill.line, 'the fill row over a library it can find nothing in').toMatch(/^nothing it can fill/i)
  expect(before.fill.blocked, 'the works the fill cannot find, with a gap it would fill').toBeGreaterThan(0)

  await app.setup('POST', '/books', { title: 'A Pinned Book With Nothing Filled In', isbn: '9780000000002' })
  await app.setup('POST', '/books', { title: 'An Unpinned Book With No Cover' })
  await app.setup('POST', '/movies', { title: 'A Film With No Source' })
  await app.setup('POST', '/movies', { title: 'A Game With No Id', media_type: 'game' })
  const added = await card()
  expect(added.fill.n - before.fill.n, 'the fill counts the pinned book and nothing it cannot find').toBe(1)
  expect(added.fill.blocked - before.fill.blocked, 'the fill says the unpinned book, film and game need a source').toBe(3)
  expect(added.covers.n - before.covers.n, 'the covers pass counts both books and not the film with no poster on record').toBe(2)

  // A GAME WITH NO ID IS ONE THE FILL CAN FIND once IGDB can be asked: it looks
  // the game up there by its exact title. Every such game moves from the works
  // that need a source to the ones it can fill, the one added above and the
  // golden library's own.
  await app.setup('PUT', '/admin/metadata-keys', { igdb_client_id: 'journey-id', igdb_secret: 'journey-secret' })
  const igdb = await card()
  const moved = added.fill.blocked - igdb.fill.blocked
  expect(moved, 'with IGDB set up, the games with no id still need a source').toBeGreaterThan(0)
  expect(igdb.fill.n - added.fill.n, 'with IGDB set up, the fill counts the games it can look up').toBe(moved)

  // A PINNED WORK WITH NOTHING LEFT TO FILL IS NOT COUNTED. A golden book with a
  // cover is pinned and given every field the fill writes.
  const { books } = await app.setup('GET', '/books')
  const full = books.find((b) => b.cover_path)
  expect(full, 'the golden library has a book with a cover').toBeTruthy()
  await app.setup('PUT', `/books/${full.id}`, {
    title: full.title, author: 'A. Author', isbn: '9780000000019', series: 'A Series', series_index: 1,
    published_year: 1901, genres: ['Fiction'], description: 'A book with nothing left to fill.',
  })
  const whole = await card()
  expect(whole.fill.n, 'a pinned book with nothing empty is counted by the fill').toBe(igdb.fill.n)

  // THE PEOPLE CONSOLE's Fetch missing names its number, and the people row says it.
  await app.goto('/metadata')
  await app.see('works shown')
  await app.press('People')
  await app.see('people shown')
  const fetch = await app.said(/^Fetch missing \(\d+\)$/)
  expect(whole.people.n, 'the people fetch says a different number than Fetch missing').toBe(Number(fetch.match(/\d+/)[0]))

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
