// A LIBRARY SCAN ON THE JOBS CARD. A running scan of a folder shows under its own name
// and the folder's, with how many files it has read and how many it has found, and it
// can be stopped from there.
//
// WHAT THIS KNOWS: the jobs routes, answered by helpers/jobsServer.js, and the scan's
// own count (GET /sources/found?status=1), the words on screen and what a person can
// press. The network is the only fake.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jobsServer } from './helpers/jobsServer.js'

let JOBS
let scanJob

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path, body) => {
    const a = JOBS.answer(method, path, body)
    if (a) return a
    if (path.startsWith('/sources/found') && path.includes('status=1')) {
      return { ok: true, status: 200, data: { scan: { state: 'running', job_id: scanJob.id, scanned: 1240, found: 17 } } }
    }
    return { ok: true, status: 200, data: {} }
  },
}))

const { JobsCurrentCard } = await import('../../src/jobsSection.jsx')

beforeEach(() => {
  cleanup()
  JOBS = jobsServer()
  scanJob = JOBS.add({ kind: 'library.scan', subject: 'Books', state: 'running', params: { mount_id: 'books' }, done: 1240, total: 0, started_at: Date.now() })
})

describe('a library scan on the jobs card', () => {
  it('shows what it is, how far it has got, and stops', async () => {
    render(<JobsCurrentCard user={{ id: 1 }} />)
    expect(await screen.findByText('Library scan')).toBeTruthy()
    expect(screen.getByText('Books')).toBeTruthy()
    expect(await screen.findByText('1240 files scanned · 17 found')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Stop .*Library scan/ }))
    await waitFor(() => expect(JOBS.stops()).toContain(scanJob.id))
  })
})
