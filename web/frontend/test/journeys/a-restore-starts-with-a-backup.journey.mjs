// An admin restores the server from the archive it keeps, and the restore will
// not go until they have downloaded a copy of what it is about to replace. The
// connection drops on the first try and the step says so; the second try lands,
// the keyboard is handed on to the restore's own question, and the password they
// typed for the copy is already in it.
//
// WHAT THIS GUARDS. The owner, on restore and reset: "Admin can choose to do
// this, but must take a backup and download it before this can be done (as part
// of the process of the reset)." And the round-2 rating of that work: nothing
// drove the restore half in a browser, so a step that hung on a dropped
// connection, a field that took focus past the step, or a password asked for
// twice were all invisible.
//
// DECLARED EXCEPTIONS, ALL THROUGH `app.page` OR THE ACCOUNT, each because no
// word on the screen can serve:
// - the admin's password, from TIPPANI_JOURNEY_PASS, as the reset journey does;
// - a dropped connection, `setOfflineMode`, because a reader cannot be asked to
//   pull a cable and the harness has no verb for the network;
// - where focus is: the text of the label around the focused box, case folded
//   as `press` folds it (the label is drawn in capitals), because a
//   keyboard reader knows where focus is and the vocabulary has no verb for it.
//
// Mutations: with the second `press('Download a backup first')` deleted the
// Restore button stays shut and "restored" never appears; with the step's
// focus hand-off removed `focusedField` is not "Your password"; with the
// catch removed from the download the step never says "Backup failed".
//
// It knows the words on the screen, the file it is handed, that password, the
// network switch, and where focus is.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const focusedField = () => app.page.evaluate(() =>
  document.activeElement?.closest('label')?.innerText.split('\n')[0].trim().toLowerCase() ?? '')

it('a restore waits for a downloaded backup, survives a dropped connection, and asks the password once', async () => {
  // SETUP: the archive the restore reads. Made through the screen, because the
  // harness gives a journey no API.
  await app.goto('/settings/server')
  await app.press('Back up now')
  await app.type('Your password', app.account.password)
  await app.press('Back up')
  await app.see('backup created')

  await app.press('Restore…')
  await app.see('First, download a copy')

  // THE CONNECTION DROPS: the step says so and gives the button back, rather
  // than sitting on "Preparing the copy…".
  await app.type('Your password, to seal the copy', app.account.password)
  await app.page.setOfflineMode(true)
  await app.press('Download a backup first')
  await app.see('Backup failed')
  await app.page.setOfflineMode(false)

  await app.press('Download a backup first')
  const copy = await app.downloaded('safety-copy')
  expect(copy.name).toMatch(/\.tpbk$/)
  await app.see('Copy downloaded')

  // THE KEYBOARD IS HANDED ON, and the question already has its answer: this
  // server made the archive, so the password that sealed the copy opens it.
  expect(await focusedField(), 'focus was left behind by the download').toBe('your password')
  expect(await app.valueOf('Your password'), 'the restore asked for the password a second time').not.toBe('')

  await app.press('Restore')
  await app.see('restored')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
