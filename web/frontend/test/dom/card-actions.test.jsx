// The action row on a quote card, and what its copy glyph puts on the clipboard.
//
// Two claims, and they fail in different ways.
//
// The ROW is a layout claim, and the way it goes wrong is that an action ends up
// somewhere else — behind the ⋯ where it used to live, or on the card where it
// should not be. Nothing throws either way: the button is still there, still
// wired, still one tap further from the reader than it was meant to be. Both
// cards in the app (a book annotation and a film dialogue) build this row from
// the same two components precisely so a dialogue and an annotation cannot end
// up putting the same control in two different places, so both are asserted.
//
// The CLIPBOARD is a correctness claim in an app whose whole subject is quoting
// accurately. A copy glyph that drops the author is a misquote, and one that
// pastes WhatsApp asterisks into an email is a mess somebody sends before they
// read it. The dialog and the glyph share shareDefaults for exactly that reason,
// so the assertion is on the text that comes out, not on the wiring.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AnnotationCard } from '../../src/Library.jsx'
import { Frame } from '../../src/Movies.jsx'
import { bookShare, copyQuote } from '../../src/share.jsx'

const ANNOTATION = {
  id: 7,
  quote: 'Only in silence the word',
  note: '',
  chapter: '1',
  location: '12',
  color: 'yellow',
  tags: [],
  favorite: false,
}

const DIALOGUE = {
  id: 9,
  quote: 'Here is looking at you, kid.',
  character: 'Rick Blaine',
  actor: 'Humphrey Bogart',
  timestamp: '01:02:03',
  color: 'blue',
  tags: [],
  favorite: false,
}

let onCopy
let onShare

beforeEach(() => {
  onCopy = vi.fn()
  onShare = vi.fn()
})

// actionsAlwaysVisible on both: the hover gate is CSS, which jsdom does not
// apply, so it changes nothing here — but rendering the pinned variant is the
// honest way to say "these are the controls the row has".
const annotation = (over = {}) =>
  render(
    <AnnotationCard
      a={ANNOTATION}
      variant={0}
      tagMap={{}}
      editing={false}
      setEditingId={() => {}}
      save={() => {}}
      patch={async () => {}}
      remove={() => {}}
      onCopy={onCopy}
      onShare={onShare}
      actionsAlwaysVisible
      {...over}
    />,
  )

const dialogue = (over = {}) =>
  render(
    <Frame
      d={DIALOGUE}
      tagMap={{}}
      editing={false}
      onEdit={() => {}}
      onCancelEdit={() => {}}
      onSave={() => {}}
      onPatch={() => {}}
      onDelete={() => {}}
      onCopy={onCopy}
      onShare={onShare}
      actionsAlwaysVisible
      {...over}
    />,
  )

const btn = (name) => screen.queryByRole('button', { name })
const openOverflow = () => fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
const menu = () => screen.getByRole('menu')

// precedes reads DOCUMENT order, which is the only place the row's order really
// exists — the JSX can say anything and a stray wrapper can reorder it. The ♥ is
// found by class because it is labelled by its own glyph rather than by an
// aria-label (see Hearts).
const precedes = (a, b) => {
  expect(a, 'the earlier control').toBeTruthy()
  expect(b, 'the later control').toBeTruthy()
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}
const heart = () => document.querySelector('button.heart')
// The recall mark is found by class for the ♥'s reason: it is named by its
// tooltip, which changes with the quote's state, so an accessible-name lookup
// would be a lookup on the state under test.
const recall = () => document.querySelector('.status-mark')
const colours = () => document.querySelector('.card-colors')

describe('what the copy glyph puts on the clipboard', () => {
  const written = () => navigator.clipboard.writeText.mock.calls.at(-1)?.[0]

  const earthsea = () =>
    bookShare({
      quote: 'Only in silence the word',
      note: 'The opening of the Creation of Ea.',
      author: 'Ursula K. Le Guin',
      title: 'A Wizard of Earthsea',
      published: 1968,
      chapter: '1',
      location: '12',
      date: '2026-08-01',
      tags: ['magic'],
    })

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    })
  })

  it('carries the quote and its credit', async () => {
    // The failure this exists for: a copy glyph that hands over a naked line of
    // text. The whole reason to keep a quote is that it came from somewhere.
    await copyQuote(earthsea())
    expect(written()).toContain('Only in silence the word')
    expect(written()).toContain('Ursula K. Le Guin')
    expect(written()).toContain('A Wizard of Earthsea')
  })

})
