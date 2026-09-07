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
  // THE PICKER LIVES BEHIND "In-depth controls", which is collapsed on arrival —
  // the same fold the question repertoire and the tuning sliders sit in. Opened
  // here rather than in each case, because every one of them is about the
  // control and none of them is about the fold.
  const fold = screen.getByText(/in-depth controls/i)
  await act(async () => { fireEvent.click(fold.closest('button') || fold) })
}

// The four options the toggle draws, found by the label each one shows rather
// than by a test-only hook. Toggle renders a tablist of role="tab", not buttons —
// looked up the way an assistive reader would find them.
const tierButtons = () =>
  REVIEW_TIERS.map((k) => screen.queryAllByRole('tab', { name: new RegExp(`^${labelOf(k)}$`, 'i') })[0])

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', random: 'Random' }
const labelOf = (k) => LABELS[k]

const easyNote = () =>
  screen.queryByText(/close wrong answers teach more than obvious ones/i)

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

  it('says what Easy costs, and only on Easy', async () => {
    await mount({ srTier: 'medium' })
    expect(easyNote(), 'the Easy caveat is shown to a reader who is not on Easy').toBeNull()
    cleanup()
    await mount({ srTier: 'easy' })
    expect(easyNote(), 'Easy is offered without saying what it gives up').toBeTruthy()
  })
})
