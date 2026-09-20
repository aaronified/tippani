// Type: a button with a pop-up behind it (1.15.2), on the Language and font
// section of Settings.
//
// LANGUAGE MARKS IS NO LONGER ONE OF THESE, and the cases that paired the two
// are now about Type alone. The marks table became a SECTION of the Metadata
// console: Settings points at it for what a quote's language is — "the only place
// a quote's language is defined" — and a pop-up inside another section is not an
// address another screen can send a reader to. Its own behaviour is unchanged and
// is covered by language-text-order.test.jsx, which mounts the panel directly.
//
// THEY ARE ON TWO SCREENS NOW. The sources block was a Settings card and moved to
// the Metadata screen whole, taking the marks door with it — which is exactly what
// the door's own argument always said should happen: a mark is what a quote with
// nobody to credit says it IS, and that is the subject of the block rather than of
// the page it happened to be on.
//
// Both doors are still asserted in one file, because what they have in common is
// the SHAPE — a panel too long to stand open on a page read at a glance — and a
// rule about that shape is worth one file rather than one per screen. What
// changed is that "one at a time" is no longer a claim about them: two screens
// cannot both be open.
//
// THE BUG THAT PROMPTED THE MOVE was in the panel, not the layout. Settings'
// language-mark tray rendered <Field label="Or type one"> and Settings never
// imported Field, so opening a tray to change a glyph threw a ReferenceError and
// took the screen with it. Nothing caught it: the reference is inside
// `{picking === row.key && …}`, so the module parses and the page loads, and
// language-marks.test.jsx tests languages.jsx without ever mounting the card.
//
// That is the shape being pinned here — not "the dialog opens" but "the tray
// inside the dialog renders every control it has". A test that stops at the
// dialog would pass against the broken build.
//
// icon-imports.test.js catches the same class by reading; this catches it by
// running. Both, deliberately: the reader misses what it cannot parse, and the
// runner misses what nothing clicks.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    // THE LIBRARY THE LANGUAGE TABLE IS A TABLE OF. It used to open with ten
    // starter languages regardless of what was in the library, so these cases
    // could render it against nothing; the starters are gone and the rows are
    // now the reader's own — every language their quotes are actually in. A
    // mock that answers this with nothing is an account with no quotes, and the
    // table it draws is correctly empty.
    if (path === '/search/vocabulary') return { ok: true, data: { languages: ['Bengali', 'Hindi'] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { LanguageMarksSettings, MetadataSources } = await import('../../src/MetadataSources.jsx')
const { applyLanguageMarks } = await import('../../src/languages.jsx')
const { glyphsFor } = await import('../../src/iso639.js')

const USER = { username: 'a', is_admin: false, preferences: {} }

beforeEach(() => {
  PUTS = []
  // languages.jsx holds the applied marks as MODULE state, the way theme.js
  // holds the applied theme — a card three screens deep needs the mark and has
  // no business being handed the whole user to get it. That makes it shared
  // between cases in this file, and a case that saves a mark leaves it set for
  // the next one: the custom-bar assertions below passed and failed by test
  // ORDER until this line existed.
  applyLanguageMarks({})
})

// The LAST save, not the first. Several of these fire more than one PUT — adding
// a custom mark selects it — and asserting on PUTS[0] reads the state the panel
// was in before the act under test.
const lastPrefs = () => {
  const puts = PUTS.filter(([p]) => p === '/auth/me/preferences')
  expect(puts.length, 'nothing was saved').toBeGreaterThan(0)
  return JSON.parse(puts.at(-1)[1].languageMarks || '{}')
}

// THE DEFAULT IS THE SECTION THIS FILE IS ABOUT. Almost every case here opens
// the Type panel, and Type lives under Language and font now that Settings is
// sectioned — so the default section is that one, and a case wanting another
// names it.
const page = async (section = 'Language and font') => {
  render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection(section)
}
// The other door's screen. The block is rendered on its own rather than through
// the metadata page, for the same reason the key-row cases are: these are about
// what is behind the button, and a whole console around it is scaffolding.
const sources = async () => {
  render(<MetadataSources user={USER} onPreferences={() => {}} />)
  // A ROW EVERY READER SEES — see settings-key-field.jsx. The title that used to
  // stand here said "Metadata sources" under a tab that had just said "Sources".
  await screen.findByText('Multi-author credits')
}
const dialog = () => screen.getByRole('dialog')

describe('the two panels are doors, not cards', () => {
  it('does not stand either panel open on the page it is a door on', async () => {
    // The whole point of the change. Both were cards in the column grid: eleven
    // type roles with a specimen apiece, and a row per language with a tray of
    // flags behind each, permanently unrolled beside cards you read at a glance.
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(/Or type one/)).toBeNull()
    cleanup()
    await sources()
    expect(screen.queryByRole('dialog')).toBeNull()
    // The first language row — what was on the page before and must not be now.
    expect(screen.queryByText('Bengali')).toBeNull()
    expect(screen.queryByText(/Or type one/)).toBeNull()
  })

  it('offers the faces themselves, not a door to them', async () => {
    // THE DOOR IS GONE AND THAT IS THE CHANGE. "Type" was the only way to a
    // typeface, so choosing one cost four presses on the screen whose subject is
    // typefaces. The pack draws a picker per row and no button at all.
    await page()
    expect(screen.queryByRole('button', { name: 'Type' }), 'the Type door is back').toBeNull()
    expect(screen.getByRole('button', { name: /Typeface for Labels/i })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps a door\'s words at every width where a door is left', async () => {
    // has-btn-icon is what data-labels="off" squares to 44px. A door into a whole
    // screen opts out of that the way primary submits and destructive confirms do:
    // a bare letterform on a phone is not an unlabelled button, it is a screen
    // nobody finds. ONE is left on this section, and it is no longer the one into
    // Quote fonts — that panel is a card now — but the one out of it, to the
    // language table on Metadata where a language is actually added.
    await page()
    for (const name of ['Open the language table']) {
      const b = screen.getByRole('button', { name })
      expect(b.className, name).not.toContain('has-btn-icon')
      expect(b.querySelector('.btn-label-fixed')?.textContent, name).toBe(name)
      expect(b.querySelector('svg'), `${name} has no glyph`).not.toBeNull()
    }
  })

  it('opens no dialog at all, because both halves are on the screen', async () => {
    // WHAT THIS USED TO ASSERT: that the Quote fonts door opened exactly one
    // panel and not two stacked scrims. There is no door — the owner's ask folded
    // the panel into the section as a card — so the stronger claim is available:
    // nothing on this section opens a dialog to answer a question about type.
    await page()
    expect(screen.queryByRole('button', { name: 'Set fonts by language' }),
      'the door into the Quote fonts panel is back').toBeNull()
    expect(screen.queryAllByRole('dialog')).toHaveLength(0)
    // And the card itself is here, which is what proves the rows did not vanish
    // with the door.
    expect(screen.getByRole('region', { name: /Quote fonts/i })).toBeTruthy()
  })

  it('puts the faces under Language and font, and the marks table nowhere on Settings', async () => {
    // WHERE they are, which is the one thing the assertions above cannot see:
    // they find controls on a page without caring what those sit under.
    await page()
    const chosenTab = screen.getAllByRole('tab').find((el) => el.getAttribute('aria-selected') === 'true')
    expect(chosenTab?.textContent).toContain('Language and font')
    expect(screen.getByRole('button', { name: /Typeface for Labels/i })).toBeTruthy()
    // AND THE MARKS TABLE IS NOT ON SETTINGS AT ALL: the block left that page, and
    // has now left the sources block too for a section of its own.
    expect(screen.queryByRole('button', { name: 'Language marks' })).toBeNull()
    cleanup()
    await sources()
    expect(screen.queryByRole('button', { name: 'Language marks' })).toBeNull()
    // And the keys card is still here, which is what proves the screen rendered
    // rather than the query having nothing to find.
    expect(screen.getByText('Multi-author credits')).toBeTruthy()
  })
})

describe('the language-mark tray', () => {
  // THE PANEL IS THE SCOPE NOW, NOT A DIALOG. Every query below reads
  // `within(dialog())` because the table used to be behind a pop-up; it is a
  // section of the Metadata console now, so what those queries should be scoped
  // to is simply what was rendered. Shadowing the name keeps twenty assertions
  // saying exactly what they said before — the table did not change, its address
  // did — and the Type panel above is still a real dialog, scoped by the outer
  // definition.
  const dialog = () => document.body
  const openTray = async (language = 'Bengali') => {
    // THE PANEL DIRECTLY, not a door to it: the marks table is a section of the
    // Metadata console now rather than a pop-up on the sources block, so there is
    // no dialog to open and no button to open it with. Everything below this line
    // is unchanged, which is the point — the table did not move, only its address.
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    // The rows are the reader's own languages and arrive from /search/vocabulary,
    // so the first one has to land before anything can be pressed.
    await screen.findByRole('button', { name: new RegExp(`^${language}`) })
    // THE WHOLE ROW IS THE TRIGGER (1.16.0). It was a 22px disc beside a name
    // you could not press; the name is inside the button now, which is what this
    // query proves — getByRole matches on the accessible name, and the row's
    // name comes from the text it contains.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${language}`) }))
  }

  it('renders the field the crash was hiding', async () => {
    // The reported bug, exactly: "when i try to change the language glyphs in
    // Language marks section in settings, it throws: Field is not defined".
    await openTray()
    expect(within(dialog()).getByLabelText(/Add one of your own/i)).toBeTruthy()
  })

  it('opens from the row rather than from the glyph', async () => {
    // The panel directly: the marks table is a section of the Metadata console
    // now, so there is no door on the sources block to press.
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    const row = within(dialog()).getByRole('button', { name: /^Bengali/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(row)
    expect(within(dialog()).getByRole('button', { name: /^Bengali/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('offers the letters of the language’s own name and no flags', async () => {
    // FOUR HAND-TYPED LETTERS BECAME THE LETTERS OF বাংলা. The tray used to be a
    // row somebody chose for each of ten languages; it is derived from the
    // language's own autonym now, which for Bengali is two distinct letters and
    // not four. Asserted against `glyphsFor` rather than a literal so this stays a
    // test of what the TRAY RENDERS — the derivation has its own cases in
    // iso639.test.js, and spelling the answer out here would be one rule in two
    // places, the second of which nobody updates.
    await openTray()
    const tray = within(dialog()).getByRole('listbox', { name: 'Script letters for Bengali' })
    const offered = within(tray).getAllByRole('option').map((o) => o.textContent)
    expect(offered).toEqual(glyphsFor('bn'))
    expect(offered.length).toBeGreaterThan(0)
    expect(offered.filter((g) => /\p{Regional_Indicator}/u.test(g))).toEqual([])
  })

  it('offers no flag tray anywhere in the panel', async () => {
    // The whole point of 1.16.0. Asserted over the rendered dialog rather than
    // over one language's row, because a flag grid left behind on any other row
    // is the same screen it used to be.
    await openTray()
    expect(dialog().textContent).not.toMatch(/\p{Regional_Indicator}/u)
  })

  it('adds a typed mark to that language’s own bar and selects it', async () => {
    await openTray()
    const input = within(dialog()).getByPlaceholderText(/any letter, symbol or emoji/)
    fireEvent.change(input, { target: { value: '✦' } })
    fireEvent.blur(input)
    await waitFor(() => {
      const blob = lastPrefs()
      expect(blob.bengali.c).toEqual(['✦'])
      expect(blob.bengali.m).toBe('✦')
    })
  })

  it('sets a script letter without adding it to the custom bar', async () => {
    // The SECOND letter, so this is a choice and not the default the row already
    // wears — pressing the one that is already selected would save nothing and
    // the case would pass on a tray that does not work.
    await openTray()
    const letter = glyphsFor('bn')[1]
    const tray = within(dialog()).getByRole('listbox', { name: 'Script letters for Bengali' })
    fireEvent.click(within(tray).getByRole('option', { name: letter }))
    await waitFor(() => {
      const blob = lastPrefs()
      expect(blob.bengali.m).toBe(letter)
      expect(blob.bengali.c).toBeUndefined()
    })
  })

  it('renames a language without touching what quotes are stored as', async () => {
    await openTray()
    const name = within(dialog()).getByLabelText(/Shown as/)
    fireEvent.change(name, { target: { value: 'বাংলা' } })
    fireEvent.blur(name)
    await waitFor(() => {
      // The KEY is still the canonical language. A rename that moved the key
      // would orphan every quote stored under the old one.
      expect(lastPrefs().bengali.n).toBe('বাংলা')
    })
  })

  // ── REMOVING ONE, and the refusal that is the whole point of the control.
  //
  // WHAT REMOVAL DROPS IS A MARK AND A RENAME, never a quote — a language lives in a
  // free-text column on every annotation, dialogue and utterance, and this panel does
  // not touch it. So a row the library is still holding up would come back on the
  // next open, and a control that undoes itself is a control that lies. It is drawn
  // and disabled rather than hidden, so the reader is told WHY one row differs from
  // another instead of comparing two rows and guessing.
  //
  // The mock's library holds Bengali and Hindi (see /search/vocabulary above), so
  // those two are refused and a marked-only language is not.
  it('refuses to remove a language the library is still holding up', async () => {
    // The panel directly: the marks table is a section of the Metadata console
    // now, so there is no door on the sources block to press.
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    const x = await within(dialog()).findByRole('button', { name: 'Remove Bengali' })
    expect(x.disabled, 'Bengali is in the library and its remove was live').toBe(true)
    fireEvent.click(x)
    // Nothing saved: a disabled control that still fires is the bug this asserts.
    expect(PUTS.filter(([p]) => p === '/auth/me/preferences')).toHaveLength(0)
  })

  it('removes one the library is not, and drops its whole entry', async () => {
    applyLanguageMarks({ languageMarks: '{"sylheti":{"m":"✦"},"bengali":{"m":"ক"}}' })
    // The panel directly: the marks table is a section of the Metadata console
    // now, so there is no door on the sources block to press.
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    const x = await within(dialog()).findByRole('button', { name: 'Remove sylheti' })
    expect(x.disabled, 'a language no quote is stored in should be removable').toBe(false)
    fireEvent.click(x)
    await waitFor(() => {
      const blob = lastPrefs()
      // THE WHOLE ENTRY, not an emptied one — and Bengali is untouched beside it,
      // which is what says this removed a row rather than the map.
      expect(blob.sylheti).toBeUndefined()
      expect(blob.bengali.m).toBe('ক')
    })
  })

  it('adds a language the module never heard of', async () => {
    // The panel directly: the marks table is a section of the Metadata console
    // now, so there is no door on the sources block to press.
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add a language' }))
    const input = within(dialog()).getByPlaceholderText(/Yoruba, Swahili/)
    // Sylheti and not Yoruba, which iso639.js now knows — the case is about a
    // language the app has NEVER heard of keeping its row, and a known one would
    // be testing a different branch under the old name.
    fireEvent.change(input, { target: { value: 'Sylheti' } })
    fireEvent.blur(input)
    await waitFor(() => expect(lastPrefs().sylheti.n).toBe('Sylheti'))
  })
})

describe('the faces, on the section that shows them', () => {
  // THE PANEL IS THE SECTION NOW. Every case below used to open a dialog and then
  // expand a role inside it; the rows are on the page, so what they drive is the
  // row itself. What each one asserts about the app is unchanged — the shape of
  // the gesture is what got shorter.
  const rowFor = (label) => screen.getByText(label).closest('.pref-row')
  // The modifiers are one press off the row they modify: five chips across six
  // rows is thirty chips on a screen whose job is showing four typefaces.
  const openStyles = (label) => {
    fireEvent.click(within(rowFor(label)).getByRole('button', { name: new RegExp(`Style modifiers for ${label}`, 'i') }))
    return rowFor(label)
  }

  it('says nothing about monospace', async () => {
    // 1.15.2. The mono row answered a question nobody on that screen had asked,
    // every time it was opened. The reasoning survives in fonts.js, beside the
    // style table it is about.
    await page()
    expect(within(openStyles('Labels')).queryByText(/monospace/i)).toBeNull()
  })

  it('sets a face through the dropdown that replaced the chips', async () => {
    await page()
    fireEvent.click(within(rowFor('Labels')).getByRole('button', { name: /Typeface for Labels/i }))
    // The list portals to <body>, so it is NOT inside the row.
    const opts = screen.getAllByRole('option')
    expect(opts.length, 'the dropdown offers no typefaces').toBeGreaterThan(1)
    fireEvent.click(opts[1])
    await waitFor(() => expect(PUTS.some(([p]) => p === '/auth/me/preferences')).toBe(true))
  })

  it('narrows the list as you type, and Enter takes what is left', async () => {
    // The reason it is typeable at all: three bundled faces per role plus every
    // font you have ever uploaded is a list you cannot read your way down.
    await page()
    fireEvent.click(within(rowFor('Labels')).getByRole('button', { name: /Typeface for Labels/i }))
    const all = screen.getAllByRole('option').length
    const box = screen.getByPlaceholderText(/Type a typeface name/i)
    fireEvent.change(box, { target: { value: 'jet' } }) // JetBrains Mono
    const narrowed = screen.getAllByRole('option')
    expect(narrowed.length).toBeLessThan(all)
    expect(narrowed.length).toBe(1)
    // Matched on the words on screen, not on the value token behind them.
    fireEvent.keyDown(document, { key: 'Enter' })
    await waitFor(() => {
      const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
      expect(JSON.parse(put[1].fontsByLocale).en.mono).toBe('jetbrains-mono')
    })
  })

  it('says so rather than emptying when nothing matches', async () => {
    await page()
    fireEvent.click(within(rowFor('Labels')).getByRole('button', { name: /Typeface for Labels/i }))
    const box = screen.getByPlaceholderText(/Type a typeface name/i)
    fireEvent.change(box, { target: { value: 'zzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/nothing matches/i)).toBeTruthy()
  })

  // WHOSE INTERFACE, and it is the half of the owner's font spec that is about
  // the app's own words: "any language that the user adds in via translation
  // files should have a full ui font picker (revamp the font picker in settings
  // for that)." Every language still has one — AND THE WAY TO IT IS BEING IN THAT
  // LANGUAGE, not a chooser above the rows. The owner's ask removed the chooser:
  // "the interface faces do not need a 'these faces are for' because the language
  // is selected above anyway." What the rows write is therefore the overlay of
  // the language on screen, which is also the only scope whose specimens can be
  // believed.
  describe('the language the rows are for', () => {
    it('is said as a fact and not asked as a question', async () => {
      await page()
      expect(screen.queryByRole('button', { name: /These faces are for/i }),
        'the scope chooser is back').toBeNull()
      expect(screen.getByText(/The faces English is set in/i)).toBeTruthy()
    })

    // THE CASE THAT WOULD HAVE CAUGHT THE ONE THING A COMMIT SHIPPED BROKEN.
    // `save` changed from (field, value) to (changes), and the style chip's call
    // site kept the old two-argument shape — so Object.entries over the STRING
    // 'monoStyle' PUT {"0":"m","1":"o",…}: a silent no-op under the shared scope,
    // and a 400 under a named one.
    it('presses a style chip and saves the modifier, not the field name', async () => {
      await page()
      fireEvent.click(within(openStyles('Labels')).getByRole('button', { name: 'Bold' }))
      await waitFor(() => {
        const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
        expect(Object.values(JSON.parse(put[1].fontsByLocale))[0].monoStyle).toBe('bold')
        // The shape that broke it: numeric keys from a spread string.
        expect(put[1]['0'], 'the field NAME was spread into the patch').toBeUndefined()
      })
    })

    // THE CASE THE SCOPE EXISTS FOR, and it survives the chooser going: a choice
    // made while reading one language must not overwrite the answer every other
    // language reads.
    it('writes that language\'s overlay and leaves the shared field alone', async () => {
      await page()
      fireEvent.click(within(rowFor('Labels')).getByRole('button', { name: /Typeface for Labels/i }))
      fireEvent.change(screen.getByPlaceholderText(/Type a typeface name/i), { target: { value: 'jet' } })
      fireEvent.keyDown(document, { key: 'Enter' })
      await waitFor(() => {
        const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
        expect(put[1].fontMono, 'a per-language choice overwrote the shared answer').toBeUndefined()
        expect(JSON.parse(put[1].fontsByLocale).en.mono).toBe('jetbrains-mono')
      })
    })
  })

  it('offers Upload once, as its own control rather than as a fourth typeface', async () => {
    // It was a chip in the row of faces, which reads as a face — and then it was
    // six buttons, one per role, because uploading assigned. It is not a face and
    // it is not a role's business: it is a way of getting one, and there is one
    // of it.
    await page()
    const ups = screen.getAllByText(/Upload a font/i)
    expect(ups, 'upload is drawn more than once').toHaveLength(1)
    const up = ups[0].closest('label')
    expect(up, 'no Upload control').toBeTruthy()
    expect(up.className, 'Upload is still styled as a typeface chip').not.toContain('tp-filter-chip')
    expect(up.querySelector('input[type="file"]'), 'Upload takes no file').toBeTruthy()
  })
})
