// A screen gets ONE persistent bar on a phone, and the shell owns it.
//
// Settings, Metadata, Stats and Bin each drew a second one. The shell's
// .mobile-topbar already names the screen and has a sub-line under the name for
// whatever the screen wants to add; these four then wrapped their own
// .page-header in .mobile-sticky-bar, which pinned a second row directly below
// it. On Settings that second row was worse than redundant — the header's <h1>
// is visually hidden on a phone and its caption had already moved to the shell's
// sub-line, so the row was pinned to say nothing at all.
//
// THE FIX IS THE ABSENCE, which is exactly the kind of change that comes back:
// the header is easy to re-add, reads as an oversight when it is missing, and
// nothing about the JSX explains why four screens out of nine skip it. So the
// absence is asserted, per screen, at phone width.
//
// It is asserted through SCREENS rather than by importing the four components,
// for the reason test/screens.js exists: the props App hands down are recorded
// once, and a screen whose signature changes fails here instead of rendering a
// blank.
import { describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { SCREENS, USER } from '../screens.js'
import { useScreenBarState } from '../../src/ui.jsx'

// The four that had the second bar. The five that still use .mobile-sticky-bar —
// Import, Staging, Tags, Cleanup, Search — are not in scope here: each of those
// rows carries a control a thumb needs, not a repeated title.
const SCREENS_WITHOUT_A_HEADER = ['settings', 'metadata', 'stats', 'bin']

// AND SETTINGS DRAWS NONE ON A DESK EITHER, which is the one exception below.
//
// The desktop half of this file rests on "the desktop shell has no top bar of its
// own to double". That stopped being true: the desktop bar carries a breadcrumb
// whose leaf is `screenTitleKey(tab)` (App.jsx:855) — it names the screen. So the
// page header is a second naming there too, and on Settings what survived of it was
// a lone "ADMIN" floating above the tabs, since the <h1> is hidden.
//
// SETTINGS ALONE, because the v3 pack settles Settings and nothing else here: its
// desktop frame goes from the top bar straight into the tab row
// (settings-restructured.dc.html:120-122). The same argument plainly applies to
// Metadata, Stats and Bin and is not this change's to make — they keep their headers
// until somebody looks at them on purpose.
const SCREENS_KEEPING_A_DESK_HEADER = SCREENS_WITHOUT_A_HEADER.filter((k) => k !== 'settings')

let BAR = { sub: null, keys: null }
const Probe = () => {
  BAR = useScreenBarState()
  return null
}

const width = (isPhone) => {
  window.matchMedia = (media) => ({
    matches: isPhone, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

async function mount(key) {
  const [load, name, props] = SCREENS[key]
  const Screen = (await load())[name]
  // The screens log their refused fetches; that is the mock working, not a fault.
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await act(async () => {
      render(
        <>
          <Screen {...props} user={props.user || USER} />
          <Probe />
        </>,
      )
    })
  } finally {
    quiet.mockRestore()
  }
}

describe('on a phone, a screen draws no bar of its own', () => {
  for (const key of SCREENS_WITHOUT_A_HEADER) {
    it(`${key} has no page header and no sticky row`, async () => {
      width(true)
      BAR = { sub: null, keys: null }
      await mount(key)
      expect(document.querySelector('.page-header')).toBeNull()
      expect(document.querySelector('.mobile-sticky-bar')).toBeNull()
    })
  }
})

describe('on a desk, the same screens keep their header', () => {
  for (const key of SCREENS_KEEPING_A_DESK_HEADER) {
    it(`${key} draws one`, async () => {
      width(false)
      BAR = { sub: null, keys: null }
      await mount(key)
      // One, not two: the desktop shell has no top bar of its own to double.
      await waitFor(() => expect(document.querySelectorAll('.page-header')).toHaveLength(1))
      // And it publishes no sub-line, because there is no bar to put one in.
      expect(BAR.sub).toBeNull()
    })
  }

  it('settings draws none, because the breadcrumb already names it', async () => {
    width(false)
    BAR = { sub: null, keys: null }
    await mount('settings')
    expect(document.querySelectorAll('.page-header')).toHaveLength(0)
  })
})
