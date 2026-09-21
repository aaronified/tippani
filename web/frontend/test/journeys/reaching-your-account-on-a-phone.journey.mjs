// A reader on a phone opens the drawer, presses the chip with their own name on
// it, and lands on their account — a screen, with a way back to where they were.
//
// WHY THIS EXISTS. The owner, of that chip: "it merely refreshes the screen for
// me. Same page as i was before", and, of the account: "I see no way to get
// there." Both halves were true of a screen that had no ADDRESS. Profile was a
// dialog: the chip layered it over whatever screen you were on, so the URL still
// said /settings, a reload lost it, nothing could link to it, and the one gesture
// that reaches it shared a history marker with the drawer it was pressed in.
//
// WHAT NO OTHER TIER CAN SEE. Whether the press leaves you somewhere is a
// question about the shell, the drawer, the router and the history stack at once
// — four things that are each other's context. A dom test mounts Profile and
// finds it renders; it cannot press a chip inside a drawer and ask what the app
// then shows, which is the only version of the question the reader asked.
//
// THE MUTATION. Point the chip back at a dialog — `onAccount` setting a flag that
// renders an overlay instead of `go('profile')` — and the reload assertion goes
// red: the address is still the screen the reader came from, so the reader comes
// back to Settings rather than to their account. Delete the `press` on the chip
// and the first `see('Log out')` goes red.
//
// THE RELOAD IS THE POINT, and it is the assertion a panel cannot pass however
// well it renders. "The account is on screen" was true of the dialog too.
//
// It knows the words on the screen and nothing else — no route, no component, no
// class, no preference key.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('a reader reaches their account from the drawer, and it is a screen they can come back to', async () => {
  // Somewhere that is not the account, so "it left me where I was" is a thing
  // this case can actually catch.
  await app.goto('/settings')
  await app.see('Theme')

  await app.press('Menu')
  // The chip says who you are — which is what makes it the account door rather
  // than a decoration, and it is the name the reader presses.
  await app.press('Profile — ' + app.account.username)

  // ON THE ACCOUNT, AND NOT UNDER A DRAWER. Both matter and they fail
  // differently: the first is the app having gone somewhere, the second is the
  // drawer having got out of the way. The bug the owner reported looked exactly
  // like the second one alone — the app HAD moved, and the drawer standing open
  // over it is what made the screen look unchanged.
  await app.see('Log out')
  await app.gone('Anthologies')

  // AND THE SECTIONS OF SETTINGS ARE GONE, so this cannot pass by the account
  // having merely been drawn on top of the screen the reader started on.
  await app.gone('Theme')

  // THE ADDRESS IS THE ACCOUNT'S OWN. A reload is how a reader finds out whether
  // the app thinks they are somewhere or merely showing them something: a panel
  // over Settings comes back as Settings, and this comes back as the account.
  await app.page.reload({ waitUntil: 'networkidle0' })
  await app.see('Log out')
  await app.gone('Theme')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
