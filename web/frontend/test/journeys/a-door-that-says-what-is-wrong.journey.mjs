// A reader on a phone presses an issue on the Metadata index and lands on the
// console showing exactly that.
//
// WHAT THIS GUARDS. The owner, of an index that was a name and an arrow per section:
// "the metadata phone index page looks like shit". Each console's door now carries
// its open issues as pills, and a pill is a door straight to the console filtered to
// that issue. A pill that only LOOKS like a door — that opens the section unfiltered
// — would be the worse of the two indexes, so this checks where it lands.
//
// THE MUTATION. Make the index pill's press `setSection(row.go.section)` instead of
// `pickGap(…)` and the console's own "no source" pill is not the chosen one.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('an issue on the phone index opens its console filtered to that issue', async () => {
  await app.goto('/metadata')
  await app.press('no source')

  expect(await app.chosen('no source'), 'the console opened, but not filtered to the issue pressed').toBe(true)

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
