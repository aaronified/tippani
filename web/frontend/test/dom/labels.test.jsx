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
  it('writes nothing until it is called', async () => {
    await loadTheme()
    // Importing theme.js must not touch the document: the pure test project
    // runs in node with no document at all, and share.jsx imports theme.js.
    expect(labels()).toBeUndefined()
  })

  it("shows labels on a desktop width under 'auto'", async () => {
    const { applyLabels } = await loadTheme({ narrow: false })
    applyLabels('auto')
    expect(labels()).toBe('on')
  })

  it("hides labels under the mobile breakpoint under 'auto'", async () => {
    const { applyLabels } = await loadTheme({ narrow: true })
    applyLabels('auto')
    expect(labels()).toBe('off')
  })

  it("'off' wins on a desktop width", async () => {
    const { applyLabels } = await loadTheme({ narrow: false })
    applyLabels('off')
    expect(labels()).toBe('off')
  })

  it("'on' wins under the mobile breakpoint", async () => {
    // The explicit preference has to beat the breakpoint in BOTH directions, or
    // the setting is only half a setting.
    const { applyLabels } = await loadTheme({ narrow: true })
    applyLabels('on')
    expect(labels()).toBe('on')
  })

  it('treats an unrecognised preference as auto', async () => {
    const { applyLabels } = await loadTheme({ narrow: true })
    applyLabels('yes please')
    expect(labels()).toBe('off')
  })
})

describe('applyLabels with no argument', () => {
  it('reads the device-local preference', async () => {
    const { applyLabels, LABELS_KEY } = await loadTheme({ narrow: false })
    localStorage.setItem(LABELS_KEY, JSON.stringify('off'))
    applyLabels()
    expect(labels()).toBe('off')
  })

  it('falls back to auto when nothing is stored', async () => {
    const { applyLabels } = await loadTheme({ narrow: true })
    applyLabels()
    expect(labels()).toBe('off')
  })

  it('falls back to auto when the stored value is not JSON', async () => {
    // usePersistedState writes JSON, but localStorage is shared with anything
    // else on the origin and survives a downgrade. A parse error must not stop
    // boot — main.jsx calls this before the first render.
    const { applyLabels, LABELS_KEY } = await loadTheme({ narrow: false })
    localStorage.setItem(LABELS_KEY, '{not json')
    expect(() => applyLabels()).not.toThrow()
    expect(labels()).toBe('on')
  })
})

describe('a viewport change', () => {
  it("re-resolves under 'auto'", async () => {
    const { applyLabels, resize } = await loadTheme({ narrow: false })
    applyLabels('auto')
    expect(labels()).toBe('on')
    resize(true)
    expect(labels()).toBe('off')
  })

  it('is ignored once the preference is explicit', async () => {
    // Someone who turned labels off for density does not want them back
    // because they widened the window.
    const { applyLabels, resize } = await loadTheme({ narrow: true })
    applyLabels('off')
    resize(false)
    expect(labels()).toBe('off')
  })
})

describe('labelsPref', () => {
  it('reports what was applied, not what was asked for', async () => {
    const { applyLabels, labelsPref } = await loadTheme()
    applyLabels('nonsense')
    // Settings initialises its control from this, so it has to report the
    // canonical value rather than echo the input back.
    expect(labelsPref()).toBe('auto')
    applyLabels('off')
    expect(labelsPref()).toBe('off')
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
describe('the Settings control and boot agree', () => {
  it('writes a value applyLabels() can read back', async () => {
    const { applyLabels } = await loadTheme({ narrow: false })
    // Imported AFTER loadTheme, and deliberately not mocked. loadTheme resets
    // the module registry and imports theme.js; Settings.jsx imported into that
    // same registry resolves to the SAME theme instance, so the two share state
    // without anyone hand-listing what theme.js exports. A mock that listed them
    // is what this used to do, and it broke the moment the module grew a new one.
    const { LabelDensity } = await import('../../src/Settings.jsx')
    const { render, fireEvent, screen } = await import('@testing-library/react')

    render(<LabelDensity />)
    fireEvent.click(screen.getByRole('tab', { name: 'Hide' }))
    expect(labels()).toBe('off')

    // The round trip: forget the in-memory preference, then boot.
    applyLabels('auto')
    expect(labels()).toBe('on')
    applyLabels()
    expect(labels()).toBe('off')
  })

  it('offers auto in both directions, not just off', async () => {
    const { applyLabels } = await loadTheme({ narrow: true })
    const { LabelDensity } = await import('../../src/Settings.jsx')
    const { render, fireEvent, screen } = await import('@testing-library/react')

    render(<LabelDensity />)
    // A phone resolves auto to off, so "Show" is the override that has to work.
    fireEvent.click(screen.getByRole('tab', { name: 'Show' }))
    expect(labels()).toBe('on')
    applyLabels('auto')
    applyLabels()
    expect(labels()).toBe('on')
  })
})
