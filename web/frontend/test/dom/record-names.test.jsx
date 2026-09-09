// THE NAME A RECORD PRINTS UNDER IS EDITABLE, AND SO ARE ITS OTHER SPELLINGS.
//
// THE OWNER'S REPORT: "i am unable to change the canonical name or add aliases
// (global character screen)."
//
// WHAT WAS WRONG, and it was two things stacked. `PUT /{characters|people}/{id}/names`
// has existed since 0056 — it replaces the whole set and makes the first non-empty
// line the name that PRINTS — and NOTHING in the app had ever called it. The pencil
// on the Canonical name row instead toggled a chip row of aliases at the FOOT of the
// sheet, far below the row that opened it, so the press read as doing nothing; and
// the name itself had no editor at all. The person's sheet had a second flavour of
// the same defect: an `onRename` prop was passed to a component that has never
// declared it.
//
// SO WHAT IS TESTABLE, without knowing which component or hook does it:
//
//   PRESSING THE NAME ROW OPENS SOMETHING THAT TAKES A NAME. Not a chip row
//   somewhere else on the page — a field, focused on this fact.
//
//   SAVING IT REACHES THE ENDPOINT THAT CAN RENAME, and carries every line. A save
//   that posted only the aliases would leave the reported defect in place while
//   looking fixed.
//
//   THE FIRST LINE IS THE NAME AND THE REST ARE SPELLINGS. That is the server's
//   contract, so the field has to be seeded that way round or a reader's first save
//   silently renames the record to its own alias.
//
//   AND BOTH SHEETS DO IT, because they draw the same row. The repo's directive:
//   "a control drawn by one component on two screens has ONE behaviour."
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let RECORD
let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && /^\/(characters|people\/id)\/\d+$/.test(path)) {
      return { ok: true, data: RECORD }
    }
    if (/whos-in-it/.test(path)) return { ok: true, data: { characters: [] } }
    return { ok: true, data: RECORD }
  }),
}))

const { characterPanel, personPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')

function Harness({ make }) {
  const stack = usePanelStack()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (done) return
    setDone(true)
    stack.open(make(stack))
  }, [])
  return <PanelHost stack={stack} />
}

const buttons = () => [...document.querySelectorAll('button')]
const byText = (re) => buttons().find((b) => re.test(b.textContent))
const press = async (el) => { await act(async () => { el.click() }) }
// Whatever the editor is, it is a box that holds several lines of names.
const nameBox = () => document.querySelector('textarea')
    || [...document.querySelectorAll('input')].find((i) => /name/i.test(i.getAttribute('aria-label') || ''))

beforeEach(() => {
  window.history.replaceState({}, '')
  CALLS = []
  RECORD = {
    id: 4, name: 'Itkovian', sort_name: '', description: '', note: '', born: '', bio: '', links: '',
    aliases: ['The Shield Anvil'], lines: [], shared_lines: 0,
    appearances: [], credits: [], roles: [], kinds: [],
  }
})
afterEach(() => cleanup())

// THE ROW'S LABEL IS NOT THE SAME WORD ON BOTH SHEETS — a character's reads
// "Canonical name" and a person's "Name" — so each case names its own rather than
// this file assuming they match. The BEHAVIOUR is what has to be identical.
const SHEETS = [
  ['a character', (stack) => characterPanel(stack, { id: 4, name: 'Itkovian' }),
    '/characters/4/names', /Canonical name/],
  ['a person', (stack) => personPanel(stack, { id: 4, name: 'Itkovian' }),
    '/people/4/names', /^Name/m],
]

describe.each(SHEETS)('the names row on %s', (_label, make, endpoint, rowLabel) => {
  const open = async () => {
    await act(async () => { render(<Harness make={make} />) })
    const row = byText(rowLabel)
    expect(row, 'the sheet draws no canonical-name row to press').toBeTruthy()
    await press(row)
  }

  it('opens a field when its pencil is pressed', async () => {
    await open()
    expect(nameBox(), 'pressing the name row opened nothing that takes a name').toBeTruthy()
  })

  it('seeds it with the printing name first and the other spellings after', async () => {
    await open()
    const lines = String(nameBox().value).split('\n').map((l) => l.trim()).filter(Boolean)
    expect(lines[0], `the field opens with ${JSON.stringify(lines)} — the first line is not the printing name`)
      .toBe('Itkovian')
    expect(lines, 'the record’s other spelling is not in the field, so saving would delete it')
      .toContain('The Shield Anvil')
  })

  it('and saving it reaches the one endpoint that can rename, carrying every line', async () => {
    await open()
    // `fireEvent.change` and not a hand-set `.value`: React tracks a controlled
    // field's value on the node, so assigning it directly leaves the component's
    // state on the old string — the save then carries what was already stored and
    // the case passes while proving nothing.
    await act(async () => {
      fireEvent.change(nameBox(), {
        // Rename, and add a spelling, in one edit — which is what one field buys.
        target: { value: 'Itkovian, Shield Anvil\nThe Shield Anvil\nItkovian of the Grey Swords' },
      })
    })
    // The panel header's ✓ — a submit bound to the field's form by `form=`.
    const tick = buttons().find((b) => b.getAttribute('type') === 'submit')
    expect(tick, 'the editor offers no way to confirm').toBeTruthy()
    await press(tick)

    const wrote = CALLS.find(([m, p]) => m === 'PUT' && p === endpoint)
    expect(wrote, `nothing was written to ${endpoint} — the calls were ${JSON.stringify(CALLS.map((c) => c.slice(0, 2)))}`)
      .toBeTruthy()
    const sent = wrote[2] || {}
    const text = sent.text != null ? sent.text : (sent.lines || []).join('\n')
    expect(text, 'the rename did not reach the server').toMatch(/Itkovian, Shield Anvil/)
    expect(text, 'the existing spelling was dropped from the save').toMatch(/The Shield Anvil/)
    expect(text, 'the newly typed spelling was dropped from the save')
      .toMatch(/Itkovian of the Grey Swords/)
  })
})
