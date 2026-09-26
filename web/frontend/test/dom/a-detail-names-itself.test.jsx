// A THING OPEN INSIDE A SCREEN SAYS WHAT IT IS, on a desk as well as a phone.
//
// WHAT WAS WRONG. Since 3.0.0 a page's own <h1> is visually hidden, on the grounds
// that the breadcrumb names the page on a desk and the shell header on a phone.
// Both print the title a detail publishes, and an anthology published none, so an
// open anthology showed its name nowhere: "Anthologies" in a phone's header, and
// on a desk no breadcrumb at all, because a crumb with no leaf is not drawn. An
// open board of quotes lost its breadcrumb on a desk the same way, and a Settings
// section's crumb could never draw, since a section publishes no title either.
//
// WHY THE STORE AND THE CRUMB, NOT THE PAGE'S TEXT. The hidden <h1> is still in
// the document, so "the name is on the page" passes with the defect in place:
// jsdom does not apply the stylesheet that takes it off the screen. What the
// reader sees is what the shell prints, so these read the publication the shell
// subscribes to, and the breadcrumb it draws from it.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraph above; that the anthology
// screen's default export takes the open id; and that the breadcrumb is exported
// from App.jsx beside the rail and the drawer, which are tested the same way.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCrumbTitle } from '../../src/ui.jsx'

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    if (method === 'GET' && path === '/anthologies/2') {
      return { ok: true, data: { anthology: { id: 2, title: 'Arguments with faith', intro: '', rule: '', rule_auto: false }, entries: [] } }
    }
    if (method === 'GET' && path === '/anthologies') return { ok: true, data: { anthologies: [] } }
    return { ok: true, data: {} }
  }),
}))

afterEach(cleanup)

describe('an open anthology', () => {
  it('publishes its name for the breadcrumb and the phone header', async () => {
    const { default: AnthologiesPage } = await import('../../src/anthologies.jsx')
    let crumb = null
    const Probe = () => { crumb = useCrumbTitle(); return null }
    render(<><AnthologiesPage openId={2} onOpen={() => {}} onClose={() => {}} /><Probe /></>)
    await waitFor(() => expect(crumb).toBe('Arguments with faith'))
  })
})

describe('the breadcrumb over a detail', () => {
  const crumbs = () => within(screen.getByRole('navigation'))

  it('roots an anthology in Anthologies and ends at its name', async () => {
    const { Breadcrumb } = await import('../../src/App.jsx')
    render(<Breadcrumb tab="anthologies" detail={{ type: 'anthology', id: 2 }} title="Arguments with faith" crumb={null} onRoot={() => {}} />)
    expect(crumbs().getByRole('button', { name: 'Anthologies' })).toBeTruthy()
    expect(crumbs().getByText('Arguments with faith')).toBeTruthy()
  })

  it('roots a board of quotes in Quotes', async () => {
    const { Breadcrumb } = await import('../../src/App.jsx')
    render(<Breadcrumb tab="quotes" detail={{ type: 'board', id: 1 }} title="Proverbs" crumb={null} onRoot={() => {}} />)
    expect(crumbs().getByRole('button', { name: 'Quotes' })).toBeTruthy()
    expect(crumbs().getByText('Proverbs')).toBeTruthy()
  })

  it('draws a section as Settings, then the section, with Settings the way back up', async () => {
    const { Breadcrumb } = await import('../../src/App.jsx')
    const onRoot = vi.fn()
    render(<Breadcrumb tab="settings" detail={{ type: 'section', id: 'review' }} title={null} crumb={{ label: 'Review' }} onRoot={onRoot} />)
    crumbs().getByRole('button', { name: 'Settings' }).click()
    expect(onRoot).toHaveBeenCalledWith('settings')
    expect(crumbs().getByText('Review')).toBeTruthy()
  })
})
