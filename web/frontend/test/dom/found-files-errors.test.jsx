// A SCAN THAT FAILED SAYS WHY, ON CHECKS. "It should also handle errors and tell me that
// some error has occurred." The last scan of a folder that ended in failure is one of the
// things Checks shows after a scan, with its reason. (A Scan press that fails is tested on
// Metadata > Source files, where the press is: source-files-console.test.jsx.)
//
// WHAT THIS KNOWS: the addresses the section reads and presses (the folders, what a scan
// found, the scan start, the past scans on the jobs list), the words on screen, and what
// a person can press. The network is the only fake.
import { cleanup, render, screen } from '@testing-library/react'
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

describe('a scan that failed', () => {
  it('shows why the last scan of a folder failed', async () => {
    pastJobs = [{ id: 4, kind: 'library.scan', state: 'failed', own: true, error: 'the folder is not readable', params: { mount_id: 'books' } }]
    section()
    expect(await screen.findByText(/The last scan of Books failed: the folder is not readable/)).toBeTruthy()
  })
})
