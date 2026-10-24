// HOW OLD IS THE BUILD I AM RUNNING — the Updates card's second row.
//
// THE REQUEST WAS "a last updated date in the update section", and the word this
// row settles is `released` rather than `updated`. The server cannot know when
// THIS BOX was last updated: the setting that would record it travels inside a
// backup archive, so a restore prints the date of the machine the archive came
// from; a local build's version is `dev` for ever, so a change-detector would
// stamp once and never again; a NAS with a dead clock writes 1970 and keeps it;
// and a downgrade would be called an update. The release date is a fact about the
// BUILD, so it survives all four and nothing is stored for any of them to spoil.
//
// SO THE CASES ARE ABOUT WHAT THE CARD SAYS FOR WHAT THE SERVER SENDS. Nothing
// here asserts a label's wording — the row is found by the value it carries — and
// nothing mounts the whole Settings screen, which would fail for a dozen reasons
// that are not this row.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: {} })),
}))

const { UpdatesCard } = await import('../../src/Settings.jsx')
const { t } = await import('../../src/i18n.js')

const card = (user) => render(
  <UpdatesCard user={{ is_admin: true, ...user }} update={null} onUpdateInfo={() => {}} onAsking={() => {}} />,
)

afterEach(() => cleanup())

describe('the date on the running build', () => {
  it('is the day that version came out, written the way this app writes dates', async () => {
    card({ version: '3.1.0', version_date: '2026-09-01' })
    // Composed through the app's own partial-date formatter, so Bengali gets
    // Bengali months with no second date mechanism. Asserted as the formatter's
    // own output rather than as a literal, which is what makes that true.
    const { formatPartialDate } = await import('../../src/ui.jsx')
    expect(screen.getByText(formatPartialDate('2026-09-01'))).toBeTruthy()
  })

})
