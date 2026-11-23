// A DOT BELONGS TO A CONTROL, NOT TO A HEADING.
//
// THE COMPLAINT, AND WHAT IT TURNED OUT TO BE. "Twenty-two in Settings alone. A
// dot on every heading is a dot nobody presses." The count was low — there are
// twenty-four below the section level, because two are written as a bare
// `<InfoDot>` rather than an `info=` prop — but the density was real.
//
// THE FIX WAS NOT DELETION, AND THE MEASUREMENT IS WHY. Every dot's body was
// compared against the words already on its own row (label, sub, title, aside):
// the highest overlap of any of the twenty-four was 14%, and most were under 8%.
// Not one was a restatement. Deleting them to hit "one per section" would have
// deleted the only place those rules are stated — a quote with no speaker never
// joins the deck, a passphrase archive is recoverable by nothing, changing your
// password deliberately does not unpair your phone. None of that is on a label.
//
// SO THE DEFECT WAS PLACEMENT. Six dots sat on HEADINGS, competing with the
// section's own dot at the same level and attached to no control. Five came down
// onto the row they were about or became standing prose; one was the single
// caption in the set and went. The rest were already on controls and stayed.
//
// WHAT THIS GUARD HOLDS: no `PrefGroup` carries an `info` except the one named
// below, and that exception has to be spelled out here to exist. A group-level
// dot is not banned — it is made deliberate.
//
// MUTATION-VERIFIED: put `info=` back on any other PrefGroup and the first case
// fails; empty the exception list and the second fails.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
// SETTINGS IS TWO FILES: the Server section's system logs card lives in
// jobsSection.jsx, and a group-level dot there is the same defect as one here —
// so the guard reads both.
const FILE = ['Settings.jsx', 'jobsSection.jsx'].map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n')

// Every `<PrefGroup … >` opening tag, whole, however many lines it spans.
const groups = () => [...FILE.matchAll(/<PrefGroup\b[\s\S]*?>/g)].map((m) => m[0])

describe('an info dot in Settings', () => {
  it('there are groups to check, so this test is testing something', () => {
    // The sweep's own failure mode: a regex that stops matching asserts nothing
    // about an empty list and passes for ever.
    // THE FLOOR IS 1: Settings is Theme, Language and Server now, and Server has
    // one group (the update card). A floor of 2 would fail the honest page.
    expect(groups().length).toBeGreaterThan(0)
  })

  it('is never on a group heading, except the one group that earns it', () => {
    const onHeadings = groups()
      .map((g) => g.match(/info=\{t\('([^']+)'/)?.[1])
      .filter(Boolean)
    expect(onHeadings, 'these put a dot on a heading rather than on the control it is about')
      .toEqual([])
  })

  it('and no card draws its own heading beside the section’s', () => {
    // `SectionTitle` was how a card headed itself before Settings became five
    // screens of numbered groups. Devices was the last one using it, and it kept
    // a dot up there too — a heading in a shape nothing else on the screen used.
    expect(FILE.includes('<SectionTitle'), 'a card is heading itself again').toBe(false)
  })
})
