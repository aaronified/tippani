// tourFeatures — the named steps, each carrying the index the tour is started
// at.
//
// WHY `at` EXISTS. Settings' section picker (1.15.2) replays ONE step: you pick
// "Instant search" and the tour opens there. It starts the tour by index —
// onStartTour(n) becomes FeatureTour's startStep — and the obvious index is the
// wrong one. tourFeatures is tourSteps FILTERED: `welcome` and `done` have no
// name and drop out, and two more steps drop out for a non-admin. So the nth
// feature is not the nth step, and the gap grows as you go down the list.
//
// The failure that would cause is the quiet kind. Every index is a valid step,
// so picking a section would open a real screen with real copy — just not the
// one asked for — and the further down the list you picked, the further off it
// landed. Nothing throws and nothing looks broken.
//
// So the mapping is asserted rather than described: every feature's `at` must
// name the step it came from, at both admin levels.

import { describe, expect, it } from 'vitest'
import { tourFeatures, tourSteps } from '../../src/tour.jsx'

describe('every feature points at its own step', () => {
  it.each([false, true])('is_admin=%s', (isAdmin) => {
    const steps = tourSteps(isAdmin)
    const feats = tourFeatures(isAdmin)
    expect(feats.length).toBeGreaterThan(5)
    for (const f of feats) {
      expect(steps[f.at], `${f.key} at ${f.at}`).toBeTruthy()
      expect(steps[f.at].key, `${f.key} landed on ${steps[f.at]?.key}`).toBe(f.key)
    }
  })

  it('is not the same as the position in the filtered list', () => {
    // The bug, stated as the thing that made it a bug rather than a rename. If
    // the two ever coincided this test would be asserting nothing, and a picker
    // built on the wrong index would pass it.
    const feats = tourFeatures(true)
    const drifted = feats.filter((f, i) => f.at !== i)
    expect(drifted.length).toBeGreaterThan(0)
  })

  it('shifts for a non-admin, because two steps are not there', () => {
    // The admin-only steps sit in the middle of the list, so dropping them moves
    // every feature after them. A picker that hard-coded one set of indices
    // would send non-admins to the wrong screen and nobody else.
    const last = (isAdmin) => tourFeatures(isAdmin).at(-1)
    expect(last(true).key).toBe(last(false).key)
    expect(last(true).at).toBeGreaterThan(last(false).at)
  })

  it('gives every feature the name and blurb the picker renders', () => {
    for (const f of tourFeatures(true)) {
      expect(f.name.trim()).not.toBe('')
      expect(f.blurb.trim().length).toBeGreaterThan(10)
    }
  })

  it('never offers a step that has no name', () => {
    // welcome and done are tour-only: "Welcome to tippani" is not a section
    // anybody comes back for a refresher on.
    const keys = tourFeatures(true).map((f) => f.key)
    expect(keys).not.toContain('welcome')
    expect(keys).not.toContain('done')
  })

  it('hides the admin sections from everyone else', () => {
    const keys = tourFeatures(false).map((f) => f.key)
    expect(keys).not.toContain('keys')
    expect(keys).not.toContain('backup')
    expect(tourFeatures(true).map((f) => f.key)).toContain('backup')
  })
})
