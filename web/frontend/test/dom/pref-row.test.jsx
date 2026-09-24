// The row that sets one preference, and the other half of the pair recordRow began.
//
// WHY IT IS TESTED APART FROM SETTINGS, which is recordRow's reasoning and holds
// here for the same reason: this row is drawn on every section of Settings and
// will be drawn on Account, so a defect in it is a defect on all of them. A test
// that reached it through one section would pass while the others were wrong.
//
// AND IT KNOWS THE COMPONENT, which the repo's tier rule allows only with a
// stated reason. The reason: what it guards are promises to callers that do not
// exist yet — that a row with nothing to explain draws no explanation, that an
// info dot appears only where there is something to say, that the changed mark is
// a mark and not a word. The browser tier sees one section's rendering of it; it
// cannot see a contract whose other callers have not been written.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PrefGroup, PrefRow, changedCount } from '../../src/prefRow.jsx'

describe('what a row says', () => {
  it('names the preference', () => {
    render(<PrefRow label="Which one you see" />)
    expect(screen.getByText('Which one you see')).toBeTruthy()
  })

  // A ROW SAYS A THING ONCE. The sub-line earns its place by carrying something
  // the label does not, so a row with nothing more to say draws nothing more —
  // not an empty paragraph, which is a gap a reader reads as a missing word.
  it('draws no sub-line when there is nothing the label does not already say', () => {
    const { container } = render(<PrefRow label="Which one you see" />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })

  it('draws one when the caller has something to add', () => {
    render(<PrefRow label="True glass" sub="Off is the light choice." />)
    expect(screen.getByText('Off is the light choice.')).toBeTruthy()
  })

  // AN INFO DOT ON EVERY ROW IS A ROW OF DOTS, and a reader stops pressing any of
  // them. It appears only where the caller gave it a paragraph.
  it('offers an explanation only where there is one', () => {
    const { rerender } = render(<PrefRow label="Ground" />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<PrefRow label="Ground" info="What the app sits on." />)
    expect(screen.getByRole('button')).toBeTruthy()
  })
})

describe('the changed mark', () => {
  // IT IS A MARK, NOT A WORD. A row that said "changed" would say it in the space
  // its own explanation needs, and on a section where half the rows are touched it
  // would be a column of the same word.
  it('marks a row the reader has moved off its default', () => {
    const { container } = render(<PrefRow label="Ground" changed />)
    expect(container.querySelector('.pref-row-dot')).toBeTruthy()
  })

  it('leaves an untouched row unmarked', () => {
    const { container } = render(<PrefRow label="Ground" />)
    expect(container.querySelector('.pref-row-dot')).toBeNull()
  })

  // The mark is decoration for the count, which is the thing that carries meaning
  // — so it is hidden from a reader who is being read to rather than announced as
  // a stray bullet.
  it('does not announce itself to a screen reader', () => {
    const { container } = render(<PrefRow label="Ground" changed />)
    expect(container.querySelector('.pref-row-dot').getAttribute('aria-hidden')).toBe('true')
  })

  it('counts what a section has to report', () => {
    expect(changedCount([true, false, true, undefined, null])).toBe(2)
    expect(changedCount([])).toBe(0)
  })
})

describe('the control', () => {
  // THE ROW DRAWS NO CONTROL. The caller passes one, so this never becomes a
  // registry of every kind of input the app has — which is the shape the pack's
  // own row took, with fourteen branches in it.
  it('takes whatever the caller hands it', () => {
    render(<PrefRow label="Which one you see" control={<button type="button">System</button>} />)
    expect(screen.getByRole('button', { name: 'System' })).toBeTruthy()
  })

  it('draws no control slot at all when there is none', () => {
    const { container } = render(<PrefRow label="Which one you see" />)
    expect(container.querySelector('.pref-row-control')).toBeNull()
  })
})

describe('a group of them', () => {
  // THE NUMBER IS THE SECTION'S TO GIVE (useCardNumbers, counting the cards on
  // the screen), so a group alone draws only its title. The numbering itself is
  // asked of a real screen: test/journeys/cards-counted-where-they-stand.
  it('draws its title and no number of its own', () => {
    render(<PrefGroup title="Light and dark"><PrefRow label="Mode" /></PrefGroup>)
    expect(screen.getByText('Light and dark')).toBeTruthy()
  })

  // The aside is a fact about the group — which material set is on, how many looks
  // are saved — and not a second heading, so it does not compete with the first.
  it('carries an aside without making it a heading', () => {
    render(<PrefGroup title="What it is made of" aside="Manuscript"><PrefRow label="Set" /></PrefGroup>)
    expect(screen.getByText('Manuscript').tagName).not.toBe('H2')
  })
})
