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
  press: 'button, a[href], summary, input[type="submit"], input[type="button"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"]',
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
  async function see(text, { timeout = DEFAULT_TIMEOUT } = {}) {
    try {
      await page().waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text)
    } catch {
      throw new Error(`waited ${timeout}ms for "${text}" and it never appeared.\n\nThe screen said:\n\n${await onScreen()}`)
    }
  }

  async function gone(text, { timeout = DEFAULT_TIMEOUT } = {}) {
    try {
      await page().waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, text)
    } catch {
      throw new Error(`waited ${timeout}ms for "${text}" to go and it is still there.\n\nThe screen said:\n\n${await onScreen()}`)
    }
  }

  // candidates — every visible thing of this kind, each paired with the name
  // Chrome computes for it. One CDP snapshot per element, which is the price of
  // asking the browser rather than guessing.
  async function candidates(kind) {
    const handles = await page().$$(CSS_FOR[kind])
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

  function pick(found, want, kind) {
    const tiers = [
      ['named exactly', found.filter((c) => c.name === want)],
      ['whose name starts with', found.filter((c) => c.name.startsWith(want))],
      ['whose name contains', found.filter((c) => c.name.includes(want))],
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

  return { onScreen, see, gone, press, pressKey, type, valueOf }
}
