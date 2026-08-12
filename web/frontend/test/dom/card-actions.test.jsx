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
const colours = () => document.querySelector('.card-colors')

describe.each([
  ['a book annotation', (over) => annotation(over)],
  ['a film dialogue', (over) => dialogue(over)],
])('the action row on %s', (_name, mount) => {
  it('puts copy and share on the card, not in the overflow', () => {
    mount()
    expect(btn('Copy'), 'the copy glyph').toBeTruthy()
    expect(btn('Share'), 'the share glyph').toBeTruthy()
    openOverflow()
    expect(within(menu()).queryByText('Share'), 'share is still in the ⋯').toBeNull()
    expect(within(menu()).queryByText('Copy'), 'copy is in the ⋯').toBeNull()
  })

  it('keeps edit and delete in the overflow', () => {
    // The two that change or destroy what somebody wrote down. A sweep of the
    // pointer should not be able to reach either.
    mount()
    expect(btn('Edit')).toBeNull()
    expect(btn('Delete')).toBeNull()
    openOverflow()
    expect(within(menu()).getByText('Edit')).toBeTruthy()
    expect(within(menu()).getByText('Delete')).toBeTruthy()
  })

  it('reads favourite · copy · share · colour, then the overflow', () => {
    // Order is the whole request. The ♥ leads because it is the card's resting
    // mark, copy and share follow because they are what you do with a quote, the
    // colour dots come after because they are a note to yourself, and the ⋯ is
    // alone on the right where a destructive action belongs.
    mount()
    expect(precedes(heart(), btn('Copy')), '♥ before copy').toBe(true)
    expect(precedes(btn('Copy'), btn('Share')), 'copy before share').toBe(true)
    expect(precedes(btn('Share'), colours()), 'share before the colour dots').toBe(true)
    expect(precedes(colours(), btn('More actions')), 'colours before the ⋯').toBe(true)
  })

  it('fires the handlers it was given', () => {
    mount()
    fireEvent.click(btn('Copy'))
    fireEvent.click(btn('Share'))
    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('shows no empty tool row where a surface offers neither', () => {
    // QuoteTools is absent, not present-and-inert: an invisible 6px gap between
    // the ♥ and the colour dots is a layout bug nobody can point at.
    mount({ onCopy: undefined, onShare: undefined })
    expect(btn('Copy')).toBeNull()
    expect(btn('Share')).toBeNull()
    expect(btn('More actions'), 'the overflow survives').toBeTruthy()
  })
})

describe.each([
  ['a book annotation', (over) => annotation(over)],
  ['a film dialogue', (over) => dialogue(over)],
])('the context menu on %s', (_name, mount) => {
  it('offers exactly what the row and the ⋯ offer, in one list', () => {
    // THE REASON THE REGISTRY EXISTS, asserted on a real card rather than on the
    // registry alone: a menu that offers Delete beside a row that does not looks
    // completely normal on both, and the divergence only surfaces when somebody
    // wonders why they cannot do to forty what they just did to one.
    mount()
    fireEvent.contextMenu(document.querySelector('.card-menu-host'), { clientX: 30, clientY: 30 })
    const inMenu = within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent)
    expect(inMenu).toEqual(['Copy', 'Share', 'Edit', 'Delete'])
  })

  it('fires the same handler the glyph does', () => {
    mount()
    fireEvent.contextMenu(document.querySelector('.card-menu-host'), { clientX: 30, clientY: 30 })
    fireEvent.click(within(screen.getByRole('menu')).getByText('Copy'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('is not offered on the card’s own buttons', () => {
    mount()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Share' }), { clientX: 5, clientY: 5 })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

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

  it('is plain, not WhatsApp', async () => {
    // The dialog opens on WhatsApp because whoever went there is choosing where
    // the quote is going. A glyph on a card is not that choice, and *asterisks*
    // land as asterisks everywhere except the one app that eats them.
    await copyQuote(earthsea())
    expect(written()).not.toMatch(/[*_>]/)
  })

  it('holds back the same parts the dialog holds back', async () => {
    // shareDefaults is shared with ShareDialog so these cannot drift. The page
    // number and the save-date are factual noise to a reader.
    await copyQuote(earthsea())
    expect(written()).not.toContain('12')
    expect(written()).not.toContain('2026-08-01')
  })

  it('says so when the clipboard refuses', async () => {
    // Insecure origins have no navigator.clipboard and execCommand can fail too.
    // Silence there means somebody pastes their previous clipboard into a
    // message and does not find out from us.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    // jsdom has no execCommand at all, so it is defined here rather than spied:
    // a test that leaned on its absence would stop testing the refusal the day
    // jsdom grows one.
    document.execCommand = vi.fn(() => false)
    expect(await copyQuote(earthsea())).toBe(false)
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    delete document.execCommand
  })
})
