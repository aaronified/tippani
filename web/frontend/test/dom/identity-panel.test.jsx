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
import { useEffect } from 'react'

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
const { parseLinks } = await import('../../src/people.jsx')
// The panel chrome, so the one case that presses commit presses the ✓ the app
// actually draws — see inPanel below.
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')
const { t } = await import('../../src/i18n.js')

// The panel machinery renders through a portal from a descriptor; the body is
// what this file is about, so it is rendered directly.
const body = (panel) => panel.render()

// inPanel — the same panel, mounted the way the app mounts it.
//
// WHY IT EXISTS. `body()` renders a panel's contents with nothing around them,
// which is right for the twenty-five cases that only READ the sheet. It is not
// right for the one that presses commit, because the commit is the panel's — the
// sheet's form joins the head's ✓ through `useFormHost`, exactly as the standing
// tick/cross rule requires, and a body rendered outside a `PanelHost` has no head
// and therefore no ✓. The old spelling of that case pressed a `GhostButton`
// reading "Save" inside the body; that button was the rule's violation, so a test
// that requires it to exist would pin the defect in place.
function InPanel({ panel }) {
  const stack = usePanelStack()
  useEffect(() => { stack.open(panel) }, [])
  return <PanelHost stack={stack} />
}
const inPanel = (panel) => <InPanel panel={panel} />

// openSpellings — press the name row, which opens the record's names as one field.
//
// WHAT THE PRESS DOES CHANGED, and the tests below moved with it rather than being
// relaxed. It used to toggle a chip row at the FOOT of the sheet — far below the
// row that opened it, which is why the owner reported the row as doing nothing —
// and there was no way to change the printing NAME at all, because the endpoint
// that can (`PUT /{table}/{id}/names`) had no caller. The press opens that field
// now: one line per spelling, the first being the one that prints.
//
// The chips remain, no longer behind the press, and carry the one verb a textarea
// has nowhere to put: split, which gives a spelling its own record.
const openSpellings = async (label) => {
  const row = (await screen.findByText(label)).closest('.cs-row')
  act(() => row.click())
}

// The names field the press opens, and the header ✓ that writes it.
const namesField = () => document.querySelector('textarea')
const saveNames = async () => {
  const tick = [...document.querySelectorAll('button')].find((b) => b.getAttribute('type') === 'submit')
  expect(tick, 'the names field offers no way to confirm').toBeTruthy()
  await act(async () => { tick.click() })
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

// MERGE IS BEHIND ITS ROW NOW. It used to sit inline at the foot of the screen
// while the section above ALSO offered it as a row — two doors to one act, the
// row's being a scroll down to the other. Pressing the row is what a reader
// does, so it is what these cases do.
const openMerge = async () => {
  const row = [...document.querySelectorAll('button')]
    .find((b) => /Merge with another/i.test(b.textContent))
  expect(row, 'no row to merge through').toBeTruthy()
  await act(async () => { row.click() })
}

describe('a person panel says which scope you are in', () => {
  // A PERSON IS ALWAYS GLOBAL — the owner's ruling, and it retired the two cases
  // that stood here. They asserted a person-on-a-work sheet: that it named the
  // work, that it said the change stopped there, and that its Save reached
  // /credits while the record's reached /people/id. There is no such sheet now.
  // What replaces them is the assertion that makes the ruling real — a work
  // handed in is IGNORED, so there is no second screen to reach the record's
  // writer from by mistake.

  it('writes the record to /people/id, and that is the only writer it has', async () => {
    const stack = { push: vi.fn(), open: vi.fn() }
    render(inPanel(personPanel(stack, { id: 7, name: 'Mikhail Bulgakov' })))
    await screen.findByText(/^The person$/i)
    // BY ROLE AND NAME, not by text node: the commit is the panel head's ✓, whose
    // name is on an aria-label rather than between its tags. Asking for "the
    // control called Save" is also the question a reader asks, so this survives
    // the verb moving again.
    // THROUGH A ROW'S OWN SHEET, which is where this screen commits now. It used
    // to carry a whole form under its rows — every fact on screen twice, the row
    // "editing" by scrolling you down to its twin — and the panel head's ✓ was
    // that form's. A row opens a sheet carrying its one field, the way the local
    // sheet's rows have since 3.1, and the sheet's own ✓ writes. The destination
    // is what this case is about and it has not moved.
    const row = [...document.querySelectorAll('button')].find((b) => /Sort name/i.test(b.textContent))
    expect(row, 'no row to edit the record through').toBeTruthy()
    await act(async () => { row.click() })
    // The sheet's own field, found in the sheet rather than by a label string —
    // the row's words and the field's are two different keys, and neither is what
    // this case is about.
    const sheet = await waitFor(() => {
      const d = [...document.querySelectorAll('[role=dialog]')]
        .find((x) => x.querySelector('input[type=text], input:not([type]), textarea'))
      if (!d) throw new Error('the row opened no editor')
      return d
    })
    // NOT the picture picker's hidden file input, which is the first `input` in
    // the panel and accepts only a filename.
    const field = sheet.querySelector('input[type=text], input:not([type]), textarea')
    fireEvent.change(field, { target: { value: 'Bulgakov, Mikhail' } })
    const tick = await screen.findByRole('button', { name: /^Save$/i })
    await act(async () => { tick.click() })
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/people/id/7')).toBe(true))
    expect(
      CALLS.some(([m, p]) => m === 'PUT' && p === '/credits'),
      'the record sheet reached the per-work credit writer',
    ).toBe(false)
  })

  // OPENED FROM A LIST THERE IS NO WORK TO BE ON, so the section is absent rather
  // than present and inert. A disabled "on this work" over no work is a control
  // whose only possible outcome is confusion.

  // AND THE GLOBAL SCREEN STILL SAYS SO, which is what this whole file is for.
  // The design pack draws `people-global` with no sentence under its first
  // heading and `char-global` with one, over the same three rows and the same
  // blast radius — so the sentence is kept on both. Losing it here would leave
  // the record's name editable with nothing saying it reaches every work.

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

    await openMerge()
    fireEvent.change([...document.querySelectorAll('[role=dialog] input')].find((i) => i.type !== 'file'), { target: { value: 'Welles' } })
    const hit = await screen.findByText('Orson Welles Jr')
    // A NAME ALONE CANNOT TELL TWO RECORDS APART, which is the case this control
    // exists to resolve, so each hit says how much hangs off it.
    // SCOPED TO THE MERGE CONTROL. "2 works" is also the screen's own crumb now,
    // and the fact under test is what the CANDIDATE carries.
    // The figure is text and the noun is the glyph's name — see the count sweep.
    const merge = within(document.getElementById('person-merge'))
    expect(merge.getByText('2')).toBeTruthy()
    expect(merge.getByRole('img', { name: 'works' })).toBeTruthy()

    act(() => hit.click())
    await screen.findByText(/is merged into/)
    expect(screen.getByText(/No cover changes/)).toBeTruthy()
    // THE FACT, NOT THE SENTENCE. This read `/bin holds the way back/` and broke on
    // a prose pass that changed nothing about the behaviour — the owner's rule for
    // this repo is that a test checks the feature and never the wording. What the
    // dialog owes the reader is that the merge is undoable and WHERE from; the
    // place is the durable half of that.
    expect(screen.getByText(/\bbin\b/i), 'the confirm no longer says the merge can be undone, or where from')
      .toBeTruthy()
    // Nothing has been written yet — the dialog is a question, not a receipt.
    expect(MERGED).toBeNull()

    act(() => screen.getByText('Merge them').closest('button').click())
    await waitFor(() => expect(MERGED).toEqual({ keep_id: 7, drop_id: 9 }))
  })

})
