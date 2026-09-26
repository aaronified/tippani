// WHEN THE DATABASE DOOR REFUSES, THE READER IS TOLD, NOT SIGNED OUT.
//
// Issue #40's state, seen from the browser: the server's /api door answers 503
// with code TIP-HTTP-002 when no database connection comes free, and the request
// changed nothing. The app used to read that at boot as "no session" and show the
// sign-in form, whose own sign-in the door then refused: about twenty seconds of
// nothing, then the wrong screen. Now any request that meets the refusal puts up
// the busy screen, which steps aside once /healthz answers again.
//
// WHAT IT KNOWS, declared: the server's answers, faked at fetch, because nothing
// on a screen puts a server's database into that state; and that the busy screen
// polls every five seconds, which the fake clock advances. What is asserted is
// what a reader sees.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

const BUSY = { error: "Tippani's database is not answering, so this request changed nothing.", code: 'TIP-HTTP-002' }
const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let healthy
let realLocation
beforeEach(() => {
  healthy = false
  realLocation = window.location
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload: vi.fn(), search: '' } })
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url)
    if (u.endsWith('/healthz')) return new Response('', { status: healthy ? 200 : 503 })
    return answer(503, BUSY)
  })
})
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  vi.useRealTimers()
})

describe('a boot the database door refuses', () => {
  it('shows the busy screen instead of the sign-in form, and reloads once the database answers', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { default: App } = await import('../../src/App.jsx')
    render(<App />)
    const dialog = await screen.findByRole('alertdialog', { name: 'Busy for a moment' })
    expect(dialog.textContent).toMatch(/wasn't saved/)
    expect(dialog.textContent).toMatch(/TIP-HTTP-002/)
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull()

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(window.location.reload, 'reloaded while the database was still refusing').not.toHaveBeenCalled()
    healthy = true
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(window.location.reload).toHaveBeenCalled()
  })
})

describe('any request', () => {
  it('raises the busy signal on the door\'s refusal and on nothing else', async () => {
    const { json } = await import('../../src/api.js')
    const { onDatabaseBusy } = await import('../../src/databaseBusy.js')
    const heard = vi.fn()
    const stop = onDatabaseBusy(heard)
    await json('GET', '/books')
    expect(heard).toHaveBeenCalledTimes(1)
    globalThis.fetch = vi.fn(async () => answer(503, { error: 'no movie-lookup key configured' }))
    await json('POST', '/movies/lookup', { title: 'Stalker' })
    expect(heard, 'a 503 without the code raised it too').toHaveBeenCalledTimes(1)
    stop()
  })
})
