// "SHOW ME THIS" SHOWS THIS, ON THE SECOND PASS AS WELL AS THE FIRST.
//
// THE MEASUREMENT, on the owner's library at 1280: open a film's Details, open a
// character from its cast, press the performer's name — three times in one tab.
//
//   pass 1 → "Max von Sydow · actor · 1 work"        the person's page
//   pass 2 → "Details … POSTER … Fetch metadata"     two panels down
//   pass 3 → the same
//
// The press is one that REPLACES the stack — a person's page is not deeper than
// a character's, it is instead of it — and the mechanism asked the browser to
// walk history back to empty and pushed the panel on the pop it got. By the
// second pass the entries below were the FIRST pass's panels, which carry a
// panel depth of their own, so the pop arrived with the stack truncated to two
// rather than to none; the lander correctly decided that pop was somebody else's
// and abandoned the open. The reader pressed a name and was dropped onto a panel
// they had not asked for, which is worse than a control that does nothing.
//
// THE PROPERTY, which is the whole of what open() promises: after it, the stack
// IS this panel. Not "eventually", not "if the history walk lands where it was
// asked to" — a control that means "show me this" cannot depend on what the
// reader did before pressing it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that jsdom is why
// this was invisible for so long — `history.go()` there does not deliver a
// popstate the way a browser does, so every test of a replacing open passed on a
// mechanism that only works on the first pass.

import { act, cleanup, render } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { PanelHost, usePanelStack } from '../../src/ui.jsx'

afterEach(() => cleanup())

const panelNamed = (title) => ({ title, render: () => <p>{title} body</p> })

// The harness hands the stack out so a case can drive it, and renders the host
// so the assertions can be about what is ON SCREEN rather than about the array.
function Harness({ take }) {
  const stack = usePanelStack()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    take(stack)
  }, [take, stack])
  return <PanelHost stack={stack} />
}

const onScreen = () => document.querySelector('.tp-panel')?.textContent || ''

describe('a control that means "show me this"', () => {
  it('shows it, however deep the reader already was', async () => {
    let stack
    await act(async () => { render(<Harness take={(s) => { stack = s }} />) })
    // The reader walks in: a Details panel, then a character inside it.
    await act(async () => { stack.push(panelNamed('Details')) })
    await act(async () => { stack.push(panelNamed('Esbern')) })
    expect(onScreen()).toContain('Esbern')

    // And presses the performer's name, which REPLACES rather than deepens.
    await act(async () => { stack.open(panelNamed('Max von Sydow')) })
    expect(onScreen(), 'the press landed somewhere the reader did not ask to go')
      .toContain('Max von Sydow')
  })

  it('does not deepen, however many times it is pressed', async () => {
    // The other half of the promise, and the one open() exists for: a control
    // meaning "show me this" must not BURY what a previous one left open. Pressed
    // twice it swaps twice; it does not stack two answers.
    let stack
    await act(async () => { render(<Harness take={(s) => { stack = s }} />) })
    await act(async () => { stack.push(panelNamed('Details')) })
    await act(async () => { stack.push(panelNamed('Esbern')) })
    await act(async () => { stack.open(panelNamed('Max von Sydow')) })
    const after1 = document.querySelectorAll('.tp-panel').length
    await act(async () => { stack.open(panelNamed('Michael Hogan')) })
    expect(onScreen()).toContain('Michael Hogan')
    expect(document.querySelectorAll('.tp-panel').length,
      'a second "show me this" stacked on top of the first').toBe(after1)
  })

  it('and leaves history able to describe what is on screen', async () => {
    // THE WAY OUT DEPENDS ON THIS, which is what the first fix broke. Emptying
    // the stack to `[panel]` from a depth of two leaves two panel entries in
    // history under a stack of one, and the ✕ then walks back onto an entry
    // recording a depth of 2 — where the truncation guard (`want < depth`)
    // declines, because 2 is not less than 1. The reader presses ✕ and the panel
    // stays. So the property is not "the stack is one" but "history and the
    // stack still agree", and it is asserted as that.
    //
    // ASSERTED ON THE RECORDED DEPTH rather than by pressing Back, because jsdom
    // delivers no popstate for a traversal: a Back here would change nothing and
    // the case would pass on both the working version and the broken one.
    let stack
    await act(async () => { render(<Harness take={(s) => { stack = s }} />) })
    await act(async () => { stack.push(panelNamed('Details')) })
    await act(async () => { stack.push(panelNamed('Esbern')) })
    const deep = window.history.state?.tpPanelDepth
    expect(deep, 'two pushes did not record a depth of two').toBe(2)
    await act(async () => { stack.open(panelNamed('Max von Sydow')) })
    expect(window.history.state?.tpPanelDepth,
      'the replacing open changed the depth history has recorded, so the way out now walks to the wrong place')
      .toBe(deep)
  })

  it('and still works from a screen with nothing open', async () => {
    // The case open() has always got right, kept: a panel arriving over a screen
    // with none is the one that owes history an entry.
    let stack
    await act(async () => { render(<Harness take={(s) => { stack = s }} />) })
    await act(async () => { stack.open(panelNamed('Straight in')) })
    expect(onScreen()).toContain('Straight in')
  })
})
