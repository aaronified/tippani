// THE WHOLE VOCABULARY A JOURNEY GETS: see, gone, press, hold, type, valueOf,
// chosen, onScreen.
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
      // CHROME'S NAME, NOT THE `aria-label` ATTRIBUTE — the same computation every
      // other verb here uses, and the reason is the app's own picker. `FilePick`
      // draws a <label> that IS the button with the input inside it, so most of
      // its inputs carry NO aria-label at all: the name comes from the label's
      // own text, exactly as a screen reader would read it. Asking for the
      // attribute found nothing on the import picker and would have read as a
      // missing control, or worse as an accessibility defect in the app.
      const snap = await page().accessibility.snapshot({ root: h }).catch(() => null)
      if (snap?.name) named.push({ handle: h, name: snap.name })
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

  // choose — PICK ONE OF THE THINGS A LIST OFFERS.
  //
  // IT IS IN THE VOCABULARY BECAUSE IT IS SOMETHING A PERSON DOES, which is the
  // only test for admission here, and because without it a whole control was
  // unreachable from this tier. A native <select> is not pressable — a reader
  // opens it and picks a word — and `type` cannot drive one either: it clicks,
  // clears and types, and a select has nothing to clear. So the works console's
  // filter, which is the control that console is FOR, could be looked at from a
  // journey and never operated.
  //
  // IT NAMES THE OPTION BY ITS WORDS, never by its value. A journey that passed
  // 'no_synopsis' would be naming a token the app stores rather than the words the
  // reader reads, which is the line this whole vocabulary is drawn on. Case is
  // folded for the reason `press` folds it.
  //
  // AND IT REFUSES AN OPTION THAT IS NOT THERE rather than leaving the list on
  // whatever it was showing — a silent no-op is a journey that goes on asserting
  // against the unfiltered screen and passes.
  async function choose(label, option, opts) {
    const el = await find('fill', label, opts)
    try {
      const picked = await el.evaluate((e, want) => {
        if (!e.options) return null
        const hit = [...e.options].find((o) => (o.textContent || '').trim().toLowerCase() === want)
        if (!hit) return [...e.options].map((o) => (o.textContent || '').trim())
        e.value = hit.value
        e.dispatchEvent(new Event('input', { bubbles: true }))
        e.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }, String(option).trim().toLowerCase())
      if (picked === null) throw new Error(`"${label}" is not a list of options to choose from.`)
      if (picked !== true) {
        throw new Error(`"${label}" offers no option named "${option}".\nWhat it offers: ${picked.join(', ')}`)
      }
    } finally {
      await el.dispose()
    }
  }

  // hold — A THUMB THAT STAYS DOWN. A second verb on a control that already has
  // one: the dock's Back key goes back when pressed and offers the screens behind
  // you when held.
  //
  // A REAL TOUCH, not a mouse press held open, and the app can tell the difference
  // on purpose — every long press in this app guards on `pointerType === "touch"`,
  // because a mouse has hover to say the same things with. A journey holding with
  // the mouse would find nothing happens and report a dead gesture. So this goes
  // through the touchscreen, and the world has to be a touch device for it: see
  // PHONE in world.mjs.
  //
  // 700ms, where the app's threshold is 500. Long enough to clear it on a loaded
  // machine, short enough that a journey which stops asserting still finishes.
  async function hold(name, { timeout = DEFAULT_TIMEOUT, ms = 700 } = {}) {
    const el = await find('press', name, { timeout })
    try {
      await el.scrollIntoView().catch(() => {})
      await el.touchStart()
      await sleep(ms)
      await el.touchEnd()
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

  // IS THIS CONTROL THE CHOSEN ONE? A latch, a chosen swatch, a selected tab — the
  // state a control announces about itself.
  //
  // IT IS IN THE VOCABULARY BECAUSE A PERSON CAN PERCEIVE IT, which is this
  // harness's whole test for admission. `aria-pressed` and `aria-selected` are the
  // accessibility tree, and the tree is what every other verb here already works
  // from — a screen reader says "pressed" out loud, and a sighted reader sees the
  // ring the same attribute drives.
  //
  // WITHOUT IT A WHOLE CLASS OF CHANGE IS UNREACHABLE FROM THIS TIER. A control
  // whose entire effect is a colour — picking the ground the app sits on — has no
  // words to assert, so a journey could press it and check nothing. The choice was
  // between adding this verb and having no browser-tier coverage of any toggle at
  // all; a vocabulary that cannot ask "did that take effect" is too small.
  //
  // IT RETURNS null RATHER THAN false WHEN THE CONTROL SAYS NOTHING, because "this
  // is not a toggle" and "this toggle is off" are different facts, and collapsing
  // them lets a journey assert `false` against a control that never had a state to
  // report — which passes while proving nothing.
  async function chosen(name, opts) {
    const el = await find('press', name, opts)
    try {
      return await el.evaluate((e) => {
        const v = e.getAttribute('aria-pressed') ?? e.getAttribute('aria-selected')
        return v === null ? null : v === 'true'
      })
    } finally {
      await el.dispose()
    }
  }

  // sideways — HOW FAR THE WHOLE SCREEN SLIDES LEFT AND RIGHT, in pixels, and 0
  // where it does not. The one thing here that is not a word, because there is no
  // word for it: a page laid out three times wider than the phone it is on still
  // LOOKS like a phone screen in a picture, and the reader is the only one who
  // finds out — every card, the top bar and the dock slide together under their
  // thumb with nothing on screen saying why. This app's answer to a row that is
  // too wide is a measured fade and a scroller inside it, so the page itself
  // sliding is always a defect rather than a layout.
  const sideways = () => page().evaluate(() => {
    const de = document.scrollingElement
    return Math.max(0, de.scrollWidth - de.clientWidth)
  })

  // said — WHAT THE SCREEN SAYS TO SOMEBODY WHO CANNOT SEE IT.
  //
  // `see` reads `innerText`, which is the right instrument for nearly everything
  // and is blind to exactly one thing: a glyph. This app now prints counts as a
  // figure and a drawing — "27 ⏭ / 28 ❝" — where the row is too tight for the
  // noun, and the noun lives in the control's accessible NAME instead. A journey
  // with no way to read that could only assert the digits, which is the half that
  // was never in doubt.
  //
  // IT IS NOT A LICENCE TO READ MARKUP. What comes back is Chrome's own name
  // computation, the same thing `press` matches on and the same thing a screen
  // reader announces — a fact about the rendered screen, not about the source. A
  // journey may still not ask for a class, a component or a field.
  //
  // REFUSES AN AMBIGUOUS MATCH, for `press`'s reason: two things called the same
  // thing means the assertion is about whichever one the markup happened to put
  // first.
  async function said(want, { timeout = DEFAULT_TIMEOUT } = {}) {
    // A STRING IS MATCHED WHOLE, unlike `see`. `see` reads a screen's text and a
    // substring of it is a fair question; a NAME is one string the browser
    // computed for one thing, and half of it is not that thing's name. Case still
    // folds, for `press`'s reason.
    const test = want instanceof RegExp ? (n) => want.test(n) : (n) => fold(n) === fold(want)
    const deadline = Date.now() + timeout
    for (;;) {
      const tree = await page().accessibility.snapshot({ interestingOnly: false })
      const names = []
      const walk = (node) => {
        if (!node) return
        if (node.name) names.push(node.name.trim())
        for (const c of node.children || []) walk(c)
      }
      walk(tree)
      const hits = [...new Set(names.filter(test))]
      if (hits.length === 1) return hits[0]
      if (hits.length > 1) {
        throw new Error(
          `${hits.length} things on this screen are named like ${want}, so this journey would be ` +
          `reading whichever one the markup happened to put first.\nThey are: ${hits.map((h) => JSON.stringify(h)).join(', ')}`,
        )
      }
      if (Date.now() > deadline) {
        throw new Error(
          `nothing on this screen is named like ${want}.\n\nWhat is named:\n\n` +
          [...new Set(names)].slice(0, 60).map((n) => `  ${JSON.stringify(n)}`).join('\n'),
        )
      }
      await sleep(150)
    }
  }

  return { onScreen, see, gone, press, pressAll, pressKey, hold, type, choose, upload, valueOf, chosen, sideways, said }
}
