// AN ANTHOLOGY'S FRONT MATTER on its page: the cover, the dedication and the epigraph open the
// document when there are any, and are written through their own route.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, DETAIL, UPLOADS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies/1') return { ok: true, data: DETAIL }
    if (method === 'GET' && path === '/anthologies/1/removed') return { ok: true, data: { removed: [] } }
    return { ok: true, data: {} }
  }),
  upload: vi.fn(async (path, file) => {
    UPLOADS.push([path, file.name])
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

beforeEach(() => {
  CALLS = []
  UPLOADS = []
  DETAIL = { anthology: { id: 1, title: 'Front', intro: 'Hello.', entries: 0, group_by: '' }, entries: [], sections: [] }
})

describe('the front matter of an anthology', () => {
  it('draws the cover, the dedication and the epigraph before the introduction when there are any', async () => {
    DETAIL.anthology = { ...DETAIL.anthology, cover_path: 'abcdef0123456789.png', dedication: 'For R.', epigraph: 'Time is the substance.' }
    open()
    const front = await screen.findByTestId('anthology-front')
    expect(within(front).getByRole('img').getAttribute('src')).toContain('/covers/abcdef0123456789.png')
    expect(within(front).getByText('For R.')).toBeTruthy()
    expect(within(front).getByText('Time is the substance.')).toBeTruthy()
    // before the introduction in the document
    const intro = screen.getByText('Hello.')
    expect(front.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws nothing for an anthology that has none', async () => {
    open()
    await screen.findByText('Hello.')
    expect(screen.queryByTestId('anthology-front')).toBeNull()
  })

  it('saves the epigraph and the dedication through their own route', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Front matter' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Epigraph/ }), { target: { value: 'Line one.\nLine two.' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Dedication/ }), { target: { value: 'For R.' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/ }))
    await waitFor(() =>
      expect(CALLS).toContainEqual(['PUT', '/anthologies/1/front', { epigraph: 'Line one.\nLine two.', dedication: 'For R.' }]),
    )
  })

  it('sends a chosen picture to the cover route as soon as it is chosen', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Front matter' }))
    const dialog = await screen.findByRole('dialog')
    const input = dialog.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] } })
    await waitFor(() => expect(UPLOADS).toEqual([['/anthologies/1/cover', 'cover.png']]))
  })

  it('offers to remove a cover that is there, and asks the server to', async () => {
    DETAIL.anthology = { ...DETAIL.anthology, cover_path: 'abcdef0123456789.png' }
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Front matter' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove the picture' }))
    await waitFor(() => expect(CALLS).toContainEqual(['DELETE', '/anthologies/1/cover', undefined]))
  })
})
