// A reader opens a show's Episodes from its details, names an episode, and puts the show in its
// custom order; the quotes then wear the order they chose.
//
// SETUP MAY USE THE API: the show and its lines are arranged, not asserted. What is asserted is the
// dialog's own work, read back from what the app keeps afterwards, so the setup calls know
// POST /movies, POST /dialogues and GET /movies/{id}/episodes and their fields (declared here).
//
// THE MUTATION: take the `show` field out of the dialog's final save and the second case goes red,
// because the card still says S1E1; take the name out of the first PUT and the first goes red.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

async function arrange() {
  const show = await app.setup('POST', '/movies', { title: 'Journey Episodes Show', media_type: 'show' })
  for (const [quote, season, episode] of [['the first words', 1, 1], ['the second words', 1, 2]]) {
    await app.setup('POST', '/dialogues', { movie_id: show.id, quote, season, episode })
  }
  return show
}

it('a reader names an episode in the Episodes dialog and it is kept', async () => {
  const show = await arrange()
  await app.goto(`/movies/${show.id}`)
  await app.press('Details')
  await app.press('Episodes…')
  await app.see('Episodes of Journey Episodes Show')
  const names = await app.page.$$('input[aria-label="Episode name"]')
  await names[0].type('The Arrival')
  await app.press('Save')
  await app.gone('Episodes of Journey Episodes Show')
  const got = await app.setup('GET', `/movies/${show.id}/episodes`)
  expect(got.episodes.map((e) => e.name).sort()).toEqual(['', 'The Arrival'])
})

it('a reader puts the show in a custom order and its lines wear it', async () => {
  const show = await arrange()
  await app.goto(`/movies/${show.id}`)
  await app.press('Details')
  await app.press('Episodes…')
  await app.press('Custom')
  const season = await app.page.$$('input[aria-label="Season number"]')
  await season[0].click()
  await app.page.keyboard.press('End')
  await app.page.keyboard.press('Backspace')
  await app.page.keyboard.type('4')
  await app.press('Save')
  await app.gone('Episodes of Journey Episodes Show')
  const got = await app.setup('GET', `/movies/${show.id}/episodes`)
  expect(got.order).toBe('custom')
  const lines = await app.setup('GET', `/dialogues?movie_id=${show.id}`)
  expect(lines.dialogues.map((d) => [d.shown_season, d.shown_episode]), 'the lines wear the custom order').toContainEqual([4, 1])
})

// THE DRAG WITHOUT A POINTER, and the confirmation that renumbering the TV order asks. Alt and the
// arrow keys move a row one place; saving the tv order moves quotes, so the dialog says how many and
// waits for a yes. Declared: the grips are found by their accessible name, which starts "Move".
it('a reader swaps two episodes with the keyboard, confirms, and the quotes move', async () => {
  const show = await arrange()
  await app.goto(`/movies/${show.id}`)
  await app.press('Details')
  await app.press('Episodes…')
  await app.see('Episodes of Journey Episodes Show')
  const grips = await app.page.$$('button[aria-label^="Move"]')
  await grips[0].focus()
  await app.page.keyboard.down('Alt')
  await app.page.keyboard.press('ArrowDown')
  await app.page.keyboard.up('Alt')
  await app.press('Save')
  await app.see('Renumber the TV order?')
  await app.see('2 of your quotes move')
  await app.press('Renumber')
  await app.gone('Episodes of Journey Episodes Show')
  const lines = await app.setup('GET', `/dialogues?movie_id=${show.id}`)
  const at = Object.fromEntries(lines.dialogues.map((d) => [d.quote, [d.season, d.episode]]))
  expect(at['the first words']).toEqual([1, 2])
  expect(at['the second words']).toEqual([1, 1])
})
