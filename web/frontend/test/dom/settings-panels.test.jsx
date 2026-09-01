// Type and Language marks: a button apiece with a pop-up behind it (1.15.2) —
// Type on the Appearance card, Language marks on the Metadata sources block.
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

let PUTS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    if (path === '/fonts') return { ok: true, data: { fonts: [] } }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { MetadataSources } = await import('../../src/MetadataSources.jsx')
const { applyLanguageMarks } = await import('../../src/languages.jsx')

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

const page = async () => {
  render(<Settings user={USER} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await screen.findByText('Appearance')
}
// The other door's screen. The block is rendered on its own rather than through
// the metadata page, for the same reason the key-row cases are: these are about
// what is behind the button, and a whole console around it is scaffolding.
const sources = async () => {
  render(<MetadataSources user={USER} onPreferences={() => {}} />)
  await screen.findByText('Metadata sources')
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

  it('offers both as buttons that name themselves', async () => {
    await page()
    expect(screen.getByRole('button', { name: 'Type' })).toBeTruthy()
    cleanup()
    await sources()
    expect(screen.getByRole('button', { name: 'Language marks' })).toBeTruthy()
  })

  it('keeps both sets of words at every width', async () => {
    // has-btn-icon is what data-labels="off" squares to 44px. These two are the
    // only way into two whole panels — a bare letterform on a phone is not an
    // unlabelled button, it is a screen nobody finds — so they opt out the way
    // primary submits and destructive confirms do.
    for (const [open, name] of [[page, 'Type'], [sources, 'Language marks']]) {
      cleanup()
      await open()
      const b = screen.getByRole('button', { name })
      expect(b.className, name).not.toContain('has-btn-icon')
      expect(b.querySelector('.btn-label-fixed')?.textContent, name).toBe(name)
      expect(b.querySelector('svg'), `${name} has no glyph`).not.toBeNull()
    }
  })

  it('opens exactly one dialog, on either screen', async () => {
    // Two stacked scrims trap the page, so what is asserted is that a door opens
    // its own panel and only that. "One at a time" used to be a claim about two
    // cards sharing a page; they are on two screens now, and the property that
    // survives is per-screen.
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog().getAttribute('aria-label')).toBe('Type')
    cleanup()
    await sources()
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog().getAttribute('aria-label')).toBe('Language marks')
  })

  it('hangs the marks door off the sources block and Type off Appearance', async () => {
    // WHERE each door is, which is the whole of this change and the one thing
    // the assertions above cannot see: they find a button on a page without
    // caring what it sits under. A mark is what a quote with nobody to credit
    // says it IS — the sources block's subject — and not how the app looks.
    const heading = (name) =>
      screen.getByRole('button', { name }).closest('.hand-card')?.querySelector('h2')?.textContent || ''
    await page()
    expect(heading('Type')).toBe('Appearance')
    // AND IT IS NOT ON SETTINGS AT ALL ANY MORE, which is the half a heading
    // check cannot state: the block left that page.
    expect(screen.queryByRole('button', { name: 'Language marks' })).toBeNull()
    cleanup()
    await sources()
    expect(heading('Language marks')).toBe('Metadata sources')
  })
})

describe('the language-mark tray', () => {
  const openTray = async (language = 'Bengali') => {
    await sources()
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    // THE WHOLE ROW IS THE TRIGGER (1.16.0). It was a 22px disc beside a name
    // you could not press; the name is inside the button now, which is what this
    // query proves — getByRole matches on the accessible name, and the row's
    // name comes from the text it contains.
    fireEvent.click(within(dialog()).getByRole('button', { name: new RegExp(`^${language}`) }))
  }

  it('renders the field the crash was hiding', async () => {
    // The reported bug, exactly: "when i try to change the language glyphs in
    // Language marks section in settings, it throws: Field is not defined".
    await openTray()
    expect(within(dialog()).getByLabelText(/Add one of your own/i)).toBeTruthy()
  })

  it('opens from the row rather than from the glyph', async () => {
    await sources()
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    const row = within(dialog()).getByRole('button', { name: /^Bengali/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(row)
    expect(within(dialog()).getByRole('button', { name: /^Bengali/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('offers four letters of the language’s own script and no flags', async () => {
    await openTray()
    const tray = within(dialog()).getByRole('listbox', { name: 'Script letters for Bengali' })
    const offered = within(tray).getAllByRole('option').map((o) => o.textContent)
    expect(offered).toEqual(['অ', 'আ', 'ক', 'ব'])
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
    await openTray()
    const tray = within(dialog()).getByRole('listbox', { name: 'Script letters for Bengali' })
    fireEvent.click(within(tray).getByRole('option', { name: 'ক' }))
    await waitFor(() => {
      const blob = lastPrefs()
      expect(blob.bengali.m).toBe('ক')
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

  it('adds a language the starter list never heard of', async () => {
    await sources()
    fireEvent.click(screen.getByRole('button', { name: 'Language marks' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add a language' }))
    const input = within(dialog()).getByPlaceholderText(/Yoruba, Swahili/)
    fireEvent.change(input, { target: { value: 'Yoruba' } })
    fireEvent.blur(input)
    await waitFor(() => expect(lastPrefs().yoruba.n).toBe('Yoruba'))
  })
})

describe('the Type panel', () => {
  const openRole = async (label) => {
    await page()
    fireEvent.click(screen.getByRole('button', { name: 'Type' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: label }))
  }

  it('says nothing about monospace', async () => {
    // 1.15.2. The mono row answered a question nobody on that screen had asked,
    // every time it was opened. The reasoning survives in fonts.js, beside the
    // style table it is about.
    await openRole('Labels')
    expect(within(dialog()).queryByText(/monospace/i)).toBeNull()
  })

  it('still sets a face, through the dropdown that replaced the chips', async () => {
    // THE CONTROL CHANGED SHAPE AND THIS CASE DID NOT NOTICE. It used to click the
    // first unpressed .tp-filter-chip in the dialog, which was a typeface; the
    // typefaces are a typeable dropdown now and the first chip it found was a
    // STYLE. It passed, and it was testing something else — so it drives the real
    // control by name.
    await openRole('Labels')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Typeface for Labels/i }))
    // The panel portals to <body>, so it is NOT inside the dialog element.
    const opts = screen.getAllByRole('option')
    expect(opts.length, 'the dropdown offers no typefaces').toBeGreaterThan(1)
    fireEvent.click(opts[1])
    await waitFor(() => expect(PUTS.some(([p]) => p === '/auth/me/preferences')).toBe(true))
  })

  it('narrows the list as you type, and Enter takes what is left', async () => {
    // The reason it is typeable at all: three bundled faces per role plus every
    // font you have ever uploaded is a list you cannot read your way down.
    await openRole('Labels')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Typeface for Labels/i }))
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
      expect(put[1].fontMono).toBe('jetbrains-mono')
    })
  })

  it('says so rather than emptying when nothing matches', async () => {
    await openRole('Labels')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Typeface for Labels/i }))
    const box = screen.getByPlaceholderText(/Type a typeface name/i)
    fireEvent.change(box, { target: { value: 'zzzz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/nothing matches/i)).toBeTruthy()
  })

  it('offers Upload as its own control rather than as a fourth typeface', async () => {
    // It was a chip in the row of faces, which reads as a face. It is not a face;
    // it is a way of getting one.
    await openRole('Labels')
    const up = within(dialog()).getByText(/Upload$/i).closest('label')
    expect(up, 'no Upload control').toBeTruthy()
    expect(up.className, 'Upload is still styled as a typeface chip').not.toContain('tp-filter-chip')
    expect(up.querySelector('input[type="file"]'), 'Upload takes no file').toBeTruthy()
  })
})
