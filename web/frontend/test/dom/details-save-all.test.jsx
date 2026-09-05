// The Details panel's master save (1.14.2).
//
// The panel is deliberately a stack of self-saving rows: the modal it replaced
// made you re-save a whole record to change one line. That is still the right
// answer for changing one line, and it costs six presses for six lines — so the
// header offers one, and the per-row controls stay exactly as they were.
//
// ONE REQUEST, NOT SIX, is the rule these tests exist for. Every row PUTs the
// FULL record with its own field changed. Six rows saving themselves is six
// full-state writes over the top of each other: run together the last reply
// wins, run in order each still reads the record as it was before the previous
// reply landed. Either way five edits vanish behind five toasts saying they were
// saved — a failure that reports success, which is the kind this repo keeps
// finding. A loop here would pass any test that only checked the final field.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

let PUTS, OK, CHANGED

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') {
      PUTS.push({ path, body })
      return OK ? { ok: true, data: { ...ITEM, ...body } } : { ok: false, status: 500, data: {} }
    }
    // The People section's own reads, so the panel can be driven from here.
    // THE PANEL READS ITS RECORD BACK ON MOUNT (useWorkRecord). A mock that did
    // not answer this would leave every case running against the seed, which is
    // the exact staleness the read was added to end.
    if (method === 'GET' && /^\/(books|movies)\/\d+$/.test(path)) {
      return { ok: true, data: path.startsWith('/movies') ? FILM : ITEM }
    }
    if (method === 'GET' && path.endsWith('/cast')) {
      return { ok: true, data: { cast: [{ id: 1, character: 'Ahab', actor: '' }], actor_role: 'none' } }
    }
    if (method === 'GET' && path.startsWith('/people')) return { ok: true, data: { people: [] } }
    if (method === 'POST' && path.endsWith('/cast/tvdb')) {
      return { ok: true, data: { title: 'Stalker', cast: [{ id: 4, character: 'The Stalker', actor: 'Aleksandr Kaydanovskiy' }] } }
    }
    return { ok: true, data: {} }
  }),
}))

const { workDetailsPanel } = await import('../../src/WorkDetails.jsx')
const { PanelHarness, resetPanelHistory } = await import('../panel-harness.jsx')

const ITEM = {
  id: 7, title: 'Solaris', author: 'Stanisław Lem', translator: '', editor: '',
  isbn: '', asin: '', description: '', published_year: 1961, published_circa: false,
  genres: [], series: '', series_index: 0, favorite: false,
}

// MODULE SCOPE, because the api mock answers the panel's record read-back with
// it and a mock hoisted above the file cannot see a describe's local.
const FILM = {
  id: 12, title: 'Stalker', director: 'Andrei Tarkovsky', media_type: 'movie',
  release_year: 1979, genres: [], series: '', series_index: 0, tmdb_id: 0, tvdb_id: 4321,
}

beforeEach(() => {
  PUTS = []
  OK = true
  CHANGED = []
  resetPanelHistory()
})

// MOUNTED THROUGH THE PANEL STACK, because that is where this form now lives and
// the master ✓ belongs to the CHROME rather than to the form. Rendering
// WorkDetails bare would leave useFormHost with no host, no form id, and no ✓ at
// all — which is precisely the regression this file is here to catch, so it must
// not be the thing this file does.
const panel = () => {
  const r = render(
    <PanelHarness
      panel={(stack) =>
        workDetailsPanel(stack, {
          kind: 'book',
          item: ITEM,
          onChanged: (rec) => CHANGED.push(rec),
          onDelete: null,
        })
      }
    />,
  )
  return r
}

// The panel opens on the frame after mount (open() walks history first), so every
// case waits for a row of the form before touching it.
const shown = () => waitFor(() => expect(screen.getByRole('button', { name: /Edit Title/i })).toBeTruthy())

// CLOSING IS NOW OBSERVED, NOT COUNTED. The panel dismisses itself through the
// stack — onClose calls stack.close(), which walks history back — so what a test
// can see is the panel gone from the page, which is also what a reader sees.
//
// THE CHROME, NOT A ROW. Asking for the Title row's pencil looks equivalent and
// is not: opening a row REPLACES its pencil with an input, so a panel with a row
// open would read as closed and three cases about exactly that state would pass
// for the wrong reason.
const isOpen = () => document.querySelector('.tp-panel') !== null
const closed = () => waitFor(() => expect(isOpen()).toBe(false))

// A row is opened by its pencil and typed into by its input.
const openRow = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Edit ${label}`, 'i') }))
}
const typeIn = (label, text) => {
  const box = screen.getByLabelText(new RegExp(`^${label}$`, 'i'))
  fireEvent.change(box, { target: { value: text } })
  return box
}
const masterSave = () => screen.getByLabelText('Save')
// The ✓ belongs to the chrome and appears one render after the body: the form
// registers itself in an effect, which is the only way the panel learns there is
// anything to commit.
const waitForSave = () => screen.findByLabelText('Save')

describe('the master save', () => {
  // IT IS NEVER GREYED, and it used to be greyed almost always. "Nothing to save"
  // is the state this panel is in for most of the time it is on screen — every row
  // saves itself, so by the time you reach the header the work is usually already
  // done — and a ✓ that is inert whenever you have finished is a ✓ that appears to
  // do nothing. The owner reported exactly that. So it means DONE: commit whatever
  // is open, then leave.
  it('is never disabled, with nothing open or with a row untouched', async () => {
    panel()
    await shown()
    expect((await waitForSave()).disabled).toBe(false)
    openRow('Title')
    expect(masterSave().disabled).toBe(false)
  })

  // ...and with nothing to save it writes nothing. "Does something" must not
  // become "writes the record back unchanged": that would stamp updated_at on a
  // row nobody edited, every time somebody closed the panel.
  it('closes without writing when there is nothing to save', async () => {
    panel()
    await shown()
    openRow('Title') // open, unchanged
    fireEvent.click(masterSave())
    await closed()
    expect(PUTS).toEqual([])
  })

  it('saves what is open AND closes the panel', async () => {
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())
    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.title).toBe('Solaris (1961)')
    await closed()
  })

  // TWO ROWS OF THIS FORM, and Author is no longer one of them: the credits moved
  // behind the People door with the cast they belong beside, and that panel keeps
  // its own master save. Title and Series are the pair now.
  it('sends every edited field in ONE request', async () => {
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    // "Series #" also matches /Edit Series/, so this one is anchored.
    fireEvent.click(screen.getByRole('button', { name: /^Edit series$/i }))
    typeIn('Series', 'Lem')

    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBeGreaterThan(0))
    // The count IS the assertion. A loop over the rows would send two, and the
    // second would carry the first field's ORIGINAL value alongside its own.
    expect(PUTS.length).toBe(1)
    expect(PUTS[0].body.title).toBe('Solaris (1961)')
    expect(PUTS[0].body.series).toBe('Lem')
  })

  // Full-state, like every other write here: the fields nobody touched go back
  // exactly as they stand rather than being dropped from the body.
  it('carries the untouched fields through', async () => {
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(PUTS[0].body.author).toBe('Stanisław Lem')
    expect(PUTS[0].body.published_year).toBe(1961)
  })

  // The same rule a single row follows: closing first would be snappier and
  // would throw away what you typed the moment the request failed.
  it('leaves the rows open when the server refuses', async () => {
    OK = false
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())

    await waitFor(() => expect(PUTS.length).toBe(1))
    expect(screen.getByDisplayValue('Solaris (1961)')).toBeTruthy()
    // AND THE PANEL STAYS UP. The ✓ closes on success, so the failure path has to
    // be the one thing it does not do — closing over a refused write would take
    // the error message and the drafts off the screen together.
    expect(isOpen(), 'the panel closed when it should not have').toBe(true)
  })

  // The per-row ✓ is what the panel is for, and it does not go away.
  it('does not replace the row own save', async () => {
    panel()
    await shown()
    openRow('Title')
    expect(screen.getAllByLabelText(/save/i).length).toBeGreaterThan(1)
  })
})

// ---- Enter, and the form this panel really is -------------------------------
//
// WHY THIS BLOCK EXISTS, AND WHY THE OTHERS COULD NOT SEE IT. The header ✓ is
// `type="submit" form={formId}`, so once it stopped being greyed it became this
// form's DEFAULT BUTTON — and a form with a default button is implicitly
// submitted by Enter in any text input inside it. The People panel lives inside
// that form, so typing a character's name and pressing Enter closed the whole
// Details panel and added nothing.
//
// jsdom does not implement implicit submission, which is exactly why every test
// in this file stayed green through it. So these assert the MECHANISM the browser
// uses: that the keydown's default is prevented before it can reach the form.
describe('Enter inside the panel', () => {
  const enter = (el) => fireEvent.keyDown(el, { key: 'Enter', bubbles: true, cancelable: true })

  it('does not submit the form from a text input', async () => {
    panel()
    await shown()
    openRow('Title')
    const box = screen.getByLabelText(/^Title$/i)
    // InlineField commits the row on Enter and prevents the default itself; the
    // form-level guard is what covers every OTHER input in the panel.
    expect(enter(box)).toBe(false) // false = something called preventDefault
    expect(isOpen(), 'the panel closed when it should not have').toBe(true)
  })

  it('is prevented for an input the panel does not own', async () => {
    // A box added to this panel later — the cast panel's, the cover URL's — gets
    // the guard whether or not whoever added it thought about Enter. That is the
    // point of putting it on the <form> rather than on each control.
    panel()
    await shown()
    const form = document.querySelector('form')
    const stray = document.createElement('input')
    form.appendChild(stray)
    expect(enter(stray)).toBe(false)
    expect(isOpen(), 'the panel closed when it should not have').toBe(true)
  })

  it('leaves a textarea alone, which needs its newline', async () => {
    panel()
    await shown()
    const form = document.querySelector('form')
    const area = document.createElement('textarea')
    form.appendChild(area)
    // A textarea never implicitly submits, so swallowing Enter there would only
    // take away the newline.
    expect(enter(area)).toBe(true)
  })
})

// ---- a form inside this form ------------------------------------------------
//
// WHY THIS EXISTS. The People panel opens the person editor, which is a <form>,
// INSIDE the Details <form>. React's synthetic submit bubbles through the React
// tree — a portal does not stop it — so pressing Save on a person ran that form's
// submit and then this one's, which closes the panel and, with a field row open
// and dirty, wrote the record nobody asked to write. CoverPicker.jsx had already
// written this rule down after the same bug ("the search bounces to the homepage").
//
// Asserted at the mechanism, because there is no person editor in this file's
// fixtures and the fault is not about people: a submit that did not come from THIS
// form is not this form's.
describe('a submit from somewhere else', () => {
  it('is ignored, so a nested form cannot close the panel', async () => {
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    const form = document.querySelector('form')
    const inner = document.createElement('form')
    form.appendChild(inner)
    // The event React would deliver to the outer form's onSubmit when an inner
    // form submits: target is the inner form, currentTarget the outer.
    fireEvent.submit(inner)
    await new Promise((r) => setTimeout(r, 0))
    expect(isOpen(), 'a nested form closed the panel').toBe(true)
    expect(PUTS, 'a nested form wrote the record').toEqual([])
  })

  it('and the panel still submits itself', async () => {
    panel()
    await shown()
    openRow('Title')
    typeIn('Title', 'Solaris (1961)')
    fireEvent.click(masterSave())
    await waitFor(() => expect(PUTS.length).toBe(1))
    await closed()
  })
})

// ---- what the panel's HOST does with a cast change --------------------------
//
// THE STEP THE PANEL'S OWN TESTS STOP ONE SHORT OF, and where both versions of one
// bug lived. Called with nothing, this host ran `setBook(undefined)` and the page
// unmounted. Called with its own record back — the first repair — it set state to
// the same reference, React bailed out, and the panel's edits reached nobody: the
// character combobox and the film board's cast list kept the old names until the
// page was reloaded by hand. Neither failure is visible from inside the panel, and
// asserting the argument at the panel cannot see either.
describe('a cast change reaches the record', () => {
  // BEHIND ONE PRESS, and not a collapsed section. The cast spent a release
  // hidden behind a "People" button *inside* the form and the owner could not
  // find it at all; then it sat above the form, twenty rows deep, between the
  // cover and the first field. It is now the pack's arrangement: the faces are on
  // the form, under a `Cast · N` head, and that head carries the way in.
  const openPeople = async () => {
    panel()
    await shown()
    const door = await waitFor(() => {
      const b = document.querySelector('.cs-section-action')
      expect(b, 'the Cast head carries no way into the list').toBeTruthy()
      return b
    })
    fireEvent.click(door)
    await screen.findByText('Ahab')
  }

  it('hands the host a NEW record carrying the new cast', async () => {
    await openPeople()
    // Named for the row, not by position: the Details panel has its own field
    // pencils with the same prefix.
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ahab' }))
    fireEvent.change(screen.getByLabelText(/^Character$/i), { target: { value: 'Ishmael' } })
    // The row's own ✓, named for the row: the dialog header carries a Save too.
    fireEvent.click(screen.getByRole('button', { name: 'Save Ahab' }))

    await waitFor(() => expect(CHANGED.length).toBeGreaterThan(0))
    const rec = CHANGED[CHANGED.length - 1]
    // Never undefined — that unmounted the page.
    expect(rec, 'the host was handed nothing').toBeTruthy()
    // Never the same object — React bails out of that, so nothing re-renders.
    expect(rec, 'the host was handed its own record back').not.toBe(ITEM)
    // And it carries the cast, which is what the boards read.
    expect(Array.isArray(rec.cast)).toBe(true)
    // The rest of the record survives, so this is an update and not a
    // replacement.
    expect(rec.title).toBe(ITEM.title)
    expect(rec.author).toBe(ITEM.author)
  })
})

// ---- the cast fetches are on the fetch screen ------------------------------
//
// A COMPONENT WITH NO CALLER PASSES EVERY TEST IT HAS. cast-panel.test.jsx proves
// CastFills asks TheTVDB correctly and hands back the cast; none of that is worth
// anything if the screen never renders it, and the move that put it here is
// exactly the kind of change that can leave it rendered nowhere. So this drives
// the real dialog: press the button a reader presses, and look for the control on
// the screen it lands on.
describe('the fetch screen carries the cast fetches', () => {
  const film = (onChanged) =>
    render(
      <PanelHarness
        panel={(stack) =>
          workDetailsPanel(stack, {
            kind: 'movie',
            item: FILM,
            onChanged: onChanged || (() => {}),
            onDelete: null,
          })
        }
      />,
    )

  // The panel opens a frame after mount, so each case waits for its first row.
  //
  // EXACT, and that is the fix for a 1-in-6 flake. The cover strip carries a
  // fetch of its own — "fetch metadata by edition", a different act on a
  // different subject — and it used to announce itself with these same two
  // words. So `getAll(...)[0]` took whichever of the two had mounted first, the
  // cover strip's read being the slower one, and every so often the click landed
  // on the wrong control and opened nothing. Both are named for what they do now,
  // and this addresses one of them.
  const fetchRow = () => screen.getByRole('button', { name: 'Fetch metadata' })
  const filmShown = () => waitFor(() => expect(fetchRow()).toBeTruthy())

  it('offers them where the other fetch is, not inside the People panel', async () => {
    film()

    await filmShown()
    // NOT IN THE PEOPLE PANEL — that is half the claim, and the half a
    // positive-only test misses. Opened here on purpose: the cast list is
    // genuinely inside it (the panel's own row, from the mocked /cast read
    // above), and the two fetches are genuinely not.
    fireEvent.click(document.querySelector('.cs-section-action'))
    expect(await screen.findByText('Ahab')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Cast from TheTVDB/ })).toBeNull()
    // Back to the form, where the fetch actually lives.
    fireEvent.click(screen.getByRole('button', { name: /Back to/i }))
    await filmShown()

    fireEvent.click(fetchRow())
    expect(await screen.findByRole('button', { name: /Cast from TheTVDB/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Cast from IMDb/ })).toBeTruthy()
  })

  // AND WHAT IT HANDS BACK REACHES THE HOST — the same seam that broke twice on
  // the People panel: never undefined (that unmounts the page), never the same
  // object (React bails out of a state set to the same reference).
  it('hands the host a new record carrying the fetched cast', async () => {
    const seen = []
    film((rec) => seen.push(rec))

    await filmShown()
    fireEvent.click(fetchRow())
    fireEvent.click(await screen.findByRole('button', { name: /Cast from TheTVDB/ }))

    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    const rec = seen[seen.length - 1]
    expect(rec, 'the host was handed nothing').toBeTruthy()
    expect(rec, 'the host was handed its own record back').not.toBe(FILM)
    expect(rec.cast.map((c) => c.character)).toEqual(['The Stalker'])
    expect(rec.title).toBe(FILM.title)
  })
})
