// A reader makes a dashboard key under Settings → Server, copies what the screen gives them
// into their dashboard, and the dashboard can read their library's four numbers
// with it — until they revoke it, and then it cannot.
//
// DECLARED EXCEPTION: THIS JOURNEY KNOWS AN ADDRESS AND FOUR JSON FIELD NAMES —
// `/api/widget`, `works`, `quotes`, `forgot`, `mastered` — and a header name.
// Nothing on the screen could serve instead, because the second actor in this
// story is not a person: it is gethomepage, a program, and those names are the
// contract it is configured with. They are the same names the README publishes
// and the screen itself prints in the YAML the reader copies, so the journey
// reads the key and the header off the screen, and knows only what the reader's
// dashboard would be told.
//
// Mutation: with `press('Make a key')` deleted there is no key on the screen to
// copy and it waits for one in vain; with the revoke deleted the last
// fetch answers 200.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

async function dashboard(key) {
  const r = await fetch(app.baseUrl + '/api/widget', { headers: { 'X-API-Key': key } })
  return { status: r.status, body: r.status === 200 ? await r.json() : null }
}

it('a key made under Settings → Server lets a dashboard read four numbers, and revoking it stops that', async () => {
  await app.goto('/settings/server')
  await app.see('Dashboard widget')
  await app.press('Make a key')
  await app.see('Copy it now')

  const key = (await app.onScreen()).match(/X-API-Key: (tpw_[0-9a-f]+)/i)?.[1]
  expect(key, 'the screen shows a key to paste into the dashboard').toBeTruthy()

  const { status, body } = await dashboard(key)
  expect(status).toBe(200)
  for (const field of ['works', 'quotes', 'forgot', 'mastered']) {
    expect(Number.isInteger(body[field]), `${field} is a count`).toBe(true)
  }
  // The fixture library has works and quotes; zeros here would be a widget
  // counting somebody else's (empty) library.
  expect(body.works).toBeGreaterThan(0)
  expect(body.quotes).toBeGreaterThan(0)

  await app.press('Revoke')
  await app.see('No key yet')
  expect((await dashboard(key)).status).toBe(401)
})
