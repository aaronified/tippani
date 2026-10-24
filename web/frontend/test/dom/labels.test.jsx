// theme.js's label resolution — the auto | on | off preference collapsing to
// the concrete data-labels attribute that index.css reads.
//
// This is worth testing rather than eyeballing because every wrong answer is
// silent. Get it backwards and the app still renders: desktop just shows glyphs
// with no words, or a phone shows a row of labelled buttons that overflow off
// the edge. Nothing throws, and neither is visible in a screenshot of the state
// you happened to be in.
//
// theme.js captures matchMedia at MODULE scope, so the viewport has to be
// decided before the import. Every case therefore resets the module registry
// and imports a fresh copy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// installMatchMedia swaps in a matchMedia whose answer depends on the query,
// and hands back the listener registry so a test can fire a viewport change.
// The default setup-dom shim answers `false` to everything, which would make
// the narrow cases untestable — and untestably wrong, since "false to
// everything" is exactly the desktop answer.
function installMatchMedia(narrow) {
  const listeners = new Map()
  window.matchMedia = (media) => ({
    // A getter, not a value. A real MediaQueryList updates .matches live, and
    // theme.js holds ONE object from import time and re-reads it on every
    // change event — so a frozen boolean here would make the listener look
    // broken when it is fine.
    get matches() {
      return media.includes('max-width') ? narrow : false
    },
    media,
    onchange: null,
    addEventListener(_type, fn) {
      if (!listeners.has(media)) listeners.set(media, [])
      listeners.get(media).push(fn)
    },
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
  return {
    // resize() re-answers the width query and fires the change listeners, the
    // way a browser does when a window is dragged across the breakpoint.
    resize(nowNarrow) {
      narrow = nowNarrow
      for (const [media, fns] of listeners) {
        if (media.includes('max-width')) fns.forEach((fn) => fn({ matches: nowNarrow, media }))
      }
    },
  }
}

async function loadTheme({ narrow = false } = {}) {
  vi.resetModules()
  const mm = installMatchMedia(narrow)
  const mod = await import('../../src/theme.js')
  return { ...mod, ...mm }
}

const labels = () => document.documentElement.dataset.labels

beforeEach(() => {
  document.documentElement.removeAttribute('data-labels')
})

afterEach(() => {
  vi.resetModules()
})

describe('applyLabels', () => {

  // One test over all five preference × viewport pairs rather than five: the
  // body was identical per row — load a fresh theme at that width, apply that
  // preference, read the attribute back — and only the three values varied.
  // Every case is still an iteration under its own name, and comparing the
  // collected answers in one go names EVERY wrong pair at once rather than
  // stopping at the first.
  const CASES = [
    { name: "shows labels on a desktop width under 'auto'", narrow: false, pref: 'auto', want: 'on' },
    { name: "hides labels under the mobile breakpoint under 'auto'", narrow: true, pref: 'auto', want: 'off' },
    { name: "'off' wins on a desktop width", narrow: false, pref: 'off', want: 'off' },
    // The explicit preference has to beat the breakpoint in BOTH directions, or
    // the setting is only half a setting.
    { name: "'on' wins under the mobile breakpoint", narrow: true, pref: 'on', want: 'on' },
    { name: 'treats an unrecognised preference as auto', narrow: true, pref: 'yes please', want: 'off' },
  ]

  it('resolves every preference against the viewport', async () => {
    const got = []
    for (const { name, narrow, pref } of CASES) {
      // A fresh loadTheme per row, exactly as each it() did: theme.js captures
      // matchMedia at module scope, so the viewport has to be re-established
      // before the import for every case. Clearing the attribute first means a
      // row cannot pass by inheriting the previous row's answer.
      document.documentElement.removeAttribute('data-labels')
      const { applyLabels } = await loadTheme({ narrow })
      applyLabels(pref)
      got.push([name, labels()])
    }
    expect(got).toEqual(CASES.map(({ name, want }) => [name, want]))
  })
})

// ---- the Settings control ------------------------------------------------
//
// Everything above tests theme.js in isolation. This tests the half that
// actually has to agree with it: the control writes a value, boot reads it back.
//
// The specific trap is JSON. applyLabels() does JSON.parse on the stored string
// and swallows the throw, so a control that wrote a bare `off` instead of `"off"`
// would look correct in Settings, apply correctly for that session, and silently
// revert to auto on the next reload. Nothing errors, and the only symptom is a
// preference that will not stick.
