// A reader opens Settings › Jobs, and each library job on the Common jobs card says
// how much of the library is still missing what it fetches — the number the
// Metadata screen shows for the same thing.
//
// THE OWNER'S ASK, 30 September, of the card: "This card should also know about
// what all are pending (from metadata)." So a fill says how many works Metadata's
// works console does not call complete, a people fetch says the number on the
// People console's Fetch missing, and a covers pass says how many works have no
// cover or poster, which is what its Missing only run walks.
//
// WHY A JOURNEY. The two screens are counted by one set of tests (libraryGaps.js),
// and the only proof that they agree is the two numbers side by side on a real
// library. A dom test of the card would be handed the rows it counts, which is the
// half that was never in doubt.
//
// SETUP KNOWS `GET /people/records` and its `people` and `id` fields, and
// `PUT /people/id/{id}` with `links`, to give one person a provider link and no
// portrait. In the golden library every person lacks both, so a count of people
// with no links, with no photo, or with neither would all read 69 and a card that
// counted the wrong one would pass. With one link the three are 68, 69 and 68.
//
// THE MUTATIONS, each built and run and put back (commonJobs.jsx):
//   - the Pending line taken out of CommonJob: red, "works incomplete" never
//     appears;
//   - the films half taken out of `incomplete`: red, "expected 27 to be 41", the
//     fill counting books alone;
//   - the people count made `lacksLinks` where it is `fetchable`: red, "expected 68
//     to be 69", where Metadata's Fetch missing says 69.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const count = (seen, re, what) => {
  const m = seen.match(re)
  expect(m, `the screen does not say ${what}`).toBeTruthy()
  return Number(m[1])
}

it('each library job on the Common jobs card says what is left, in the numbers Metadata shows', async () => {
  const { people } = await app.setup('GET', '/people/records')
  await app.setup('PUT', `/people/id/${people[0].id}`, { links: 'https://www.wikidata.org/wiki/Q42' })

  await app.goto('/settings/jobs')
  await app.see('works incomplete')
  const card = await app.onScreen()
  const incomplete = count(card, /(\d+) works? incomplete/, 'how many works are incomplete')
  const missingPeople = count(card, /(\d+) (?:person|people) missing a portrait or links/, 'how many people are missing a portrait or links')
  const artless = /Fetch covers and details\n[^\n]*\nNothing missing/.test(card)
    ? 0
    : count(card, /(\d+) works? with no cover or poster/, 'how many works have no cover or poster')

  // THE WORKS CONSOLE, every type: how many there are, how many it calls complete,
  // and how many have no cover or no poster. A pill is its words, then its number.
  await app.goto('/metadata')
  await app.see('works shown')
  const works = await app.onScreen()
  const pill = (label) => count(works, new RegExp(`\\n${label}\\n(\\d+)`), `the "${label}" pill's count`)
  const total = count(works, /(\d+) works? shown/, 'how many works are shown')
  expect(incomplete, 'the fill says a different number of works than Metadata leaves incomplete').toBe(total - pill('complete'))
  expect(artless, 'the covers pass says a different number than Metadata has with no cover or poster').toBe(pill('no cover') + pill('no poster'))

  // THE PEOPLE CONSOLE's Fetch missing names its number.
  await app.press('People')
  await app.see('people shown')
  const fetch = await app.said(/^Fetch missing \(\d+\)$/)
  expect(missingPeople, 'the people fetch says a different number than Fetch missing').toBe(Number(fetch.match(/\d+/)[0]))

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
