// A reader opens Metadata, on a phone and on a desk, now that Overview is gone.
//
// WHAT THIS GUARDS. The owner: "remove the overview screen completely. We are not
// going to miss it. All options are available on other screens." A phone opens on
// the index of sections; a desk opens on Works; and an old /metadata/overview
// address lands somewhere real rather than on a blank screen.
//
// THE MUTATIONS. Put Overview back in the section table and the desk case goes
// red — "Re-verify metadata" is on the screen again. Make a phone enter a section
// by itself and the phone case goes red — the Works pills are there instead of the
// index.
//
// It knows the addresses it opens and the words on the screen.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const desk = openApp()

it('a reader on a desk lands on Works, even from an old Overview address', async () => {
  await desk.goto('/metadata/overview')
  await desk.see('flagged')
  await desk.gone('Re-verify metadata')
  await desk.gone('Overview')
  expect(desk.pageErrors(), 'the page threw on the way').toEqual([])
})

const phone = openApp({ viewport: PHONE })

it('a reader on a phone opening Metadata sees its sections, not one of them', async () => {
  await phone.goto('/metadata')
  await phone.see('Works')
  await phone.see('Languages')
  await phone.gone('flagged')
  await phone.gone('Overview')
  expect(phone.pageErrors(), 'the page threw on the way').toEqual([])
})
