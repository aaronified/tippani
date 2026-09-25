// A reader pastes their Pushover keys into Profile, saves, and finds them still
// there after a reload — with the application token kept secret and the events
// they can be told about now on offer.
//
// WHAT IS NOT HERE: "Send a test". It posts to pushover.net, which this
// container cannot reach and a journey must not; the Go suite covers the
// message with the sender stubbed.
//
// Mutation: with `press('Save keys')` deleted, the reload shows an empty user
// key and no events, and the first `see` after it waits in vain.
//
// It knows the words on the screen and nothing else.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader saves their Pushover keys and they are kept, the token unshown', async () => {
  await app.goto('/profile')
  await app.see('Notifications')
  await app.gone('Daily review ready')

  await app.type('Pushover user key', 'ujourneyreaderkey0000000000000')
  await app.type('Pushover application token', 'ajourneyapptoken00000000000000')
  await app.press('Save keys')
  await app.see('Saved.')

  await app.goto('/profile')
  await app.see('Daily review ready')
  await app.see('Large imports')
  expect(await app.valueOf('Pushover user key')).toBe('ujourneyreaderkey0000000000000')
  // Write-only: the field comes back empty, and says a token is saved.
  expect(await app.valueOf('Pushover application token')).toBe('')
  expect(await app.onScreen()).not.toContain('ajourneyapptoken')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
