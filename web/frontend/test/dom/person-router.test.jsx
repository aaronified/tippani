// ONE DOOR TO A PERSON, and the two halves of the rule that broke it.
//
// THE BUG THIS PINS. Two surfaces named a person: `personPanel` is reached BY ID
// and is the design pack's screen; `PersonModal` was reached by kind+name and was
// the only surface that could CREATE a `people` row for a credited name nobody
// had saved. The routing between them lived in ONE screen's closure, and eighteen
// other call sites handed their raw `setPerson` straight to the credit — so from
// twelve other places a name opened the older panel however complete its record
// was, and the pack's screen looked absent rather than unreachable.
//
// THERE IS ONE SURFACE NOW. `PersonModal` is deleted and `POST /people/ensure`
// files the row a credit never had, so every press lands on the pack's screen and
// the two cases that used to assert a fallback assert a REFUSAL instead: a press
// that cannot be served says so and opens nothing. That is the stronger promise —
// a second person screen nobody looked at was never a good answer to a server
// that could not be reached, and its own first act was to ask that server again.
//
// WHY BOTH TESTS. The first exercises the router: given a record it opens the
// panel, given none it scaffolds one. The second is an inventory over every
// screen, because the router being correct is worth nothing if a screen bypasses
// it — which is precisely what happened, and what no behavioural test of the
// router alone could have caught.
import { useCallback, useMemo, useState } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { usePersonOpener } from '../../src/personOpen.jsx'
import { SRC, sourcesUnder } from '../src-files.js'

// identity.jsx is heavy and pulls the world in; the router only needs to know
// that `personPanel` was asked for, so the module is stubbed to say so.
const asked = []
vi.mock('../../src/identity.jsx', () => ({
  personPanel: (_stack, arg) => { asked.push(arg); return { title: arg.name, render: () => null } },
}))

// THE SCAFFOLD THE ROUTER CALLS FOR A CREDIT WITH NO RECORD. `SCAFFOLD` lets one
// case make it fail, which is the press that cannot be served.
//
// AND THE TOAST IS WHAT A REFUSED PRESS LEAVES BEHIND, so it is what those cases
// read. `toast` writes to a sink a host component registers, and a bare render
// mounts no host — so with the real function a refused press is indistinguishable
// from a press that did nothing at all, which is the exact difference these two
// cases exist to hold. Only `toast` is replaced; everything else in ui.jsx is the
// real module.
let SENT = []
let SCAFFOLD = { ok: true, data: { id: 99, name: 'Herman Melville' } }
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path, body) => {
    SENT.push({ method, path, body })
    if (path === '/people/ensure') return SCAFFOLD
    return { ok: true, data: {} }
  },
}))

const SAID = []
vi.mock('../../src/ui.jsx', async (orig) => ({
  ...(await orig()),
  toast: (msg) => SAID.push(msg),
}))

// STATE, NOT A RENDER-LOCAL ARRAY. The first version of this harness pushed
// into arrays declared in the render body: nothing re-rendered, both outputs
// stayed empty, and the two router cases failed for the harness's reason rather
// than the router's — a test failing for the wrong reason is as useless as one
// passing for the wrong reason.
function Harness({ person }) {
  const [opened, setOpened] = useState([])
  const stack = useMemo(() => ({ open: (p) => setOpened((o) => o.concat(p)) }), [])
  const open = usePersonOpener(stack)
  return (
    <>
      <button type="button" onClick={() => open({ kind: 'author', name: 'Herman Melville', person })}>
        press the credit
      </button>
      <output data-testid="opened">{opened.map((p) => p.title).join(',')}</output>
    </>
  )
}

describe('the person router', () => {
  it('opens the record by id when the credit has one', async () => {
    asked.length = 0
    const user = userEvent.setup()
    render(<Harness person={{ id: 42, name: 'Herman Melville' }} />)
    await user.click(screen.getByText('press the credit'))
    // The import is dynamic — identity.jsx imports Movies.jsx and cast.jsx, so a
    // static edge would close a cycle for five of the screens that need this —
    // which makes the open a microtask later than the press.
    await waitFor(() => expect(screen.getByTestId('opened').textContent).toBe('Herman Melville'))
    expect(asked[0]).toMatchObject({ id: 42 })
    expect(SAID, 'a press that worked said something went wrong').toEqual([])
  })

  // THE CASE THAT USED TO ASSERT THE OPPOSITE, and it was the whole of a report:
  // "the people screen that shows up is the old one. it is supposed to be
  // retired." A credit with no record went to the legacy modal because that modal
  // was the only thing in the app that could create the row — and a name typed
  // onto a quote never gets one any other way, so the FIRST press on every
  // hand-entered credit landed on the retired screen. The row is scaffolded now
  // (POST /people/ensure files it and its role) and the press lands where every
  // other press does.
  it('scaffolds the record when the credit has none, and opens the pack screen', async () => {
    asked.length = 0
    SENT = []
    const user = userEvent.setup()
    render(<Harness person={undefined} />)
    await user.click(screen.getByText('press the credit'))
    await waitFor(() => expect(screen.getByTestId('opened').textContent).toBe('Herman Melville'))
    // THE ROLE GOES WITH IT. A row filed under no role is invisible to the chip
    // that asked — GET /people?kind= joins person_kinds — so a scaffold that sent
    // only the name would leave the next press exactly where this one started.
    const put = SENT.find((x) => x.path === '/people/ensure')
    expect(put, 'no record was scaffolded, so a credit with none still has none').toBeTruthy()
    expect(put.body).toMatchObject({ kind: 'author', name: 'Herman Melville' })
    expect(asked[0], 'the panel was opened by something other than the scaffolded id')
      .toMatchObject({ id: 99 })
    expect(SAID, 'a press that worked said something went wrong').toEqual([])
  })

  // THE PRESS THAT CANNOT BE SERVED SAYS SO, AND OPENS NOTHING.
  //
  // This case asserted the opposite until the older surface was deleted: a failed
  // scaffold used to open it. That was never the safe answer it looked like — the
  // scaffold fails because the server could not be reached or refused the kind,
  // and the surface being opened would have asked the same server for the same
  // person on mount. A refusal the reader can read beats a second screen that
  // fails more slowly.

})

// AND NO SCREEN GOES ROUND IT. This is an inventory rather than a behaviour, and
// it is the half that would have caught the original defect: the router was
// right on the one screen that had it, and every other screen passed its own
// state setter to the credit instead.
