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

// openSpellings — press the name row, which is what reveals the chips.
//
// THE ROW IS THE DISPLAY AND THE CHIPS ARE ITS EDITOR, which is how the design
// pack draws every row it has: the row lists every spelling as its second line,
// so a chip list open beneath it printed each alias twice and left the reader
// working out whether the two lists were the same thing. Split is a verb per
// spelling and cannot live in a single line of them, so the chips stayed — behind
// the press rather than beside it.
const openSpellings = async (label) => {
  const row = (await screen.findByText(label)).closest('.cs-row')
  act(() => row.click())
}

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
    lines: [
      {
        id: 1, kind: 'screen', text: 'Round up the usual suspects.', name: 'Claude Rains',
        work_title: 'Casablanca',
        // The roster, which on a PERSON's record is not the name the line prints
        // — that one is the performer. See identity_reads_test.go.
        character_images: [{ name: 'Renault', path: 'renault.jpg' }, { name: 'Rick', path: '' }],
      },
    ],
    shared_lines: 0,
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
    lines: [
      // The FILM's title, not the book's: the appearance cards above already print
      // 'The Master and Margarita' exactly, and a fixture that repeats a string
      // another case looks up by exact text makes that case ambiguous rather than
      // wrong — which is a fixture bug that reads like a regression.
      { id: 4, kind: 'screen', text: 'Manuscripts don’t burn.', name: 'Woland', work_title: 'The Master and Margarita (2005)', character_images: [{ name: 'Woland', path: 'w.jpg' }] },
      // AN UTTERANCE WEARS NO CHIPS: a standalone quote has a speaker and no
      // cast, so there is nobody else on the line to name.
      { id: 5, kind: 'utterance', text: 'Everything will turn out right.', name: 'Woland', work_title: '' },
    ],
    shared_lines: 2,
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
    await screen.findByText('The person')
    expect(screen.queryByText('on this work')).toBeNull()
  })

  // AND THE GLOBAL SCREEN STILL SAYS SO, which is what this whole file is for.
  // The design pack draws `people-global` with no sentence under its first
  // heading and `char-global` with one, over the same three rows and the same
  // blast radius — so the sentence is kept on both. Losing it here would leave
  // the record's name editable with nothing saying it reaches every work.
  it('says the record reaches every work, on the screen that edits it', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('The person')
    expect(screen.getByText(/reach every work/i), 'the blast radius went unsaid').toBeTruthy()
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
    await openSpellings('Canonical name')
    // TWICE ON SCREEN BY DESIGN: the name row lists every spelling and the chip
    // below it is that row's editor, so a count is not the assertion — that the
    // reload brought the new one back is.
    await screen.findAllByText('Messire')

    fireEvent.change(screen.getByPlaceholderText('another spelling…'), { target: { value: 'the professor' } })
    act(() => screen.getByText('Add').closest('button').click())
    await screen.findAllByText('the professor')
    expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/characters/3/aliases' && b.alias === 'the professor')).toBe(true)
  })

  it('removes one by its own chip', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await openSpellings('Canonical name')
    const chip = [...document.querySelectorAll('.tp-chip, .alias-chip')]
      .find((c) => /Messire/.test(c.textContent)) || (await screen.findAllByText('Messire')).at(-1).closest('span')
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
    await openSpellings('Canonical name')
    const chip = [...document.querySelectorAll('.tp-chip, .alias-chip')]
      .find((c) => /Messire/.test(c.textContent)) || (await screen.findAllByText('Messire')).at(-1).closest('span')
    act(() => within(chip).getByText('split out').click())
    await waitFor(() => expect(CALLS.some(([m, p, b]) => m === 'POST' && p === '/characters/3/split' && b.alias === 'Messire')).toBe(true))
  })
})

describe('the two records reach each other', () => {
  // The owner's ruling: a character page names its performer, and an actor's page
  // lists every character they have played. Both directions come off work_cast.
  // WHERE THE DOOR IS NOW, and it moved rather than closed. The pack's global
  // strip tile does not name the performer: that is the local screen's CreditRow,
  // which has the picker, the open and the remove on it. So a character's own
  // screen reaches the performer through the appearance — press the work, land on
  // that work's screen, press the credit — and the FACT is kept where the door
  // used to be, on the tile face's own title, so it did not vanish meanwhile.
  it('a character reaches the performer through the appearance, and names them on the tile', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    const { container } = render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await screen.findByText('Canonical name')

    const faces = [...container.querySelectorAll('.cs-tile-chip')]
      .map((f) => f.getAttribute('title'))
    expect(faces.some((ti) => /Oleg Basilashvili/.test(ti || '')), 'the performer is named nowhere').toBe(true)
    // The book appearance has no performer, so its own tile says only the name —
    // an empty "played by" would claim nobody had filled it in.
    expect(faces.filter((ti) => /played by/.test(ti || ''))).toHaveLength(1)

    // THE TILE OPENS ITS OWN CARD rather than pushing a panel — see identity.jsx's
    // `openWork` for why — and the performer's door is on that card. The FILM's
    // tile, not the first on the strip: the book appearance has no performer, so
    // its card has no door and `container.querySelector` would find it first.
    const film = [...container.querySelectorAll('.cs-tile')]
      .find((c) => /played by/.test(c.querySelector('.cs-tile-chip')?.getAttribute('title') || ''))
    act(() => film.querySelector('.cs-tile-art').click())
    act(() => screen.getByText('Oleg Basilashvili').click())
    expect(stack.push).toHaveBeenCalledTimes(1)

    // A BOOK CHARACTER HAS NO PERFORMER, and its tile says nothing rather than
    // leaving an empty slot — a slot invites a value and there is nothing true to
    // put in it. Asserted against the performer specifically rather than "no
    // second line at all": every tile carries the work's title and this
    // character's billing on it, and a count of lines would pass or fail on those.
    const bookTile = [...container.querySelectorAll('.cs-tile')]
      .find((c) => /The Master and Margarita$/m.test(c.querySelector('.cs-tile-title')?.textContent || ''))
    expect(bookTile, 'the book appearance is not on the strip').toBeTruthy()
    expect(bookTile.textContent).not.toContain('Oleg Basilashvili')
    expect(bookTile.querySelector('.cs-tile-chip').getAttribute('title')).not.toMatch(/played by/)
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
    await screen.findByText('The person')

    fireEvent.change(screen.getByPlaceholderText('find the other record…'), { target: { value: 'Welles' } })
    const hit = await screen.findByText('Orson Welles Jr')
    // A NAME ALONE CANNOT TELL TWO RECORDS APART, which is the case this control
    // exists to resolve, so each hit says how much hangs off it.
    // SCOPED TO THE MERGE CONTROL. "2 works" is also the screen's own crumb now,
    // and the fact under test is what the CANDIDATE carries.
    expect(within(document.getElementById('person-merge')).getByText('2 works')).toBeTruthy()

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
    await screen.findByText('The person')

    fireEvent.change(screen.getByPlaceholderText('find the other record…'), { target: { value: 'Bulgakov' } })
    await screen.findByText('M. Bulgakov')
    // Merging a record into itself is refused by the server, so a row for it here
    // would be a control whose only possible outcome is an error.
    const list = within(document.getElementById('person-merge'))
    expect(list.queryByText('1 work')).toBeTruthy()
    // Scoped for the same reason: this record's name is on its own header and in
    // its name row, and neither of those is an offer to merge into itself.
    expect(list.queryAllByText('Mikhail Bulgakov')).toHaveLength(0)
  })
})

// ---- the pills on a panel's lines -------------------------------------------
//
// THE OWNER'S RULING: "same character pills should be there in the favourite
// section of the homepage / and in the character / actor page (only globals)."
describe('a panel’s lines wear the same pills the cards do', () => {
  const chipNames = (root) =>
    [...root.querySelectorAll('.person-chip-name')].map((n) => n.textContent)

  it('names every character on the line, on a performer’s record', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    const { container } = render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('The person')
    const line = await waitFor(() => {
      const el = container.querySelector('.identity-line')
      expect(el).toBeTruthy()
      return el
    })
    // THE CHARACTERS, NOT THE PERFORMER, and this is the assertion the server
    // asymmetry is about: the name this line PRINTS is "Claude Rains".
    expect(chipNames(line)).toEqual(['Renault', 'Rick'])
  })

  it('stops repeating those names in the microcopy, and keeps the work', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    const { container } = render(body(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText('The person')
    const line = await waitFor(() => {
      const el = container.querySelector('.identity-line')
      expect(el).toBeTruthy()
      return el
    })
    const micro = line.querySelector('.microcopy').textContent
    // The WORK is the one thing the chips never say, so it stays.
    expect(micro).toContain('Casablanca')
    expect(micro, 'the printed name is repeated beside the chips').not.toContain('Claude Rains')
  })

  it('opens nothing, because the panel is already the record’s', async () => {
    // NOT HOME'S REASON. There the tile is the press; here the chip that would
    // open a character IS the page the reader is standing on, and the other names
    // on the line have no record behind them at all.
    const stack = { push: vi.fn(), open: vi.fn() }
    const { container } = render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await waitFor(() => expect(container.querySelector('.identity-line')).toBeTruthy())
    const chips = [...container.querySelectorAll('.person-chip')]
    expect(chips.length).toBeGreaterThan(0)
    expect([...new Set(chips.map((c) => c.tagName))]).toEqual(['SPAN'])
  })

  it('draws no row at all on a line that belongs to no work', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    const { container } = render(body(characterPanel(stack, { id: 3, name: 'Woland' })))
    await waitFor(() => expect(container.querySelector('.identity-line')).toBeTruthy())
    const lines = [...container.querySelectorAll('.identity-line')]
    const utterance = lines.find((l) => /turn out right/.test(l.textContent))
    expect(utterance, 'the standalone quote is not listed').toBeTruthy()
    expect(utterance.querySelector('.speaker-chips'), 'a standalone quote has no cast').toBeNull()
    // And its microcopy keeps the printed name, since no chip is saying it.
    expect(utterance.querySelector('.microcopy').textContent).toContain('Woland')
  })
})
