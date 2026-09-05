// ADDING A PERFORMER OFFERS THE PEOPLE THE LIBRARY ALREADY HAS.
//
// THE SPECIFICATION, from the design pack. `character-popup.dc.html` draws the
// performer picker as a search-or-type field over a list of people, captioned
// "Everyone the app already knows", and its own fixture makes the shape explicit:
// "Two have photographs and four do not, which is the normal state of a library —
// the picker has to look right with a row of silhouettes." Below the list, when
// what you typed is not one of them, it offers to add a new person, because "a
// name the app does not know is a normal answer, not an error state — most casts
// arrive one unknown person at a time".
//
// WHY IT IS WORTH A TEST RATHER THAN A LOOK. What a plain text box costs is
// invisible at the moment you pay it: `ResolvePerson` folds on the name, so
// "H. Bogart" typed where "Humphrey Bogart" exists is a SECOND record with its own
// portrait fetch and its own page. Nothing errors, nothing looks wrong, and the
// reader finds out later when a face is missing from a credit they were sure they
// had filled in. A test that only asked "is there an input" would pass on the box.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above, and that the account's
// people arrive from `GET /people?kind=…`. Nothing about how the list is built.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The library: two with a portrait and four without, which is the pack's own
// fixture and the case its caption singles out.
const PEOPLE = [
  { id: 1, name: 'Daniel Radcliffe', image_path: 'dr.jpg', kinds: ['actor'] },
  { id: 2, name: 'Adam Sopp', image_path: 'as.jpg', kinds: ['actor'] },
  { id: 3, name: 'Rupert Grint', image_path: '', kinds: ['actor'] },
  { id: 4, name: 'Emma Watson', image_path: '', kinds: ['actor'] },
  { id: 5, name: 'Toby Papworth', image_path: '', kinds: ['actor'] },
  { id: 6, name: 'Harley Quinn', image_path: '', kinds: ['actor', 'speaker'] },
]

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.startsWith('/people?kind=')) {
      return { ok: true, data: { people: PEOPLE } }
    }
    return { ok: true, data: {} }
  }),
}))

const { FieldPicker } = await import('../../src/identityPicker.jsx')

const spec = (over = {}) => ({
  id: 'add-1-cast',
  title: 'Add another performer',
  personKind: 'actor',
  blocked: 'Name the performer first',
  fields: [
    { key: 'actor', label: 'Add another performer', value: '', required: true },
    { key: 'lang', label: 'Dubbed in which language', value: '' },
  ],
  ...over,
})

const box = () => screen.getByPlaceholderText(/search or type a name/i)
const rows = () => screen.queryAllByRole('button').filter((b) => b.className.includes('cs-pick-row'))

afterEach(() => cleanup())

describe('the performer picker', () => {
  beforeEach(() => {
    render(<FieldPicker spec={spec()} onClose={() => {}} onSave={() => {}} />)
  })

  it('offers the people the library already has', async () => {
    await waitFor(() => expect(rows().length, 'no list at all — this is the text box the pack replaced').toBeGreaterThan(0))
    const names = rows().map((r) => r.textContent)
    expect(names.some((n) => n.includes('Daniel Radcliffe'))).toBe(true)
    expect(names.some((n) => n.includes('Emma Watson'))).toBe(true)
  })

  it('draws a face for everyone, photograph or not', async () => {
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    for (const r of rows()) {
      const face = r.querySelector('.cs-pick-face')
      expect(face, `${r.textContent} has no face`).toBeTruthy()
      // A portrait or a silhouette, never an empty disc: the pack's fixture is
      // mostly people without a photograph, so the unfilled case IS the design.
      expect(
        face.querySelector('img') || face.querySelector('svg'),
        `${r.textContent} has an empty face — the silhouette is the resting state, not a gap`,
      ).toBeTruthy()
    }
  })

  it('narrows on any part of a name, not just the front of it', async () => {
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    // "quinn" is the half of "Harley Quinn" a reader remembers, which is the rule
    // CastCombo already follows and the reason a prefix match is not enough.
    await act(async () => { await userEvent.type(box(), 'quinn') })
    await waitFor(() => expect(rows().length).toBe(1))
    expect(rows()[0].textContent).toContain('Harley Quinn')
  })

  it('picking one fills the box, so the sheet commits a name and not an id', async () => {
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    const row = rows().find((r) => r.textContent.includes('Emma Watson'))
    await act(async () => { row.click() })
    expect(box().value).toBe('Emma Watson')
  })

  it('says a name it does not know is new rather than refusing it', async () => {
    await act(async () => { await userEvent.type(box(), 'Ingrid Bergman') })
    await waitFor(() => expect(screen.getByText(/is new/i), 'an unknown name got no answer at all').toBeTruthy())
  })

  it('and says nothing of the sort about one it does know', async () => {
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    await act(async () => { await userEvent.type(box(), 'Emma Watson') })
    await waitFor(() => expect(screen.queryByText(/is new/i), 'offered to add somebody the library already has').toBeNull())
  })
})

describe('the same picker asked for a dub', () => {
  it('offers languages, and a box for one it did not list', async () => {
    render(<FieldPicker spec={spec({ langs: ['English', 'বাংলা'] })} onClose={() => {}} onSave={() => {}} />)
    await waitFor(() => expect(screen.getByText('বাংলা')).toBeTruthy())
    // THE LIST IS A SHORTCUT AND NOT A SET. A library is not limited to five
    // languages, and a picker that has no way to say a sixth is worse than none.
    expect(screen.getByText(/or type a language/i)).toBeTruthy()
  })

  it('does not offer them when the credit is not a dub', async () => {
    render(<FieldPicker spec={spec()} onClose={() => {}} onSave={() => {}} />)
    await waitFor(() => expect(rows().length).toBeGreaterThan(0))
    expect(screen.queryByText(/or type a language/i),
      'a plain performer credit was asked which language it is dubbed in').toBeNull()
  })
})
