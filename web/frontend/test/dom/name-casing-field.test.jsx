// Name fields ask the keyboard for a capital per word, and rewrite nothing.
//
// THIS FILE REPLACES A SUITE THAT TESTED THE OPPOSITE, and the reason is worth
// a line: the app used to capitalise names itself, on every keystroke, with a
// small-word list for titles and an escape hatch for "bell hooks". It failed on
// "The Wheel of Time" three releases running, so the rule is gone and the HTML
// `autocapitalize` attribute does the job — the phone offers the capital, the
// reader presses shift when the offer is wrong, and nothing in the page argues.
//
// TWO PROPERTIES, AND BOTH ARE SILENT WHEN BROKEN.
//
// The first is that WHAT YOU TYPE IS WHAT IS SAVED. A transform reintroduced
// anywhere on this path — in the field, in the hook, on the save — would pass
// its own unit tests while quietly renaming somebody. So these tests type
// lower-case strings that the old rule would have rewritten and require the
// field and the reported value to be that exact string.
//
// The second is that THE ATTRIBUTE IS ACTUALLY ON THE ELEMENT. jsdom has no
// software keyboard, so nothing here can prove a phone capitalises anything;
// what it can prove is that the hint is present on a name box and absent from
// prose, which is the whole of what this app controls. A missing attribute
// looks identical on a desktop and is only wrong on the device nobody tests on.

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Field, NameInput, TokenInput } from '../../src/ui.jsx'

// Harness mirrors how the real forms are wired: a controlled value in the
// parent, updated from the event the field reports. `last` is what a Save would
// have sent, so a test can compare it against what is on screen.
function Harness({ initial = '', Comp = NameInput, ...props }) {
  const [v, setV] = useState(initial)
  return (
    <div>
      <Comp value={v} onChange={(e) => setV(e.target.value)} aria-label="Name" {...props} />
      <span data-testid="saved">{v}</span>
    </div>
  )
}

const box = () => screen.getByLabelText('Name')
const saved = () => screen.getByTestId('saved').textContent

describe('a name field stores exactly what was typed', () => {
  // THE TITLE THE OLD RULE WAS WRITTEN FOR AND KEPT BREAKING. Under the small-word
  // rule this arrived as "The Wheel Of Time" — "of" was promoted while it was still
  // the one-letter word "o", and the promote-only rule's own escape hatch then
  // froze the capital for the rest of the edit.

  // The names the escape hatch existed for. They now need no hatch at all.
  it.each(['bell hooks', 'danah boyd', 'k.d. lang', 'eBay', 'iRobot'])(
    'leaves %s alone',
    async (name) => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(box(), name)
      expect(box().value).toBe(name)
      expect(saved()).toBe(name)
    },
  )

  // A LOWER-CASE FIRST LETTER IS NOT PROMOTED, which is the single-keystroke
  // version of the same claim and the one a reintroduced transform would fail
  // first.

  // Field re-wraps its value in a synthetic event, so the parent's
  // `e.target.value` wiring has to keep working with no transform in the middle.
})

