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
  it('says so and opens nothing when the record cannot be written', async () => {
    SAID.length = 0
    // THE SERVER'S SHAPE, NOT A SHORTHAND: `errText` reads `data.error`, so a
    // fixture putting the message at the top level tests the fallback instead of
    // the thing this case is about.
    SCAFFOLD = { ok: false, data: { error: 'no such kind' } }
    const user = userEvent.setup()
    render(<Harness person={undefined} />)
    await user.click(screen.getByText('press the credit'))
    await waitFor(() => expect(SAID.length).toBe(1))
    // THE SERVER'S OWN WORDS WHERE IT GAVE ANY — `ensure` names a bad kind and a
    // blank name, and those are the two answers a reader can act on.
    expect(SAID[0]).toBe('no such kind')
    expect(screen.getByTestId('opened').textContent, 'a press that could not be served opened a panel anyway').toBe('')
    SCAFFOLD = { ok: true, data: { id: 99, name: 'Herman Melville' } }
  })

  it('says so rather than throwing when a screen has no panel stack', async () => {
    // Not the goal — a screen that draws credits should mount a PanelHost, and all
    // eight of the app's call sites do — but a missing stack must not throw over
    // the screen. This is the shape of a ninth caller's first day.
    SAID.length = 0
    const Bare = () => {
      const open = usePersonOpener(null)
      return <button type="button" onClick={() => open({ kind: 'author', name: 'X', person: { id: 7 } })}>go</button>
    }
    const user = userEvent.setup()
    render(<Bare />)
    await user.click(screen.getByText('go'))
    // Even WITH a record: no stack means no panel to open into, so the press
    // reports rather than dying silently.
    await waitFor(() => expect(SAID.length).toBe(1))
  })
})

// AND NO SCREEN GOES ROUND IT. This is an inventory rather than a behaviour, and
// it is the half that would have caught the original defect: the router was
// right on the one screen that had it, and every other screen passed its own
// state setter to the credit instead.
describe('every screen routes a credit through the one opener', () => {
  const files = sourcesUnder((n) => n.endsWith('.jsx'), 40)

  it('never hands a raw state setter to a credit', () => {
    const offenders = []
    for (const f of files) {
      const src = readFileSync(join(SRC, f), 'utf8')
      // PERSON-SPECIFIC. An earlier version of this matched `set` followed by
      // any capital — which flagged three `onOpen={setQuote}` on quote hits, a
      // prop that opens a QUOTE. A guard that cries wolf gets switched off, and
      // this file criticises other tests for exactly that shape.
      //
      // BOTH FORMS, and the first version had only one. It matched the JSX
      // attribute `onOpenPerson={setPerson}` and nothing else — but a credit is
      // just as often wired through an options OBJECT, `onOpenPerson: setPerson`,
      // which is how `utteranceMeta` takes it. `Quotes.jsx` did exactly that,
      // three hundred lines above the same file's correct use of the router, and
      // this test passed green over it: an inventory that knows one spelling is
      // an inventory of one spelling. The defect it was written to prevent was
      // live in the tree the whole time it was passing.
      for (const m of src.matchAll(/onOpenPerson\s*(?:=\{|:\s*)set[A-Z]\w*|onOpen\s*(?:=\{|:\s*)setPerson\b/g)) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${f}:${line} ${m[0]}`)
      }
    }
    expect(offenders, 'a credit wired straight to a setter opens the older panel whatever the record says').toEqual([])
  })

  it('and the shell hands down the door those panels need', () => {
    // AN INVENTORY, FOR THE REASON THIS DESCRIBE BLOCK EXISTS. `work-door.test
    // .jsx` proves that a panel under the door opens the work; nothing in a
    // jsdom suite can prove the APP puts a door there, because that is one line
    // in the shell's own render and mounting the shell means mounting auth, the
    // router and eleven lazy screens.
    //
    // It is worth a line because of what it replaces. The door was a third
    // argument to `usePersonOpener`, and all seven callers passed two — so every
    // work tile in the app said it could not be opened while the register
    // recorded the door as landed. The provider makes that impossible to forget
    // at seven sites; this makes it impossible to forget at the one that is left.
    const app = readFileSync(join(SRC, 'App.jsx'), 'utf8')
    expect(app, 'the shell does not provide a work door, so every panel below it has none')
      .toMatch(/<WorkDoor\s/)
    expect(app, 'the shell provides a door with nothing behind it').toMatch(/<WorkDoor\s+open=\{/)
  })

  it('is imported by every screen that draws a credit', () => {
    // A screen rendering PersonCredit / PersonChip / PeopleChips is drawing a
    // credit, and a credit is a door.
    const missing = []
    for (const f of files) {
      const src = readFileSync(join(SRC, f), 'utf8')
      // IMPORTED FROM people.jsx, not merely named. `review.jsx` defines its OWN
      // `PersonChip` — display-only, because there the answer buttons own the tap
      // — and an earlier version of this flagged it for drawing a component with
      // the same name. What makes a credit a door is the shared component, so the
      // import is what to look for.
      const imports = new RegExp(
        String.raw`import \{[^}]*\b(PersonCredit|PersonChip|PeopleChips|PersonName)\b[^}]*\} from '\./people\.jsx'`,
        's',
      ).test(src)
      if (!imports) continue
      if (f === 'personOpen.jsx') continue
      if (!/usePersonOpener/.test(src)) missing.push(f)
    }
    expect(missing, 'these screens draw a credit and do not import the router').toEqual([])
  })
})
