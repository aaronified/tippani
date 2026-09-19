// THE FACES ARE ON THE PAGE, AND THEY ARE CHOSEN THERE.
//
// WHAT THIS GUARDS. Language and font drew four specimens that PICKED NOTHING:
// pressing one opened a panel, where a reader expanded a role, opened a list and
// chose — four presses to change a typeface, on the screen whose whole subject is
// typefaces. The pack draws a picker on every row and no door at all. So the
// claim here is not "the faces are visible", which the old shape satisfied while
// being unusable; it is that pressing a row's own control changes the face.
//
// A SPECIMEN IS THE PART THAT CANNOT BE A NAME, which is why each row is asked
// for its sample text as well as its label.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

// The languages the library holds. The Quote fonts panel reads the same table
// Metadata's language section does, so a case that needs a library stored under
// its own name — `বাংলা` rather than `Bengali` — sets this before opening.
let VOCAB = ['Bengali', 'Hindi', 'English']
let PUTS = []
const put = vi.fn(async (method, path, body) => {
  if (method === 'PUT') PUTS.push([path, body])
  if (path === '/search/vocabulary') return { ok: true, data: { languages: VOCAB } }
  return { ok: true, data: {} }
})
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (...args) => put(...args)),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { FONT_ROLES } = await import('../../src/fonts.js')
const { t } = await import('../../src/i18n.js')
const { forgetSessionCaches } = await import('../../src/sessionCaches.js')

const page = async (preferences = {}) => {
  render(<Settings user={{ username: 'a', is_admin: false, preferences }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Language and font')
}

beforeEach(() => {
  cleanup()
  put.mockClear()
  PUTS = []
  VOCAB = ['Bengali', 'Hindi', 'English']
  // THE VOCABULARY IS A SESSION CACHE held at module scope, so a case that needs
  // a different library has to forget the one an earlier case primed — otherwise
  // the suite passes or fails by the order it happens to run in.
  forgetSessionCaches()
})

// The Quote fonts panel, open, with its rows arrived.
const quoteFaces = async (preferences = {}) => {
  await page(preferences)
  fireEvent.click(screen.getByRole('button', { name: t('settings.quote-faces.row.open') }))
  const panel = await screen.findByRole('dialog')
  return panel
}
const faceFor = async (panel, name) =>
  within(panel).findByRole('button', { name: new RegExp(`Typeface for quotes in ${name}`, 'i') })
const written = () => PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)?.[1]

describe('the faces the interface is set in', () => {
  it('shows every one of them without opening anything', async () => {
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    for (const role of FONT_ROLES.filter((r) => !r.script)) {
      expect(screen.getByText(t(role.label)), `${role.key} should be named`).toBeTruthy()
      expect(screen.getByText(t(role.sample)), `${role.key} should show its specimen`).toBeTruthy()
      // AND NOT A RAW LOCALE KEY. `chosen.name` is a key, so a row that forgot to
      // resolve it printed "vocab.face.newsreader.name" down the middle of the
      // section — which a suite that only read labels and samples passed straight
      // through.
      const row = screen.getByText(t(role.sample)).closest('.pref-row')
      expect(row.textContent, `${role.key} is showing a raw locale key`).not.toMatch(/vocab\./)
    }
  })

  it('draws no control for a script, because a script is not a language', async () => {
    // "my German should be a serif, my English should not" is a question one face
    // per SCRIPT cannot answer, and these two were the attempt. The roles remain
    // as the tail of every stack; what is gone is a picker for them.
    await page()
    for (const role of FONT_ROLES.filter((r) => r.script)) {
      expect(screen.queryByText(t(role.label)), `${role.key} should not be a row here`).toBeNull()
    }
  })

  it('changes a face where the face is shown, with nothing opened first', async () => {
    await page()
    const role = FONT_ROLES[0]
    const row = screen.getByText(t(role.sample)).closest('.pref-row')
    const picker = within(row).getByRole('button', { name: t('settings.type.face.aria', { name: t(role.label) }) })
    fireEvent.click(picker)
    // The second face on the row: the first is what it is already set to, so
    // choosing it would prove nothing about saving.
    const options = screen.getAllByRole('option')
    fireEvent.click(options[1])
    const saved = put.mock.calls.find(([method, path]) => method === 'PUT' && path === '/auth/me/preferences')
    expect(saved, 'choosing a face saved nothing').toBeTruthy()
    expect(Object.keys(saved[2])).toContain(role.key === 'display' ? 'fontDisplay' : Object.keys(saved[2])[0])
  })
})

describe('what a quote is set in', () => {
  // THE OWNER'S FEATURE: "I may want my german to have serifs, but not english."
  // It is a question about a LANGUAGE, and the two script rows — Bengali,
  // Devanagari — were the first attempt at it: one face per script cannot tell
  // German from Swedish.
  it('is a language at a time, behind the row that says so', async () => {
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: t('settings.quote-faces.row.open') }))
    const panel = await screen.findByRole('dialog')
    expect(panel.getAttribute('aria-label')).toBe(t('settings.quote-faces.title'))
  })

  it('offers the door to where languages are actually added', async () => {
    // A language exists because a quote is in it or because it was named on
    // Metadata. A second way to create one here would be two rows for one
    // language the first time anybody used the other.
    const go = vi.fn()
    render(<Settings user={{ username: 'a', is_admin: false, preferences: {} }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onGo={go} />)
    await openSettingsSection('Language and font')
    fireEvent.click(screen.getByRole('button', { name: t('settings.quote-faces.row.open') }))
    const panel = await screen.findByRole('dialog')
    fireEvent.click(within(panel).getByRole('button', { name: t('settings.quote-faces.add.open') }))
    // THE SECTION AND NOT THE SCREEN: Metadata is eight consoles, and a reader
    // sent to add a language has been given a direction rather than a door.
    expect(go).toHaveBeenCalledWith('metadata', 'languages')
  })
})

describe('what a missing line falls back to', () => {
  it('is on the section, and says English until told otherwise', async () => {
    await page()
    const row = screen.getByText(/fall back to/i).closest('.pref-row')
    expect(row).toBeTruthy()
    // Toggle draws its options as tabs, which is what the rest of Settings reads
    // them as too — asked here the way the control actually answers rather than
    // the way a button would.
    expect(within(row).getByRole('tab', { name: 'English' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the reader\'s own choice where they have made one', async () => {
    await page({ localeFallback: 'bn' })
    const row = screen.getByText(/fall back to/i).closest('.pref-row')
    expect(within(row).getByRole('tab', { name: 'বাংলা' }).getAttribute('aria-pressed')).toBe('true')
  })
})

// EVERY GUARANTEE THE LANGUAGE TABLE USED TO CARRY, now asked of the control that
// actually writes the preference. They moved out of language-text-order.test.jsx
// with the picker itself; what they say about the app is unchanged.
describe('a language\'s own quote face', () => {
  it('offers every face the app ships, not one role\'s three', async () => {
    const panel = await quoteFaces()
    fireEvent.click(await faceFor(panel, 'Bengali'))
    const words = screen.getAllByRole('option').map((o) => o.textContent)
    // A serif, a sans and a hand all in one list: the question is "what does my
    // Bengali look like", and the answer is not confined to a role.
    expect(words).toContain('Literata')
    expect(words).toContain('Inter')
    expect(words).toContain('Caveat')
  })

  // THE KEY IS WHAT THE LIBRARY STORES, NOT THE ISO NAME. A row carries both: its
  // key is the fold of what the reader typed, its canonical is the English name
  // iso639 knows it by. This control passed `canonical` for a commit, so a library
  // whose quotes say `বাংলা` saved {"bengali":…} — which reads back as saved,
  // looks right in the picker, and changes no card at all.
  it('keys the face on what the library stores, not on the ISO name', async () => {
    VOCAB = ['বাংলা']
    const panel = await quoteFaces()
    fireEvent.click(await faceFor(panel, 'Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'Literata'))
    await waitFor(() => expect(JSON.parse(written().fontsByLanguage)).toEqual({ 'বাংলা': 'literata' }))
  })

  it('saves it against the language and nothing else', async () => {
    const panel = await quoteFaces()
    fireEvent.click(await faceFor(panel, 'Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === 'Literata'))
    await waitFor(() => expect(JSON.parse(written().fontsByLanguage)).toEqual({ bengali: 'literata' }))
  })

  // Following the interface face is a real answer a reader has to be able to
  // choose AGAIN, which is why it is the first option and not a clear button.
  it('and takes the row back out when the reader chooses to follow again', async () => {
    const panel = await quoteFaces({ fontsByLanguage: JSON.stringify({ bengali: 'literata' }) })
    fireEvent.click(await faceFor(panel, 'Bengali'))
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent === t('settings.languages.face.inherit')))
    await waitFor(() => expect(written().fontsByLanguage).toBe(''))
  })
})
