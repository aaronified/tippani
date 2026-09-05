// A FORM OPENED FROM INSIDE A POPUP STAYS INSIDE IT.
//
// THE REPORT, in the owner's words: "if the actor/char page is a popup, why is
// the sub entry of add links a separate screen altogether? that's an escalation.
// it should work within the popup (the breadcrumb back option works)."
//
// Every sub-surface of an identity panel is a `FormModal` — the nine field
// pickers, the choose sheet, the merge sheet, the works picker, the link sheet —
// and below the mobile breakpoint a FormModal became a full-bleed sheet. So
// pressing a row inside the popup REPLACED the popup: the record being edited
// vanished, the header saying whose record it was went with it, and the only way
// out looked like it closed everything.
//
// THE PACK NEVER ESCALATES EITHER: its picker is `width:min(460px,100%)` on a
// scrim with 24px of padding (`character-popup.dc.html:1356`, `:1387`), and that
// file is the PHONE prototype. So the full screen was the deviation.
//
// WHAT THESE CASES HOLD is the containment and the way back, not any wording:
// where the surface is drawn, that the screen it came from is still mounted
// underneath it, and that its left key names that screen. A test on the title
// would pass on a sheet that had escaped the panel entirely.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'

let CHARACTER

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path.startsWith('/characters/')) return { ok: true, data: CHARACTER }
    return { ok: true, data: {} }
  }),
}))

const { characterPanel } = await import('../../src/identity.jsx')
const { PanelHost, usePanelStack } = await import('../../src/ui.jsx')
const { resolveOn } = await import('../css-cascade.js')

function Host({ panel }) {
  const stack = usePanelStack()
  useEffect(() => { stack.open(panel) }, [])
  return <PanelHost stack={stack} />
}

const openSheet = async (rowLabel) => {
  render(<Host panel={characterPanel({ push: vi.fn(), open: vi.fn() }, { id: 3, name: CHARACTER.name })} />)
  await screen.findByText(/^The identity$/i)
  act(() => screen.getByText(rowLabel).closest('.cs-row').click())
  return waitFor(() => {
    const el = document.querySelector('.tp-subsheet')
    expect(el, 'the sub-surface is not inside the panel').toBeTruthy()
    return el
  })
}

beforeEach(() => {
  CHARACTER = {
    id: 3, name: 'Woland', sort_name: '', description: '', note: '',
    aliases: [], appearances: [], lines: [], shared_lines: 0,
  }
})
afterEach(() => cleanup())

describe('a sub-surface of a panel', () => {
  it('is drawn inside the panel box, not over the whole viewport', async () => {
    const sheet = await openSheet('Sort name')
    expect(sheet.closest('.tp-panel'), 'the sheet escaped the popup it belongs to').toBeTruthy()
  })

  it('leaves the screen it came from mounted underneath', async () => {
    // The escalation's real cost: the record you were editing disappeared, so a
    // reader could not see whose sort name they were typing.
    await openSheet('Sort name')
    expect(document.querySelector('.tp-panel .cs-screen-body, .tp-panel-body'),
      'the panel body went away when the sheet opened').toBeTruthy()
    expect(screen.getAllByText('Woland').length, 'the record name is gone from the screen').toBeGreaterThan(0)
  })

  it('offers the way back by naming the screen it came from', async () => {
    // "the breadcrumb back option works" — the owner naming the mechanism they
    // want. It is the panel's own back key, which is why it carries the parent's
    // name rather than the word "back".
    const sheet = await openSheet('Sort name')
    const back = sheet.querySelector('.tp-panel-back')
    expect(back, 'no way back out of the sheet').toBeTruthy()
    expect(back.textContent).toContain('Woland')
  })

  it('draws no ✕ beside the back key, which would close the lot', async () => {
    // `PanelHost`'s own rule for a nested surface: "its two exits are answer and
    // back", and a third key that closes everything is a destructive control
    // wearing a dismiss key's clothes.
    const sheet = await openSheet('Sort name')
    const names = [...sheet.querySelectorAll('.tp-panel-head button')]
      .map((b) => b.getAttribute('aria-label') || '')
    expect(names.filter((n) => /close/i.test(n)), 'a close key on a nested surface').toHaveLength(0)
  })

  it('is positioned against the panel and not against the viewport', async () => {
    // `fixed` here would put the sheet back over the whole screen however it is
    // nested, which is the defect in one word.
    expect(resolveOn('.tp-subsheet', 'position').value).toBe('absolute')
  })
})
