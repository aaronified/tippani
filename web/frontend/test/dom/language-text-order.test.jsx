// HOW MUCH OF THE ORIGINAL, SET PER LANGUAGE AND FOR ALL OF THEM.
//
// The owner's UI, in their words: "a table, where i add languages as rows, and I
// can slide across the 4 options beside it. a slider will be there above the
// column as well, as a master trigger. when it is controlled, it will push all
// knobs to align with it. when other knobs are adjusted (custom), it will lose
// contrast, which will indicate custom state."
//
// AND THE SLIDER IS GONE, on the same person's later reading: "What does the
// slider mean? Make the slider an obvious 4 point chooser. Sliders are for when
// we have a gradient, not when we have 4-5 distinct options!" The spec above is
// kept verbatim because the TABLE it describes is unchanged — a row per language,
// a master above the column, the master pulling every row into line and losing
// contrast when one has been set on its own. Only the widget in each cell moved.
//
// THREE BEHAVIOURS, AND ALL THREE ARE INVISIBLE IN A SCREENSHOT. A chooser that
// saves nothing, a master that does not carry the rows with it, and an indicator
// that never lights all look exactly like a working table until you reload.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let PUTS
let PREFS
// The languages the library holds. A case that needs a library stored under its
// own name — `বাংলা` rather than `Bengali` — sets this before opening.
let VOCAB

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    if (method === 'PUT') { PUTS.push([path, body]); return { ok: true, data: {} } }
    if (path === '/metadata/status') return { ok: true, data: { tmdb: { source: 'builtin' }, books_lookup: { ok: true } } }
    if (path === '/admin/metadata-keys') return { ok: true, data: {} }
    // THE ROWS ARE THE LIBRARY'S LANGUAGES NOW, not ten the app picked. The table
    // used to open with the same ten for every account; with STARTER_LANGUAGES
    // gone it opens with what the reader's quotes are in, which is what this
    // answer supplies. Three, because the master-carries-the-rows assertions want
    // more than one row to carry.
    if (path === '/search/vocabulary') return { ok: true, data: { languages: VOCAB } }
    return { ok: true, data: {} }
  }),
}))

const { LanguageMarksSettings } = await import('../../src/MetadataSources.jsx')
const { forgetSessionCaches } = await import('../../src/sessionCaches.js')

beforeEach(() => {
  PUTS = []
  PREFS = {}
  VOCAB = ['Bengali', 'Hindi', 'English']
  // THE VOCABULARY IS A SESSION CACHE, held at module scope for the whole file —
  // which is why this file's own header says only the FIRST case races for it.
  // One case needs a library stored under its own name (`বাংলা`), so every case
  // now starts from an empty cache and gets the VOCAB it asked for. `open()`
  // awaits the table, so nothing races.
  forgetSessionCaches()
})

// THE TABLE IS A SECTION NOW, NOT A DOOR. It was a FormModal behind a button on
// the sources card; Settings points at it for what a quote's language is, and a
// pop-up inside another section is not an address. So the panel mounts directly
// here — which is what this file was always about, the whole console around it
// having been scaffolding.
const open = async () => {
  render(<LanguageMarksSettings prefs={PREFS} onSaved={() => {}} />)
  return screen.findByRole('radiogroup', { name: /^all languages$/i })
}

// THE FOUR ARE ICONS ON A ROW NOW, and words only on the default above them — the
// owner: "The 4 repeated text buttons can be replaced with icons. The top general
// one can have both icon and legend, all others icon only." Every guarantee below
// is unchanged; what changed is how a reader names the choice. On a row it is the
// name the icon announces, "Bengali: translation only", which is the language and
// the word together — the icon alone would be a picture to a screen reader.
const rowFor = (name) => screen.findByRole('radiogroup', { name: new RegExp(`^${name}$`, 'i') })
const master = () => screen.getByRole('radiogroup', { name: /^all languages$/i })
const written = () => PUTS.filter(([p]) => p === '/auth/me/preferences').map(([, b]) => JSON.parse(b.textOrder))

const pick = (group, word) =>
  fireEvent.click(within(group).getByRole('radio', { name: new RegExp(`${word}$`, 'i') }))
// Which of the four a group is currently showing, by the word it announces.
const chosen = (group) => {
  const on = within(group).getAllByRole('radio').find((b) => b.getAttribute('aria-checked') === 'true')
  return (on?.getAttribute('aria-label') || on?.textContent || '').replace(/^.*: /, '')
}

describe('the per-language table', () => {
  it('has a chooser for every language and one above them all', async () => {
    await open()
    expect(master()).toBeTruthy()
    expect(await rowFor('Bengali')).toBeTruthy()
    // FOUR, and all four reachable. A chooser missing one silently refuses a state
    // the app can store.
    expect(within(master()).getAllByRole('radio')).toHaveLength(4)
    expect(within(await rowFor('Bengali')).getAllByRole('radio')).toHaveLength(4)
  })

  it('names every icon on a row with its language and its word', async () => {
    await open()
    const names = within(await rowFor('Bengali')).getAllByRole('radio').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual([
      'Bengali: translation only', 'Bengali: translation first', 'Bengali: quotation first', 'Bengali: quotation only',
    ])
  })

  it('saves the state a row is set to', async () => {
    await open()
    pick(await rowFor('Bengali'), 'translation only')
    await waitFor(() => expect(written().length).toBeGreaterThan(0))
    expect(written().at(-1).byLanguage.bengali).toBe('trans-only')
  })

  // THE OWNER'S "IT WILL PUSH ALL KNOBS TO ALIGN WITH IT". The master is not a
  // fallback the rows read; moving it CLEARS them.
  it('and moving the master puts every row back in line with it', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'quote-first', byLanguage: { bengali: 'trans-only' } }) }
    await open()
    pick(master(), 'quotation only')
    await waitFor(() => expect(written().length).toBeGreaterThan(0))
    const last = written().at(-1)
    expect(last.master).toBe('quote-only')
    expect(last.byLanguage, 'a row survived the master moving, so it will overrule it for good')
      .toEqual({})
  })

  it('and a row with nothing of its own shows what the master says', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'trans-only' }) }
    await open()
    expect(chosen(await rowFor('Bengali'))).toBe('translation only')
  })
})

// WHAT THIS LANGUAGE'S QUOTES ARE SET IN HAS MOVED TO SETTINGS — see
// language-faces.test.jsx.

describe('a row with a setting of its own', () => {
  it('says nothing while every row agrees', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'trans-only' }) }
    await open()
    await rowFor('Bengali')
    expect(screen.queryByText(/own setting/i)).toBeNull()
    expect(document.querySelector('[title]')).toBeNull()
  })

  it('says so in words beside its name, and the default explains why it looks dimmed', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'quote-first', byLanguage: { bengali: 'trans-only' } }) }
    await open()
    await rowFor('Bengali')
    // COLOUR IS NOT THE ONLY SIGNAL. The accent on the chosen icon says it to an
    // eye; the words say it to everything else.
    expect(screen.getAllByText(/own setting/i)).toHaveLength(1)
    // AND THE DEFAULT'S TOOLTIP IS PART OF THE SIGNAL: a dimmed control with
    // nothing to say reads as disabled, when it is the one control that still
    // does something to every row.
    expect(document.querySelector('[title]')?.getAttribute('title')).toMatch(/own setting/i)
  })
})
