// THE SWITCH AND THE OPERATING SYSTEM RESOLVE TO ONE STATE.
//
// docs/plans/access.md names this as the thing to get right and says why: "Two
// independent sources for one visual property is the drift this repo keeps
// writing about." A reader's Settings choice and their machine's
// `prefers-contrast` both answer the same question, so they are answered ONCE,
// in applyContrastNow, before any rule is consulted.
//
// WHAT WOULD GO WRONG WITHOUT IT is not subtle: index.css would carry the
// twenty-three-selector texture block twice, once behind a media query and once
// behind the attribute, and the two copies would drift the way every pair of
// copies in this repo has. The stylesheet already has that lesson written into
// the same block — it shipped in the wrong layer once and did nothing at all.
//
// THE MODULE CAPTURES ITS MediaQueryList AT IMPORT, so each case re-imports
// theme.js against a freshly stubbed matchMedia. Setting the stub after the
// import would change nothing and the case would pass for the wrong reason.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// A machine that either asks for more contrast or says nothing at all. Both
// queries are answered together because index.css asked for both together —
// `prefers-contrast: more` and `prefers-reduced-transparency: reduce` are two
// ways of saying the same thing and the app treats them as one.
function osSays(more) {
  window.matchMedia = (media) => ({
    matches: more && (media.includes('prefers-contrast') ||
      media.includes('prefers-reduced-transparency')),
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

async function freshTheme(osMore) {
  vi.resetModules()
  osSays(osMore)
  return import('../../src/theme.js')
}

const resolved = () => document.documentElement.dataset.contrast
const raw = () => document.documentElement.dataset.contrastMode

describe('contrast resolves the reader and the machine into one answer', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.contrast
    delete document.documentElement.dataset.contrastMode
  })

  // THE CASE THE PLAN NAMES: "auto + OS-more equals explicit more".
  it('auto on a machine asking for more contrast is the same as choosing more', async () => {
    const auto = await freshTheme(true)
    auto.applyContrast('auto')
    const viaOS = resolved()

    const chosen = await freshTheme(false)
    chosen.applyContrast('more')
    expect(viaOS, 'the OS route and the switch route must land on one value').toBe(resolved())
    expect(resolved()).toBe('more')
  })

  // AND THE OTHER HALF: "explicit more survives an OS that says nothing".
  it('more chosen here survives a machine that says nothing', async () => {
    const t = await freshTheme(false)
    t.applyContrast('more')
    expect(resolved()).toBe('more')
  })

  it('auto on a machine that says nothing leaves the app as it was', async () => {
    const t = await freshTheme(false)
    t.applyContrast('auto')
    expect(resolved()).toBe('normal')
  })

  // THE RAW PREFERENCE IS KEPT BESIDE THE RESOLVED ONE, and Settings needs it:
  // 'auto' on a machine asking for more contrast looks identical on screen to an
  // explicit 'more', and a control that cannot tell them apart reports the wrong
  // answer back to the person who set it.
  it('and the raw choice is still readable, which auto on a more-contrast machine needs', async () => {
    const t = await freshTheme(true)
    t.applyContrast('auto')
    expect(resolved(), 'the machine still wins the resolved value').toBe('more')
    expect(raw(), 'but the reader chose auto and the control must say so').toBe('auto')
    expect(t.contrastPrefValue()).toBe('auto')
  })

  // An unknown value falls to the documented default rather than to a
  // half-understood approximation of it — clampFactor's rule, one file over.
  it('a value a newer client invented falls back to auto', async () => {
    const t = await freshTheme(false)
    t.applyContrast('maximum')
    expect(resolved()).toBe('normal')
    expect(t.contrastPrefValue()).toBe('auto')
  })
})
