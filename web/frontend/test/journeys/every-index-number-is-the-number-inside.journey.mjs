// A reader on a phone opens Metadata, and every number on its index is the number
// the screen behind it prints.
//
// WHAT WENT WRONG, and the owner photographed it (30 September): "The works > no
// source shows 3 on the index card, but inside it shows 0." A sweep over every pill
// found four ways a number disagreed with its door: a gap films, shows and games
// share was counted over all three and opened on films alone; "people with no
// portrait or link" was a union that no People filter draws, so it opened on
// everybody; "no actor" opened on Characters, where no screen said how many lines
// had none; and "characters who may be the same character" opened on a list that
// drew no pairs at all.
//
// SO THIS PRESSES EVERY PILL, not a sample: each pill is read off the index with
// its number, pressed, and held to that number where it lands. A new pill joins the
// run by being drawn, and a pill whose landing prints no number fails by name.
//
// WHERE IT LANDS says the number in one of three ways, each the words a reader
// reads there: a console's "N works shown" (or people, or characters) under a
// filter; the speaker remap's "N lines have no actor yet"; a duplicates list's
// "Possible duplicates (N)".
//
// It knows the words on the screen and nothing else: the three sections' names,
// which are the doors the pills sit under, and the two verbs that sit among them.
//
// AGAINST THE CODE BEFORE THIS FIX it is red at the first mismatch it meets:
// "Works › no cast says 1 on the index: expected +0 to be 1", the owner's report in
// another gap.
//
// TWO MORE CASES, both from a rating. The sheet the dock opens ("Everything that
// needs work") printed People's "no quotes" and Characters' "no quotes" as two
// identical rows opening two consoles, so each row now sits under its section's
// name, and the case reads which name each "no quotes" sits under and presses each
// to see that name is the console it opens. And a pill's filter outlived its
// console: pill, Back, then the section's own door landed on the pill's three
// people rather than on all of them, and the Works door on the pill's works.
//
// The last case presses Merge on the Characters console's duplicate card, which
// this fix put there with the People console's card: the count above the cards is
// one pair fewer afterwards. It runs last because it changes the library.
//
// THE MUTATIONS, each built and run and put back:
//   - `arriveIssue={peopleIssue}` taken off the page's PeopleConsole
//     (MetadataPage.jsx): red, "People › in no work says 3 on the index: expected
//     69 to be 3";
//   - the "no actor" line taken out of SpeakerRemap: red, "no actor yet" never
//     appears;
//   - the characters' duplicate list taken out of CharactersConsole: red,
//     "Possible duplicates" never appears.
//   - the section heading taken out of the sheet's groups: red, "no section
//     name above the rows";
//   - the door's reset taken out (`onChange={setSection}` back on the rail): red,
//     "the People door opened on the pill's filter";
//   - the Works line taken out of `openDoor`: red, "\"Works\" opened on the \"no
//     cast\" pill's filter: expected 1 to be 41"; and `enter` going straight to
//     `setSection` again: red, "\"Scan for duplicate works\" opened on the \"no
//     cast\" pill's filter";
//   - the sheet's groups printing People's rows under CHARACTERS and the other way
//     round: red, "the \"no quotes 30\" row under characters opened: expected
//     'people' to be 'characters'".
//   - the Characters card's `endpoint="/characters/merge"` taken off (so it posts to
//     the People merge): red, the pair is still there.

import { expect, it } from 'vitest'

import { PHONE, openApp } from './harness/world.mjs'

const app = openApp({ viewport: PHONE })

const SECTIONS = ['Works', 'People', 'Characters']
const VERBS = ['Scan for duplicate works', 'Fetch missing', 'Prune']

// The index as a reader reads it: under each section's name and its count, the
// pills, each its words on one line and its number on the next, until a verb or
// the next section.
async function indexPills() {
  const lines = (await app.onScreen()).split('\n').map((l) => l.trim()).filter(Boolean)
  const pills = []
  for (const section of SECTIONS) {
    let i = lines.indexOf(section)
    expect(i, `the index has no ${section} door`).toBeGreaterThanOrEqual(0)
    i += 2 // the name, then its count
    while (i + 1 < lines.length && !SECTIONS.includes(lines[i]) && !VERBS.some((v) => lines[i].startsWith(v)) && /^\d+$/.test(lines[i + 1])) {
      pills.push({ section, label: lines[i], n: Number(lines[i + 1]) })
      i += 2
    }
  }
  return pills
}

// The number the landing prints for this pill, read off the screen.
async function landedCount(label) {
  const seen = await app.onScreen()
  // Which words to read follows the pill: the console's own count sits on the
  // same screen as the other two, and is not what they promised.
  const says = seen.match(
    label === 'no actor' ? /(\d+)\s+lines?\s+ha(?:s|ve)\s+no\s+actor/i
      : / may be the same /.test(label) ? /Possible duplicates \((\d+)\)/i
        : /(\d+)\s+(?:works?|people|persons?|characters?)\s+shown/i,
  )
  expect(says, `pressing "${label}" landed on a screen that prints no number for it`).toBeTruthy()
  return Number(says[1])
}

it('every pill on the phone Metadata index opens on the number it carries', async () => {
  await app.goto('/metadata')
  await app.see('Fetch missing')
  const pills = await indexPills()
  // The golden library has gaps under every door; an index that drew none would
  // make every step below a pass over nothing.
  for (const s of SECTIONS) expect(pills.some((p) => p.section === s), `${s} carries no pills`).toBe(true)

  for (const { section, label, n } of pills) {
    await app.goto('/metadata')
    await app.see('Fetch missing')
    await app.press(`${label} ${n}`)
    // The count line and the duplicate head wait on the console's own fetch.
    await app.see(label === 'no actor' ? 'no actor yet' : / may be the same /.test(label) ? 'Possible duplicates' : 'shown')
    expect(await landedCount(label), `${section} › ${label} says ${n} on the index`).toBe(n)
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

// The sheet as a reader reads it: under each section's name, its rows, each its
// words on one line and its number on the next.
async function sheetRows() {
  await app.goto('/metadata')
  await app.see('Fetch missing')
  await app.press('Everything that needs work')
  await app.see('Everything that needs work')
  // The sheet is drawn after the page, so its words are the ones after its title.
  const lines = (await app.onScreen()).split('\n').map((l) => l.trim()).filter(Boolean)
  const sheet = lines.slice(lines.map((l) => l.toLowerCase()).lastIndexOf('everything that needs work') + 1)
  const rows = []
  let heading = null
  for (let i = 0; i < sheet.length; i++) {
    if (SECTIONS.some((s) => s.toLowerCase() === sheet[i].toLowerCase())) heading = sheet[i].toLowerCase()
    else if (/^\d+$/.test(sheet[i + 1] || '')) { rows.push({ heading, label: sheet[i], n: Number(sheet[i + 1]) }); i++ }
  }
  return rows
}

it('the sheet of everything that needs work names the section each row opens', async () => {
  const quiet = (await sheetRows()).filter((r) => r.label === 'no quotes')
  expect(quiet.length, 'no "no quotes" rows in the sheet').toBeGreaterThan(0)
  expect(quiet.every((r) => r.heading), 'no section name above the rows').toBe(true)
  // The golden library has characters and people with no quotes; each pair of
  // same-worded rows sits under two different names.
  expect(quiet.map((r) => r.heading).sort(), 'the sections the "no quotes" rows sit under').toEqual(['characters', 'people'])
  // AND EACH NAME IS THE CONSOLE ITS ROWS OPEN: the row under PEOPLE lands on
  // people, the one under CHARACTERS on characters, each on its own number.
  for (const { heading, n } of quiet) {
    await sheetRows()
    await app.press(`no quotes ${n}`)
    await app.see('shown')
    const landed = (await app.onScreen()).match(/(\d+)\s+(people|persons?|characters?)\s+shown/i)
    expect(landed, `the "no quotes" row under ${heading} landed on no people or characters`).toBeTruthy()
    expect(/^character/i.test(landed[2]) ? 'characters' : 'people', `the "no quotes ${n}" row under ${heading} opened`).toBe(heading)
    expect(Number(landed[1]), `the "no quotes" row under ${heading} says ${n}`).toBe(n)
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it("a section's own door opens on everything, after a pill opened it on one issue", async () => {
  // What the door shows on a fresh arrival, before any pill has been pressed.
  await app.goto('/metadata')
  await app.see('Fetch missing')
  await app.press('People')
  await app.see('shown')
  const everyone = await landedCount('People')

  await app.goto('/metadata')
  await app.see('Fetch missing')
  const pill = (await indexPills()).find((p) => p.section === 'People' && p.label === 'in no work')
  expect(pill, 'the golden library has people in no work').toBeTruthy()
  expect(pill.n, 'a pill that shows everyone cannot tell a filtered door from an open one').not.toBe(everyone)
  await app.press(`${pill.label} ${pill.n}`)
  await app.see('shown')
  expect(await landedCount(pill.label)).toBe(pill.n)
  // By the dock's Back key, so the app stays mounted and the pill's filter is
  // still there to be wrongly re-used (see scanning-from-the-metadata-home).
  await app.press('Back')
  await app.see('Fetch missing')
  await app.press('People')
  await app.see('shown')
  expect(await landedCount('People'), "the People door opened on the pill's filter").toBe(everyone)

  // WORKS TOO, whose type and filter are the page's for the same reason, and
  // through the index verb as well as the door: "Scan for duplicate works" walks
  // in through the same door.
  await app.goto('/metadata')
  await app.see('Fetch missing')
  await app.press('Works')
  await app.see('shown')
  const works = await landedCount('Works')
  for (const via of ['Works', 'Scan for duplicate works']) {
    await app.goto('/metadata')
    await app.see('Fetch missing')
    const w = (await indexPills()).find((p) => p.section === 'Works' && p.n !== works)
    expect(w, 'the golden library has a Works pill narrower than the door').toBeTruthy()
    await app.press(`${w.label} ${w.n}`)
    await app.see('shown')
    expect(await landedCount(w.label)).toBe(w.n)
    await app.press('Back')
    await app.see('Fetch missing')
    await app.press(via)
    await app.see('shown')
    expect(await landedCount('Works'), `"${via}" opened on the "${w.label}" pill's filter`).toBe(works)
  }
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})

it('a pair of characters who may be one is merged from the Characters console', async () => {
  await app.goto('/metadata')
  await app.see('Fetch missing')
  const pill = (await indexPills()).find((p) => p.section === 'Characters' && / may be the same /.test(p.label))
  expect(pill, 'the golden library has characters who may be one').toBeTruthy()
  await app.press(`${pill.label} ${pill.n}`)
  await app.see('Possible duplicates')
  const pairs = async () => Number((await app.onScreen()).match(/Possible duplicates \((\d+)\)/i)?.[1] || 0)
  const before = await pairs()
  expect(before, 'the golden library has characters who may be one').toBeGreaterThan(0)
  const merge = (await app.onScreen()).split('\n').map((l) => l.trim()).find((l) => /^merge into /i.test(l))
  await app.press(merge)
  await expect.poll(pairs, { timeout: 15_000, message: 'the pairs left after one merge' }).toBe(before - 1)
  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
