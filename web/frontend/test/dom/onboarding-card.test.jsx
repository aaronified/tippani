// Settings → Onboarding: two buttons, and no table of contents (1.15.2).
//
// The card has now twice tried to be a list of what the tour covers. It began as
// a dozen two-line rows, which pushed the Start button off a phone screen; the
// blurbs went behind InfoDots, which left a dozen names each trailing a dot. A
// name in that list answers "is this covered?", and nobody opens Settings →
// Onboarding asking that — they open it having forgotten how one screen works.
//
// So the list is a picker now, and the assertions are about the difference: the
// names are off the card, and choosing one starts the tour AT THAT STEP. The
// second half is the part that can break silently — every step index is a valid
// step, so a wrong one opens a real screen with real copy and nothing to say it
// is the wrong screen.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { tourFeatures, tourSteps } = await import('../../src/tour.jsx')

let started

const page = async (preferences = {}, is_admin = false) => {
  render(
    <Settings
      user={{ username: 'a', is_admin, preferences }}
      onPreferences={() => {}}
      update={null}
      onUpdateInfo={() => {}}
      onStartTour={(step) => started.push(step)}
    />,
  )
  await screen.findByText('Onboarding')
}

beforeEach(() => {
  started = []
})

describe('the card itself', () => {
  it('no longer lists the sections beside the button', async () => {
    await page({ tour: 'done' })
    // Three names spread across the old list, one of them the last row — the
    // shape of a list that was rendered but truncated would still fail this.
    for (const name of ['Add & import', 'Instant search', 'Profile & users']) {
      expect(screen.queryByText(name), name).toBeNull()
    }
  })

  it('gives the replay button a glyph and keeps its words', async () => {
    await page({ tour: 'done' })
    const replay = screen.getByRole('button', { name: 'Replay the tour' })
    expect(replay.querySelector('svg'), 'no glyph').not.toBeNull()
    // keepLabel: this button carries the step count when it is a Resume, and
    // has-btn-icon would let data-labels="off" square it away to a bare flag.
    expect(replay.className).not.toContain('has-btn-icon')
    expect(replay.querySelector('.btn-label-fixed')).not.toBeNull()
  })

  it('gives the picker button a glyph and keeps its words too', async () => {
    // The only way to the picker. An unlabelled bookmark on a phone is the
    // feature not existing.
    await page({ tour: 'done' })
    const pick = screen.getByRole('button', { name: 'Refresh one section' })
    expect(pick.querySelector('svg'), 'no glyph').not.toBeNull()
    expect(pick.className).not.toContain('has-btn-icon')
  })

  it('lets "Start over" drop its words, because the button beside it says them', async () => {
    // The deliberate contrast, and the reason keepLabel is a judgement rather
    // than a habit: "Start over" is a secondary variant of the labelled button
    // it sits next to, so the row already says what it is about.
    await page({ tour: 'postponed', tourStep: 2 })
    expect(screen.getByRole('button', { name: 'Start over' }).className).toContain('has-btn-icon')
  })

  it('still replays from the beginning', async () => {
    await page({ tour: 'done' })
    fireEvent.click(screen.getByRole('button', { name: 'Replay the tour' }))
    expect(started).toEqual([0])
  })

  it('still resumes a postponed tour where it was parked', async () => {
    await page({ tour: 'postponed', tourStep: 4 })
    fireEvent.click(screen.getByRole('button', { name: /Resume tour/ }))
    expect(started).toEqual([4])
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(started).toEqual([4, 0])
  })
})

describe('the section picker', () => {
  const open = async (preferences = { tour: 'done' }, is_admin = false) => {
    await page(preferences, is_admin)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh one section' }))
    return screen.getByRole('dialog')
  }

  it('opens with a row per section, blurb and all', async () => {
    const d = await open()
    const feats = tourFeatures(false)
    for (const f of feats) {
      expect(within(d).getByText(f.name), f.name).toBeTruthy()
      expect(within(d).getByText(f.blurb), f.blurb).toBeTruthy()
    }
  })

  it('starts the tour at the step the name belongs to', async () => {
    // The assertion the whole feature turns on, and it is written against
    // tourSteps rather than a number: a step added to the middle of the tour
    // must not be able to make this pass while sending readers to the wrong
    // screen.
    const d = await open()
    const steps = tourSteps(false)
    const wanted = tourFeatures(false).find((f) => f.key === 'search')
    fireEvent.click(within(d).getByText(wanted.name))
    expect(started).toHaveLength(1)
    expect(steps[started[0]].key).toBe('search')
  })

  it('lands on the same section for an admin, at a different index', async () => {
    // Two admin-only steps sit in the middle of the tour, so every section after
    // them moves. A picker built on the filtered list would be wrong for exactly
    // one of these two runs.
    const d = await open({ tour: 'done' }, true)
    const steps = tourSteps(true)
    const wanted = tourFeatures(true).find((f) => f.key === 'account')
    fireEvent.click(within(d).getByText(wanted.name))
    expect(steps[started[0]].key).toBe('account')
    expect(started[0]).toBeGreaterThan(tourFeatures(false).find((f) => f.key === 'account').at)
  })

  it('closes itself on the way, so the tour is not opened behind a dialog', async () => {
    const d = await open()
    fireEvent.click(within(d).getByText('Instant search'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers a non-admin nothing they cannot act on', async () => {
    const d = await open()
    expect(within(d).queryByText('Backup, restore & updates')).toBeNull()
    expect(within(d).queryByText('Metadata keys & Amazon cookie')).toBeNull()
  })
})
