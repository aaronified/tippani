// A SCREEN HAS ONE HEADER.
//
// THE RULE. The design pack draws every character and people sheet with a single
// header row — `character-popup.dc.html:33`, a flex row with one
// `border-bottom`, holding the work's cover with the medium glyph laid over it,
// the name with its crumb beneath, and the ✕. There is no second bar anywhere in
// the prototype, on any of its four artboards.
//
// WHAT WENT WRONG WITHOUT THIS. `ScreenHead` drew that bar as the first element
// of a panel BODY — its own border, its own ground, and the record's name —
// underneath a `PanelHost` head that had already drawn the same name and the ✕.
// The owner's report was one line: "there is a second header bar, despite the
// prototype showing you what exactly to do with the header bar."
//
// WHY A COUNT AND NOT A SNAPSHOT. A snapshot of the right markup passes only for
// the markup it was taken from, and fails on every legitimate change to it. What
// the rule actually says is a NUMBER — one header, one place the name is printed
// — and both survive rewording, restyling and re-nesting.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph at the top. Nothing about which
// component draws what.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let RECORD
let WORKS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && /^\/characters\/\d+$/.test(path)) return { ok: true, data: RECORD }
    if (method === 'GET' && /works/.test(path)) return { ok: true, data: { works: WORKS } }
    if (method === 'GET' && /whos-in-it/.test(path)) return { ok: true, data: { quotes: 2, locators: 1 } }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')
const { ScreenHead } = await import('../../src/characterRows.jsx')

function Harness({ panel }) {
  const stack = usePanelStack()
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (opened) return
    setOpened(true)
    stack.open(panel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}

beforeEach(() => {
  window.history.replaceState({}, '')
  RECORD = {
    id: 4, name: 'Matrim Cauthon', image_path: '', aliases: [], lines: [], shared_lines: 0,
  }
  WORKS = [{
    cast_id: 9, kind: 'book', work_id: 3, work_title: 'Crossroads Of Twilight',
    character: 'Matrim Cauthon', actor: '', character_id: 4, cover: '', aliases: '',
  }]
})
afterEach(() => cleanup())

const open = async (panel) => { await act(async () => { render(<Harness panel={panel} />) }) }

describe('a character sheet inside a panel', () => {
  beforeEach(async () => {
    await open(characterPanel({ open: () => {}, push: () => {}, close: () => {} },
      { id: 4, name: 'Matrim Cauthon', work: { kind: 'book', id: 3, title: 'Crossroads Of Twilight' } }))
  })

  it('draws one header bar, not two', () => {
    // Both bars carried a bottom rule and a name. Counting the bars is the rule.
    const bars = document.querySelectorAll('.tp-panel-head, .cs-head')
    expect(bars.length, `${bars.length} header bars — the pack draws one`).toBe(1)
  })

  it('prints the name once', () => {
    const printed = screen.queryAllByText('Matrim Cauthon')
      // A field's VALUE may legitimately repeat the name — "Called here" says what
      // this work calls them, and that is a fact about the work, not a heading.
      .filter((n) => !n.closest('.cs-row, .tp-field, form'))
    expect(printed.length, 'the record is named more than once in the chrome').toBe(1)
  })

  it('puts the name in the header the panel owns', () => {
    const bar = document.querySelector('.tp-panel-head')
    expect(bar, 'the panel head is gone entirely').toBeTruthy()
    expect(bar.textContent).toContain('Matrim Cauthon')
  })

})

// AND THE MECHANISM ON ITS OWN, so the rule is pinned without depending on which
// fixture makes an identity screen think it is local. `ScreenHead` is the thing
// every one of those screens calls; what it must do is put a cover, a name and a
// crumb in the PANEL'S bar and draw nothing itself.
describe('a body that publishes a header', () => {
  const Sheet = () => (
    <>
      <ScreenHead
        title="Andy Dufresne"
        crumb="in The Shawshank Redemption"
        glyph={<svg data-glyph="film" />}
        art="poster.jpg"
        scopeTitle="this work"
      />
      <p>the body</p>
    </>
  )

  beforeEach(async () => {
    await open({ title: 'Andy Dufresne', render: () => <Sheet /> })
  })

  it('still draws exactly one bar', () => {
    expect(document.querySelectorAll('.tp-panel-head, .cs-head').length).toBe(1)
  })

  it('puts the crumb under the name, in that bar', () => {
    const bar = document.querySelector('.tp-panel-head')
    expect(bar.textContent).toContain('Andy Dufresne')
    expect(bar.textContent, 'the crumb never reached the header').toContain('in The Shawshank Redemption')
  })

  it('puts the work\'s cover in the bar, with the medium glyph over it', () => {
    const bar = document.querySelector('.tp-panel-head')
    const art = bar.querySelector('.cs-scope-art')
    expect(art, 'no cover in the header — the pack puts one in the slot a back key would hold').toBeTruthy()
    expect(art.querySelector('img'), 'the cover slot draws no picture').toBeTruthy()
    expect(art.querySelector('.cs-scope-overlay'),
      'the medium glyph is not OVER the cover — the owner reported it beside it').toBeTruthy()
  })

  it('and takes the header away again when the panel closes', async () => {
    cleanup()
    await open({ title: 'A plain panel', render: () => <p>nothing published</p> })
    const bar = document.querySelector('.tp-panel-head')
    expect(bar.querySelector('.cs-scope-art'),
      "a panel that published no header wears the last one's cover").toBeNull()
  })
})
