// A reader looks at their characters, sees who played one, and goes to that person.
//
// WHAT THIS GUARDS. The character row carries its medium and its performers as
// pills, which is the owner's own spec — "medium and performers (full list of chip
// with clickable pills, edgemasked)". Two Go tests hold the shape of the JSON and a
// jsdom test holds the row rendered under a mocked network. None of them runs the
// app: the pill is a door only if the server's id, the row's handler and the
// panel's own fetch all agree, and this is the one tier where all three are real.
//
// WHAT IT DOES NOT CATCH, MEASURED RATHER THAN ASSUMED. A rating pass suggested a
// journey would have caught the merge key that lost the work's KIND — folding book
// 1 into movie 1, since the two tables number themselves independently. It would
// not: this fixture's character is in ONE work, so the collision never arises, and
// the key mutation was run against this file and it stayed green. An id collision
// needs a character standing on a book AND a film whose ids are equal, which is a
// fixture the API can build in a line and the UI cannot. That case is
// `TestACharacterInANovelAndItsFilmIsTwoAppearances`. Tiers answer different
// questions, and saying which is the point of having four.
//
// THE MUTATION. Delete `press('Ines Brightwater')` and it goes red on the person
// screen's own sentence.
//
// THE FIRST VERSION OF THIS FILE ASSERTED THE WORK'S TITLE AND PASSED WITH THE
// PRESS DELETED, which is the exact failure this directory's rule is named after.
// The character row already carries that work as a pill, so `see('Shingle bene')`
// was true of the list the journey had not left. What is on the PERSON's screen
// and nowhere on the row is the record's own field labels — a character row has no
// "Sorts as", because a character does not file under a sort name.
//
// It knows the words on the screen and nothing else — no route, no component, no
// field name.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader presses the performer on a character row and lands on that person', async () => {
  await app.goto('/')

  await app.press('Metadata')
  await app.press('Characters')

  // NARROWED TO ONE ROW FIRST, and not for tidiness. A library's cast repeats: a
  // performer plays several characters, so their name is on several rows, and
  // `press` REFUSES an ambiguous name rather than guessing which one the markup
  // happened to put first. That refusal is the harness working — so the journey
  // does what a reader does when they want one record, and searches for it.
  await app.type('Search characters in this library', 'Zeno Vallence')

  // THE ROW NAMES WHO PLAYED THEM, read off the APPEARANCE rather than off the
  // character's own record — which is the whole of what the pills are.
  await app.see('Zeno Vallence-Pellworth')
  await app.see('Ines Brightwater')

  // AND THE PILL IS A DOOR, which is the reason the appearance carries an id
  // beside the name. A chip that looks pressable and is not is the failure this
  // repo has a rule about.
  await app.press('Ines Brightwater')
  // THE PERSON'S OWN SCREEN, named by something only a person record has. The work
  // is on this screen too — but it is on the row behind it as well, so it cannot
  // tell the two apart.
  await app.see('Reaches every work')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
