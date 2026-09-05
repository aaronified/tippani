// Unpairing a device, and unpairing all of them.
//
// TWO MORE OF THE THIRTEEN. Until the question became the app's own dialog, both
// of these opened with the browser's `confirm()` — which jsdom does not
// implement, so the guard was always taken and neither DELETE could be reached
// from a test. "Unpair every device" is the one that matters most: it is the
// broadest revoke the app has, and nothing had ever asserted that it asks first.
//
// The two questions are asserted apart from each other on purpose. One names the
// device and one does not, and a revoke-all wearing the single-device sentence
// would tell a reader that one phone is about to stop working when the answer is
// all of them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'

let CALLS
let DEVICES

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    if (method === 'GET' && path === '/auth/devices') return { ok: true, data: { devices: DEVICES } }
    if (method === 'GET' && path === '/fonts') return { ok: true, data: { fonts: [] } }
    if (method === 'DELETE' && path.startsWith('/auth/devices/')) {
      DEVICES = DEVICES.filter((d) => `/auth/devices/${d.id}` !== path)
      return { ok: true, data: {} }
    }
    if (method === 'POST' && path === '/auth/devices/revoke-all') {
      DEVICES = []
      return { ok: true, data: {} }
    }
    return { ok: true, data: {} }
  }),
}))

const { default: Settings } = await import('../../src/Settings.jsx')

const ADMIN = { username: 'alice', is_admin: true, version: '3.1.0', preferences: {} }

beforeEach(() => {
  CALLS = []
  DEVICES = [
    { id: 1, name: 'Pixel 8', last_seen_at: '2026-08-30T10:00:00Z' },
    { id: 2, name: 'the kitchen tablet', last_seen_at: '2026-08-29T10:00:00Z' },
  ]
})
afterEach(() => cleanup())

// Settings draws every card; the devices one is reached by its own controls
// rather than by a tab, so the row is found by the device's name.
const rowFor = async (name) => (await screen.findByText(name)).closest('li') || (await screen.findByText(name)).closest('div')

const mount = async () => {
  render(<Settings user={ADMIN} onPreferences={() => {}} update={null} onUpdateInfo={() => {}} onStartTour={() => {}} />)
  await screen.findByText('Pixel 8')
}

const press = async (el) => {
  await act(async () => {
    el.click()
  })
}

describe('unpairing one device', () => {
  it('asks with the device named, and sends nothing until it is answered', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair Pixel 8'))
    // ALERTDIALOG, because this one destroys something. `ConfirmDialog` takes
    // the role the pack gives it (`book-detail.dc.html:562`) whenever the act
    // is destructive or final, so a screen reader interrupts rather than waits —
    // and asking for it by name here is what keeps this question in that class.
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Pixel 8/)).toBeTruthy()
    expect(within(dialog).getByText(/stop working immediately/)).toBeTruthy()
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })

  it('revokes the one it named, and only that one', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair Pixel 8'))
    await press(screen.getByText('Confirm').closest('button'))
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/auth/devices/1')).toBe(true))
    expect(CALLS.some(([m, p]) => m === 'DELETE' && p === '/auth/devices/2')).toBe(false)
  })

  it('sends nothing when the question is answered no', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair Pixel 8'))
    await press(screen.getByText('Cancel').closest('button'))
    expect(CALLS.some(([m]) => m === 'DELETE')).toBe(false)
  })
})

describe('unpairing every device', () => {
  // THE BROADEST REVOKE THE APP HAS. Its question must not be the single-device
  // one: naming a phone while taking all of them away is the wrong sentence for
  // the act, and it is the sentence a reader would act on.
  it('asks about all of them, not about one', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair every device'))
    // ALERTDIALOG, because this one destroys something. `ConfirmDialog` takes
    // the role the pack gives it (`book-detail.dc.html:562`) whenever the act
    // is destructive or final, so a screen reader interrupts rather than waits —
    // and asking for it by name here is what keeps this question in that class.
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Unpair every device\?/)).toBeTruthy()
    expect(within(dialog).queryByText(/Pixel 8/)).toBeNull()
    expect(CALLS.some(([m, p]) => p === '/auth/devices/revoke-all')).toBe(false)
  })

  it('revokes all of them once answered yes', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair every device'))
    await press(screen.getByText('Confirm').closest('button'))
    await waitFor(() =>
      expect(CALLS.some(([m, p]) => m === 'POST' && p === '/auth/devices/revoke-all')).toBe(true),
    )
  })

  it('revokes nothing when answered no', async () => {
    await mount()
    await press(screen.getByLabelText('Unpair every device'))
    await press(screen.getByText('Cancel').closest('button'))
    expect(CALLS.some(([m, p]) => p === '/auth/devices/revoke-all')).toBe(false)
  })
})
