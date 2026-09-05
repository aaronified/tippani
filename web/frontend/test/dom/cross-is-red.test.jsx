// THE CROSS IS RED WHEREVER THERE IS A PAIR FOR IT TO BE HALF OF.
//
// THE RULE, from CLAUDE.md's standing UI rules: "A tick confirms, a cross
// discards… The cross is red. It is the discarding half of the pair, and the
// repo's danger colour is how the app says so everywhere else. The tick is never
// red — the accent is not a warning."
//
// Two consequences, and both are what a reader sees rather than how it is wired:
//
//   A SURFACE THAT HOLDS A FORM draws both halves, and the discarding half is in
//   the danger colour. Leaving that surface throws away what was typed.
//
//   A SURFACE THAT HOLDS NO FORM draws no tick, so its ✕ is a plain way out and
//   must stay plain. A red ✕ on a panel that is only a list of rows warns about
//   closing a list of rows, and a warning that means nothing is a warning nobody
//   reads the next time.
//
// AND THE COLOUR IS NOT ABOUT WHETHER ANYTHING HAS CHANGED. That is the tick's
// question — it arms with a count when the substance differs — and asking the
// cross the same question leaves "what does this press do" unanswered. It also
// left two surfaces disagreeing: `PanelHost` reddened only once something had
// been typed, while every `FormModal` caller passes `closeDanger` outright, so
// one form's ✕ answered a different question from the next screen's.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
import { act, cleanup, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { FormModal, PanelHost, useFormHost, usePanelStack } from '../../src/ui.jsx'

afterEach(() => cleanup())

// The ✕ on whatever surface is on screen: the close control in the head.
const cross = () => [...document.querySelectorAll('button')]
  .find((b) => /close/i.test(b.getAttribute('aria-label') || ''))
const tick = () => [...document.querySelectorAll('button')]
  .find((b) => b.getAttribute('type') === 'submit' || /save|confirm/i.test(b.getAttribute('aria-label') || ''))

const isRed = (el) => /var\(--error\)|--error/.test(el?.getAttribute('style') || '')

// A child that registers a form with whatever surface is around it — which is
// what makes the surface draw a tick at all — and publishes how much that form
// would change. `useFormHost` takes the BLOCKING REASON and hands back the host;
// the count goes up through the host, which an earlier draft of this file got
// wrong by passing it as a second argument that nothing reads. It passed either
// way, which is the whole hazard: a harness that publishes nothing makes every
// assertion about the count vacuous.
function Registers({ dirty = 0 }) {
  const host = useFormHost('')
  useEffect(() => { host?.setDirty?.(dirty) }, [host, dirty])
  return <p>a form</p>
}
function RegistersNothing() {
  return <p>just rows</p>
}

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

const openPanel = async (render_) => {
  await act(async () => { render(<Harness panel={{ title: 'A panel', render: render_ }} />) })
}

describe('a panel with a form in it', () => {
  it('draws both halves of the pair', async () => {
    await openPanel(() => <Registers />)
    expect(tick(), 'a registered form draws no tick').toBeTruthy()
    expect(cross(), 'no way out at all').toBeTruthy()
  })

  it('and the discarding half is in the danger colour', async () => {
    await openPanel(() => <Registers />)
    expect(isRed(cross()), 'the ✕ on a form is not the danger colour').toBe(true)
  })

  it('before anything has been typed, too', async () => {
    // The colour says what the press DOES, and it does the same thing either
    // way: it abandons the form. Only the tick answers "has something changed".
    await openPanel(() => <Registers dirty={0} />)
    expect(isRed(cross()),
      'a form whose reader has typed nothing yet draws a plain ✕, so nothing says it is a form').toBe(true)
  })

  it('and once something has, it is still red and the tick is not', async () => {
    await openPanel(() => <Registers dirty={2} />)
    expect(isRed(cross())).toBe(true)
    expect(isRed(tick()), 'the tick took the danger colour — the accent is not a warning').toBe(false)
  })
})

describe('a panel with no form in it', () => {
  it('draws no tick', async () => {
    await openPanel(() => <RegistersNothing />)
    expect(tick(), 'a panel with nothing to confirm drew a confirming half').toBeFalsy()
  })

  it('and its ✕ is a plain way out', async () => {
    await openPanel(() => <RegistersNothing />)
    expect(isRed(cross()),
      'closing a list of rows is drawn as a destructive act').toBe(false)
  })
})

describe('a dialog, which is the same pair on a different surface', () => {
  it('reds its ✕ when the caller says it holds a form', () => {
    render(<FormModal open title="Edit" onClose={() => {}} closeDanger><p>body</p></FormModal>)
    expect(isRed(cross()), 'a form dialog draws a plain ✕').toBe(true)
  })

  it('and leaves it plain when the caller does not', () => {
    render(<FormModal open title="Read" onClose={() => {}}><p>body</p></FormModal>)
    expect(isRed(cross())).toBe(false)
  })

  it('by the same rule the panel uses, which is the point', async () => {
    // TWO SURFACES, ONE RULE. They disagreed: the dialog reddened for any caller
    // holding a form and the panel only once something had been typed. A reader
    // moving between them saw one control mean two things, and neither surface
    // was wrong on its own — which is why only a case holding them side by side
    // could find it.
    render(<FormModal open title="Edit" onClose={() => {}} closeDanger dirty={0}><p>body</p></FormModal>)
    const onTheDialog = isRed(cross())
    cleanup()

    await openPanel(() => <Registers dirty={0} />)
    const onThePanel = isRed(cross())

    expect(onThePanel, 'the panel and the dialog answer differently with nothing typed')
      .toBe(onTheDialog)
    expect(onThePanel, 'neither surface reds a form’s ✕ at all').toBe(true)
  })
})
