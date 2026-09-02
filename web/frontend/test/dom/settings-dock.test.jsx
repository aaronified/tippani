// The two ACTS on the Settings page are reachable from a thumb.
//
// Everything else on this page is a preference — you change it where it is drawn,
// and a dock key pointing at a toggle would be a door to a switch. Making an
// archive and installing a release are different: both are verbs, both live in
// admin-only cards six cards down a scroll on a phone.
//
// AND NEITHER KEY SKIPS THE DECISION, which is the half worth guarding. Backup
// still asks for the credential that seals the archive; the update still asks for
// the word UPDATE, typed. A one-tap update on a phone is precisely the accident
// that confirmation exists to prevent.

import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useScreenBarState } from '../../src/ui.jsx'

const AVAILABLE = {
  update_available: true,
  can_self_update: true,
  latest: '1.99.0',
  channel: 'stable',
  channel_explicit: true,
}

let applied = 0
let checks = 0
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/admin/update/check') { checks++; return { ok: true, data: AVAILABLE } }
    if (path === '/admin/update/apply') { applied++; return { ok: true, data: {} } }
    if (path === '/admin/backup') return { ok: true, data: { backup: null } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { id: 1, username: 'aaron', is_admin: true, preferences: {}, version: '1.0.0' }
const READER = { ...ADMIN, is_admin: false }

let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

const asPhone = () => {
  window.matchMedia = (media) => ({
    matches: true, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

const page = (user = ADMIN) => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <>
        <Settings user={user} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />
        <Probe />
      </>,
    )
  } finally {
    quiet.mockRestore()
  }
}
const keys = () => (BAR.keys || []).map((k) => k.id)
const press = (id) => act(() => (BAR.keys || []).find((k) => k.id === id).onClick())

// ── WHO YOU ARE, UNDER THE WORD "SETTINGS".
//
// It was a mono label inside .page-header, whose <h1> is visually hidden on a
// phone — so "admin" became the only thing left in that header and took a whole
// sticky row to say one word. A caption for a title belongs under the title, and
// the shell bar already draws one.
describe('the Settings header on a phone', () => {
  it('publishes the role as the bar’s sub-line', async () => {
    asPhone()
    page()
    await waitFor(() => expect(BAR.sub).toMatch(/admin/i))
  })

  it('says it once, not twice', async () => {
    asPhone()
    page()
    await waitFor(() => expect(BAR.sub).toMatch(/admin/i))
    // Not also in the page header, which is where it used to be — the same fact
    // in two places on one screen is what cost the row.
    expect(document.querySelector('.page-header .mono-label')).toBeNull()
  })

  it('names a reader who is not an admin by their username', async () => {
    asPhone()
    page(READER)
    await waitFor(() => expect(BAR.sub).toBe('aaron'))
  })

  it('leaves the desktop header alone', async () => {
    window.matchMedia = (media) => ({
      matches: false, media, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })
    page()
    // On a desk the <h1> is visible and the label sits beside it, which is the
    // arrangement every other page header has.
    await waitFor(() => expect(document.querySelector('.page-header .mono-label')).toBeTruthy())
    expect(BAR.sub).toBeNull()
  })
})

describe('the Settings dock', () => {
  it('carries the page’s two verbs and nothing else', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toEqual(['backup', 'update']))
  })

  it('offers neither to a reader who is not an admin', async () => {
    asPhone()
    page(READER)
    // Both cards are admin-only; a key to a card that is not on the page would
    // be a door to nothing.
    await waitFor(() => expect(BAR.keys).toBeNull())
  })

  it('opens the backup prompt rather than making one', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toContain('backup'))
    press('backup')
    // The archive is sealed with a credential, and the key does not invent one.
    await waitFor(() => expect(screen.getAllByLabelText(/password/i).length).toBeGreaterThan(0))
  })

  it('checks before it offers, and still asks for the word', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toContain('update'))
    press('update')
    // The check runs on open: a key that showed a stale "nothing to do" would be
    // lying about the one thing it is for.
    // Scoped to the sheet: the card behind it draws the same confirmation off
    // the same state, which is the point — two views of one field cannot
    // disagree — but a bare query would not know which it had found.
    const sheet = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-card')
      expect(el, 'no sheet opened').toBeTruthy()
      return el
    })
    const box = await within(sheet).findByPlaceholderText('UPDATE')
    const start = applied
    // The wrong word does nothing, and says so before it is pressed — the button
    // is dead AND the handler refuses, because either one alone is a guard that
    // a change to the other silently removes.
    fireEvent.change(box, { target: { value: 'update' } })
    expect(within(sheet).getByRole('button', { name: /update/i }).disabled).toBe(true)
    fireEvent.submit(box.closest('form'))
    expect(applied).toBe(start)

    fireEvent.change(box, { target: { value: 'UPDATE' } })
    fireEvent.submit(box.closest('form'))
    await waitFor(() => expect(applied).toBe(start + 1))
  })

  // A RUNNING UPDATE IS NOT A BUTTON. "Pulling the new image — this can take a
  // few minutes…" was the button's LABEL, so a 140px control on a phone was asked
  // to hold a sentence and pushed the row off the screen.
  it('says a running update in prose, not on a control', async () => {
    asPhone()
    page()
    await waitFor(() => expect(keys()).toContain('update'))
    press('update')
    const sheet = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-card')
      expect(el).toBeTruthy()
      return el
    })
    const box = await within(sheet).findByPlaceholderText('UPDATE')
    fireEvent.change(box, { target: { value: 'UPDATE' } })
    fireEvent.submit(box.closest('form'))

    const line = await screen.findAllByText(/pulling the new image/i)
    expect(line.length).toBeGreaterThan(0)
    // Prose, not a control — and the form is gone, because once the pull has
    // started there is nothing on that row left to decide.
    for (const el of line) expect(el.closest('button')).toBeNull()
    // Re-queried: the sheet re-renders, and a node captured before the submit is
    // not the one on screen after it.
    await waitFor(() => {
      const live = document.querySelector('.mobile-sheet-card')
      expect(within(live).queryByPlaceholderText('UPDATE')).toBeNull()
    })
  })
})

// ── THE KEY ASKS, EVERY TIME.
//
// The owner's words: "the settings update shortcut must also always search for
// updates when clicked." It did not. The effect behind it read `if (asking &&
// !info && !busy) check()` — only when nothing had been fetched yet — so the
// first press checked and every press after it opened on whatever that first
// check had said. The card stays mounted for a whole Settings visit and this key
// is reachable from every screen, so the stale answer was the ordinary case: a
// release ships, the reader presses Update now, and is told they are up to date.
describe('the update key always checks', () => {
  it('asks again on a second press rather than answering from the first', async () => {
    asPhone()
    checks = 0
    page()
    await waitFor(() => expect(keys()).toContain('update'))

    press('update')
    await waitFor(() => expect(checks).toBe(1))
    // Close it without applying, the way a reader who saw "up to date" would.
    const sheet1 = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-card')
      expect(el, 'no sheet opened').toBeTruthy()
      return el
    })
    // The key SETS the prompt open rather than toggling it, so a second press
    // while it is up is a no-op — the reader closes it and presses again, which
    // is the sequence this is about.
    fireEvent.click(within(sheet1).getByRole('button', { name: /^close$/i }))
    await waitFor(() => expect(document.querySelector('.mobile-sheet-card')).toBeNull())

    // Second press: a fresh request, not the first answer again.
    press('update')
    await waitFor(() => expect(checks).toBe(2))
  })

  // WHAT THIS CAN AND CANNOT ASSERT, said plainly. While an apply is running the
  // prompt refuses to close — PromptFrame takes busy and dismissOnScrim={false} —
  // and the dock key SETS the prompt open rather than toggling it, so pressing it
  // again is a no-op. There is therefore no route from the interface to a
  // re-check mid-apply, and a test claiming to prove the phase guard would pass
  // whether the guard were there or not (it does: removing it changes nothing
  // here). The guard stays because it is correct if the close path ever gains a
  // way out; what this case asserts is the property that IS reachable — the key
  // cannot disturb a running update.
  it('leaves a running update alone when the key is pressed again', async () => {
    asPhone()
    checks = 0
    applied = 0 // module-level, shared with the cases above
    page()
    await waitFor(() => expect(keys()).toContain('update'))
    press('update')
    await waitFor(() => expect(checks).toBe(1))

    // Scoped to the sheet, the way the case above does it: the card behind draws
    // the same confirmation off the same state.
    const sheet = await waitFor(() => {
      const el = document.querySelector('.mobile-sheet-card')
      expect(el, 'no sheet opened').toBeTruthy()
      return el
    })
    const box = await within(sheet).findByPlaceholderText('UPDATE')
    fireEvent.change(box, { target: { value: 'UPDATE' } })
    fireEvent.submit(box.closest('form'))
    await waitFor(() => expect(applied).toBe(1))

    // The prompt is saying "pulling the new image". Pressing the key again must
    // leave both the prose and the request count where they are.
    const after = checks
    const running = document.querySelector('.mobile-sheet-card').textContent
    press('update')
    await new Promise((r) => setTimeout(r, 30))
    expect(checks).toBe(after)
    expect(document.querySelector('.mobile-sheet-card').textContent).toBe(running)
    expect(applied).toBe(1)
  })
})
