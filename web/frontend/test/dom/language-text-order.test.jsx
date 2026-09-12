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

const { MetadataSources } = await import('../../src/MetadataSources.jsx')
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

const open = async () => {
  render(<MetadataSources user={{ username: 'a', is_admin: true, preferences: PREFS }} onPreferences={() => {}} />)
  // The languages table is a door, as it was before this column was added — a row
  // per language with a tray behind each is a column spent on a choice made once.
  fireEvent.click(await screen.findByRole('button', { name: /language marks/i }))
  // The MASTER, matched exactly: a loose /how much of the original/ also matches
  // every row's group, and findBy throws on more than one.
  return screen.findByRole('radiogroup', { name: /^how much of the original$/i })
}

// FOUR CHIPS, AND THESE CASES DROVE A SLIDER. The owner replaced it — "Sliders
// are for when we have a gradient, not when we have 4-5 distinct options!" — so
// the GESTURE changed and not one of the guarantees below: a row still saves what
// it is set to, the master still pulls every row back into line, and a row with
// nothing of its own still shows the master's answer. Each case says the same
// thing about the app; only the way a reader says it to the control is different.
//
// AWAITED, BECAUSE A ROW ARRIVES ON A PROMISE. The table used to open with ten
// starters — present on the first paint, synchronously, for every account — and
// its rows are now the languages the library holds, which is a fetch. Only the
// FIRST case in a file actually races: the vocabulary is cached at module scope,
// so every case after it finds the rows already there. That is the shape of an
// order-dependent suite, which this file has been bitten by before.
const rowFor = (name) => screen.findByRole('radiogroup', { name: new RegExp(`how much of the original for ${name}`, 'i') })
const master = () => screen.getByRole('radiogroup', { name: /^how much of the original$/i })
const written = () => PUTS.filter(([p]) => p === '/auth/me/preferences').map(([, b]) => JSON.parse(b.textOrder))

// Pick one of the four, by the word on its face — which is the whole of the
// reader's gesture now, and needs no release event to commit.
const pick = (group, word) =>
  fireEvent.click(within(group).getByRole('radio', { name: word }))
// Which of the four a group is currently showing.
const chosen = (group) =>
  within(group).getAllByRole('radio').find((b) => b.getAttribute('aria-checked') === 'true')?.textContent

describe('the per-language table', () => {
  it('has a chooser for every language and one above them all', async () => {
    await open()
    expect(master()).toBeTruthy()
    expect(await rowFor('Bengali')).toBeTruthy()
    // FOUR, and all four reachable — which is what the old `max="3"` stood for. A
    // chooser missing a chip silently refuses a state the app can store, the same
    // defect a slider with the wrong max used to have.
    expect(within(master()).getAllByRole('radio')).toHaveLength(4)
    expect(within(await rowFor('Bengali')).getAllByRole('radio')).toHaveLength(4)
  })

  it('saves the state a row is set to', async () => {
    await open()
    pick(await rowFor('Bengali'), 'translation only')
    await waitFor(() => expect(written().length).toBeGreaterThan(0))
    expect(written().at(-1).byLanguage.bengali).toBe('trans-only')
  })

  // THE OWNER'S "IT WILL PUSH ALL KNOBS TO ALIGN WITH IT". The master is not a
  // fallback the rows read; moving it CLEARS them, so a language set on its own
  // comes back into line rather than quietly out-ranking the thing that looks
  // like it just changed everything.
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
    // Not the app default — the master's value, which is the whole point of it
    // being a default rather than only a bulk setter.
    expect(chosen(await rowFor('Bengali'))).toBe('translation only')
  })
})

// WHAT THIS LANGUAGE'S QUOTES ARE SET IN, and it is in THIS table rather than in
// the Type card on the panel's own stated rule: "A second table of the same
// languages would be two lists to keep in step, and the first time somebody added
// a language to one of them they would diverge." A language's mark, its name and
// how much of the original it shows already live in its row; its face is the
// fourth thing about it.
describe('a language row carries its quotes\' face', () => {
  // AWAITED, because a row arrives on a promise. Every case in this file now
  // starts from an empty vocabulary cache (see beforeEach), so no case inherits
  // rows another one fetched — which is what made this helper synchronous, and
  // order-dependent, before.
  const tray = async (name) => {
    await open()
    fireEvent.click(await screen.findByRole('button', { name }))
    return screen.findByRole('button', { name: new RegExp(`Typeface for quotes in ${name}`, 'i') })
  }

  it('offers every face the app ships, not one role\'s three', async () => {
    fireEvent.click(await tray('Bengali'))
    const words = screen.getAllByRole('option').map((o) => o.textContent)
    // A serif, a sans and a hand all in one list: the question is "what does my
    // Bengali look like", and the answer is not confined to a role.
    expect(words).toContain('Literata')
    expect(words).toContain('Inter')
    expect(words).toContain('Caveat')
  })

  // THE KEY IS WHAT THE LIBRARY STORES, NOT THE ISO NAME. A row carries both: its
  // `key` is the fold of what the reader typed, its `canonical` is the English
  // name iso639 knows it by. This control passed `canonical` for a commit, so a
  // library whose quotes say `বাংলা` saved {"bengali":…} — which reads back as
  // saved, looks right in the picker, and changes no card at all.
  it('keys the face on what the library stores, not on the ISO name', async () => {
    // THE VOCABULARY IS A SESSION CACHE, so a case that needs a different library
    // has to forget the one the file's earlier cases primed — this panel's own
    // header warns that only the FIRST case in a file races for it.
    // THE ROW IS HEADED "Bengali" AND KEYED `বাংলা`, which is the whole trap: the
    // row's NAME is what iso639 calls the language, and its KEY is what the
    // library stores. A picker reading the name saves under the wrong one.
    VOCAB = ['বাংলা']
    fireEvent.click(await tray('Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'Literata'))
    await waitFor(() => {
      const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
      expect(JSON.parse(put[1].fontsByLanguage)).toEqual({ 'বাংলা': 'literata' })
    })
  })

  it('saves the face against the language, not against a script', async () => {
    fireEvent.click(await tray('Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'Literata'))
    await waitFor(() => {
      const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
      expect(JSON.parse(put[1].fontsByLanguage)).toEqual({ bengali: 'literata' })
    })
  })

  // "Follows the card" is a real answer a reader has to be able to choose AGAIN,
  // which is why it is the first option and not a clear button beside the list.
  it('and takes the row back out when the reader chooses to follow the card', async () => {
    PREFS = { fontsByLanguage: JSON.stringify({ bengali: 'literata' }) }
    fireEvent.click(await tray('Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => /Follows the card/i.test(o.textContent)))
    await waitFor(() => {
      const put = PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)
      expect(put[1].fontsByLanguage).toBe('')
    })
  })
})

describe('the master\'s custom state', () => {
  // "when other knobs are adjusted (custom), it will lose contrast."
  it('is at full contrast while every row agrees', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'trans-only' }) }
    const el = await open()
    const box = el.closest('div[title], div')
    expect(box.parentElement.style.opacity || '1').toBe('1')
  })

  it('and dims, with an explanation, once one does not', async () => {
    PREFS = { textOrder: JSON.stringify({ master: 'quote-first', byLanguage: { bengali: 'trans-only' } }) }
    await open()
    // THE TOOLTIP IS PART OF THE SIGNAL. A dimmed control with nothing to say
    // reads as disabled, which is the opposite of true: it is the one control that
    // still does something to every row.
    const dimmed = document.querySelector('div[title]')
    expect(dimmed, 'nothing carries the custom-state explanation').toBeTruthy()
    expect(Number(dimmed.style.opacity)).toBeLessThan(1)
  })
})
