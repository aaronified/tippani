// THE FACES ARE ON THE PAGE, AND THE SECTION SAYS WHAT IT FALLS BACK TO.
//
// WHAT THIS GUARDS. The Language and font section drew a language picker and a
// button. Every face the interface is set in was behind that button, and the
// pack draws all four on the section with a specimen apiece — so the answer to
// "what is this app set in" was one press away, and "what would it look like
// changed" was a press inside that press.
//
// A SPECIMEN IS THE PART THAT CANNOT BE A NAME, which is why this asserts the
// sample text is there for each role rather than just the role's label. A list of
// four names is what the panel's own picker already is.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { openSettingsSection } from './helpers/settingsSection.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { default: Settings } = await import('../../src/Settings.jsx')
const { FONT_ROLES } = await import('../../src/fonts.js')
const { t } = await import('../../src/i18n.js')

const page = async (preferences = {}) => {
  render(<Settings user={{ username: 'a', is_admin: false, preferences }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await openSettingsSection('Language and font')
}

beforeEach(() => cleanup())

describe('the faces the interface is set in', () => {
  it('shows all four without opening anything', async () => {
    await page()
    // The four the INTERFACE wears. The role table also holds Bengali and
    // Devanagari, which are what a quote in those scripts is set in — they belong
    // to the panel's scope picker and would read here as two more UI faces.
    const ui = FONT_ROLES.filter((r) => !r.script)
    expect(ui).toHaveLength(4)
    for (const role of ui) {
      expect(screen.getByText(t(role.label)), `${role.key} should be named`).toBeTruthy()
      expect(screen.getByText(t(role.sample)), `${role.key} should show its specimen`).toBeTruthy()
    }
  })

  it('does not show the two quote scripts as interface faces', async () => {
    await page()
    for (const role of FONT_ROLES.filter((r) => r.script)) {
      expect(screen.queryByText(t(role.sample)), `${role.key} does not belong here`).toBeNull()
    }
  })

  it('opens the panel when a face is pressed, rather than choosing one itself', async () => {
    // TWO PLACES THAT BOTH ASSIGN A FACE WOULD BE TWO WRITERS FOR ONE PREFERENCE.
    // The specimen is for seeing; choosing stays where everything that goes with
    // choosing already is.
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    screen.getByText(t(FONT_ROLES[0].sample)).closest('button').click()
    expect(await screen.findByRole('dialog')).toBeTruthy()
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
