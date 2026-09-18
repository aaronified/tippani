// The row every list in the app is drawn with.
//
// WHY IT IS TESTED APART FROM THE SCREENS, which is `character-rows.test.jsx`'s
// reasoning and applies here with more force: that vocabulary serves five sheets,
// this row serves every console and, once the v3 port reaches them, Library,
// Catalogue, Quotes and the rest. A defect in it is a defect on all of them, and a
// test that reached it through one screen would pass while the others were wrong.
//
// AND THIS FILE KNOWS THE COMPONENT, which the repo's testing rule says a test may
// not do without declaring why. The declaration: `RecordRow` IS the observable
// unit here. What the browser tier can see is one console's rendering of it — the
// journey `reading-the-metadata-console` does exactly that, and it is what proves
// the row works in the app. What that tier cannot see is a promise the row makes to
// every FUTURE caller, before those callers exist: that an action declaring itself
// a toggle announces its state, and that one that does not declare itself a toggle
// stays silent. Nothing observable can assert a contract whose callers have not been
// written yet, and the first draft of this component broke exactly that contract
// with every existing screen still rendering correctly.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { RecordRow, RowArt } from '../../src/recordRow.jsx'

describe('a latched glyph says so', () => {
  // THE REGRESSION THIS EXISTS FOR. The hand-rolled action cluster this component
  // replaced passed `aria-pressed` through FieldIconButton's `...rest`. The first
  // draft enumerated the props it forwarded and dropped it, so both toggles on
  // every book and film row went on drawing their latched state and stopped
  // announcing it. It rendered correctly, every suite stayed green, and only a
  // screen reader could tell.
  it('announces a pressed toggle', () => {
    render(
      <RecordRow
        name="Pather Panchali"
        actions={[{ key: 'edit', icon: <svg />, ariaLabel: 'Edit', pressed: true, onClick: () => {} }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('announces an unpressed toggle rather than going silent', () => {
    render(
      <RecordRow
        name="Pather Panchali"
        actions={[{ key: 'edit', icon: <svg />, ariaLabel: 'Edit', pressed: false, onClick: () => {} }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('false')
  })

  // AND THE OTHER HALF, which is not symmetry for its own sake: `aria-pressed="false"`
  // on a one-shot verb tells a reader the button is a toggle that is currently off,
  // which is a lie about what pressing it does. An action with no `pressed` is a
  // plain button and must carry no attribute at all.
  it('leaves a one-shot verb unmarked', () => {
    render(
      <RecordRow
        name="Pather Panchali"
        actions={[{ key: 'open', icon: <svg />, ariaLabel: 'Open', onClick: () => {} }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Open' }).hasAttribute('aria-pressed')).toBe(false)
  })
})

describe('the grammar', () => {
  // THE NAME AND ITS SUB-LINE ARE TWO BLOCKS, which is the arrangement the whole
  // change is about: a name line that also carried the credit put its edge fade
  // inside the punctuation. The journey asserts this on a real screen; here it is
  // asserted as a promise to callers that do not exist yet.
  it('puts the name and the sub-line in separate blocks', () => {
    const { container } = render(<RecordRow name="Pather Panchali" sub="Satyajit Ray · 12 quotes" />)
    const name = screen.getByText('Pather Panchali')
    const sub = screen.getByText('Satyajit Ray · 12 quotes')
    expect(name.closest('p')).not.toBe(sub.closest('p'))
    expect(container.textContent).toContain('Satyajit Ray')
  })

  it('says nothing when a row has no sub-line', () => {
    const { container } = render(<RecordRow name="Pather Panchali" />)
    // The absence of a thing is not worth a sentence — no empty paragraph, and
    // nothing announcing that there is nothing.
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('draws the chips a row wears, and marks the ones that are findings', () => {
    render(<RecordRow name="Pather Panchali" chips={[{ label: 'No cover', warn: true }, 'Library']} />)
    expect(screen.getByText('No cover')).toBeTruthy()
    expect(screen.getByText('Library')).toBeTruthy()
  })

  // A row with nothing missing says so; a row whose caller has nothing worth saying
  // says nothing. Both are the say-it-once rule, from opposite sides.
  it('speaks for an empty chip list only when the caller gave it words', () => {
    const { rerender, container } = render(<RecordRow name="Pather Panchali" chips={[]} chipsEmpty="complete" />)
    expect(screen.getByText('complete')).toBeTruthy()
    rerender(<RecordRow name="Pather Panchali" chips={[]} />)
    expect(container.textContent).not.toContain('complete')
  })

  it('takes the caller words for its selection box, having none of its own', () => {
    const onChange = vi.fn()
    render(<RecordRow name="Pather Panchali" select={{ checked: false, onChange, tip: 'Select this book' }} />)
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })
})

describe('a missing picture is the finding', () => {
  // The empty slot keeps its space and wears a mark, so a console whose job is
  // "what is missing" does not hide the thing a row is in the list for.
  it('names the gap when there is no image', () => {
    render(<RowArt src="" alt="No cover stored" />)
    expect(screen.getByRole('img', { name: 'No cover stored' })).toBeTruthy()
  })

  // AND THE PRESENT ONE IS DECORATIVE, because the row's name already says which
  // work this is: alt text repeating it would have a reader hear the title twice.
  it('leaves a present image unnamed, the title beside it having said it', () => {
    const { container } = render(<RowArt src="/cover.jpg" alt="No cover stored" />)
    expect(container.querySelector('img').getAttribute('alt')).toBe('')
  })
})
