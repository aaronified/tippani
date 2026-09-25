// An admin resets the server, and the reset will not go until they have
// downloaded a copy of everything that is about to be deleted.
//
// WHAT THIS GUARDS. The owner, on restore and reset: "Admin can choose to do
// this, but must take a backup and download it before this can be done (as part
// of the process of the reset)."
//
// TWO DECLARED EXCEPTIONS. The one per-user-isolation.journey.mjs makes: the
// copy is sealed with the admin's own password, read from TIPPANI_JOURNEY_PASS,
// which the harness itself signs in with. No screen prints a password. And where
// focus is: the RESET box has no label, only the word it asks for as its
// placeholder, so the focused element's placeholder is read — a keyboard reader
// knows where focus is and the vocabulary has no verb for it.
//
// Mutations: with `press('Download a backup first')` deleted, the reset button
// stays shut and "Welcome to tippani" never appears; with the safety step's focus
// hand-off deleted, focus is not on the RESET box after the download.
//
// It knows the words on the screen, the file it is handed, that password, and
// where focus is.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a factory reset waits for a downloaded backup, then goes', async () => {
  await app.goto('/profile')
  await app.press('Reset all data…')
  await app.type('RESET', 'RESET')

  // The refusal without a download is the server's (Go:
  // TestRestoreAndResetWaitForAFreshDownloadedBackup); a press on the shut button
  // here would only prove the button is shut, and the mutation below is what
  // shows the download is the step that opens it.

  await app.type('Your password, to seal the copy', app.account.password)
  await app.press('Download a backup first')
  const copy = await app.downloaded('safety-copy')
  expect(copy.name).toMatch(/\.tpbk$/)
  await app.see('Copy downloaded')

  // THE KEYBOARD IS HANDED ON to the step that comes next: the RESET box.
  const focused = await app.page.evaluate(() => document.activeElement?.getAttribute('placeholder'))
  expect(focused, 'focus was left behind by the download').toBe('RESET')

  await app.press('Delete everything & restart')
  await app.see('Welcome to tippani')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
