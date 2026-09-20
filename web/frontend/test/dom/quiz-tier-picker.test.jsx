// The difficulty picker, driven the way a reader meets it.
//
// WHY A RENDER TEST AND NOT A SOURCE SCAN. The commit before this one added
// `schedule-default-rule.test.jsx` for exactly this shape of risk — a preference
// whose control is wired to the wrong value shows a correct server and a wrong
// screen — and then the picker shipped with no test at all. Three things are
// invisible to a grep and to every Go test in the repo: whether four buttons are
// drawn, whether pressing one sends the tier the server understands, and whether
// the note that says what Easy COSTS appears on Easy and nowhere else.
//
// The last of those is not decoration. Little, Bjork, Bjork & Angello (2012) is
// why Easy is a lower floor rather than a better question, and a control that
// advertised only its benefit would be selling the reader something.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let SENT
let PREFS

// A plain function, not vi.fn: setup-dom.js restores all mocks between tests,
// which wipes a module-scope implementation from the second test onwards.
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path.startsWith('/auth/me/preferences')) return { ok: true, data: {} }
    return { ok: true, data: {} }
  },
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { REVIEW_TIERS } = await import('../../src/quiz.js')

beforeEach(() => {
  SENT = []
  PREFS = {}
})
afterEach(() => cleanup())

const mount = async (preferences = {}) => {
  PREFS = preferences
  render(
    <Settings
      user={{ id: 1, username: 'alice', is_admin: true, preferences }}
      onPreferences={() => {}}
      onClose={() => {}}
    />,
  )
  await act(async () => {})
  await openSettingsSection('Review')
  // THE PICKER IS ON THE SCREEN NOW, and opening a fold to reach it is what this
  // helper used to do. "How hard the questions are" was the first block inside
  // "In-depth controls", a door that existed because Settings was one long scroll
  // — and it is the control a reader reaches for the moment the deck feels wrong
  // in either direction. The owner's mantra: "Whatever will be used more needs to
  // be up front." What is left behind the door is the schedule's arithmetic.
}

// The four options the toggle draws, found by the label each one shows rather
// than by a test-only hook. Toggle renders a tablist of role="tab", not buttons —
// looked up the way an assistive reader would find them.
const tierButtons = () =>
  REVIEW_TIERS.map((k) => screen.queryAllByRole('tab', { name: new RegExp(`^${labelOf(k)}$`, 'i') })[0])

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', random: 'Random' }
const labelOf = (k) => LABELS[k]

const easyCost = () => screen.queryByText(/the cost is the close wrong answers/i)

// THE LINE UNDER THE PICKER, whichever tier is chosen. Found by a phrase only
// that tier's sentence contains, so a screen that printed one line for all four
// cannot pass.
const TIER_LINE = {
  easy: /two choices instead of four/i,
  medium: /four choices with close ones among them/i,
  hard: /leans on typing the words back/i,
  random: /a different tier on every card/i,
}

describe('the difficulty picker', () => {
  it('draws one button per tier the server knows', async () => {
    await mount()
    const got = tierButtons()
    expect(REVIEW_TIERS.length).toBe(4)
    got.forEach((b, i) => {
      expect(b, `no button for the ${REVIEW_TIERS[i]} tier`).toBeTruthy()
    })
  })

  // THE VALUE ON THE WIRE IS THE ONE GO NORMALISES. A picker that sent a label,
  // or a capitalised key, would be silently corrected to medium by loadPrefs —
  // a control that moves and then does nothing, which is the failure the ladder
  // parity guard exists for one layer down.
  it('and sends the key the server understands, not the label', async () => {
    await mount()
    await act(async () => { fireEvent.click(tierButtons()[REVIEW_TIERS.indexOf('hard')]) })
    const put = SENT.filter((s) => s.path.startsWith('/auth/me/preferences')).pop()
    expect(put, 'pressing a tier sent no preferences PUT at all').toBeTruthy()
    expect(put.body.srTier).toBe('hard')
  })

  // MEDIUM IS THE DEFAULT AND THE PICKER HAS TO SHOW IT. An account that has
  // never opened this panel stores nothing; a control that read "" as no
  // selection would leave the reader unable to tell which tier they were on.
  it('and shows medium for an account that has never chosen', async () => {
    await mount({})
    const got = tierButtons()
    const selected = got.filter((b) => b.getAttribute('aria-selected') === 'true')
    expect(selected.length, 'exactly one tier should read as chosen').toBe(1)
    expect(selected[0], 'an account that stored nothing is not shown as being on medium')
      .toBe(got[REVIEW_TIERS.indexOf('medium')])
  })

  // FOUR ADJECTIVES ARE NOT AN EXPLANATION. The owner's ask: the toggle says
  // Easy / Medium / Hard / Random, and a reader on Hard could read the whole row
  // without learning that it means typing. One line, under whichever is chosen —
  // the info dot describes all four, this describes the one in force.
  it('says what the chosen tier actually does, for every tier', async () => {
    for (const k of REVIEW_TIERS) {
      await mount({ srTier: k })
      expect(screen.queryByText(TIER_LINE[k]), `${k} is offered without saying what it does`).toBeTruthy()
      // AND ONLY ITS OWN LINE. A screen that printed all four would "pass" the
      // check above on every tier and tell the reader nothing.
      for (const other of REVIEW_TIERS) {
        if (other === k) continue
        expect(screen.queryByText(TIER_LINE[other]), `${k} also shows ${other}'s line`).toBeNull()
      }
      cleanup()
    }
  })

  it("and Easy's line names what it gives up, not only what it gives", async () => {
    await mount({ srTier: 'medium' })
    expect(easyCost(), 'the Easy caveat is shown to a reader who is not on Easy').toBeNull()
    cleanup()
    await mount({ srTier: 'easy' })
    expect(easyCost(), 'Easy is offered without saying what it gives up').toBeTruthy()
  })
})
