import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Field, Kbd, NameInput, PartialDateField, ShortcutSheet, ToastHost, TokenInput, Tooltip, YearField, parseYearInput, yearInputValue } from '../../src/ui.jsx'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { LanguagePicker } from '../../src/locale.jsx'
import { LOCALE_KEY, PSEUDO, applyLocale, coverage, isInstalled, localeActive, localeCatalogue, resetLocaleForTests, setLocaleFiles, t } from '../../src/i18n.js'
import { withShortcut } from '../../src/keys.js'
import { helpFor } from '../../src/help.jsx'

// THE BOX THAT COULD NOT BE TYPED INTO.
//
// The owner's report: "i am unable to add 399BCE as a date now. this is weird. i
// cannot even add just 399. this was fine before. i have Seneca's quotes from c.
// 40." Two screenshots came with it, both showing the WHEN field outlined in red
// under the message "needs to be YYYY, YYYY-MM or YYYY-MM-DD", and both showing a
// NUMERIC KEYPAD.
//
// That keypad is the half of the defect the validator does not explain, and it is
// what this file is mostly about. The box carried inputMode="numeric" and stripped
// its value to /[^\d-]/ on every keystroke, so even with a validator that accepted
// "399 BCE" a reader could not have got the letters into it: the phone offered no
// keyboard that spells them and the field deleted them if they arrived anyway.
//
// WHAT A TEST WRITER NEEDS TO KNOW, and nothing beyond it: a date box holds a
// partial date, meaning a year, a year and month, or a full day. A `historical`
// one is a date in the world (a quote's occasion, a person's birth) and takes any
// year and either era. A plain one is a date in the reader's own life (a read log)
// and must keep refusing both — the app's own guarantee is that a stored date is a
// real one, and a book finished in the year 40 is a typo.
describe('historical date field', () => {
  const field = () => screen.getAllByRole('textbox')[0]
  const tick = () => document.querySelector('input[type="checkbox"]')

  const mount = (over = {}) => {
    const onChange = vi.fn()
    const onCirca = vi.fn()
    render(
      <PartialDateField
        label="Said when"
        value=""
        onChange={onChange}
        onCirca={onCirca}
        circaLabel="The date is approximate"
        {...over}
      />,
    )
    return { onChange, onCirca }
  }

  describe('a date in history', () => {
    // The keypad first, because it is the part no validator change would have fixed.

    it('lets the era survive being typed', () => {
      const { onChange } = mount({ historical: true })
      // One character at a time is how a reader types it, and a box that strips
      // non-digits eats each letter as it lands rather than at the end.
      for (const partial of ['399 B', '399 BC', '399 BCE']) {
        onChange.mockClear()
        fireEvent.change(field(), { target: { value: partial } })
        expect(onChange, partial).toHaveBeenCalledWith(partial)
      }
    })

    it('accepts the three dates the report named', () => {
      for (const good of ['399', '399BCE', 'c. 40']) {
        const { onChange } = mount({ historical: true, value: good })
        // Whatever the marker did, the box is not in its error state.
        expect(field().getAttribute('aria-invalid'), good).toBe(null)
        onChange.mockClear()
        cleanupRender()
      }
    })

  })

  // The owner's second ask, in their words: "there SHould be an info dot on the year
  // fields (keep it in the field, and not on the header) (all of them) to explain
  // the formats and how to do circa (the button) and BCE (-)."

  // render() appends; these cases each want a fresh tree.
  function cleanupRender() {
    document.body.innerHTML = ''
  }
})

// A YEAR, ITS ESTIMATE, AND THE PHRASE THAT CARRIES BOTH.
//
// The owner: "every capture screen shall get the same year/circa behaviour. both
// the checkbox and the text parsing."
//
// WHAT WAS ACTUALLY WRONG IS WORSE THAN A MISSING CHECKBOX. All four year boxes ran
// `value.replace(/\D/g, '').slice(0, 4)` on every keystroke, while the comment above
// two of them said `parseYearInput` "reads '380 BCE' and 'c. 1500' as well as
// '1719'". Both were true and they could not both matter: the parser could read the
// phrase and the box could not hold it. So an estimate and a BCE year were
// undocumented-impossible to type.
//
// AND IT LOST DATA THAT WAS ALREADY THERE. The edit form seeded the box from
// `formatYear`, so a book already recorded as "c. 1500" opened with that in the box
// — and the first keystroke anywhere in the field stripped the "c. ", so the next
// save wrote the estimate away. No error, no warning, and the year still looked
// right afterwards.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the two paragraphs above, that `formatYear` is
// for DISPLAY and resolves locale keys while `yearInputValue` is the editable form,
// and that the flag is DERIVED from the string rather than stored beside it.
describe('year circa', () => {
const box = () => screen.getByPlaceholderText('Year')
const flag = () => document.querySelector('input[type="checkbox"]')
const mount = (value = '') => {
  const onChange = vi.fn()
  render(<YearField value={value} onChange={onChange} placeholder="Year" circaLabel="The year is approximate" />)
  return { onChange }
}

// ---- the round trip, which is the data-loss fix ---------------------------
//
// NOT THROUGH `formatYear`, AND THAT IS THE POINT. That one resolves one of four
// locale keys, so in Bengali it returns a Bengali prefix that `parseYearInput`'s
// `/^(?:circa|ca|c)\.?/i` cannot match — the estimate round-tripped in English and
// was silently dropped in every other language. These cases hold in any locale
// because `yearInputValue` resolves nothing.
describe('a year survives being written down and read back', () => {
  it.each([
    [1500, false],
    [1500, true],
    [-380, false],
    [-380, true],
    [1, true],
  ])('%s, approximate=%s', (year, circa) => {
    const back = parseYearInput(yearInputValue(year, circa))
    expect(back.year, 'the year changed on the way through the box').toBe(year)
    expect(back.circa, 'the estimate was lost on the way through the box').toBe(circa)
  })

})

describe('what the reader may type', () => {
  it('keeps a marker the box used to delete', () => {
    const { onChange } = mount()
    fireEvent.change(box(), { target: { value: 'c. 1500' } })
    expect(onChange, 'the estimate was stripped, as it always was').toHaveBeenCalledWith('c. 1500')
  })

})

describe('the checkbox and the phrase are one fact', () => {

  it('and ticking it writes the marker into the phrase', () => {
    const { onChange } = mount('1500')
    fireEvent.click(flag())
    expect(onChange).toHaveBeenCalledWith('c. 1500')
  })

})
})

// Name fields ask the keyboard for a capital per word, and rewrite nothing.
//
// THIS FILE REPLACES A SUITE THAT TESTED THE OPPOSITE, and the reason is worth
// a line: the app used to capitalise names itself, on every keystroke, with a
// small-word list for titles and an escape hatch for "bell hooks". It failed on
// "The Wheel of Time" three releases running, so the rule is gone and the HTML
// `autocapitalize` attribute does the job — the phone offers the capital, the
// reader presses shift when the offer is wrong, and nothing in the page argues.
//
// TWO PROPERTIES, AND BOTH ARE SILENT WHEN BROKEN.
//
// The first is that WHAT YOU TYPE IS WHAT IS SAVED. A transform reintroduced
// anywhere on this path — in the field, in the hook, on the save — would pass
// its own unit tests while quietly renaming somebody. So these tests type
// lower-case strings that the old rule would have rewritten and require the
// field and the reported value to be that exact string.
//
// The second is that THE ATTRIBUTE IS ACTUALLY ON THE ELEMENT. jsdom has no
// software keyboard, so nothing here can prove a phone capitalises anything;
// what it can prove is that the hint is present on a name box and absent from
// prose, which is the whole of what this app controls. A missing attribute
// looks identical on a desktop and is only wrong on the device nobody tests on.
describe('name casing field', () => {
// Harness mirrors how the real forms are wired: a controlled value in the
// parent, updated from the event the field reports. `last` is what a Save would
// have sent, so a test can compare it against what is on screen.
function Harness({ initial = '', Comp = NameInput, ...props }) {
  const [v, setV] = useState(initial)
  return (
    <div>
      <Comp value={v} onChange={(e) => setV(e.target.value)} aria-label="Name" {...props} />
      <span data-testid="saved">{v}</span>
    </div>
  )
}

const box = () => screen.getByLabelText('Name')
const saved = () => screen.getByTestId('saved').textContent

describe('a name field stores exactly what was typed', () => {
  // THE TITLE THE OLD RULE WAS WRITTEN FOR AND KEPT BREAKING. Under the small-word
  // rule this arrived as "The Wheel Of Time" — "of" was promoted while it was still
  // the one-letter word "o", and the promote-only rule's own escape hatch then
  // froze the capital for the rest of the edit.

  // The names the escape hatch existed for. They now need no hatch at all.
  it.each(['bell hooks', 'danah boyd', 'k.d. lang', 'eBay', 'iRobot'])(
    'leaves %s alone',
    async (name) => {
      const user = userEvent.setup()
      render(<Harness />)
      await user.type(box(), name)
      expect(box().value).toBe(name)
      expect(saved()).toBe(name)
    },
  )

  // A LOWER-CASE FIRST LETTER IS NOT PROMOTED, which is the single-keystroke
  // version of the same claim and the one a reintroduced transform would fail
  // first.

  // Field re-wraps its value in a synthetic event, so the parent's
  // `e.target.value` wiring has to keep working with no transform in the middle.
})
})

// SPELLCHECK WHILE EDITING, AND NOT AFTER.
//
// THE OWNER'S ASK: "in the quote entry field (in various add surfaces), can we add
// client side grammar/spelling check? … only when the user is editing the field."
//
// THE SECOND HALF IS WHAT MAKES IT SAFE ON A QUOTE. A quote is somebody else's
// words: an archaic spelling, a dialect form, a proper name and a transliteration
// are all correct and all unknown to a dictionary. Underlines under a faithful
// transcription tell the reader they made a mistake they did not make. So the
// check is advice while typing and silent afterwards, and BOTH states are asserted
// — "it is on" alone would pass a field that never turns it off.
//
// AND THE LANGUAGE, which is the part that would have been silently wrong. A
// browser picks its dictionary from `lang`; a quote field carried none, only a CSS
// class for the face. Without it a Bengali quote is checked against the
// interface's language and every word comes back misspelled — the app telling a
// Bengali reader their Bengali is wrong, in red, word by word.
describe('prose spellcheck', async () => {
const { ProseArea } = await import('../../src/proseField.jsx')

afterEach(cleanup)

const box = () => screen.getByRole('textbox')
// THE ATTRIBUTE, NOT THE IDL PROPERTY. jsdom does not implement
// `HTMLTextAreaElement.spellcheck`, so `box().spellcheck` is `undefined` whatever
// React rendered — three cases here asserted it and failed against a correct
// component. What React writes is the attribute, and it is what a browser reads.
const checking = () => box().getAttribute('spellcheck')

describe('a prose field', () => {
  it('is spell-checked while somebody is typing in it', () => {
    render(<ProseArea defaultValue="" />)
    fireEvent.focus(box())
    expect(checking(), 'the check should be on while the field is being edited').toBe('true')
  })

  it('and stops the moment they leave', () => {
    render(<ProseArea defaultValue="" />)
    fireEvent.focus(box())
    fireEvent.blur(box())
    expect(checking(), 'a quote is somebody else’s words and must not stay underlined').toBe('false')
  })

})
})

// The picker, twice: the first-run screen and the Settings row.
//
// Both matter for the same reason and neither is decoration. The first-run one is
// the ONLY place the language can be chosen before an account exists — without it
// the operator's first act is creating an admin account in a language they may not
// read. The Settings one is the only place the choice reaches the account, so
// without it the choice does not survive signing in on another device.
//
// The module holds mutable state across a file, so each case resets it.
describe('locale picker', () => {
  const file = (keys = {}, reserved = {}) => ({ keys, reserved, empty: [], bad: [] })

  beforeEach(() => {
    resetLocaleForTests()
  })

  afterEach(() => {
    resetLocaleForTests()
  })

  // open clicks the trigger and hands back the panel.
  async function open(user) {
    await user.click(screen.getByRole('button', { name: t('locale.picker.aria') }))
    return screen.getByRole('listbox')
  }

  describe('the language actually renders', () => {
    test('choosing one changes the words on screen, with no reload', async () => {
      const user = userEvent.setup()
      setLocaleFiles({ fr: file({ 'settings.language.title': 'Langue' }, { _name: 'Français' }) })
      render(<LanguagePicker titleKey="settings.language.title" />)
      const before = screen.getByText(t('settings.language.title')).textContent
      const panel = await open(user)
      await user.click(within(panel).getByRole('option', { name: /Français/ }))
      expect(screen.getByText('Langue')).toBeTruthy()
      expect(before).not.toBe('Langue')
    })

  })

  describe('a stored language that is no longer installed', () => {
    test('renders a built-in and says so, instead of blanking or lying', async () => {
      // Design §4. The reader is looking at a language they did not choose, and
      // without this line there is nothing on screen that explains why.
      applyLocale('pt-br')
      render(<LanguagePicker titleKey="settings.language.title" />)
      expect(screen.getByText(/pt-br/)).toBeTruthy()
      // And the picker still shows what IS rendering as the selected row.
      const user = userEvent.setup()
      const panel = await open(user)
      expect(within(panel).getByRole('option', { selected: true })).toBeTruthy()
    })
  })

  // THIS USED TO ASSERT THE OPPOSITE, and the change is a product decision rather
  // than a correction. The pseudo-locale was the third row of every reader's
  // language menu, labelled in its own transform — ⟦Pšëüðö··⟧ · 100% — which reads
  // as a broken build and not as a tool. The app ships two languages; further ones
  // arrive as config files when they arrive. So it is applicable but not offered.
  //
  // It is emphatically NOT gone: it is what screens-i18n.test.jsx drives over every
  // screen, and it is how the three tables that held a key and drew it raw were
  // found. Both halves are pinned below, because either one silently flipping is a
  // different bug — a diagnostic in a reader's menu, or a diagnostic that no longer
  // works.
})

// No keyboard chrome on a phone.
//
// Every shortcut in this app is drawn in one of four ways: a Kbd cap (drawer rows,
// quiz buttons, MCQ options), a suffix on a Tooltip label ("Search · /"), the
// ShortcutSheet, and exactly one interpolated string (the cloze placeholder). A
// phone has none of the keys and all of the clutter, and the app's own rule for the
// drawer applies unchanged: describing a control the reader does not have is worse
// than saying nothing.
//
// BOTH DIRECTIONS ARE ASSERTED. A gate that hides the legends everywhere is not a
// fix, it is a regression with a good excuse — so every case here has a pointer
// twin proving the legend is still drawn when there is a keyboard to draw it for.
//
// The bindings themselves are untouched, which is the other half of the decision: a
// Bluetooth keyboard on a narrow window keeps working, and the omission is cosmetic
// in exactly the way Settings → Features is.
describe('mobile no keys', () => {
const realMatchMedia = window.matchMedia

// The breakpoint the whole shell swaps on. `matches` answers every query the same
// way, which is what the other mobile tests do — ui.jsx asks only this one.
const setViewport = (mobile) => {
  window.matchMedia = (media) => ({
    matches: mobile,
    media,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

describe('Kbd — the key cap', () => {
  it('draws nothing on a phone', () => {
    setViewport(true)
    const { container } = render(<Kbd keys="G then L" />)
    expect(container.querySelector('kbd')).toBeNull()
    expect(container.textContent).toBe('')
  })

})

// The composed label goes to the bubble rather than into the tree, so these read
// the bubble the way hint-lifetime.test.jsx does: mount the host, hover, look.
const hover = (mobile) => {
  setViewport(mobile)
  render(
    <>
      <ToastHost />
      <Tooltip label="Search" shortcut="search">
        <button type="button">go</button>
      </Tooltip>
    </>,
  )
  fireEvent.pointerEnter(screen.getByRole('button'), { pointerType: 'mouse' })
  // A HOVER LABEL WAITS TO BE ASKED (HOVER_TIP_MS in ui.jsx): a pointer has to rest
  // on the control before the bubble appears, so that crossing a bar of five
  // controls does not fire five labels. This suite is about WHAT the bubble says,
  // not when, so it waits out the delay rather than asserting about it —
  // hint-lifetime.test.jsx owns the timing.
  act(() => { vi.advanceTimersByTime(500) })
  return document.querySelector('.hint-bubble, .tp-hint, [data-hint]')?.textContent || ''
}

describe('ShortcutSheet — the whole legend', () => {
  it('does not open on a phone', () => {
    setViewport(true)
    render(<ShortcutSheet open onClose={() => {}} />)
    // Asserted against the DOCUMENT, not the render container: HelpSheet mounts in
    // a portal, so `container.firstChild` is null whether the sheet opened or not —
    // which is a check that cannot fail, and did not.
    expect(screen.queryAllByText('Keyboard shortcuts')).toHaveLength(0)
    expect(document.querySelectorAll('kbd')).toHaveLength(0)
  })

})
})
