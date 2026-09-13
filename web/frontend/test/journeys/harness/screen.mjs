// THE WHOLE VOCABULARY A JOURNEY GETS: see, gone, press, type, valueOf, onScreen.
//
// IT IS DELIBERATELY SMALL, and what it leaves out is the point. There is no
// `click('.tp-filter-chip')`, no `$('[data-testid=…]')`, no `evaluate(() =>
// store.getState())`. A journey that could reach those would start using them the
// first time a name was awkward to find, and then it would be reading the code
// again with extra steps.
//
// EVERY CONTROL IS FOUND BY ITS ACCESSIBLE NAME, COMPUTED BY CHROME. Not by a
// name this file works out from aria-label-or-innerText-or-placeholder: a first
// draft did exactly that, and a hand-rolled name computation that disagrees with
// the browser's is two answers to one question, which is the defect this repo
// keeps writing about. `page.accessibility.snapshot()` is the browser's own
// answer, and it is the same answer a screen reader gets.
//
// THAT HAS A SECOND EFFECT WORTH HAVING ON PURPOSE: a control with no accessible
// name is unreachable from here, so a journey cannot be written for it until it
// has one. A suite that can only touch what a screen reader can touch is a suite
// that keeps the app reachable.
//
// EXACT, THEN PREFIX, THEN CONTAINS — AND AMBIGUITY IS AN ERROR, NEVER A GUESS.
// This app's navigation is named "Library 22 | 13", counts and all, so a journey
// that had to spell the count would break every time the fixture changed; prefix
// matching is what lets it say `press('Library')`. But "Copy" appears on every
// card on Home, and a matcher that took the first of those would press whichever
// the markup happened to put first — a coin toss that looks like a passing test.
// So more than one match is a failure that lists them and asks the journey to say
// which.
//
// FAILURES PRINT THE SCREEN AND WHAT WAS ON IT. Half the value of this tier is
// that a red journey says what the reader was looking at; "expected to find a
// button named Save" on its own sends somebody to the wrong file.

const DEFAULT_TIMEOUT = 15000

// What a person can press. Roles, not tag names, because the role is what the
// app promises and what a reader navigates by.
const PRESSABLE = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'checkbox', 'radio', 'switch']
// What a person can type in or choose from.
const FILLABLE = ['textbox', 'searchbox', 'combobox', 'spinbutton', 'listbox', 'slider']

const CSS_FOR = {
  // NATIVE CHECKBOXES AND RADIOS BY TAG, not only by an explicit role attribute:
  // <input type=checkbox> has the implicit role and carries no role=, so a list of
  // them was invisible here while the accessibility tree named every one.
  press: 'button, a[href], summary, input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"]',
  fill: 'input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [role="spinbutton"], [role="listbox"], [role="slider"]',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function screenVerbs(getPage) {
  const page = () => {
    const p = getPage()
    if (!p) throw new Error("there is no page yet — openApp()'s beforeAll has not run")
    return p
  }

  const onScreen = () => page().evaluate(() => document.body.innerText)

  // WAITING, NOT LOOKING ONCE. Everything here is asynchronous — a press starts a
  // fetch, the fetch redraws a list — so this polls until the words arrive or the
  // clock runs out. An assertion that reads the screen once is an assertion about
  // how fast the machine was.
  //
  // CASE IS NOT PART OF WHAT A SCREEN SAYS, for the same reason `pick` folds it
  // and with a second proof. `innerText` reports text as RENDERED, so a CSS
  // `text-transform: uppercase` reaches it: `.mono-label` carries that rule, so
  // the practice card's question — `quiz.question.flip.stem`, written "Where is
  // this from?" — arrives here as "WHERE IS THIS FROM?". A journey asserting the
  // sentence the app's own locale file spells got "it never appeared", printed a
  // screen dump with the words plainly on it, and read as a missing screen.
  //
  // So both verbs fold, and the pair stays honest: `gone` folding too means a
  // word that comes back SHOUTING is still a word that came back.
  const fold = (s) => s.toLowerCase()

  async function see(text, { timeout = DEFAULT_TIMEOUT } = {}) {
    try {
      await page().waitForFunction((t) => document.body.innerText.toLowerCase().includes(t), { timeout }, fold(text))
    } catch {
      throw new Error(`waited ${timeout}ms for "${text}" and it never appeared.\n\nThe screen said:\n\n${await onScreen()}`)
    }
  }

  async function gone(text, { timeout = DEFAULT_TIMEOUT } = {}) {
    try {
      await page().waitForFunction((t) => !document.body.innerText.toLowerCase().includes(t), { timeout }, fold(text))
    } catch {
      throw new Error(`waited ${timeout}ms for "${text}" to go and it is still there.\n\nThe screen said:\n\n${await onScreen()}`)
    }
  }

  // candidates — every visible thing of this kind, each paired with the name
  // Chrome computes for it. One CDP snapshot per element, which is the price of
  // asking the browser rather than guessing.
  // A MODAL TAKES THE SCREEN, so a verb that acts on a control may only see what
  // is inside it. This is ARIA's own rule, not a convenience: `aria-modal="true"`
  // says everything outside the dialog is removed from the accessibility tree,
  // and the app puts it on every dialog it draws. It is also what a reader
  // experiences — a scrim over the rest, and nothing behind it answers a click.
  //
  // WITHOUT THIS, "Export" IS AMBIGUOUS AND A JOURNEY CANNOT SAY WHICH. Pressing
  // Export on a board opens a confirm dialog whose own button is also "Export";
  // both matched, `press` refused as it should, and the only ways out were to
  // name a class or to guess. A reader has no such problem: there is one Export
  // in front of them. The innermost open dialog is the screen.
  //
  // `see` DELIBERATELY DOES NOT SCOPE. A scrim dims what is behind it, it does
  // not delete it — the reader can still read the list the dialog is asking
  // about, and a journey checking they can is asking a fair question.
  //
  // AND THE SURFACE IS THE INNERMOST ONE, NOT SIMPLY THE DIALOG — because a menu
  // the dialog itself opened does not live inside it. THE PORTAL TRAP, which this
  // repo has already paid for once: `TokenInput`'s own blur handler carries a
  // comment about it ("the menu is no longer a descendant of boxRef"). Scoping to
  // the dialog alone made the bulk editor's field chooser unreachable — its
  // listbox is `createPortal`'d to `<body>`, so "Season" sat outside the dialog
  // that had opened it and `press` reported that nothing on the screen was named
  // Season, over a menu with Season plainly in it.
  //
  // So the stack is read top down: an open menu sits ON a dialog, a dialog sits on
  // the page, and whichever is innermost is what the reader is answering.
  //
  // ONE FUNCTION, BOTH CALLERS — the repo's rule about two things that look the
  // same. `upload` asks the same question `candidates` does and must get the same
  // answer, or a file picker inside a dialog would be found by a different set of
  // rules from the button beside it.
  async function surface() {
    // Last in document order, because that is the one drawn on top.
    for (const sel of ['[role="listbox"], [role="menu"]', '[role="dialog"][aria-modal="true"]']) {
      const found = await page().$$(sel)
      let top = null
      for (const el of found) {
        if (await el.isVisible().catch(() => false)) {
          if (top) await top.dispose()
          top = el
        } else await el.dispose()
      }
      if (top) return top
    }
    return null
  }

  async function within(selector) {
    const root = await surface()
    const handles = root ? await root.$$(selector) : await page().$$(selector)
    if (root) await root.dispose()
    return handles
  }

  async function candidates(kind) {
    const handles = await within(CSS_FOR[kind])
    const roles = kind === 'press' ? PRESSABLE : FILLABLE
    const out = []
    for (const h of handles) {
      if (!(await h.isVisible().catch(() => false))) { await h.dispose(); continue }
      const snap = await page().accessibility.snapshot({ root: h }).catch(() => null)
      if (!snap || !snap.name || !roles.includes(snap.role)) { await h.dispose(); continue }
      out.push({ handle: h, name: snap.name, role: snap.role })
    }
    return out
  }

  // CASE IS NOT PART OF A NAME, and finding that out cost a journey. This app
  // styles its field labels in capitals, and the capitals reach the accessible
  // name: the quote box is named "QUOTE", the note box "NOTE" — while the one
  // beside them is "Chapter name" and another is "Tags". A journey that typed into
  // 'Quote' got "nothing a person could type in is named Quote", which reads like
  // a missing control and is a missing shift key. Worse, it read like an
  // ACCESSIBILITY DEFECT: I recorded in a commit that the field appeared to carry
  // no accessible name at all, and that was false.
  //
  // A person looking for the Quote box and a screen shouting QUOTE mean the same
  // thing, and ambiguity is still an error rather than a guess — so folding case
  // costs nothing and removes a whole class of unreadable failure.
  function pick(found, want, kind) {
    const w = fold(want)
    const tiers = [
      ['named exactly', found.filter((c) => fold(c.name) === w)],
      ['whose name starts with', found.filter((c) => fold(c.name).startsWith(w))],
      ['whose name contains', found.filter((c) => fold(c.name).includes(w))],
    ]
    for (const [how, hits] of tiers) {
      if (hits.length === 1) return { hit: hits[0] }
      if (hits.length > 1) {
        return {
          error: `${hits.length} things a person could ${kind === 'press' ? 'press' : 'type in'} are ${how} "${want}", ` +
            `so this journey would be pressing whichever one the markup happened to put first.\n` +
            `They are: ${hits.map((c) => JSON.stringify(c.name)).join(', ')}\n` +
            'Say which one by giving more of its name.',
        }
      }
    }
    return {
      error: `nothing a person could ${kind === 'press' ? 'press' : 'type in'} is named "${want}".\n` +
        `What is there: ${found.length ? found.map((c) => `${c.role} ${JSON.stringify(c.name)}`).join(', ') : '(nothing)'}`,
    }
  }

  // find — polls, because a control that is about to render is not a control that
  // is missing, and the difference is a few hundred milliseconds.
  async function find(kind, want, { timeout = DEFAULT_TIMEOUT } = {}) {
    const deadline = Date.now() + timeout
    let last = 'nothing was looked at'
    for (;;) {
      const found = await candidates(kind)
      const { hit, error } = pick(found, want, kind)
      if (hit) {
        await Promise.all(found.filter((c) => c !== hit).map((c) => c.handle.dispose()))
        return hit.handle
      }
      last = error
      await Promise.all(found.map((c) => c.handle.dispose()))
      if (Date.now() > deadline) break
      await sleep(150)
    }
    throw new Error(`${last}\n\nThe screen said:\n\n${await onScreen()}`)
  }

  // pressAll — TICK EVERY ONE OF THEM. A list of rows gives every row's checkbox
  // the SAME accessible name ("Select this line", six times), and `press` refuses
  // that on purpose: for two buttons sharing a name, picking one is a coin toss.
  //
  // BUT "TICK EVERY LINE" IS A REAL THING A PERSON DOES, and it is unambiguous in
  // a way "press the Copy button" is not — the intent names the whole set rather
  // than one of it. So it gets its own verb instead of an escape hatch into
  // page.$$, and a journey that means one row still cannot express it, which is
  // right: that journey should say which row by naming more of it.
  //
  // Returns how many it pressed, so a journey can assert it found what it expected
  // rather than silently pressing nothing — an empty list is a passing no-op, and
  // that is the vacuous shape this whole tier exists to end.
  async function pressAll(name, { timeout = DEFAULT_TIMEOUT } = {}) {
    const deadline = Date.now() + timeout
    for (;;) {
      const found = await candidates('press')
      const hits = found.filter((c) => fold(c.name) === fold(name))
      if (hits.length) {
        for (const h of hits) {
          await h.handle.scrollIntoView().catch(() => {})
          await h.handle.click()
        }
        await Promise.all(found.map((c) => c.handle.dispose()))
        return hits.length
      }
      await Promise.all(found.map((c) => c.handle.dispose()))
      if (Date.now() > deadline) {
        throw new Error(`nothing a person could press is named "${name}", so there was nothing to tick.` +
          `\n\nThe screen said:\n\n${await onScreen()}`)
      }
      await sleep(150)
    }
  }

  // upload — HAND THE APP A FILE, the way a reader hands it one through the
  // picker their platform draws. Puppeteer's `uploadFile` is the only honest
  // stand-in: a file chooser is the operating system's window, not the page's,
  // so there is nothing on screen for `press` to press.
  //
  // IT LOOKS PAST `candidates`, AND THAT IS DELIBERATE. The app's own picker
  // (`FilePick` in ui.jsx) keeps its `input[type=file]` `sr-only` — in the tree,
  // focusable, off screen — precisely so a keyboard can reach it, and the
  // visibility filter every other verb uses would throw it away. So this asks
  // for file inputs by tag and matches on the `aria-label` the primitive puts on
  // every one of them, which is the same name a screen reader announces.
  async function upload(name, filePath) {
    const inputs = await within('input[type="file"]')
    const named = []
    for (const h of inputs) {
      const label = await h.evaluate((el) => el.getAttribute('aria-label') || '')
      if (label) named.push({ handle: h, name: label })
      else await h.dispose()
    }
    const { hit, error } = pick(named, name, 'hand a file to')
    if (error) {
      await Promise.all(named.map((c) => c.handle.dispose()))
      throw new Error(`${error}\n\nThe screen said:\n\n${await onScreen()}`)
    }
    await hit.handle.uploadFile(filePath)
    await Promise.all(named.map((c) => c.handle.dispose()))
  }

  async function press(name, opts) {
    const el = await find('press', name, opts)
    try {
      await el.scrollIntoView().catch(() => {})
      await el.click()
    } finally {
      await el.dispose()
    }
  }

  // TYPED, NOT ASSIGNED. Setting .value from script fires no events, so a React
  // box keeps its old state and the screen disagrees with the DOM — exactly the
  // vacuous pass this tier exists to end. Select-all then keystrokes is what a
  // person does to replace what is in a box.
  async function type(label, value, opts) {
    const el = await find('fill', label, opts)
    try {
      await el.scrollIntoView().catch(() => {})
      await el.click({ count: 3 })
      await page().keyboard.press('Backspace')
      if (String(value) !== '') await el.type(String(value))
    } finally {
      await el.dispose()
    }
  }

  // A KEY A READER PRESSES: Enter to submit, Escape to dismiss, Tab and the
  // arrows to move. It goes to whatever has focus, which after `type` is the box
  // just typed in.
  //
  // IT IS IN THE VOCABULARY BECAUSE IT IS SOMETHING A PERSON DOES, not because
  // the harness needs it. The app's search is submit-on-Enter — typing alone
  // changes nothing — so without this verb a journey could fill the box and never
  // search, which is what the first draft of the vocabulary's own test did.
  const pressKey = (key) => page().keyboard.press(key)

  async function valueOf(label, opts) {
    const el = await find('fill', label, opts)
    try {
      return await el.evaluate((e) => ('value' in e ? e.value : e.textContent))
    } finally {
      await el.dispose()
    }
  }

  return { onScreen, see, gone, press, pressAll, pressKey, type, upload, valueOf }
}
