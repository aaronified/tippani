// The person panel and the character page: the three scopes, and what each one
// promises.
//
// THE SENTENCES ARE THE FEATURE. "On this work" and "the record" write to two
// different endpoints with two very different blast radii, and the only thing
// standing between a reader and renaming an author on thirty-one books is the
// line under each heading saying which one they are in. A test that checked the
// fields existed and not the sentences would pass on a panel that had quietly
// lost the distinction — which is the failure worth guarding.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let PERSON
let CHARACTER
let CALLS
let HITS
let MERGED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path.startsWith('/people/id/')) return { ok: true, data: PERSON }
    if (method === 'GET' && path.startsWith('/characters/')) return { ok: true, data: CHARACTER }
    if (method === 'POST' && path.includes('/aliases')) {
      // The server answers 204 and the panel reloads, so the added spelling has to
      // be in the record the reload returns rather than pushed in locally.
      CHARACTER = { ...CHARACTER, aliases: [...CHARACTER.aliases, body.alias].sort() }
      PERSON = { ...PERSON, aliases: [...PERSON.aliases, body.alias].sort() }
      return { ok: true, data: {} }
    }
    if (method === 'GET' && path.startsWith('/people/search')) return { ok: true, data: { people: HITS } }
    if (method === 'POST' && path === '/people/merge') {
      MERGED = body
      return { ok: true, data: {} }
    }
    if (method === 'DELETE' && path.includes('/aliases')) {
      const gone = decodeURIComponent(path.split('alias=')[1])
      CHARACTER = { ...CHARACTER, aliases: CHARACTER.aliases.filter((a) => a !== gone) }
      PERSON = { ...PERSON, aliases: PERSON.aliases.filter((a) => a !== gone) }
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { personPanel, characterPanel } = await import('../../src/identity.jsx')

// The panel machinery renders through a portal from a descriptor; the body is
// what this file is about, so it is rendered directly.
const body = (panel) => panel.render()

beforeEach(() => {
  CALLS = []
  HITS = [{ id: 9, name: 'Orson Welles Jr', works: 2 }]
  MERGED = null
  PERSON = {
    id: 7,
    name: 'Mikhail Bulgakov',
    sort_name: 'Bulgakov, Mikhail',
    born: '1891',
    died: '1940',
    note: '',
    aliases: ['M. Bulgakov'],
    credits: [
      { kind: 'book', work_id: 1, title: 'The Master and Margarita', role: 'author', credit_as: '' },
      { kind: 'book', work_id: 2, title: 'The White Guard', role: 'author', credit_as: 'M. Bulgakov' },
    ],
    roles: [],
  }
  CHARACTER = {
    id: 3,
    name: 'Woland',
    sort_name: '',
    description: '',
    note: '',
    aliases: ['Messire'],
    appearances: [
      { cast_id: 11, kind: 'book', work_id: 1, work_title: 'The Master and Margarita', character: 'Woland', actor_id: 0, actor: '' },
      { cast_id: 12, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)', character: 'Woland', actor_id: 9, actor: 'Oleg Basilashvili' },
    ],
  }
})
afterEach(() => cleanup())

describe('a person panel says which scope you are in', () => {
  it('names the work, and says the change stops there', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov', work: { kind: 'book', id: 1, title: 'The Master and Margarita', role: 'author' } })))
    await screen.findByText('on this work')
    // THE SENTENCE, not just the heading. Without it a reader believes the field
    // below renames the author everywhere.
    expect(screen.getByText(/no other work/i)).toBeTruthy()
    expect(screen.getByText(/reaches every work/i)).toBeTruthy()
  })

  // OPENED FROM A LIST THERE IS NO WORK TO BE ON, so the section is absent rather
  // than present and inert. A disabled "on this work" over no work is a control
  // whose only possible outcome is confusion.
  it('leaves the work scope out entirely when there is no work', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('across the library')
    expect(screen.queryByText('on this work')).toBeNull()
  })

  it('writes the work spelling to /credits and the record to /people/id', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov', work: { kind: 'book', id: 1, title: 'The Master and Margarita', role: 'author' } })))
    await screen.findByText('on this work')

    const saves = screen.getAllByText('Save').map((n) => n.closest('button'))
    act(() => saves[0].click())
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/credits')).toBe(true))
    // THE TWO WRITES ARE TWO ENDPOINTS. One handler taking both would be one
    // request away from the mistake the whole panel is shaped to prevent.
    expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people/id/7')).toBe(false)

    act(() => saves[1].click())
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people/id/7')).toBe(true))
  })

  it('lists every work the record is credited on, with the spelling each one prints', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('The Master and Margarita')
    expect(screen.getByText('The White Guard')).toBeTruthy()
    // The second book prints a different spelling, which is credit_as doing the
    // thing that makes one record and two covers possible at once.
    expect(screen.getByText(/as M\. Bulgakov/)).toBeTruthy()
  })
})

describe('the aliases are what find the record', () => {
  it('adds one and shows it back from the reload, not from local state', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await screen.findByText('Messire')

    fireEvent.change(screen.getByPlaceholderText('another spelling…'), { target: { value: 'the professor' } })
    act(() => screen.getByText('Add').closest('button').click())
    await screen.findByText('the professor')
    expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/characters/3/aliases' && b.alias === 'the professor')).toBe(true)
  })

  it('removes one by its own chip', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    const chip = (await screen.findByText('Messire')).closest('span')
    // TWO CONTROLS ON THE CHIP NOW, and the × is the second: characters offer
    // split-out as well, which 0056 shipped an endpoint for and only the person
    // panel ever wired up. So a reader who welded two Wolands together had a way
    // back on one of the two tables.
    act(() => within(chip).getByLabelText(/Remove the spelling Messire/).click())
    await waitFor(() => expect(screen.queryByText('Messire')).toBeNull())
  })

  it('offers split-out on a character, not only on a person', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    const chip = (await screen.findByText('Messire')).closest('span')
    act(() => within(chip).getByText('split out').click())
    await waitFor(() => expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/characters/3/split' && b.alias === 'Messire')).toBe(true))
  })
})

describe('the two records reach each other', () => {
  // The owner's ruling: a character page names its performer, and an actor's page
  // lists every character they have played. Both directions come off work_cast.
  it('a character pushes the performer, and only where one is linked', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await screen.findByText('Oleg Basilashvili')

    act(() => screen.getByText('Oleg Basilashvili').click())
    expect(stack.push).toHaveBeenCalledTimes(1)

    // A BOOK CHARACTER HAS NO PERFORMER, and the card draws nothing rather than an
    // empty slot — a slot invites a value and there is nothing true to put in it.
    // Asserted against the performer specifically rather than "no buttons at all":
    // the card carries its own picture control and its own removal now, and a
    // count of buttons would pass or fail on either of those instead.
    const bookCard = screen.getByText('The Master and Margarita').closest('.char-work')
    expect(within(bookCard).queryByText('Oleg Basilashvili')).toBeNull()
    expect(within(bookCard).queryByRole('link')).toBeNull()
  })

  it('a performer pushes the character', async () => {
    PERSON = {
      ...PERSON,
      roles: [{ cast_id: 12, kind: 'movie', work_id: 5, work_title: 'The Master and Margarita (2005)', character: 'Woland', character_id: 3 }],
    }
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Oleg Basilashvili' })))
    await screen.findByText('Woland')
    act(() => screen.getByText('Woland').click())
    expect(stack.push).toHaveBeenCalledTimes(1)
  })
})

describe('merging two records into one', () => {
  // THE COPY IS THE FEATURE HERE, exactly as with the scopes above. Merge is the
  // one act in this model that destroys a record, and what a reader needs before
  // they press it is not "are you sure" but the three facts the dialog carries:
  // the other record goes, its works come here, and no cover changes.
  it('asks first, and the confirm says what will happen', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('across the library')

    fireEvent.change(screen.getByPlaceholderText('find the other record…'), { target: { value: 'Welles' } })
    const hit = await screen.findByText('Orson Welles Jr')
    // A NAME ALONE CANNOT TELL TWO RECORDS APART, which is the case this control
    // exists to resolve, so each hit says how much hangs off it.
    expect(screen.getByText('2 works')).toBeTruthy()

    act(() => hit.click())
    await screen.findByText(/stops being a record/)
    expect(screen.getByText(/No cover changes/)).toBeTruthy()
    expect(screen.getByText(/bin holds the way back/)).toBeTruthy()
    // Nothing has been written yet — the dialog is a question, not a receipt.
    expect(MERGED).toBeNull()

    act(() => screen.getByText('Merge them').closest('button').click())
    await waitFor(() => expect(MERGED).toEqual({ keep_id: 7, drop_id: 9 }))
  })

  it('never offers this record as its own merge target', async () => {
    HITS = [
      { id: 7, name: 'Mikhail Bulgakov', works: 2 },
      { id: 9, name: 'M. Bulgakov', works: 1 },
    ]
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('across the library')

    fireEvent.change(screen.getByPlaceholderText('find the other record…'), { target: { value: 'Bulgakov' } })
    await screen.findByText('M. Bulgakov')
    // Merging a record into itself is refused by the server, so a row for it here
    // would be a control whose only possible outcome is an error.
    expect(screen.queryByText('1 work')).toBeTruthy()
    expect(screen.queryAllByText('Mikhail Bulgakov')).toHaveLength(0)
  })
})
