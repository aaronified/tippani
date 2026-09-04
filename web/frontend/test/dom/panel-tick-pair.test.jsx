// A PANEL'S HEAD WEARS THE STANDING PAIR, and this renders one to find out.
//
// THE RULE, from CLAUDE.md, in its own words: "A tick confirms, a cross discards,
// and the tick lights only when something actually changed. Every editable field
// and every form wears the pair. The tick takes the accent fill *and* a small
// count badge — how many fields this press will change — the moment the substance
// differs from what is stored; before that it is plain, because a control that
// looks armed when nothing has changed teaches the reader to stop reading it.
// Focus is not a change and neither is retyping the same value." And: "The cross
// is red. It is the discarding half of the pair, and the repo's danger colour is
// how the app says so everywhere else."
//
// WHY IT IS A RENDER AND NOT A SOURCE SCAN. `tick-pair.test.js` counts callers
// that hand `FormModal` a `dirty` prop, which is a real check and a blind one:
// it reads whether a prop is PASSED, so a surface that takes the count and never
// draws anything with it passes every case. That is exactly what happened —
// `PanelHost` accepted the count from its content, used it for the unsaved
// question, and drew a ✓ that looked identical whether nothing or nine fields
// were waiting. Two documents and a commit message asserted otherwise. The
// observable is what the head LOOKS like, so the test has to look at it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the rule above, that a panel's content joins
// its head with `useFormHost`, and that it publishes a count with `setDirty`.
// Nothing about any screen, and nothing about how the head is built.
import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PanelHost, useFormHost, usePanelStack } from '../../src/ui.jsx'

// A form with `n` fields whose substance differs from what is stored. It does
// nothing else: no screen, no fetch, no fixture — the pair is a property of the
// head and its content's count, and anything else here would be scenery.
function Editor({ count }) {
  const host = useFormHost('')
  useEffect(() => {
    host?.setDirty?.(count)
    return () => host?.setDirty?.(0)
  }, [host, count])
  return <form id={host?.formId}><input readOnly value="x" /></form>
}

function Harness({ count }) {
  const stack = usePanelStack()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open) return
    setOpen(true)
    stack.open({ title: 'A panel', render: () => <Editor count={count} /> })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <PanelHost stack={stack} />
}

const tick = () => screen.getByRole('button', { name: /^Save$/i })
const cross = () => screen.getByRole('button', { name: /^Close$/i })
// The slot rather than the button: the accent fill is on `.tp-tick-slot.is-armed
// button`, so the state lives one level up from the control it paints.
const slot = () => tick().closest('.tp-tick-slot')

beforeEach(() => { window.history.replaceState({}, '') })
afterEach(() => cleanup())

describe("a panel's head, with a form registered and nothing changed", () => {
  beforeEach(async () => { await act(async () => { render(<Harness count={0} />) }) })

  it('draws a tick that is not armed and carries no count', () => {
    expect(tick(), 'a form registered and no ✓ in the head').toBeTruthy()
    expect(slot(), 'the ✓ is not in the slot that can arm it').toBeTruthy()
    expect(slot().classList.contains('is-armed'),
      'the ✓ is armed with nothing to save — the state the rule calls "teaches the reader to stop reading it"').toBe(false)
    expect(slot().querySelector('.tp-tick-count'),
      'a count badge over zero changes').toBeNull()
  })

  it('and a cross that is not the danger colour', () => {
    expect(cross().style.color, 'the ✕ warns about discarding nothing').not.toMatch(/error/)
  })
})

describe("a panel's head, with three fields waiting", () => {
  beforeEach(async () => { await act(async () => { render(<Harness count={3} />) }) })

  it('arms the tick', () => {
    expect(slot().classList.contains('is-armed'),
      'three unsaved fields and the ✓ looks exactly as it did with none').toBe(true)
  })

  it('says how many the press will write', () => {
    const badge = slot().querySelector('.tp-tick-count')
    expect(badge, 'no count badge beside the ✓').toBeTruthy()
    expect(badge.textContent, 'the badge does not say how much is at stake').toBe('3')
  })

  it('turns the cross the danger colour, because it is the discarding half', () => {
    expect(cross().style.color, 'the ✕ discards three fields and does not say so').toMatch(/var\(--error\)/)
  })
})
