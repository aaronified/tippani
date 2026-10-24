import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormHostContext, FormModal, PanelHost, SCRIM, Toggle, backdropClose, escapeDepth, useBackToClose, useBackToTop, useBodyScrollLock, useConfirm, useEscape, useFormHost, usePanelStack } from '../../src/ui.jsx'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useContext, useEffect, useRef, useState } from 'react'
import { sourcesUnder } from '../src-files.js'
import userEvent from '@testing-library/user-event'
import { PanelHarness, resetPanelHistory } from '../panel-harness.jsx'

// PRESSING THE DARKNESS AROUND A DIALOG CLOSES IT. PRESSING THE DIALOG DOES NOT.
//
// THE RULE. Every overlay in this app sits on a full-viewport scrim, and the
// scrim is a way out: a press that lands on it dismisses the thing it is behind.
// A press that lands on the dialog — or one that STARTS on the dialog and drifts
// onto the scrim, which is what selecting a line of text looks like — must not.
// That second half is the whole reason the check is `e.target === e.currentTarget`
// and not "did this press land inside the scrim's box".
//
// AND THE SCRIM CONTAINS ITS OWN SCROLL. `.tp-scrim` carries
// `overscroll-behavior: contain`, so a wheel that runs past the end of a dialog
// stops there instead of moving the page behind it — the page you cannot see,
// moving under the thing you are reading, and still moved when you close it.
// `test/rules/scroll-containment.test.js` sweeps for that; what is checked here is
// that each overlay actually WEARS the class carrying it.
//
// WHY IT IS WORTH A TEST NOW. Nine files wrote the same class list and the same
// four-line handler out in full. Both are shared, and a shared thing that nothing
// presses is a shared thing that can be wrong in nine places at once instead of
// one.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above.
describe('scrim dismiss', () => {
  afterEach(() => cleanup())

  // The overlay element itself: the outermost thing wearing the scrim class.
  const scrim = () => document.querySelector('.tp-scrim')

  describe('the shared handler', () => {

    it('and not on one that started inside the dialog', () => {
      const onClose = vi.fn()
      const card = document.createElement('div')
      const back = document.createElement('div')
      backdropClose(onClose)({ target: card, currentTarget: back })
      expect(onClose, 'a press inside the dialog dismissed it').not.toHaveBeenCalled()
    })

  })

  describe('a dialog on that scrim', () => {
    it('closes when the darkness around it is pressed', () => {
      const onClose = vi.fn()
      render(<FormModal open title="Edit" onClose={onClose}><p>body</p></FormModal>)
      const back = scrim()
      expect(back, 'the dialog draws no scrim at all').toBeTruthy()
      fireEvent.mouseDown(back)
      expect(onClose, 'pressing the backdrop did not close the dialog').toHaveBeenCalled()
    })

  })
})

// DISMISSING A SUBMENU MUST NOT DISMISS ITS PARENT.
//
// THE BUG, as reported: "the details peoples menu is getting dismissed if i
// clicked an actor and then dismissed the people screen." Open a work's Details,
// press People, tap an actor — PersonModal opens over the panel — and dismissing
// the person took the People panel with it.
//
// WHY. usePanelStack pushes a history entry per panel, so a phone's back gesture
// is how a panel is dismissed. PersonModal pushed NOTHING, so it was not on the
// stack at all: back skipped straight past it to the entry underneath, which was
// the panel's. The modal vanished only because its parent unmounted.
//
// ui.jsx has had `useBackToClose` for exactly this since the first dialog needed
// it, and FormModal, MobileSheet and the changelog viewer all use it. Five
// dismissible overlays did not. So there are two things to hold here, and the
// second is the one that stops this recurring:
//
//   1. THE ORDERING. With its own entry, one back closes the overlay and leaves
//      the panel; a second back closes the panel. Asserted against jsdom's real
//      session history rather than a mock — these are real pushes and real
//      traversals, which is the only way the interleaving of two independent
//      history users can be wrong.
//
//   2. THE ROLL. A scan naming every overlay that owns a dismissible scrim, and
//      failing on one that does not register. The next overlay is what this is
//      for: nothing about writing a new modal makes you think about the back
//      gesture, and the symptom appears two surfaces away from the cause.
describe('nested dismiss', () => {
const SRC = process.env.TIPPANI_SRC
const read = (f) => readFileSync(join(SRC, f), 'utf8')

beforeEach(() => {
  window.history.replaceState(null, '', '/library')
})

const popped = () => new Promise((r) => window.addEventListener('popstate', r, { once: true }))
const back = async () => {
  const landed = popped()
  window.history.back()
  await act(async () => { await landed })
}

// A submenu, drawn the way every one of the five is: mounted only while open,
// dismissed by its own control, and owning one history entry.
function Submenu({ onClose }) {
  useBackToClose(true, onClose)
  return (
    <div data-testid="submenu">
      <button type="button" onClick={onClose}>dismiss the submenu</button>
    </div>
  )
}

// A parent panel with a control that opens the submenu over it — the shape of
// Details → People → a person.
function Harness() {
  const stack = usePanelStack()
  const [sub, setSub] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => stack.push({
          title: 'People',
          render: () => (
            <div data-testid="panel">
              <button type="button" onClick={() => setSub(true)}>open the submenu</button>
            </div>
          ),
        })}
      >
        open the panel
      </button>
      <PanelHost stack={stack} />
      {sub && <Submenu onClose={() => setSub(false)} />}
    </>
  )
}

const panel = () => screen.queryByTestId('panel')
const submenu = () => screen.queryByTestId('submenu')

const openBoth = async () => {
  render(<Harness />)
  await act(async () => { fireEvent.click(screen.getByText('open the panel')) })
  expect(panel(), 'the panel did not open').toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByText('open the submenu')) })
  expect(submenu(), 'the submenu did not open').toBeTruthy()
}

describe('a submenu over a panel', () => {
  it('is dismissed by Back without taking the panel with it', async () => {
    await openBoth()
    await back()
    // THE WHOLE BUG, in two assertions. Before the fix the first was already
    // true — the submenu went — and the second was false.
    expect(submenu(), 'the submenu survived its own dismissal').toBeNull()
    expect(panel(), 'dismissing the submenu dismissed its parent').toBeTruthy()
  })

})

// ── THE ROLL.
//
// Named per overlay rather than counted: the fix is always one line, and knowing
// WHICH surface is missing it is the whole of the work. `ui.jsx` is excluded
// because it is where the hook lives; a scrim in there is a primitive that its
// callers gate (FormModal and MobileSheet both register for themselves).
})

// Escape closes the innermost surface, one layer at a time.
//
// THE BUG: seventeen keydown listeners were attached to `document`
// independently, and every one that recognised Escape acted on it. None yielded
// to the others and none stopped propagation, so one press reached all of them.
//
// The failure a reader meets: open a work's Details panel, press a row's pencil,
// type, press Escape. The row's edit is cancelled AND the panel closes — the
// words go, and so does the screen you were typing them on. Nothing throws;
// there is simply less on the screen than there was, and one of the things
// missing is what you just wrote.
//
// The design pack states it in capitals — "ESCAPE CLOSES THE INNERMOST SURFACE,
// ONE LAYER AT A TIME" — with an ordered ladder: confirm, back one panel, close
// the panel, popover, dialog.
//
// So the assertions here are about ARBITRATION, not about any one surface. Two
// things are registered, one press arrives, and exactly one of them hears it.
describe('escape ladder', () => {
  // A surface is anything that claims Escape while it is open.
  function Surface({ open = true, onEscape }) {
    useEscape(open, onEscape)
    return null
  }

  const esc = () => fireEvent.keyDown(document, { key: 'Escape' })

  afterEach(cleanup)

  describe('one press, one surface', () => {
    it('goes to the one registered last, and to nothing else', () => {
      const outer = vi.fn()
      const inner = vi.fn()
      render(
        <>
          <Surface onEscape={outer} />
          <Surface onEscape={inner} />
        </>,
      )
      esc()
      expect(inner, 'the innermost surface did not hear it').toHaveBeenCalledTimes(1)
      expect(outer, 'the layer underneath heard it too — this is the whole bug').not.toHaveBeenCalled()
    })
  })
})

// A SURFACE THAT TAKES FOCUS TAKES IT WHOLE.
//
// THE REPORT, the owner's, over a screenshot of a character sheet standing on a
// film's quote list: "there is no problem on the popup, but the background app.
// it can still scroll! and the chevron from bottom locations is visible above
// the popup as well." Then, as the rule: "stop scrolling screens that are not in
// focus" and "the chevron will only appear when a long scroll surface is in
// focus and has been scrolled significantly down".
//
// THE TWO ARE ONE FACT ASKED TWICE. While something covers the page, the page is
// not what the reader is scrolling — so it must not scroll, and the key that
// offers to scroll it back to the top must not be on screen offering.
//
// WHY THE LOCK LOOKED PRESENT AND WAS NOT. `PanelHost` has called
// `useBodyScrollLock` since it was written, and the hook hid the overflow of
// `<body>`. The element that scrolls a standards-mode document is `<html>`, so
// the lock was hiding the overflow of a box that was not the scroller and the
// page went on moving. Nothing in the source looked missing, which is why this
// asks the DOCUMENT what it can do rather than asking the component what it
// calls.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above; that
// `useBodyScrollLock`, `useOverlayOpen` and `useBackToTop` live in `ui.jsx`; and
// that jsdom has no layout, so "can this scroll" is read off the scrolling
// element's own overflow and not off a rectangle.
describe('focus owns the scroll', () => {
afterEach(() => {
  cleanup()
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
})

// An overlay is anything that locks; this is the smallest one there can be.
function Overlay({ on }) {
  useBodyScrollLock(on)
  return null
}

function Key() {
  const { show } = useBackToTop({ enabled: true })
  return <span data-testid="key">{show ? 'on' : 'off'}</span>
}

// A key given a surface of its own. The pack's rule is that the key belongs to
// the element that scrolled — "not a ref that happens to exist", after a version
// where it fired scrollTo on a panel that was closed and the page never moved.
function BoxKey({ overlay = false }) {
  const ref = useRef(null)
  const { show } = useBackToTop({ enabled: true, target: ref })
  useBodyScrollLock(overlay)
  return (
    <>
      <div data-testid="box" ref={ref} />
      <span data-testid="boxkey">{show ? 'on' : 'off'}</span>
    </>
  )
}

// jsdom lays nothing out, so the numbers a scroller reports are the ones a test
// puts on it.
const box = () => document.querySelector('[data-testid="box"]')
const scrollBoxFarDown = async (at = 2000) => {
  const el = box()
  Object.defineProperty(el, 'scrollHeight', { value: 4000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 800, configurable: true })
  el.scrollTop = at
  await act(async () => { fireEvent.scroll(el) })
  await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
}
const boxShowing = () => document.querySelector('[data-testid="boxkey"]').textContent

const showing = () => document.querySelector('[data-testid="key"]').textContent

// The document is tall and scrolled far enough that the key has every reason to
// be up: `useBackToTop` wants a scrollable height over 260 and an offset past a
// quarter of it.
const scrollFarDown = async () => {
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
  window.scrollY = 2000
  await act(async () => { fireEvent.scroll(window) })
  // rAF is what the hook throttles on, and jsdom runs it on a timer.
  await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
}

describe('the page behind an overlay', () => {
  it('cannot scroll — the element that actually scrolls is the one locked', () => {
    render(<Overlay on />)
    const scroller = document.scrollingElement || document.documentElement
    expect(scroller.style.overflow,
      'the page behind an open overlay can still be scrolled: the lock hid the overflow of a box that is not the scroller')
      .toBe('hidden')
  })
})
})

// A TABLIST HAS TO ANSWER THE ARROW KEYS, AND THIS ONE DID NOT.
//
// FOUND WHILE CHECKING MY OWN PROSE, which is worth recording because the defect
// and the way it surfaced are the same story. A changelog entry claimed "the
// pickers and toggles answer arrow keys". The pickers do — `ColorSwatches` has an
// `onKey` that moves focus with a wrap. The toggles did not: a grep over
// `Toggle`'s whole body found no `onKeyDown` and no `ArrowRight` anywhere in it.
// The sentence was corrected first (465e4da2); this closes the gap it described.
//
// IT WAS NEVER A BARRIER, which is why it is a fix rather than a bug. Every
// option is a real <button role="tab"> and could always be reached with Tab and
// pressed with Enter or Space. What was wrong is the CONTRACT: ARIA's tabs
// pattern puts ONE tab stop on a tablist and moves between its tabs with the
// arrows, so a screen reader announcing "tab, 2 of 4" was offering a gesture the
// widget ignored — and reaching the fourth option cost four Tab presses through
// a control the pattern says should cost one.
//
// MANUAL ACTIVATION, NOT AUTOMATIC, and the reason is not only consistency with
// `ColorSwatches`. Selecting as focus passes would fire `onChange` for every
// option arrowed THROUGH, and these toggles save — so arrowing from the first
// setting to the fourth would write three settings the reader never chose.
describe('toggle answers the arrows', () => {
  const OPTIONS = [['a', 'Alpha'], ['b', 'Beta'], ['c', 'Gamma'], ['d', 'Delta']]

  function draw(value = 'b', onChange = () => {}) {
    render(<Toggle value={value} onChange={onChange} options={OPTIONS} ariaLabel="Pick one" />)
    return [...document.querySelectorAll('[role="tab"]')]
  }

  describe('the toggle a keyboard meets', () => {

    it('moves focus along the row on Left and Right', async () => {
      const user = userEvent.setup()
      const tabs = draw('b')
      tabs[1].focus()
      await user.keyboard('{ArrowRight}')
      expect(document.activeElement, 'ArrowRight did not move focus').toBe(tabs[2])
      await user.keyboard('{ArrowLeft}{ArrowLeft}')
      expect(document.activeElement, 'ArrowLeft did not move focus').toBe(tabs[0])
    })

  })
})

// useConfirm, and the thirteen deletes that had never run.
//
// THE POINT IS NOT THE LOOK, IT IS THAT THE PATH EXECUTES. Every one of these
// actions was written `if (!confirm(question)) return`. jsdom has no confirm():
// it warns and returns undefined, which is falsy — so in every test that ever
// reached one of these handlers, the delete underneath returned early and the
// request was never made. They were not thinly covered, they were uncoverable.
//
// So this file asserts the two halves that were missing: the question is asked
// with the app's own dialog (in the app's own language, keyboard-dismissible),
// and answering it yes actually performs the delete.
describe('confirm hook', () => {
let RESULT

function Subject({ question }) {
  const { ask, confirmDialog } = useConfirm()
  return (
    <div>
      {confirmDialog}
      <button
        onClick={async () => {
          RESULT = await ask(question)
        }}
      >
        do it
      </button>
    </div>
  )
}

beforeEach(() => {
  RESULT = 'never settled'
})
afterEach(() => cleanup())

const press = async (label) => {
  await act(async () => {
    screen.getByText(label).closest('button').click()
  })
}

// THE DEFECT THIS PINS WAS FOUND BY LOOKING AT A RENDER, not by a test: the tag
// delete's question appeared UNDERNEATH the tag cards. A `.hand-card` is
// `isolation: isolate`, so a dialog rendered inside one is trapped in that card's
// stacking context and every later sibling paints over it — and z-50 cannot help,
// because z-index is only ever compared within a stacking context. jsdom has no
// layout and no paint, so nothing in the suite could have seen it. What a test
// CAN see is the structural cause, which is the dialog's position in the tree.

describe('the answer', () => {

  it('resolves false when cancelled — the caller returns, it does not hang', async () => {
    render(<Subject question="Delete this quote?" />)
    await press('do it')
    await press('Cancel')
    expect(RESULT).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

})
})

// A dismissal must not discard what you typed.
//
// The Details panel is a stack of self-saving rows: you open one, type, press ✓,
// open the next. Every way OUT of it was unconditional — the ✕, the scrim,
// Escape, the back gesture — so a reader with three rows open and typed into lost
// all three to one click outside the panel. No question, no toast, nothing.
//
// The machinery to know better already existed and was never read on the way out.
// `useUnsavedFields` keeps a registry of dirty rows and reports a count, and the
// panel header already used it to decide whether to draw the ✓. It just never
// reached the close routes.
//
// So what is pinned here is the arbitration, not the dialog: with nothing to
// lose every route still closes at once, and with something to lose every route
// asks first — including Escape, which is the fastest of them and the one most
// likely to be pressed by reflex.
describe('panel dirty guard', () => {
// A panel body that reports N dirty rows, the way WorkDetails does.
function Body({ dirty }) {
  const host = useFormHost('')
  useEffect(() => {
    host?.setDirty?.(dirty)
    return () => host?.setDirty?.(0)
  }, [host, dirty])
  return <p>the panel body</p>
}

function Harness({ dirty = 0, onClosed = () => {} }) {
  const stack = usePanelStack()
  useEffect(() => {
    stack.open({ title: 'Details', render: () => <Body dirty={dirty} /> })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (stack.stack.length === 0) onClosed()
  }, [stack.stack.length, onClosed])
  return <PanelHost stack={stack} />
}

const scrim = () => document.querySelector('.tp-panel-scrim')
// WAIT FOR THE COUNT TO HAVE LANDED, not for a timer. `stack.open()` walks
// history back before it pushes, so the panel settles over more than one commit
// and the content publishes its count somewhere in there. `data-dirty` on the
// panel is that state made visible; without it a test can only sleep and hope.
const settled = (n) => waitFor(() => expect(document.querySelector(`[data-dirty="${n}"]`)).toBeTruthy())
const panel = () => document.querySelector('.tp-panel')
const esc = () => fireEvent.keyDown(document, { key: 'Escape' })
const clickAway = () => fireEvent.mouseDown(scrim(), { target: scrim() })

// AND THE FOURTH WAY OUT, added when the panel became a bottom sheet on a phone:
// "scrolling down will close the popup now (which becomes an intuitive thing).
// any edits pending save will trigger the same warning as it does now." A second
// exit that skips the question is not a convenience, it is a way to lose typing,
// so it belongs in this file rather than beside the gesture that implements it.
//
// The gesture only exists where the panel IS a sheet, so the phone query has to
// hold; the setup's matchMedia answers false to everything.
const phone = () => { window.matchMedia = (media) => ({
  matches: media.includes('768'), media, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  dispatchEvent: () => false,
}) }
const body = () => document.querySelector('.tp-panel-body')
// THE GESTURE IS A DRAG NOW, NOT A SWIPE, and the difference matters to this
// file: a swipe fired the exit the moment it passed a threshold, while a drag
// resizes the sheet and decides only when the finger LIFTS. So a dismissal that
// forgot to ask its question would now do it on pointerup — a different line of
// the hook — and a harness still sending touchmove would watch the wrong one.
//
// It starts in the BODY, which is where the report puts it ("scrolling down"),
// and the body is at its own top, which is the only place a downward pull can
// mean leaving rather than reading.
const dragDown = (by = 160) => {
  const el = body()
  const at = (y) => ({ pointerId: 1, pointerType: 'touch', button: 0, clientY: y })
  fireEvent.pointerDown(el, at(120))
  fireEvent.pointerMove(window, at(120 + by))
  fireEvent.pointerUp(window, at(120 + by))
}

const realMatchMedia = window.matchMedia
beforeEach(() => { window.matchMedia = realMatchMedia })
afterEach(() => {
  cleanup()
  resetPanelHistory()
  window.matchMedia = realMatchMedia
})

// AND THE PANEL DRAWS ITS OWN WAY BACK UP, which is a fact about the RENDER and
// not about the hook. The hook's own cases live in `focus-owns-the-scroll`; this
// one exists because the element went missing from `PanelHost` in the commit that
// described it, and every one of those hook cases stayed green — a rule tested
// only where it is decided is a rule nobody checks is wired.

describe('with work at stake', () => {
  it('asks instead of closing when you click outside', async () => {
    render(<Harness dirty={2} />)
    await settled(2)
    clickAway()
    expect(await screen.findByText(/Leave without saving/), 'it closed silently').toBeTruthy()
    // AND THE PANEL IS STILL THERE. A question that appears while the thing it
    // is about has already gone is not a question, it is a notification.
    expect(screen.getByText('the panel body')).toBeTruthy()
  })

  it('keeps the panel and the drafts when you say keep', async () => {
    render(<Harness dirty={1} />)
    await settled(1)
    clickAway()
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/Leave without saving/)).toBeNull()
    // A SLEEP, DELIBERATELY, and it is the one case that needs one. Every other
    // assertion here waits for something to APPEAR; this one has to prove
    // something does NOT happen, and the close it must not do is asynchronous —
    // the stack walks history back, which lands a frame or two later. Asserting
    // straight after the click passed even when "keep" closed the panel anyway,
    // which is a mutation I had to watch survive before I believed it.
    await new Promise((r) => setTimeout(r, 80))
    expect(screen.getByText('the panel body'), 'saying keep still closed the panel').toBeTruthy()
    expect(document.querySelector('[data-dirty="1"]'), 'the drafts were dropped').toBeTruthy()
  })

  it('closes for real when you say discard', async () => {
    const onClosed = vi.fn()
    render(<Harness dirty={1} onClosed={onClosed} />)
    await settled(1)
    clickAway()
    fireEvent.click(await screen.findByRole('button', { name: /discard/i }))
    expect(screen.queryByText(/Leave without saving/), 'the question stayed up').toBeNull()
    await waitFor(() => expect(screen.queryByText('the panel body')).toBeNull())
    await waitFor(() => expect(onClosed).toHaveBeenCalled())
  })
})
})

// A panel that holds a form draws the key that commits it — and one that does not
// draws nothing.
//
// THE FAILURE THIS EXISTS FOR is silent and total. A form in this app does not
// draw its own ✓: `useFormHost` registers the form with whatever chrome is above
// it, wears that chrome's form id, and reports a reason it cannot be saved yet;
// the chrome draws one submit key bound to that id. For a long time the only
// chrome that did this was FormModal. Moving a form onto the panel stack
// therefore returned null from useFormHost, left the <form> with no id, and
// deleted the only control that submits it — with nothing thrown, nothing logged
// and every existing test still green, because the tests that would have noticed
// were being rewritten around the new shell in the same change.
describe('panel form host', () => {
// A form exactly as a real one is written: it asks the host for an id, reports
// whether it is ready, and wears the id it is given.
function TinyForm({ reason = '', onSubmit }) {
  const host = useFormHost(reason)
  return (
    <form id={host?.formId} onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <p>the form body</p>
    </form>
  )
}

const save = () => screen.queryByLabelText('Save')

// TWO WAITS, AND BOTH ARE REAL PROPERTIES OF THE STACK rather than test
// artefacts. open() pushes on the next frame, because it walks history back
// first and the push has to wait for the pop to land — so the panel's body
// arrives asynchronously. And the ✓ arrives one render AFTER the body: the form
// inside registers itself in an effect, which is the only way the chrome can
// learn there is anything to commit.
const opened = () => waitFor(() => expect(screen.getByText(/the form body|just a list/)).toBeTruthy())
const savedKey = () => screen.findByLabelText('Save')

beforeEach(() => { cleanup(); resetPanelHistory() })

describe('a panel that hosts a form', () => {
  it('draws the key, and pressing it submits the form', async () => {
    const onSubmit = vi.fn()
    render(<PanelHarness panel={{ title: 'Details', render: () => <TinyForm onSubmit={onSubmit} /> }} />)
    await opened()
    const key = await savedKey()
    expect(key, 'the panel drew no save key, so the form cannot be submitted at all').toBeTruthy()
    // BOUND BY ID, not by being inside the form: the key lives in the panel's
    // header and the form lives in its body, so `form={formId}` is the only thing
    // joining them. A key that is merely present but unbound submits nothing.
    expect(key.getAttribute('form')).toBeTruthy()
    expect(document.querySelector('form').id).toBe(key.getAttribute('form'))
    fireEvent.click(key)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

})

// The port's own case, kept apart from the ported ones on purpose.
//
// details-save-all.test.jsx and supplier-ids.test.jsx were both rewritten onto
// the harness in the same change that moved WorkDetails onto the stack. Every
// assertion in them survived verbatim, which is the point — but a regression in
// the SHELL could still hide inside a rewrite of the tests that watch it. So the
// shell has a case of its own that no port touched.
})

// "SHOW ME THIS" SHOWS THIS, ON THE SECOND PASS AS WELL AS THE FIRST.
//
// THE MEASUREMENT, on the owner's library at 1280: open a film's Details, open a
// character from its cast, press the performer's name — three times in one tab.
//
//   pass 1 → "Max von Sydow · actor · 1 work"        the person's page
//   pass 2 → "Details … POSTER … Fetch metadata"     two panels down
//   pass 3 → the same
//
// The press is one that REPLACES the stack — a person's page is not deeper than
// a character's, it is instead of it — and the mechanism asked the browser to
// walk history back to empty and pushed the panel on the pop it got. By the
// second pass the entries below were the FIRST pass's panels, which carry a
// panel depth of their own, so the pop arrived with the stack truncated to two
// rather than to none; the lander correctly decided that pop was somebody else's
// and abandoned the open. The reader pressed a name and was dropped onto a panel
// they had not asked for, which is worse than a control that does nothing.
//
// THE PROPERTY, which is the whole of what open() promises: after it, the stack
// IS this panel. Not "eventually", not "if the history walk lands where it was
// asked to" — a control that means "show me this" cannot depend on what the
// reader did before pressing it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that jsdom is why
// this was invisible for so long — `history.go()` there does not deliver a
// popstate the way a browser does, so every test of a replacing open passed on a
// mechanism that only works on the first pass.
describe('panel open replaces', () => {
afterEach(() => cleanup())

const panelNamed = (title) => ({ title, render: () => <p>{title} body</p> })

// The harness hands the stack out so a case can drive it, and renders the host
// so the assertions can be about what is ON SCREEN rather than about the array.
// THE HARNESS PUBLISHES THE DEPTH, and that is the whole of finding 2: the first
// draft asserted the number of `.tp-panel` elements, and `PanelHost` renders only
// the TOP of the stack — so that count is 1 whatever the stack holds. Mutating
// `open` to a plain `push` left three of these four cases green, which is a test
// that reads as a guard and is not one. `take` is called on every render so the
// case sees the depth as it stands, not as it stood when the panel mounted.
function Harness({ take }) {
  const stack = usePanelStack()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    take(stack)
  }, [take, stack])
  depthNow = stack.stack.length
  return <PanelHost stack={stack} />
}
let depthNow = 0

const onScreen = () => document.querySelector('.tp-panel')?.textContent || ''

describe('a control that means "show me this"', () => {

  it('does not deepen, however many times it is pressed', async () => {
    // The other half of the promise, and the one open() exists for: a control
    // meaning "show me this" must not BURY what a previous one left open. Pressed
    // twice it swaps twice; it does not stack two answers.
    let stack
    await act(async () => { render(<Harness take={(s) => { stack = s }} />) })
    await act(async () => { stack.push(panelNamed('Details')) })
    await act(async () => { stack.push(panelNamed('Esbern')) })
    expect(depthNow, 'two pushes did not make a stack of two').toBe(2)
    await act(async () => { stack.open(panelNamed('Max von Sydow')) })
    expect(depthNow, 'a replacing open DEEPENED the stack instead of swapping its top').toBe(2)
    await act(async () => { stack.open(panelNamed('Michael Hogan')) })
    expect(onScreen()).toContain('Michael Hogan')
    expect(depthNow, 'a second "show me this" stacked on top of the first').toBe(2)
  })

})
})
