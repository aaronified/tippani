// A reader opens Settings › Jobs, and each library job on the Common jobs card says
// how much of the library it could still fill in.
//
// THE OWNER'S ASK, 30 September, of the card: "This card should also know about
// what all are pending (from metadata)." So a fill says how many pinned works have
// a field it writes still empty, a people fetch says the number on the People
// console's Fetch missing, and a covers pass says how many books have no cover and
// how many films with a source have no poster.
//
// NARROWER THAN METADATA'S FLAGS, AND THAT IS WHAT THIS HOLDS. A rating found the
// card counting every work Metadata does not call complete under the fill (the
// golden library's 41, every one unpinned, so the fill could close none of them)
// and every missing picture under the covers pass, films it never walks included.
// So the case adds three works and reads how each count moves: a pinned book with
// empty fields and no cover, an unpinned book with no cover, and a film with no
// source and no poster. The fill moves by one, and the covers pass by two.
//
// WHY A JOURNEY. The counts are read off the same rows Metadata draws, and the only
// proof that they move with the library is a real library changing under them. A
// dom test of the card would be handed the rows it counts, which is the half that
// was never in doubt.
//
// SETUP KNOWS `POST /books` with `title` and `isbn`, `POST /movies` with `title`,
// `GET /people/records` and its `people` and `id` fields, and
// `PUT /people/id/{id}` with `links`, to give one person a provider link and no
// portrait. In the golden library every person lacks both, so a count of people
// with no links, with no photo, or with either would all read 69 and a card that
// counted the wrong one would pass. With one link the three are 68, 69 and 69.
//
// THE MUTATIONS, each built and run and put back (commonJobs.jsx, libraryGaps.js):
//   - the Pending line taken out of CommonJob: red, "missing a portrait or links"
//     never appears;
//   - the fill counting every work Metadata does not call complete: red, "the
//     fill counts the pinned book and not the unpinned one: expected 3 to be 1"
//     (the unpinned book and the film as well);
//   - the covers pass counting films with no source: red, "expected 3 to be 2";
//   - the covers count multiplied by zero: red, "expected 0 to be 2";
//   - the people count made `lacksLinks` where it is `fetchable`: red, "expected 68
//     to be 69", where Metadata's Fetch missing says 69.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const FILL = 'Fill gaps in every work'
const COVERS = 'Fetch covers and details'
const PEOPLE = 'Fetch missing people'

// What a row says it has left: the first line under its title that is a count or
// "Nothing missing", read as a number.
async function left(title) {
  const lines = (await app.onScreen()).split('\n').map((l) => l.trim())
  const at = lines.indexOf(title)
  expect(at, `the card has no ${title} row`).toBeGreaterThanOrEqual(0)
  const line = lines.slice(at + 1, at + 5).find((l) => l === 'Nothing missing' || /^\d+ (?:works?|person|people) /.test(l))
  expect(line, `the ${title} row says nothing about what is left`).toBeTruthy()
  return line === 'Nothing missing' ? 0 : Number(line.match(/^\d+/)[0])
}

it('each library job on the Common jobs card says what it could still fill in', async () => {
  const { people } = await app.setup('GET', '/people/records')
  await app.setup('PUT', `/people/id/${people[0].id}`, { links: 'https://www.wikidata.org/wiki/Q42' })

  await app.goto('/settings/jobs')
  await app.see(FILL)
  await app.see('missing a portrait or links')
  const fill = await left(FILL)
  const covers = await left(COVERS)

  await app.setup('POST', '/books', { title: 'A Pinned Book With Nothing Filled In', isbn: '9780000000002' })
  await app.setup('POST', '/books', { title: 'An Unpinned Book With No Cover' })
  await app.setup('POST', '/movies', { title: 'A Film With No Source' })
  await app.goto('/settings/jobs')
  await app.see(FILL)
  await app.see('with a gap it can fill')
  expect(await left(FILL) - fill, 'the fill counts the pinned book and not the unpinned one').toBe(1)
  expect(await left(COVERS) - covers, 'the covers pass counts both books and not the film it never walks').toBe(2)

  // THE PEOPLE CONSOLE's Fetch missing names its number, and the people row says it.
  const missingPeople = await left(PEOPLE)
  await app.goto('/metadata')
  await app.see('works shown')
  await app.press('People')
  await app.see('people shown')
  const fetch = await app.said(/^Fetch missing \(\d+\)$/)
  expect(missingPeople, 'the people fetch says a different number than Fetch missing').toBe(Number(fetch.match(/\d+/)[0]))

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
