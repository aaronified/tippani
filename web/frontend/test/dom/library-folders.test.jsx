// THE ADMINISTRATOR'S LIBRARY FOLDERS, in Settings. The folders are saved as a whole and
// validated by the server; the backup's one source-file setting sits beside them.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let mounts
vi.mock('../../src/api.js', () => ({
  json: async (method, path, body) => {
    calls.push({ method, path, body })
    if (path === '/admin/mounts' && method === 'GET') return { ok: true, data: { mounts } }
    if (path === '/admin/mounts' && method === 'PUT') {
      mounts = body.mounts.map((m) => ({ ...m, ok: true }))
      return { ok: true, data: { mounts } }
    }
    if (path === '/admin/backup/sources' && method === 'GET') return { ok: true, data: { include: false } }
    if (path === '/admin/backup/sources' && method === 'PUT') return { ok: true, data: { include: body.include } }
    return { ok: true, data: {} }
  },
  errText: () => 'nope',
  coverImgURL: () => '',
}))

const { default: LibraryFoldersGroup } = await import('../../src/libraryFolders.jsx')

beforeEach(() => {
  cleanup()
  calls.length = 0
  mounts = [{ id: 'books', label: 'Books', path: '/library/books', ok: true }]
})

describe('library folders', () => {
  it('lists each folder with its path and saves an added one as a whole list', async () => {
    render(<LibraryFoldersGroup />)
    await screen.findByText('/library/books')
    fireEvent.change(screen.getByLabelText('Path in the container'), { target: { value: '/library/movies' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Movies' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT' && c.path === '/admin/mounts')).toBe(true))
    const put = calls.find((c) => c.method === 'PUT' && c.path === '/admin/mounts')
    expect(put.body.mounts.map((m) => m.path)).toEqual(['/library/books', '/library/movies'])
    expect(put.body.mounts[1]).toEqual({ id: 'movies', label: 'Movies', path: '/library/movies' })
  })

  it('removes a folder by saving the list without it', async () => {
    render(<LibraryFoldersGroup />)
    await screen.findByText('/library/books')
    fireEvent.click(screen.getByRole('button', { name: 'Stop using the folder Books' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ mounts: [] }))
  })

  it('carries the backup setting for attached files, off by default', async () => {
    render(<LibraryFoldersGroup />)
    await screen.findByText('/library/books')
    fireEvent.click(screen.getByText('On'))
    await waitFor(() => expect(calls.find((c) => c.path === '/admin/backup/sources' && c.method === 'PUT')?.body).toEqual({ include: true }))
  })
})
