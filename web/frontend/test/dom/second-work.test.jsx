// A WORK-LEVEL CHARACTER CAN BE GIVEN ANOTHER WORK, AND THAT IS THE PROMOTION.
//
// THE OWNER'S ITEM 3, verbatim: "this character only exist in one work (for
// now), and thus the work-level screen is shown. but there is no easy way to add
// him to another work from here. i will then need to add a separate character
// and then merge. i understand that work-level character cannot gain a new
// character. but we can probably create a gate here where of i add another work
// in work-character, that will get added to the global-character (which should
// in turn enable global character for the character as well)."
//
// And when asked whether it should confirm first: "Automatic. no point gating
// this. because the user can easily remove works as well."
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing about how it was built:
//
//  * A character exists twice over. `characters` is the RECORD — a name, a
//    portrait, aliases. `work_cast` is a CREDIT: this character, in this work,
//    played by this person. One credit means the reader sees the work-level
//    sheet; several means a global sheet exists too.
//  * NOTHING IS PROMOTED. The global screen is not a flag — it is a consequence
//    of how many credits the record has. So the second credit IS the promotion,
//    and anything that writes one has done the whole job. The owner's phrasing
//    suggests two steps; the data model has one, and a test that looked for a
//    promotion step would be testing a thing that does not exist.
//  * A credit can exist with no record behind it. Those have nothing to give a
//    second work to.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    calls.push({ method, path, body })
    if (path.startsWith('/characters/') && path.endsWith('/works') && method === 'POST') {
      return { ok: true, data: { ok: true } }
    }
    return { ok: true, data: {} }
  }),
}))

const { CharacterLocal } = await import('../../src/identityLocal.jsx')
const { t } = await import('../../src/i18n.js')

const RECORD = { id: 12, name: 'Evey Hammond', image_path: '', description: '' }
const HERE = { cast_id: 3, character: 'Evey Hammond', actor: 'Natalie Portman', description: '' }
const SCOPE = { local: true, id: 'char-local', medium: 'film', performer: true }

const sheet = (over = {}) =>
  render(
    <CharacterLocal
      record={RECORD}
      work={{ kind: 'screen', id: 4, title: 'V for Vendetta' }}
      here={HERE}
      scope={SCOPE}
      counts={{}}
      works={[{ kind: 'screen', work_id: 4, title: 'V for Vendetta' }]}
      {...over}
    />,
  )

const rowNamed = (key) => {
  const want = t(key)
  for (const el of document.querySelectorAll('button, [role=button]')) {
    if (el.textContent.includes(want)) return el
  }
  return null
}

beforeEach(() => { calls.length = 0 })
afterEach(() => cleanup())

describe('the sheet about one credit', () => {
  it('offers a way to add another work', () => {
    sheet({ onAddWork: () => {} })
    expect(rowNamed('identity.row.add-work.label'),
      'a character credited in one work has no route to a second, so the reader must make a duplicate and merge it')
      .toBeTruthy()
  })

  // DRAWN ONLY WHERE IT ACTS — the rule the works strip's add tile and the global
  // sheet's "Remove from all works" both follow. A row that presses dead is worse
  // than one that is not there, because from the outside they look the same until
  // you press.
  // WITH TWO WORKS, so the section around the row is drawn for the OTHER row and
  // this one is judged on its own guard. Handed one work it passed for the wrong
  // reason: the section is gated too, so nothing reached the row's condition and
  // removing that condition left the test green — which a mutation found and a
  // reading would not have.
  it('draws no such row when there is nothing to give a work to', () => {
    sheet({
      onAddWork: null,
      onOpenGlobal: () => {},
      works: [
        { kind: 'screen', work_id: 4, title: 'V for Vendetta' },
        { kind: 'book', work_id: 9, title: 'V for Vendetta' },
      ],
    })
    expect(rowNamed('identity.row.global.label'),
      'the section is not drawn at all, so this case is testing the section rather than the row')
      .toBeTruthy()
    expect(rowNamed('identity.row.add-work.label'),
      'the row is drawn where it cannot act, so pressing it does nothing and says nothing')
      .toBeFalsy()
  })

  it('opens the chooser rather than writing anything by itself', () => {
    const opened = []
    sheet({ onAddWork: () => opened.push('chooser') })
    fireEvent.click(rowNamed('identity.row.add-work.label'))
    expect(opened, 'the row did not open the work chooser').toEqual(['chooser'])
    // It must not write a credit on the press: the reader has not said WHICH work
    // yet, and a row that commits before the question is answered is a row that
    // guesses.
    expect(calls.filter((c) => c.method === 'POST'),
      'the row wrote a credit before the reader had chosen a work')
      .toEqual([])
  })

  // THE GLOBAL ROW APPEARS ON THE COUNT, which is what makes the second credit
  // the promotion. Asserted from the same sheet with one more appearance, because
  // that is the only thing that changes.
  it('grows the global door once a second credit exists', () => {
    const { unmount } = sheet({ onAddWork: () => {}, onOpenGlobal: () => {} })
    expect(rowNamed('identity.row.global.label'),
      'a character in one work offers a door to a global screen that is the screen you are on')
      .toBeFalsy()
    unmount()
    sheet({
      onAddWork: () => {},
      onOpenGlobal: () => {},
      works: [
        { kind: 'screen', work_id: 4, title: 'V for Vendetta' },
        { kind: 'book', work_id: 9, title: 'V for Vendetta' },
      ],
    })
    expect(rowNamed('identity.row.global.label'),
      'a second credit did not bring the global door — nothing promotes, so the count is the whole mechanism')
      .toBeTruthy()
  })
})

// AND THE VERB IS ONE FUNCTION, reached from both sheets.
//
// The repo's directive: "A control drawn by one component on two screens has ONE
// behaviour, and it lives in one function that both screens call — not in a line
// each, which is how one of them goes on being right while the other quietly
// stops." The global sheet's works strip and this row open the same chooser.
describe('the chooser both sheets open', () => {
  const src = (f) => readFileSync(join(process.env.TIPPANI_SRC || 'src', f), 'utf8')

  it('is opened by one named function, not a line at each call site', () => {
    const body = src('identity.jsx')
    const inline = [...body.matchAll(/onAddWork=\{([^}]*)\}/g)].map((m) => m[1].trim())
    expect(inline.length, 'nothing passes onAddWork, so neither sheet can add a work').toBeGreaterThan(1)
    for (const expr of inline) {
      expect(expr, `onAddWork={${expr}} is a handler written at the call site rather than the shared one`)
        .toMatch(/^[A-Za-z_$][\w$]*$/)
    }
    expect(new Set(inline).size, `the two sheets are handed different handlers: ${[...new Set(inline)].join(' vs ')}`).toBe(1)
    expect(body, 'the shared handler is not defined').toMatch(/const\s+openAddWork\s*=/)
  })
})
