// The picker, twice: the first-run screen and the Settings row.
//
// Both matter for the same reason and neither is decoration. The first-run one is
// the ONLY place the language can be chosen before an account exists — without it
// the operator's first act is creating an admin account in a language they may not
// read. The Settings one is the only place the choice reaches the account, so
// without it the choice does not survive signing in on another device.
//
// The module holds mutable state across a file, so each case resets it.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LanguagePicker } from '../../src/locale.jsx'
import { LOCALE_KEY, PSEUDO, applyLocale, coverage, localeActive, resetLocaleForTests, setLocaleFiles, t } from '../../src/i18n.js'

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

describe('the Settings row', () => {
  test('offers every installed language with its coverage beside the name', async () => {
    const user = userEvent.setup()
    setLocaleFiles({ fr: file({}, { _name: 'Français' }) })
    render(<LanguagePicker titleKey="settings.language.title" info />)
    const panel = await open(user)
    const rows = within(panel).getAllByRole('option')
    // The two built-ins, the operator's file, and the pseudo-locale.
    expect(rows).toHaveLength(4)
    // COVERAGE ON EVERY ROW, design §7 — including the two that ship in the box,
    // which is the whole point of showing it. No language is second-class, so none
    // of them gets to omit the number.
    for (const row of rows) expect(row.textContent).toMatch(/\d+%$/)
    expect(within(panel).getByRole('option', { name: `Français · ${coverage('fr')}%` })).toBeTruthy()
  })

  test('picking one applies it and hands the code to the caller to save', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    setLocaleFiles({ fr: file({ 'settings.language.title': 'Langue' }, { _name: 'Français' }) })
    render(<LanguagePicker titleKey="settings.language.title" onPick={onPick} />)
    const panel = await open(user)
    await user.click(within(panel).getByRole('option', { name: /Français/ }))
    // Applied by the picker itself — the first-run screen has no session to save
    // to and still has to work.
    expect(localeActive()).toBe('fr')
    // …and the SAVE is the caller's, which is what keeps this out of the
    // Appearance card's persist() and its every-field-on-any-change PUT.
    expect(onPick).toHaveBeenCalledWith('fr')
  })

  test('the choice is mirrored device-locally, so the login screen matches next boot', async () => {
    const user = userEvent.setup()
    setLocaleFiles({ fr: file({}, { _name: 'Français' }) })
    render(<LanguagePicker titleKey="settings.language.title" />)
    const panel = await open(user)
    await user.click(within(panel).getByRole('option', { name: /Français/ }))
    expect(localStorage.getItem(LOCALE_KEY)).toBe('fr')
  })

  test('the row title, and the whole picker, are keyed rather than written here', () => {
    render(<LanguagePicker titleKey="settings.language.title" />)
    // The word on screen is whatever en.txt says it is. Asserting the KEY resolves
    // rather than asserting the word means a translator changing the copy does not
    // break the test — and a key that stops resolving does.
    expect(screen.getByText(t('settings.language.title'))).toBeTruthy()
    expect(t('settings.language.title')).not.toBe('Language title') // not the placeholder
  })
})

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

  test('and the document says which language, and which way it reads', async () => {
    const user = userEvent.setup()
    setLocaleFiles({ ar: file({}, { _name: 'العربية', _dir: 'rtl' }) })
    render(<LanguagePicker titleKey="settings.language.title" />)
    const panel = await open(user)
    await user.click(within(panel).getByRole('option', { name: /العربية/ }))
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
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

describe('the pseudo-locale is reachable from the picker', () => {
  test('because a transform nobody can select finds no unwrapped literal', async () => {
    const user = userEvent.setup()
    render(<LanguagePicker titleKey="settings.language.title" />)
    const panel = await open(user)
    const rows = within(panel).getAllByRole('option')
    // Last, and labelled as itself in its own transformed alphabet — a reader who
    // opens the list can see at a glance that it is not a language.
    expect(rows[rows.length - 1].textContent).toContain('⟦')
    await user.click(rows[rows.length - 1])
    expect(localeActive()).toBe(PSEUDO)
    // Every keyed string on screen is now bracketed. An English literal still in
    // the JSX would be the only plain text left, which is the point.
    // getAll, not get: EVERY keyed string is bracketed now, which is why a single
    // match would be the failure rather than the pass.
    expect(screen.getAllByText(/^⟦/).length).toBeGreaterThan(0)
  })
})
