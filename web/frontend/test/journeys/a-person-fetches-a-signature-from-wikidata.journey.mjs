// A reader presses Fetch on a person's signature slot and is offered the signature Wikidata
// holds, keeps it, and the slot shows it.
//
// WHAT THE REPORT WAS: Rabindranath Tagore's signature is on Wikidata and Wikimedia Commons,
// the server found it (its log shows the 24.7 kB picture arriving) and the card went on saying
// "No signature yet". The page turned the server's answer into a picture with a fetch of a
// data: address, and the app's own Content-Security-Policy refuses that — a failure that no
// test could see, because every test drew the screen in a DOM that has no policy and answered
// that fetch itself. Only a browser enforces the policy, so this is the journey for it.
//
// THIS ONE NEEDS THE INTERNET, and says so rather than hiding it: the Fetch asks Open Library,
// Wikidata and Commons, and a signature is not something a test may invent. It skips, loudly,
// where Commons, Wikidata or Open Library cannot be reached. The server is online for this file alone (every other
// journey runs it offline so a lookup cannot make a run differ from the last).
//
// SETUP KNOWS POST /books (`title`, `author`) and the `id` it answers with: a book by the
// person, opened at /books/{id}, from which the person is reached by their name.
//
// THE MUTATION, built and run and put back: turning the answer into a picture with a fetch of
// its data: address (signature.jsx's blobFromDataURL replaced by `await (await
// globalThis.fetch(r.data.image)).blob()`) leaves "Ink strength" never appearing, so the
// journey fails at the dialog, and "No signature yet" is still on the screen.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

// The Fetch asks all three services. A slow or down one fails the journey for a reason that has nothing
// to do with the app (the CI log showed Open Library timing out), so every one must answer first.
const answers = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    .then((r) => r.ok)
    .catch(() => false)
const reachable = (
  await Promise.all([
    answers('https://commons.wikimedia.org/', { method: 'HEAD' }),
    answers('https://www.wikidata.org/', { method: 'HEAD' }),
    answers('https://openlibrary.org/search/authors.json?limit=1&q=Tagore'),
  ])
).every(Boolean)

const app = openApp({ env: { TIPPANI_OFFLINE: '0' } })

it.skipIf(!reachable)('Fetch from Wikidata offers the signature it found, and keeping it fills the slot', async () => {
  const book = await app.setup('POST', '/books', { title: 'Gitanjali', author: 'Rabindranath Tagore' })

  await app.goto(`/books/${book.id}`)
  // The name is shown shortened on the book's header ("Rabindranath Tago…"), as a reader sees it.
  await app.press('Rabindranath Tago…')
  await app.see('No signature yet')

  await app.press('Fetch from Wikidata')
  // The dialog opens on the CLEANED signature and keeps nothing until it is saved.
  await app.see('Ink strength')
  await app.see('Signature — Rabindranath Tagore')
  await app.see('No signature yet') // still: nothing is kept until the tick

  await app.press('Save')
  await app.see('Remove signature')
  await app.gone('No signature yet')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
