// A PRESS THAT IS STILL WORKING SAYS SO. The credit chip's press asks the server to file a row for a
// credit that has none and then loads the person screen's chunk; neither has a ceiling, and nothing
// on the chip changed meanwhile, so a slow press looked dead. After a beat it says "Opening…". A press
// that opens at once never shows it, and a slow one says it once.
import { useMemo, useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/identity.jsx', () => ({
  personPanel: (_stack, arg) => ({ title: arg.name, render: () => null }),
}))

let RELEASE
let ENSURE_DELAYED
vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: async (method, path) => {
    if (path === '/people/ensure') {
      if (ENSURE_DELAYED) await new Promise((r) => { RELEASE = r })
      return { ok: true, data: { id: 99, name: 'Herman Melville' } }
    }
    return { ok: true, data: {} }
  },
}))

const SAID = []
vi.mock('../../src/ui.jsx', async (orig) => ({
  ...(await orig()),
  toast: (msg) => SAID.push(msg),
}))

const { usePersonOpener } = await import('../../src/personOpen.jsx')

function Harness() {
  const [opened, setOpened] = useState(0)
  const stack = useMemo(() => ({ open: () => setOpened((n) => n + 1) }), [])
  const open = usePersonOpener(stack)
  return (
    <>
      <button type="button" onClick={() => open({ kind: 'author', name: 'Herman Melville' })}>press</button>
      <output data-testid="opened">{opened}</output>
    </>
  )
}

beforeEach(() => {
  SAID.length = 0
  ENSURE_DELAYED = false
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('a credit press that takes a while', () => {
  it('says Opening… once, after a beat, and not again when it lands', async () => {
    ENSURE_DELAYED = true
    render(<Harness />)
    await act(async () => { screen.getByText('press').click() })
    expect(SAID).toEqual([])
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(SAID).toEqual(['Opening…'])
    await act(async () => { RELEASE(); await vi.advanceTimersByTimeAsync(10) })
    expect(screen.getByTestId('opened').textContent).toBe('1')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(SAID).toEqual(['Opening…'])
  })

  it('says nothing when it opens at once', async () => {
    render(<Harness />)
    await act(async () => { screen.getByText('press').click(); await vi.advanceTimersByTimeAsync(10) })
    expect(screen.getByTestId('opened').textContent).toBe('1')
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(SAID).toEqual([])
  })
})
