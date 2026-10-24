// A SCAN THAT FAILS SAYS SO. On the owner's NAS a Scan press sent a request that never
// came back and the screen showed nothing at all: "It should also handle errors and tell
// me that some error has occurred." A press whose request fails says what happened and
// gives the button back; a scan that ended in failure says why, in the section.
//
// WHAT THIS KNOWS: the addresses the section reads and presses (the folders, what a scan
// found, the scan start, the past scans on the jobs list), the words on screen, and what
// a person can press. The network is the only fake.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let scanAnswer
let pastJobs

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    const ok = (data) => ({ ok: true, status: 200, data })
    if (path === '/sources/mounts') return ok({ mounts: [{ id: 'books', label: 'Books' }] })
    if (path === '/sources/scan') return scanAnswer()
    if (path.startsWith('/sources/found')) return ok({ scan: { state: 'partial', scanned: 300, found: 0, unclaimed: 0 }, candidates: [] })
    if (path.startsWith('/jobs?')) return ok({ jobs: pastJobs, running: 0, waiting: 0, more: false })
    return ok({})
  },
}))

const { default: FoundFilesPage } = await import('../../src/FoundFilesPage.jsx')
const { ToastHost } = await import('../../src/ui.jsx')

beforeEach(() => {
  cleanup()
  pastJobs = []
  scanAnswer = () => ({ ok: true, status: 202, data: { job_id: 7 } })
})

const section = () =>
  render(
    <>
      <FoundFilesPage embedded />
      <ToastHost />
    </>,
  )

describe('a scan that fails', () => {
  it('says the server did not answer, and gives the Scan button back', async () => {
    // What a request that never settles turns into once its timeout passes.
    scanAnswer = () => ({ ok: false, status: 0, data: null })
    section()
    fireEvent.click(await screen.findByRole('button', { name: 'Scan again' }))
    expect(await screen.findByText(/did not answer the scan request/)).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Scan again' }).disabled).toBe(false))
    expect(screen.queryByText('Scanning…')).toBeNull()
  })

  it('shows why the last scan of a folder failed', async () => {
    pastJobs = [{ id: 4, kind: 'library.scan', state: 'failed', own: true, error: 'the folder is not readable', params: { mount_id: 'books' } }]
    section()
    expect(await screen.findByText(/The last scan of Books failed: the folder is not readable/)).toBeTruthy()
  })
})
