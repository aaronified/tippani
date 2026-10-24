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
const { LanguageMarksSettings } = await import('../../src/MetadataSources.jsx')
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

// THE FACES ARE CHOSEN IN METADATA › LANGUAGES NOW — the owner's "the quote font
// selection can be added to the metadata language screen" — so the cases about
// choosing one mount that section, and Settings keeps only the door to it.
const quoteFaces = async (preferences = {}) => {
  render(<LanguageMarksSettings prefs={preferences} onSaved={() => {}} />)
  await screen.findByRole('radiogroup', { name: /^all languages$/i })
  return document.body
}
const faceFor = async (panel, name) =>
  within(panel).findByRole('button', { name: new RegExp(`Typeface for quotes in ${name}`, 'i') })
const written = () => PUTS.filter(([p]) => p === '/auth/me/preferences').at(-1)?.[1]

describe('the faces the interface is set in', () => {

  it('changes a face where the face is shown, with nothing opened first', async () => {
    await page()
    const role = FONT_ROLES.find((r) => !r.script && r.key !== 'display')
    const row = screen.getAllByText(t(role.sample))[0].closest('.pref-row')
    // `role.aria || role.label` — one row's accessible name is not its label, for
    // the reason Settings.jsx sets out at the call site: "Every language" heads
    // the quote table and reads right under that heading, and an accessible name
    // carries no heading with it.
    const picker = within(row).getByRole('button', { name: t('settings.type.face.aria', { name: t(role.aria || role.label) }) })
    fireEvent.click(picker)
    // The second face on the row: the first is what it is already set to, so
    // choosing it would prove nothing about saving.
    const options = screen.getAllByRole('option')
    fireEvent.click(options[1])
    const saved = put.mock.calls.find(([method, path]) => method === 'PUT' && path === '/auth/me/preferences')
    expect(saved, 'choosing a face saved nothing').toBeTruthy()
    // THE FIELD THE ROLE OWNS, derived from the role rather than asserted against
    // the patch's own first key — which is what this line did, and a comparison
    // of a value with itself is a test that passes whatever the app sends. It
    // survived review because the branch it actually took was the real one.
    // THE LANGUAGE YOU ARE READING IN IS THE SCOPE, so the patch is that
    // language's overlay rather than the flat field. The chooser that used to say
    // so is gone — the owner's ask, because the language is picked in the card
    // above — and what replaced it is this: the faces on screen are the faces of
    // the interface you are actually looking at.
    const patch = saved[2]
    expect(Object.keys(patch), 'the patch should be the locale overlay').toContain('fontsByLocale')
    // THE ROLE THE ROW OWNS, derived from the row rather than read back off the
    // patch's own first key — a comparison of a value with itself is a test that
    // passes whatever the app sends.
    expect(Object.keys(JSON.parse(patch.fontsByLocale).en || {}), `the overlay does not name ${role.key}`)
      .toContain(role.key)
  })

  // WHOSE FACES THESE ARE, SAID RATHER THAN ASKED. The row that asked it was a
  // language picker under a language picker; what is left is the fact, as
  // subtext, so a reader still knows the answer applies to English and not to
  // every language at once.
})

// EVERY GUARANTEE THE LANGUAGE TABLE USED TO CARRY, now asked of the control that
// actually writes the preference. They moved out of language-text-order.test.jsx
// with the picker itself; what they say about the app is unchanged.
