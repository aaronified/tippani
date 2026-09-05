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

  it('says it has no date rather than inventing one, on a build that is not a release', () => {
    // Every one of these is a real build this app ships: a local build, a branch
    // image from CI, and a release candidate — which IS published, and still heads
    // no changelog entry.
    for (const version of ['dev', '3.0.0-edge.v3.a66ff6c', '3.1.0-rc.1']) {
      cleanup()
      card({ version, version_date: '' })
      expect(
        screen.getByText(t('settings.updates.released.unknown.label')),
        `${version} did not say it has no release date`,
      ).toBeTruthy()
    }
  })

  it('draws the row even then, because a missing row is a question and a stated absence is an answer', () => {
    // Also the shape every developer and every CI render sees: VERSION is `dev`
    // there, so a hidden row would mean the shipped shape is the one nobody looks
    // at. The row is found by its label's slot, not by its wording.
    card({ version: 'dev', version_date: '' })
    const rows = [...document.querySelectorAll('.mono-label')].map((n) => n.textContent)
    expect(rows.length, 'the card lost its labelled rows').toBeGreaterThan(1)
  })

  it('refuses a value it cannot format, rather than printing it raw or as NaN', () => {
    // The server already rejects a heading whose date is not YYYY-MM-DD, and the
    // card guards again: a field a client formats is one bad heading away from
    // printing NaN, and the two guards are cheap where the failure is silent.
    for (const bad of ['25 August 2026', '2026-13-01', 'soon', '2026-09-01T00:00:00Z']) {
      cleanup()
      card({ version: '3.1.0', version_date: bad })
      expect(screen.queryByText(/NaN/), `${bad} reached the reader`).toBeNull()
      expect(screen.queryByText(bad), `${bad} was printed raw`).toBeNull()
      expect(screen.getByText(t('settings.updates.released.unknown.label'))).toBeTruthy()
    }
  })

  it('and does not confuse the build’s age with the version itself', () => {
    // Two rows, two facts. A card that prints the version twice, or the date in
    // the version's slot, is the duplication this screen's siblings were reported
    // for.
    card({ version: '3.1.0', version_date: '2026-09-01' })
    expect(screen.getAllByText('3.1.0').length, 'the version is printed more than once').toBe(1)
  })
})
