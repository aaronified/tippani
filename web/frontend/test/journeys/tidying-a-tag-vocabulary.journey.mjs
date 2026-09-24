// A reader finds the two tags that are one tag, and folds them together.
//
// WHY THIS EXISTS. A tag vocabulary grows by being TYPED, so it grows duplicates:
// "Solitude" and "Solitide", the same word with a plural, the same idea under two
// phrasings. The console listed them alphabetically and said nothing — adjacent,
// identical-looking, and a reader was left to notice. Worse, the only verb for the
// one they did not want was DELETE, which throws away which quotes carried it: a
// reader tidying up had to choose between two names for one idea and losing the
// tagging underneath the loser.
//
// SO THERE ARE THREE CLAIMS HERE, and each is a different way this could be wrong:
//   - THE SCREEN SAYS SO. The pair is named as a duplicate before anything is
//     pressed — a finding a reader has to go looking for is a finding they will
//     not find.
//   - THE MERGE HAPPENS. The loser leaves the vocabulary.
//   - AND NOTHING LOSES ITS TAGGING. The survivor comes out carrying every quote
//     either name carried, counted once. This is the half a "the tag is gone"
//     assertion would pass while the app quietly dropped three quotes' tags.
//
// THE FIXTURE CARRIES THE DEFECT ON PURPOSE. `library.json` has the pair, and one
// annotation tagged with BOTH of them — the row that makes the obvious
// implementation (`UPDATE … SET tag_id`) collide on a PRIMARY KEY and abort. A
// fixture without that quote cannot tell a correct merge from a lucky one; the Go
// tier asserts the same collision against the database.
//
// THE MUTATION: have the confirm's Merge send no drop_ids and the count assertion
// fails — the vocabulary keeps both names. Drop the `dupIds` prop from the table
// and the first assertion fails while the merge still works, which is the pair
// this file exists to tell apart.
//
// It knows only the words on the screen — no route, no component, no class.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader is shown the tag that is a duplicate, and merges it away', async () => {
  await app.goto('/metadata')
  await app.press('Categories')

  // THE FINDING, BEFORE ANY PRESS. Not the tag names — those are on screen either
  // way, because a list of tags lists them. What is new is the console saying
  // these two are ONE tag.
  await app.see('looks like a duplicate')
  await app.see('Keep which one?')

  // THE CHOICE IS THE READER'S, and the counts are why: neither "the commoner
  // one" nor "the shorter name" decides it often enough. Keeping the correctly
  // spelled one is what a person would do.
  await app.press('Keep Solitude and merge the rest into it — 1 quote')
  await app.press('Merge')

  // THE LOSER IS GONE FROM THE VOCABULARY, and the finding with it: one duplicate
  // resolved is no duplicates left in this fixture, so the whole card goes.
  await app.gone('Solitide')
  await app.gone('looks like a duplicate')

  // AND THE SURVIVOR CARRIES BOTH QUOTES. One annotation had only the misspelling,
  // one had both; the survivor comes out with two, not one and not three. This is
  // the assertion a merge that dropped the colliding row would fail, and it is the
  // reason the fixture has that row.
  await app.see("Solitude · 2")

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
