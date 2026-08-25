// The character box's dropdown.
//
// WHY IT IS NOT A <datalist> ANY MORE. It was, and the argument was that the
// browser's own list is strictly better in this one role. What the browser
// actually DOES with a datalist turns out to be a per-browser matter: desktop
// Chrome opens it only after a keystroke, so a reader who had typed nothing saw
// nothing and had no way to learn the list existed. For a memory aid that is the
// whole of its value, and the owner reported it as the box not having a dropdown.
//
// So the assertions here are about what a reader can SEE without knowing the
// control: it opens on focus, it names the actor beside the part, and it never
// refuses a name the cast has never heard of.

import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const { CastCombo } = await import('../../src/suggest.jsx')

const CAST = [
  { character: 'Amanda Waller', actor: 'Viola Davis' },
  { character: 'Harley Quinn', actor: 'Margot Robbie' },
  { character: 'Rick Flag', actor: 'Joel Kinnaman' },
]
// Twelve, so both caps have something to cut.
const MANY = Array.from({ length: 12 }, (_, i) => ({ character: `Person ${i + 1}`, actor: `Actor ${i + 1}` }))

const asPhone = (matches) => {
  window.matchMedia = (media) => ({
    matches, media, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })
}

// A controlled box, exactly as every caller wires it.
function Box({ cast = CAST, field = 'character', start = '' }) {
  const [v, setV] = useState(start)
  return (
    <div>
      <CastCombo label="Character" value={v} onChange={setV} cast={cast} field={field} placeholder="who says it" />
      <span data-testid="value">{v}</span>
    </div>
  )
}

const box = () => screen.getByRole('combobox')
const options = () => screen.queryAllByRole('option')
const value = () => screen.getByTestId('value').textContent

beforeEach(() => {
  asPhone(false)
})

describe('the cast dropdown', () => {
  it('opens on focus, before anything is typed', () => {
    render(<Box />)
    expect(options()).toHaveLength(0)
    fireEvent.focus(box())
    // THE REGRESSION, in one assertion. The datalist showed nothing until a
    // keystroke, so a reader who did not already know the list was there never
    // found out.
    expect(options().map((o) => o.textContent)).toEqual([
      'Amanda WallerViola Davis', 'Harley QuinnMargot Robbie', 'Rick FlagJoel Kinnaman',
    ])
  })

  it('names the actor beside the part', () => {
    render(<Box />)
    fireEvent.focus(box())
    // A film's cast is twenty pairs and the name you remember is as often the
    // actor's, so a list of characters alone is a list you have to translate.
    expect(document.querySelectorAll('.cast-opt-other')).toHaveLength(3)
  })

  it('has no second column when the cast has no actors, which is a book', () => {
    render(<Box cast={[{ character: 'Ahab', actor: '' }, { character: 'Ishmael', actor: '' }]} />)
    fireEvent.focus(box())
    expect(options()).toHaveLength(2)
    expect(document.querySelectorAll('.cast-opt-other')).toHaveLength(0)
  })

  it('matches a substring, not only a prefix', () => {
    render(<Box />)
    fireEvent.change(box(), { target: { value: 'quinn' } })
    expect(options().map((o) => o.querySelector('.cast-opt-name').textContent)).toEqual(['Harley Quinn'])
  })

  it('matches the actor as well, because that is the half people remember', () => {
    render(<Box />)
    fireEvent.change(box(), { target: { value: 'robbie' } })
    expect(options().map((o) => o.querySelector('.cast-opt-name').textContent)).toEqual(['Harley Quinn'])
  })

  it('picking a row writes the character, not the actor', () => {
    render(<Box />)
    fireEvent.focus(box())
    fireEvent.click(screen.getByText('Harley Quinn'))
    expect(value()).toBe('Harley Quinn')
    // And the list closes, rather than standing over the form with one row in it.
    expect(options()).toHaveLength(0)
  })

  it('takes a name the cast has never heard of', () => {
    // The point of a memory aid rather than a vocabulary: half the lines worth
    // keeping are spoken by somebody the provider never credited.
    render(<Box />)
    fireEvent.change(box(), { target: { value: 'the bartender' } })
    // STORED VERBATIM. This box used to capitalise as you typed; the rule is gone
    // and the keyboard hint (autocapitalize="words") does that job on a phone,
    // where the reader can disagree with it by pressing shift.
    expect(value()).toBe('the bartender')
    expect(options()).toHaveLength(0) // nothing matches, and that is not an error
  })

  it('drops the row that is already in the box', () => {
    render(<Box start="Harley Quinn" />)
    fireEvent.focus(box())
    // A panel over the form whose only row is what you have already typed says
    // nothing and hides the box saying it.
    expect(options().map((o) => o.querySelector('.cast-opt-name').textContent)).not.toContain('Harley Quinn')
  })

  it('arrow keys and Enter pick without the mouse', () => {
    render(<Box />)
    fireEvent.focus(box())
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'ArrowDown' })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(value()).toBe('Harley Quinn')
  })

  it('leaves Enter alone when no row is highlighted', () => {
    // Enter in a form field submits the form. Swallowing it unconditionally makes
    // the dropdown a trap on the control most likely to be the last thing typed.
    let submitted = 0
    const { container } = render(
      <form onSubmit={(e) => { e.preventDefault(); submitted += 1 }}>
        <Box />
        <button type="submit">Save</button>
      </form>,
    )
    fireEvent.focus(box())
    fireEvent.keyDown(box(), { key: 'Enter' })
    // jsdom does not submit on Enter in a text input, so the claim asserted here
    // is the one this component controls: it did not preventDefault and did not
    // consume the key by picking a row.
    expect(value()).toBe('')
    expect(container).toBeTruthy()
    expect(submitted).toBe(0)
  })

  it('shows ten on a desktop', () => {
    render(<Box cast={MANY} />)
    fireEvent.focus(box())
    expect(options()).toHaveLength(10)
  })

  it('shows five on a phone, where the panel covers the form', () => {
    asPhone(true)
    render(<Box cast={MANY} />)
    fireEvent.focus(box())
    expect(options()).toHaveLength(5)
  })

  it('can hold the actor instead, and then offers actors', () => {
    render(<Box field="actor" />)
    fireEvent.focus(box())
    expect(options().map((o) => o.querySelector('.cast-opt-name').textContent)).toEqual([
      'Viola Davis', 'Margot Robbie', 'Joel Kinnaman',
    ])
    fireEvent.click(screen.getByText('Margot Robbie'))
    expect(value()).toBe('Margot Robbie')
  })
})
