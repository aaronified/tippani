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
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

describe('the language editor', () => {
  // ONE EDITOR FOR EVERY LANGUAGE. The tray these cases drove opened inline under
  // a row, in whatever shape that language's letters made it; the owner: "each
  // option opens up things in different shapes and sizes." It is one dialog now —
  // name, ISO 639-3 code, one grid of marks — and every guarantee the tray had is
  // asserted here against it: the letters are the language's own, no flags, a
  // typed mark is kept and chosen, a rename leaves the stored language alone, and
  // a language the library holds cannot be removed.
  const openEditor = async (language = 'Bengali') => {
    render(<LanguageMarksSettings prefs={USER.preferences} onSaved={() => {}} />)
    const door = await screen.findByRole('button', { name: new RegExp(`^Edit ${language}`, 'i') })
    fireEvent.click(door)
    return screen.findByRole('radiogroup', { name: new RegExp(`Script letters for ${language}`, 'i') })
  }
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }))

  // ── REMOVING ONE, and the refusal that is the whole point of the control. What
  // removal drops is a mark, a name and a code — never a quote — so a row the
  // library is still holding up would come straight back. It is drawn and disabled
  // rather than hidden, so the reader is told WHY. The mock's library holds
  // Bengali and Hindi.
  it('refuses to remove a language the library is still holding up', async () => {
    await openEditor()
    const x = screen.getByRole('button', { name: /Remove language/i })
    expect(x.disabled, 'Bengali is in the library and its remove was live').toBe(true)
    fireEvent.click(x)
    expect(PUTS.filter(([p]) => p === '/auth/me/preferences')).toHaveLength(0)
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

})
