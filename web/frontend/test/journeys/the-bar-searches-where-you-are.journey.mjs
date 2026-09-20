// A reader standing in Settings types into the search field and Settings narrows.
// They do not leave.
//
// THE ASK, IN THE OWNER'S WORDS: "the searchbar should say the context it will
// search on. in metadata, it will search in metadata, in settings it will search
// within settings as well. it should behave like an omnibar." And, asked which way
// round it should go: screen first, library on demand, on every screen, with the
// context spelled out in the helper text as well as worn as a pill.
//
// WHAT IT DID BEFORE. One field, and one meaning wherever you stood: type, press
// Enter, leave for the search screen. `searchScope` mapped four screens onto three
// library scopes and answered "everything" for all the rest — so on Settings a field
// labelled Search was a field that would take you somewhere else. Nothing was
// broken; it was simply not about the screen it was sitting on.
//
// THREE CLAIMS, AND EACH IS A DIFFERENT WAY THIS COULD BE WRONG:
//   - THE FIELD SAYS WHERE IT IS. The words are in the field itself, not only in a
//     pill, because that is what the owner asked for twice.
//   - IT NARROWS AS YOU TYPE, AND ON THIS SCREEN. The Backup card is admin-only and
//     always present for this reader; "backup" must leave it standing and take
//     Appearance away. Asserting BOTH matters: a filter that hid nothing would pass
//     on the first half alone.
//   - AND THE READER IS STILL IN SETTINGS. A bar that navigated on Enter would also
//     show the right word for a moment first.
//
// THE MUTATION: make `settingsMatches` return true for everything and the `gone` of
// Theme fails, because nothing was filtered. Drop the `useScreenSearch` call and the
// field never says Settings, so the first `see` fails.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

it('a reader searches Settings from the top bar and stays in Settings', async () => {
  await app.goto('/settings')

  // THE CONTEXT, IN WORDS, AND NAMED THE WAY A READER WOULD NAME IT. `type` finds a
  // field by the name Chrome computes for it, which is the name a screen reader
  // announces — "Search settings". It is deliberately NOT the placeholder: the
  // placeholder is the invitation ("type to narrow what is on screen") and a field
  // whose NAME is its invitation tells a screen reader user what to do and never
  // what they are doing it to. An earlier cut of this journey typed into the
  // placeholder and passed, because the field's name was wrongly the same string.
  await app.see('Theme')
  await app.type('Search settings', 'backup')

  // NARROWED, AND IT IS THIS SCREEN THAT NARROWED.
  //
  // THE WORD "BACKUP" IS NOT THE ASSERTION, and for a while it was. When nothing
  // matches, Settings says so in a sentence that QUOTES what was typed — "Nothing
  // in Settings matches “backup”" — and `see` folds case, so a screen that found
  // the card and a screen that found nothing both contain the word. This passed
  // with the Backup card's own search prefix deleted. What only the card itself
  // shows is the control on it.
  await app.see('Back up now')
  // Appearance is gone with the rest: its words are not about backups.
  await app.gone('Theme')

  // AND NOBODY WENT ANYWHERE. Settings draws the signed-in account beside its own
  // title and no other screen does, so this is the assertion that the press did not
  // land somewhere else — not a second reading of the card above, which would be
  // true on any screen that happened to hold the word.
  await app.see('journey-reader')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// THE OTHER SCREEN THE OWNER NAMED, and it is a different claim from the one above.
// Settings had NO search of its own, so the bar had to bring one. The metadata
// console already had a box, and the risk there is the opposite: two fields over one
// list, drifting, so that narrowing from the bar and narrowing from the box disagree
// about what is on screen. They are one piece of state, and this is how that is
// visible — type into the bar, and the console's own box is holding what you typed.
//
// THE MUTATION: give `useScreenSearch` its own setter instead of the console's and
// the `valueOf` fails, because the box never hears about it.
it('the bar and the metadata console are one field, not two', async () => {
  await app.goto('/metadata')
  // THE SECTION IS THE CONTEXT, which is what "search where you are" means on a
  // screen built out of consoles: the overview has no list to narrow, so the bar
  // correctly offers the library there, and Works is where the question has an
  // answer. A reader gets to it the same way.
  await app.press('Works')

  await app.type('Search works and films', 'grimm')

  // The console's own box, which nobody typed into, is holding the word.
  expect(await app.valueOf('search…'), 'the two fields have drifted').toBe('grimm')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// AND WHAT WAS TYPED DOES NOT FOLLOW THE READER OFF THE SCREEN.
//
// A RATING FOUND THIS, and it is the half a "does it narrow?" test cannot see. Type
// into Settings' field and press Home: the pill goes, the field renames itself
// "Search everything" — and the word stayed, so Enter would run a library search over
// a word that was about a screen the reader had left. The clear was on the pill's ×,
// which is one of the two ways out of a context; changing screens is the other.
//
// READ OFF THE FIELD ITSELF, because an empty field puts nothing in the page's text
// and `see` could not tell this from any other empty screen.
//
// THE MUTATION: drop the effect that clears `q` on a context change and this fails
// with 'backup' still in the box.
it('what was typed for one screen does not follow the reader to the next', async () => {
  await app.goto('/settings')
  await app.type('Search settings', 'backup')
  await app.see('Back up now')

  await app.press('Home')

  // The field is the library's again, and it is empty.
  expect(await app.valueOf('Search everything'), 'the word followed the reader').toBe('')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// THE SCOPED SCREENS SAY THEIR CONTEXT IN WORDS TOO, and for a release they did not.
//
// The owner asked for the helper text to spell out the context "along with the pills",
// and the pill was on five screens while the sentence was on two: Library, Catalogue
// and Quotes wore "in Library" and then offered "author, tag, a line you half
// remember…", which is advice about how to type. A rating read it off the line.
//
// AND THE × CARRIES WHAT WAS TYPED. Pressing it having typed something used to land
// the reader on an empty search screen, so the word had to be typed a second time.
// Asking for the whole library is "not here — everywhere", not "forget it".
//
// THE MUTATIONS: name the field "Search what you are looking at" again and the `type`
// cannot find it; drop the query from `onDropScope` and the search never runs, so
// Seneca is not among the results.
it('a scoped screen names its scope in the field, and × takes the word with it', async () => {
  await app.goto('/library')

  // The scope is in the sentence, not only in the pill — which is what `type`
  // finding this field by that name proves.
  await app.type('Search Library', 'seneca')

  // OUT TO THE WHOLE LIBRARY, carrying the word rather than discarding it.
  //
  // ASSERTED ON THE RESULTS AND NOT ON THE BOX, which is the difference between a
  // guard and a decoration. Under the defect the word IS in the box — measured — and
  // the search has simply not run, so a reader sees what they typed and no answer and
  // has to press Enter over it. Reading the box back would pass either way.
  await app.press('Search everything instead')
  await app.see('On the Shortness of Life')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
