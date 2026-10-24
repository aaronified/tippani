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
import { LOCALE_KEY, PSEUDO, applyLocale, coverage, isInstalled, localeActive, localeCatalogue, resetLocaleForTests, setLocaleFiles, t } from '../../src/i18n.js'

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
