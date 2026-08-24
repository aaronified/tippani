// Name fields capitalise as you type, and stop when you disagree.
//
// Two properties, and both are silent when broken.
//
// The first is that the transform is on the INPUT, not on the save path. A
// capitaliser that runs at save time passes every unit test of its own while
// the field shows "agatha" and the database stores "Agatha" — the user is never
// shown what was saved, so nothing looks wrong until an export or a group-by
// header disagrees with the form. So these tests read what the field displays
// and what the change handler reported, and require them to be the same string.
//
// The second is the override. useNameCasing yields the moment a change is
// nothing but a case edit, which is what makes "bell hooks" typeable. Break the
// yield and the field still works perfectly for every ordinary name; only the
// people whose names are lower-case on purpose can no longer be entered, and
// nothing throws.

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

describe('capitalising happens in the field, not on save', () => {
  it('shows the capital as you type it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(box(), 'agatha')
    expect(box().value).toBe('Agatha')
  })

  it('reports exactly what it displays', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(box(), 'agatha christie')
    // The two must be the same string. If a transform ever moves to the save
    // path, this is the assertion that catches it.
    expect(box().value).toBe('Agatha Christie')
    expect(saved()).toBe(box().value)
  })

  it('capitalises each new word as the space is typed past', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(box(), 'gabriel garcia marquez')
    expect(box().value).toBe('Gabriel Garcia Marquez')
  })

  it('leaves a name typed with internal capitals alone', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(box(), 'Ian McEwan')
    expect(box().value).toBe('Ian McEwan')
    expect(saved()).toBe('Ian McEwan')
  })
})

describe('the override — a case edit hands the field back to you', () => {
  it('lets a deliberately lower-cased word stay lower-cased', async () => {
    const user = userEvent.setup()
    render(<Harness initial="Bell" />)
    // Select the capital and retype it in lower case: letters unchanged, case
    // changed, which can only be deliberate.
    await user.clear(box())
    await user.paste('bell')
    expect(box().value).toBe('Bell') // still capitalised — clearing reset nothing
    // Now the case-only edit.
    box().setSelectionRange(0, 4)
    await user.paste('bell')
    expect(box().value).toBe('bell')
  })

  it('stays yielded for the rest of the edit, not just one keystroke', async () => {
    const user = userEvent.setup()
    render(<Harness initial="Bell" />)
    // paste() goes to whatever holds focus, so the click is not decoration —
    // without it the paste lands nowhere and the test passes by doing nothing.
    await user.click(box())
    box().setSelectionRange(0, 4)
    await user.paste('bell') // case-only edit -> field goes free
    expect(box().value).toBe('bell')
    // The bug this catches: re-capitalising on the very next character typed,
    // which would make the override last exactly one keystroke.
    await user.type(box(), ' hooks')
    expect(box().value).toBe('bell hooks')
    expect(saved()).toBe('bell hooks')
  })
})

describe('Field opts in with a prop, and only then', () => {
  it('capitalises when nameCase is set', async () => {
    const user = userEvent.setup()
    render(<Harness Comp={Field} label="Name" nameCase />)
    await user.type(screen.getByLabelText('Name'), 'agatha')
    expect(screen.getByLabelText('Name').value).toBe('Agatha')
  })

  it('leaves a plain Field completely untouched', async () => {
    const user = userEvent.setup()
    render(<Harness Comp={Field} label="Name" />)
    // Description, ISBN, timestamps and quotes all go through Field. None of
    // them should gain a capital because a name field wanted one.
    await user.type(screen.getByLabelText('Name'), 'agatha')
    expect(screen.getByLabelText('Name').value).toBe('agatha')
  })
})

describe('TokenInput capitalises the draft, so a chip reads as it saves', () => {
  function TokenHarness({ nameCase = false }) {
    const [v, setV] = useState([])
    return (
      <div>
        <TokenInput value={v} onChange={setV} ariaLabel="Characters" nameCase={nameCase} />
        <span data-testid="saved">{v.join('|')}</span>
      </div>
    )
  }

  it('capitalises a character as it is typed, before it becomes a chip', async () => {
    const user = userEvent.setup()
    render(<TokenHarness nameCase />)
    const input = screen.getByLabelText('Characters')
    await user.type(input, 'philip marlowe')
    expect(input.value).toBe('Philip Marlowe')
    await user.type(input, '{Enter}')
    expect(saved()).toBe('Philip Marlowe')
  })

  it('leaves a token list alone without the prop', async () => {
    const user = userEvent.setup()
    render(<TokenHarness />)
    const input = screen.getByLabelText('Characters')
    await user.type(input, 'philip marlowe{Enter}')
    expect(saved()).toBe('philip marlowe')
  })
})

// ---- who capitalises, and where ---------------------------------------------
//
// THE OWNER'S QUESTION, ANSWERED IN THE MARKUP. "how phone keyboards know to
// capitalise after a fullstop in some apps … it doesnt do that in some other
// apps" — the difference is the HTML `autocapitalize` attribute, which is a hint
// the PAGE gives the on-screen keyboard. Its default for a text input is
// `sentences`, so a phone was promoting the first letter of every name field
// underneath the rule in ui.jsx.
//
// Most of the time the two agree and nothing shows. Where they disagree is the
// case the rule exists to protect: type "bell hooks" on a phone and the keyboard
// capitalises the b before any of our code runs, and the promote-only rule then
// leaves the capital alone because a word carrying one is somebody's decision. The
// reader ends up fighting a rule that is not in this codebase.
//
// So a field that capitalises itself tells the keyboard to stay out of it. These
// assert the attribute rather than the behaviour, because jsdom has no keyboard —
// the attribute IS the whole of what this app controls.
describe('the keyboard is told who is in charge', () => {
  it('a name field opts the keyboard out', () => {
    render(<Field label="Author" nameCase value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Author').getAttribute('autocapitalize')).toBe('off')
  })

  it('a title field too', () => {
    render(<Field label="Title" titleCase value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Title').getAttribute('autocapitalize')).toBe('off')
  })

  it('and an ordinary field does not, because sentence case is right there', () => {
    // A note or a quote wants the browser default. Opting every input out would
    // be answering a question nobody asked, in the one place the default is good.
    render(<Field label="Note" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Note').getAttribute('autocapitalize')).toBeNull()
  })
})
