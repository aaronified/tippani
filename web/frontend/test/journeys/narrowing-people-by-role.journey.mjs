// A reader narrows the People list to one role from its dropdown.
//
// THE ASK: "use similar ways. defects will be filtered via chips, type will be via
// dropdown." Works filters its media type with a dropdown and Characters its work;
// People filtered its roles with a row of chips beside its defect chips, so the
// one console had two rows of chips that meant two different things. The role is
// a dropdown now, at every width.
//
// THE MUTATION: make the dropdown's onChange do nothing and the author stays on
// the list, so `gone('Rhoda Thurlow')` fails.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader narrows People to the actors', async () => {
  await app.goto('/metadata/people')
  // An author and an actor, both on the list to begin with.
  await app.see('Rhoda Thurlow')
  await app.see('Ysolde Quainton')

  await app.choose('Roles', 'Actors')

  await app.see('Ysolde Quainton')
  await app.gone('Rhoda Thurlow')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
