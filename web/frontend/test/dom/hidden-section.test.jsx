// A SECTION THE READER HAS PUT AWAY IS NOT ADVERTISED ANYWHERE.
//
// THE RULE. Settings → Features lets a reader switch whole sections off. What that
// has to mean is not "the tab stops working" — it is that the app stops offering
// it: no row on the drawer, and no key legend on the shortcut sheet promising a
// destination that is not there. The sheet is generated from the key table so it
// cannot fall behind it, which is exactly why it has to be TOLD; without that it
// advertises a screen the reader has hidden.
//
// WHY THIS IS A RENDER. `test/pure/features-nav.test.js` guarded the second half
// with `/ShortcutSheet[\s\S]{0,240}?omit=\{/` — a 240-character window of hope,
// which breaks on adding a prop and passes on an `omit` that belongs to something
// else further down the file. The repo's audit lists it (§2.2) with the fix in one
// line: "Test instead: which doors are on screen with a section hidden."
//
// WHAT A TEST WRITER NEEDS TO KNOW: the first paragraph.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Drawer } from '../../src/App.jsx'
import { ShortcutSheet } from '../../src/ui.jsx'
import { SHORTCUTS, shortcutFor } from '../../src/keys.js'
import { t } from '../../src/i18n.js'

const realMatchMedia = window.matchMedia
// A pointer device: a phone draws no legends at all and would pass this by
// drawing nothing, which is not the same as leaving one out.
const pointer = () => {
  window.matchMedia = (media) => ({
    matches: false, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}
afterEach(() => { cleanup(); window.matchMedia = realMatchMedia })

const drawer = (sections) => {
  pointer()
  render(
    <Drawer
      open
      onClose={() => {}}
      tab="home"
      selectTab={() => {}}
      onSearch={() => {}}
      onAdd={() => {}}
      onAccount={() => {}}
      user={{ username: 'reader', is_admin: false }}
      stats={{}}
      pending={0}
      pendingImport={0}
      streak={0}
      metaIssues={0}
      dark={false}
      onUser={() => {}}
      sections={sections}
    />,
  )
  const text = document.body.textContent
  const caps = [...document.querySelectorAll('kbd')].map((k) => k.textContent.trim())
  cleanup()
  return { text, caps }
}

// `omit` IS A SET OF ACTION IDS — keys.js reads it as `omit?.has?.(id)`, so an
// array here quietly omits nothing and the case passes for the wrong reason. It
// did, on the first draft.
const sheet = (...ids) => {
  pointer()
  render(<ShortcutSheet open omit={new Set(ids)} onClose={() => {}} />)
  const text = document.body.textContent
  cleanup()
  return text
}

// The key a reader would press to reach the shelf, as its caps, and the sentence
// the sheet writes beside it. The SENTENCE is what the sheet is checked on: a
// single cap like "L" occurs inside the sheet's own prose and inside other
// destinations' sequences, so its presence says nothing.
const LIBRARY_KEYS = shortcutFor('go-library').split(/\s+then\s+/)
const LIBRARY_ROW = t(SHORTCUTS.find((s) => s.id === 'go-library').label)

describe('with every section on', () => {
  it('the drawer offers the shelf, and says which key reaches it', () => {
    const { caps } = drawer({})
    for (const k of LIBRARY_KEYS) {
      expect(caps, `the drawer does not print "${k}" — nothing here is being tested`).toContain(k)
    }
  })

  it('and the sheet lists it too', () => {
    expect(sheet(), 'the sheet does not list the shelf at all').toContain(LIBRARY_ROW)
  })
})

describe('with the shelf put away', () => {
  it('the drawer stops offering it', () => {
    const { caps } = drawer({ library: false })
    // The FULL sequence is what reaches the shelf. A single letter may legitimately
    // still be on the drawer as part of another destination's key, so the test is
    // that the sequence is no longer offered — checked as the last cap of it, which
    // is the one that distinguishes G-then-L from G-then-H.
    expect(caps, 'a hidden section still has a drawer row with its key on it')
      .not.toContain(LIBRARY_KEYS[LIBRARY_KEYS.length - 1])
  })

  it('and the sheet stops promising a key that goes nowhere', () => {
    expect(sheet('go-library'), 'the sheet still advertises a hidden section')
      .not.toContain(LIBRARY_ROW)
  })

  it('while every other destination keeps its own', () => {
    // A gate that hides the legends everywhere is not a fix, it is a regression
    // with a good excuse.
    const { caps } = drawer({ library: false })
    const others = SHORTCUTS.filter((s) => s.id.startsWith('go-') && s.id !== 'go-library')
    const lost = others
      .filter((s) => !shortcutFor(s.id).split(/\s+then\s+/).every((k) => caps.includes(k)))
      .map((s) => s.id)
    expect(lost, 'hiding one section took the legends off these too').toEqual([])
  })
})
