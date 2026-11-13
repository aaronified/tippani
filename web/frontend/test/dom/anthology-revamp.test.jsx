// THE ANTHOLOGY PAGE'S LAYOUT: a hero with a cover, a header that keeps three verbs and puts the rest in
// one menu, a line that says why a rule's count is there, and chips that flip three of the six field
// switches. None of it changes what an anthology holds, so what is pinned is that each piece is where
// it was promised and that a chip sends the whole anthology back, not its own flag alone.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

let CALLS, DETAIL, PREVIEW

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (method === 'GET' && path === '/anthologies/1') return { ok: true, data: DETAIL }
    if (method === 'GET' && path === '/anthologies/1/removed') return { ok: true, data: { removed: [] } }
    if (method === 'POST' && path === '/anthologies/1/fill') return { ok: true, data: PREVIEW }
    return { ok: true, data: {} }
  }),
}))

const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
const noop = () => {}
const open = () => render(<AnthologiesPage openId={1} onOpen={noop} onClose={noop} onOpenBook={noop} onOpenMovie={noop} />)

beforeEach(() => {
  CALLS = []
  PREVIEW = { added: 0, skipped: 0 }
  DETAIL = {
    anthology: { id: 1, title: 'On woods', intro: 'Two passages.', entries: 0, group_by: '', hide_credit: false, hide_source: false, hide_commentary: false },
    entries: [],
    sections: [],
  }
})

describe('the hero', () => {
  it('sets a poster from the title when there is no picture, once, and keeps it out of the front matter', async () => {
    const { container } = open()
    await screen.findByText('Two passages.')
    const fallback = container.querySelector('.anthology-poster-fallback')
    expect(fallback.getAttribute('data-title')).toBe('On woods')
    expect(fallback.textContent).toBe('')
    expect(screen.getAllByText('On woods')).toHaveLength(1)
    expect(fallback.getAttribute('aria-hidden')).toBe('true')
    expect(fallback.className).toContain('no-print')
    expect(screen.queryByTestId('anthology-front')).toBeNull()
  })

  it('draws the reader\'s own cover instead of the set one', async () => {
    DETAIL.anthology = { ...DETAIL.anthology, cover_path: 'abcdef0123456789.png' }
    const { container } = open()
    await screen.findByTestId('anthology-front')
    expect(container.querySelector('.anthology-cover-fallback')).toBeNull()
    expect(container.querySelector('.anthology-poster-fallback')).not.toBeNull()
  })
})

describe('the header', () => {
  it('keeps Practise, Read and Edit as buttons and puts the once-in-a-while verbs in one menu', async () => {
    open()
    await screen.findByRole('button', { name: 'More for this anthology' })
    for (const name of ['Read', 'Edit']) expect(screen.getByRole('button', { name })).toBeTruthy()
    for (const name of ['Print', 'Save PDF', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More for this anthology' }))
    const menu = await screen.findByRole('menu')
    for (const name of ['Print', 'Save PDF', 'Delete']) expect(within(menu).getByText(name)).toBeTruthy()
  })
})

describe('the field chips', () => {
  it('press the switch the edit form has, and send every field so nothing else is reset', async () => {
    DETAIL.anthology = { ...DETAIL.anthology, show_date: true, fields: { author: true } }
    open()
    const chip = await screen.findByRole('button', { name: 'Who said it' })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    await waitFor(() => expect(CALLS.some(([m, p]) => m === 'PUT' && p === '/anthologies/1')).toBe(true))
    const [, , body] = CALLS.find(([m, p]) => m === 'PUT' && p === '/anthologies/1')
    expect(body.title).toBe('On woods')
    expect(body.intro).toBe('Two passages.')
    expect(body.hide_credit).toBe(true)
    expect(body.hide_source).toBe(false)
    expect(body.show_date).toBe(true)
    expect(body.fields).toEqual({ author: true })
  })
})

describe('the fed line', () => {
  it('says the anthology is kept fed and carries the count that takes what is waiting', async () => {
    DETAIL.anthology = { ...DETAIL.anthology, rule: 'q=thistle&tag=x', rule_auto: true }
    PREVIEW = { added: 3, skipped: 0 }
    open()
    const fed = await screen.findByTestId('anthology-fed')
    expect(fed.textContent).toContain('Kept fed by its rule')
    expect(within(fed).getByRole('button', { name: 'Add 3 waiting' })).toBeTruthy()
  })

  it('draws nothing when no rule has anything waiting', async () => {
    open()
    await screen.findByText('Two passages.')
    expect(screen.queryByTestId('anthology-fed')).toBeNull()
  })
})
