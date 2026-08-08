// utteranceMeta — the line under a standalone quote, in its three modes.
//
// Worth testing at this depth because the thing it replaced was a join() and
// the failure modes are all quiet ones: a speaker who is text instead of a
// link, a person named twice on one card, or a proverb that gains an empty
// label and the spacing that comes with it. None of those throw.

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { utteranceMeta } from '../../src/Quotes.jsx'

const BOSE = {
  quote: 'Give me blood, and I will give you freedom.',
  speaker: 'Subhas Chandra Bose',
  occasion: 'Burma Radio broadcast',
  occasion_date: '1944',
  place: 'Burma',
  medium: 'radio',
}

// A proverb: the whole point of the kind is that these fields can all be empty.
const PROVERB = { quote: 'Measure twice, cut once.' }

const people = {
  'Subhas Chandra Bose': { id: 1, name: 'Subhas Chandra Bose', image_path: 'p/bose.jpg' },
}

const show = (node) => render(<div data-testid="meta">{node}</div>)

describe('the plain string mode', () => {
  it('reads speaker first, then the occasion', () => {
    expect(utteranceMeta(BOSE)).toBe('Subhas Chandra Bose · Burma Radio broadcast · 1944 · Burma · radio')
  })

  it('drops the fields that are empty', () => {
    expect(utteranceMeta({ speaker: 'Anon', medium: 'letter' })).toBe('Anon · letter')
  })

  it('is empty for a proverb', () => {
    expect(utteranceMeta(PROVERB)).toBe('')
  })

  it('renders a bare year as a year', () => {
    // Not through the shelf's date formatter: `new Date('1944')` is a valid
    // Date and would print as a January morning nobody recorded.
    expect(utteranceMeta({ occasion_date: '1944' })).toBe('1944')
  })
})

describe('omitSpeaker', () => {
  it('leaves the speaker out for a surface that credits them above', () => {
    expect(utteranceMeta(BOSE, { omitSpeaker: true })).toBe('Burma Radio broadcast · 1944 · Burma · radio')
  })

  it('is empty when the speaker was the only thing there', () => {
    expect(utteranceMeta({ speaker: 'Anon' }, { omitSpeaker: true })).toBe('')
  })
})

describe('the credited mode', () => {
  const opts = (onOpenPerson = () => {}) => ({ people, seps: undefined, onOpenPerson })

  it('makes the speaker a button, not text', () => {
    show(utteranceMeta(BOSE, opts()))
    expect(screen.getByRole('button', { name: /Subhas Chandra Bose/ })).toBeTruthy()
  })

  it('opens the person panel for the speaker kind', () => {
    const onOpenPerson = vi.fn()
    show(utteranceMeta(BOSE, opts(onOpenPerson)))
    screen.getByRole('button', { name: /Subhas Chandra Bose/ }).click()
    // The kind matters: 'speaker' is its own people kind as of 1.5.0, and
    // opening the panel on 'author' would show a different person's record.
    expect(onOpenPerson).toHaveBeenCalledWith({ kind: 'speaker', name: 'Subhas Chandra Bose' })
  })

  it('shows the saved portrait', () => {
    const { container } = show(utteranceMeta(BOSE, opts()))
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toContain('p/bose.jpg')
  })

  it('shows no portrait for a speaker with no saved photo', () => {
    const { container } = show(utteranceMeta({ speaker: 'Nobody Known' }, opts()))
    expect(container.querySelector('img')).toBeNull()
    // Still a link, though — clicking is how you GIVE them a photo.
    expect(screen.getByRole('button', { name: /Nobody Known/ })).toBeTruthy()
  })

  it('splits a credit that names two people', () => {
    // The share image splits the speaker with the same function, so the card
    // and the exported image have to agree about who is credited.
    //
    // Asserted by COUNT and by exact name. The first version of this test used
    // /Subhas Chandra Bose/ and /Nobody Known/ against a combined string, and
    // both matched the single unsplit button as substrings — so it passed
    // whether the split happened or not.
    show(utteranceMeta({ speaker: 'Subhas Chandra Bose, Nobody Known' }, opts()))
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons.map((b) => b.textContent)).toEqual(['Subhas Chandra Bose', 'Nobody Known'])
  })

  it('leaves a name containing no separator alone', () => {
    show(utteranceMeta({ speaker: 'Subhas Chandra Bose' }, opts()))
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].textContent).toBe('Subhas Chandra Bose')
  })

  it('still shows the occasion beside the speaker', () => {
    show(utteranceMeta(BOSE, opts()))
    expect(screen.getByTestId('meta').textContent).toContain('Burma Radio broadcast')
    expect(screen.getByTestId('meta').textContent).toContain('radio')
  })

  it('returns an empty STRING for a proverb, not an empty element', () => {
    // AnnotationCard renders this as `{metaLine && <MonoLabel>}`. A JSX element
    // is always truthy, so returning <></> here would give every proverb an
    // empty label and its spacing — a silent layout change, not an error.
    expect(utteranceMeta(PROVERB, opts())).toBe('')
  })

  it('renders the occasion alone when there is no speaker', () => {
    const node = utteranceMeta({ occasion: 'a letter home' }, opts())
    expect(node).not.toBe('')
    show(node)
    expect(screen.getByTestId('meta').textContent).toBe('a letter home')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
