// A section's cards are numbered by where they stand, on Settings and Metadata
// alike, and a card alone on its screen carries no number.
//
// THE ASK: "equalise. metadata and settings cards shall be similar." Settings
// numbered some cards and not others with hand-typed ordinals ("4 ·" on a screen
// of three), and Metadata's cards wore a different heading altogether. The owner
// chose one head for both: the mono label, numbered by position when a section
// holds two or more cards.
//
// WHY BOTH SCREENS AND A LONE CARD. The number is the section's to give — it is
// counted from the screen, not typed by the card — so what has to be shown is that
// it counts on Settings, that it counts on Metadata where the cards come from
// three different components, and that it stays silent where there is nothing to
// count.
//
// THE MUTATIONS: make the counter write nothing and the first two tests fail on
// "1 · Updates" and "1 · All sources"; drop the one-card rule (number whenever
// there is a card) and the third fails on "1 · Duplicate works".
//
// The Theme section draws a single card (its rows are ruled, not boxed), so it
// is no longer a place a count can be seen; Server and Sources hold two each.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('Settings counts its cards in order', async () => {
  await app.goto('/settings/server')
  await app.see('1 · Updates')
  await app.see('2 · System logs')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('Metadata counts its cards the same way', async () => {
  await app.goto('/metadata/sources')
  await app.see('1 · All sources')
  await app.see('2 · Multi-author credits')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('a card alone on its screen has no number', async () => {
  await app.goto('/metadata/works')
  await app.see('Duplicate works')
  await app.gone('1 · Duplicate works')
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
