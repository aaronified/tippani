// THE CALENDAR'S MONTH LABELS ARE WORDS THE TRANSLATOR WROTE, NEVER A CUT.
//
// THE RULE, from `StatsPage.jsx`'s own header: the axis used to slice the full
// month name to three characters, "which is three UTF-16 code units and therefore
// an English-only idea: Bengali এপ্রিল cut at three lands mid-conjunct on a dangling
// hasant (এপ্), and অক্টোবর gives অক্. Any language with combining marks breaks the
// same way, and no translator could fix it from the locale file."
//
// WHY THIS IS A RENDER AND NOT A GREP. `test/pure/translated-not-sliced.test.js`
// asserted the rule as `expect(stats).toContain('MONTH_KEYS')` — which the file's
// own COMMENT about MONTH_KEYS satisfies, so the guard would survive the import
// being deleted. The repo's audit lists it (§2.2) and the owner's standard settles
// it: a test writer should be checking the feature, not the fix.
//
// WHAT THE FEATURE IS, stated so it can be checked without reading the source: a
// month label on the activity calendar is one of the twelve month names the app
// itself uses everywhere else — the date picker's — and it is that name whole.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above.
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MONTH_KEYS } from '../../src/ui.jsx'
import { applyLocale, ensureBuiltins, t } from '../../src/i18n.js'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { ActivityCard } = await import('../../src/StatsPage.jsx')

// A whole year, so every month gets a chance at a label.
const YEAR = Array.from({ length: 365 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 0, 1 + i))
  return { day: d.toISOString().slice(0, 10), count: 1, correct: 1 }
})

// IN BENGALI, BECAUSE IN ENGLISH THE BUG IS INVISIBLE. `Jan` is what both the
// shared table and a three-character cut produce, so an English render cannot tell
// the fixed code from the broken code — this suite passed unchanged with the slice
// put back, which is the same failure the grep it replaces had. The whole point of
// the rule is a language whose names do not survive being cut, so the test speaks
// one.
// Bengali is lazy-loaded — `ensureBuiltins` is what pulls bn.txt in, exactly as
// the app does on a language change — so the switch has to be awaited or the
// render silently stays English and the suite proves nothing. It did, for one
// draft: the slice put back passed all three cases.
beforeEach(async () => { await ensureBuiltins(); applyLocale('bn') })
afterEach(() => { applyLocale('en'); cleanup() })

const labels = () => {
  render(
    <ActivityCard
      saves={YEAR}
      quiz={YEAR}
      practice={YEAR}
      onSearch={() => {}}
      onResetPractice={() => {}}
    />,
  )
  // The axis labels are the only text on the calendar's own header row; take
  // every short text node in the card and keep the ones that name a month.
  return [...document.querySelectorAll('*')]
    .filter((el) => el.children.length === 0)
    .map((el) => el.textContent.trim())
    .filter(Boolean)
}

describe('the activity calendar’s month axis', () => {
  const NAMES = () => MONTH_KEYS.map((k) => t(k))

  it('names months at all, so this test is testing something', () => {
    const names = NAMES()
    const shown = labels().filter((s) => names.includes(s))
    expect(shown.length, 'the calendar drew no month labels — nothing to check').toBeGreaterThan(3)
  })

  it('prints each one whole, never a cut of it', () => {
    // A CUT IS A PROPER PREFIX OF A NAME THAT IS NOT ITSELF A NAME. That catches
    // `.slice(0,3)` in any language and stays true when the names are Bengali,
    // where the damage is invisible to anyone reading the English build.
    const names = NAMES()
    const cuts = labels().filter((s) =>
      !names.includes(s)
      && names.some((n) => n.length > s.length && n.startsWith(s)))
    expect(cuts, 'these month labels are cuts of a month name').toEqual([])
  })

  it('and takes them from the same table the date picker uses', () => {
    // The axis and the picker disagreeing about what April is called is the other
    // half of why the table is shared.
    const names = NAMES()
    const monthish = labels().filter((s) => names.some((n) => n.startsWith(s) || s.startsWith(n)))
    for (const s of monthish) {
      expect(names, `"${s}" is not one of the app's month names`).toContain(s)
    }
  })
})
