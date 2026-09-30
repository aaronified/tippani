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
// THE MUTATIONS, each built and run and put back:
//   - `arriveIssue={peopleIssue}` taken off the page's PeopleConsole
//     (MetadataPage.jsx): red, "People › in no work says 3 on the index: expected
//     69 to be 3";
//   - the "no actor" line taken out of SpeakerRemap: red, "no actor yet" never
//     appears;
//   - the characters' duplicate list taken out of CharactersConsole: red,
//     "Possible duplicates" never appears.

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
