// An owner on a phone opens Metadata › Sources, and the card's one verb, Test all,
// sits on the same row as the card's title.
//
// WHAT WENT WRONG, and the owner photographed it (30 September): the head carried
// the title, a caption ("records supplied"), the count of suppliers needing a key
// and "Test every source", and at 390 the button wrapped onto a row of its own
// above the list. "The button on top of the 'who the app can ask' should be 'test
// all', and in the same row as the card header. 'Records supplied' text callout
// has no need to be there."
//
// WHY A JOURNEY. Whether two things share a row is what the layout does at a
// width, and nothing in the source is wrong to read.
//
// DECLARED EXCEPTION: `app.page` MEASURES where the title and the button sit,
// finding the title by its words and the button by its name, because no word of
// the vocabulary says whether two things are on one row.
//
// THE MUTATIONS, each run and put back (MetadataSources.jsx):
//   - the caption put back as the head's `aside`: red, "records supplied" is
//     still there;
//   - the issues line put back inside the head: red, "Test all (119–163) is not on
//     the title's row (94–111)".

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

it('on a phone the sources card keeps Test all on its title row', async () => {
  await app.goto('/metadata/sources')
  await app.see('Who the app can ask')
  await app.gone('records supplied')

  const at = await app.page.evaluate(() => {
    // The innermost element carrying the title's words: the one with the fewest
    // characters around them.
    const title = [...document.querySelectorAll('body *')]
      .filter((e) => e.textContent.toLowerCase().includes('who the app can ask'))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0]
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Test all')
    const box = (el) => el && el.getBoundingClientRect().toJSON()
    return { title: box(title), button: box(button) }
  })
  expect(at.title, 'no title on the card').toBeTruthy()
  expect(at.button, 'no Test all on the card').toBeTruthy()
  expect(at.button.top < at.title.bottom && at.title.top < at.button.bottom,
    `Test all (${Math.round(at.button.top)}–${Math.round(at.button.bottom)}) is not on the title's row (${Math.round(at.title.top)}–${Math.round(at.title.bottom)})`).toBe(true)
  expect(await app.sideways()).toBe(0)
})
