// THE DEVICES CARD IS BACK ON SETTINGS, FOR EVERY READER. It was hidden while there was no app to
// pair ("not required right now"); the Android app exists now and pairs with a code from this card.
// What is pinned: it is on the Server section, an admin gets it beside the admin card and a
// reader who is not an admin gets it alone (the section was empty for them before, and so absent),
// Settings' own search finds it, and its own words are what it finds it by.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (path === '/auth/devices') return { ok: true, status: 200, data: { devices: [{ id: 2, name: 'My Android phone', created_at: '2026-11-06 09:00:00', last_seen_at: '' }] } }
    return { ok: true, status: 200, data: {} }
  }),
}))

const { default: Settings, SECTION_CARDS, SETTINGS_CARDS, sectionOfCard, settingsMatches } = await import('../../src/Settings.jsx')

const page = (user, props = {}) =>
  render(<Settings user={{ username: 'a', preferences: {}, ...user }} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} section="server" {...props} />)

beforeEach(() => cleanup())

describe('the Devices card', () => {
  it('is registered and on the Server section', () => {
    expect(SETTINGS_CARDS).toContain('devices')
    expect(sectionOfCard('devices')).toBe('server')
    expect(SECTION_CARDS.server).toContain('devices')
  })

  it('is drawn for a reader who is not an admin, who has the section to themselves', async () => {
    page({ is_admin: false })
    expect(await screen.findByText('Devices')).toBeTruthy()
    expect(await screen.findByText('My Android phone')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Server/ })).toBeTruthy()
  })

  it('is drawn for an admin too', async () => {
    page({ is_admin: true })
    expect(await screen.findByText('Devices')).toBeTruthy()
  })

  it('is found by Settings search, by its own words', () => {
    // matched against the card's own headings and labels: "Devices", "pairing code", "Pair a device"
    expect(settingsMatches('devices', 'pair')).toBe(true)
    expect(settingsMatches('devices', 'devices')).toBe(true)
    expect(settingsMatches('devices', 'zebra')).toBe(false)
  })

  it('offers a pairing code', async () => {
    page({ is_admin: false })
    // the visible button and its icon-only twin both carry the name
    expect((await screen.findAllByRole('button', { name: /Pair a device/ })).length).toBeGreaterThan(0)
  })
})
