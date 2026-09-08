// ONE DOOR TO A PERSON, and the two halves of the rule that broke it.
//
// THE BUG THIS PINS. Two surfaces name a person: `personPanel` is reached BY ID
// and is the design pack's screen; `PersonModal` is reached by kind+name and is
// the only surface that can CREATE a `people` row for a credited name nobody has
// saved. The routing between them lived in ONE screen's closure, and eighteen
// other call sites handed their raw `setPerson` straight to the credit — so from
// twelve other places a name opened the older panel however complete its record
// was, and the pack's screen looked absent rather than unreachable.
//
// WHY BOTH TESTS. The first exercises the router: given a record it opens the
// panel, given none it opens the modal. The second is an inventory over every
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

// THE SCAFFOLD THE ROUTER NOW CALLS FOR A CREDIT WITH NO RECORD. `SCAFFOLD` lets
// one case make it fail, which is the only remaining route to the older surface
// from a screen that HAS a panel stack.
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

// STATE, NOT A RENDER-LOCAL ARRAY. The first version of this harness pushed
// into arrays declared in the render body: nothing re-rendered, both outputs
// stayed empty, and the two router cases failed for the harness's reason rather
// than the router's — a test failing for the wrong reason is as useless as one
// passing for the wrong reason.
function Harness({ person }) {
  const [opened, setOpened] = useState([])
  const [legacy, setLegacy] = useState([])
  const stack = useMemo(() => ({ open: (p) => setOpened((o) => o.concat(p)) }), [])
  const toLegacy = useCallback((p) => setLegacy((l) => l.concat(p)), [])
  const open = usePersonOpener(stack, toLegacy)
  return (
    <>
      <button type="button" onClick={() => open({ kind: 'author', name: 'Herman Melville', person })}>
        press the credit
      </button>
      <output data-testid="opened">{opened.map((p) => p.title).join(',')}</output>
      <output data-testid="legacy">{legacy.map((p) => p.name).join(',')}</output>
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
    expect(screen.getByTestId('legacy').textContent).toBe('')
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
    expect(screen.getByTestId('legacy').textContent).toBe('')
  })

  // AND THE OLDER SURFACE IS STILL THERE FOR THE PRESS THAT CANNOT BE SERVED.
  // A scaffold that fails must not be a dead press, which is the rule the
  // no-stack case below already stands for.
  it('falls back to the older surface when the record cannot be written', async () => {
    SCAFFOLD = { ok: false, error: 'nope' }
    const user = userEvent.setup()
    render(<Harness person={undefined} />)
    await user.click(screen.getByText('press the credit'))
    await waitFor(() => expect(screen.getByTestId('legacy').textContent).toBe('Herman Melville'))
    expect(screen.getByTestId('opened').textContent).toBe('')
    SCAFFOLD = { ok: true, data: { id: 99, name: 'Herman Melville' } }
  })

  it('falls back rather than throwing when a screen has no panel stack', async () => {
    // Not the goal — a screen that draws credits should mount a PanelHost — but a
    // missing stack must not be a dead press, which is what the whole change is
    // about.
    const Bare = () => {
      const [seen, setSeen] = useState('')
      const open = usePersonOpener(null, (p) => setSeen(p.name))
      return (
        <>
          <button type="button" onClick={() => open({ kind: 'author', name: 'X', person: { id: 7 } })}>go</button>
          <output data-testid="bare">{seen}</output>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Bare />)
    await user.click(screen.getByText('go'))
    // Even WITH a record: no stack means no panel to open into, so the older
    // surface answers rather than the press dying. It is now the ONLY route into
    // that surface from a press, together with a scaffold that fails.
    await waitFor(() => expect(screen.getByTestId('bare').textContent).toBe('X'))
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
