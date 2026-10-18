// A PERSON'S SIGNATURE SLOT, AS A READER USES IT.
//
// What a person would say: I upload a photo of a signature and see it cleaned
// before anything is kept; the slider changes how much of the paper counts as ink;
// ✓ keeps it and ✕ throws it away; Fetch from Wikidata offers theirs the same way,
// or says there is none; Remove takes it off.
//
// WHAT THIS KNOWS, declared because a test here may not know the code: the slot's
// own props (the record's id, name and stored signature, and what to call when
// something changed), the words on the screen, and the addresses the server is
// pressed at — the network is mocked, because a test may not reach a server. It
// does not know which component draws the preview or what a class is called.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let PREVIEWS
let SAVES
let CALLS
let FETCH_ANSWER

const PNG = 'data:image/png;base64,iVBORw0KGgo='

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path, body) => {
    CALLS.push([method, path, body])
    if (path.endsWith('/signature/fetch')) return { ok: true, data: FETCH_ANSWER }
    return { ok: true, data: {} }
  }),
  upload: vi.fn(async (path, file, fields) => {
    if (path.endsWith('/signature/preview')) {
      PREVIEWS.push({ path, file, fields })
      return { ok: true, data: { image: PNG, kind: 'png' } }
    }
    SAVES.push({ path, file, fields })
    return { ok: true, data: { signature_path: '0123456789abcdef.png' } }
  }),
}))

const { SignatureSlot } = await import('../../src/signature.jsx')
const { ToastHost } = await import('../../src/ui.jsx')
const { t } = await import('../../src/i18n.js')

const draw = (over = {}) => {
  const props = { id: 7, name: 'Jane Solo', path: '', busy: false, onChanged: vi.fn(), onError: vi.fn(), ...over }
  // The toast host is the screen's, not the slot's: "nothing to offer" is said there.
  render(<><SignatureSlot {...props} /><ToastHost /></>)
  return props
}

const aFile = () => new File([new Uint8Array(600)], 'signature.png', { type: 'image/png' })
const chooseFile = () => {
  const input = document.querySelector('input[type="file"]')
  expect(input, 'the slot offers no way to choose a file').toBeTruthy()
  fireEvent.change(input, { target: { files: [aFile()] } })
}
const tick = () => [...document.querySelectorAll('button')].find((b) => b.getAttribute('type') === 'submit')

beforeEach(() => {
  PREVIEWS = []
  SAVES = []
  CALLS = []
  FETCH_ANSWER = { found: true, image: PNG }
  // THE BROWSER REFUSES A FETCH OF A data: URL: the page's CSP has no connect-src, so it is held to
  // 'self'. This stub used to ANSWER one with a blob, which is how a Fetch that did nothing in a
  // browser passed here. It refuses as the browser does, so only a picture decoded without fetch gets through.
  globalThis.fetch = vi.fn(async (u) => {
    if (String(u).startsWith('data:')) throw new TypeError('Failed to fetch')
    return { blob: async () => new Blob([new Uint8Array(600)], { type: 'image/png' }) }
  })
})
afterEach(() => cleanup())

describe('the signature slot', () => {
  it('says there is none yet and offers to add one, with nothing to remove', () => {
    draw()
    expect(screen.getByText(t('identity.signature.none'))).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(t('identity.signature.upload.label')) })).toBeTruthy()
    expect(screen.queryByRole('button', { name: new RegExp(t('identity.signature.clear.label')) })).toBeNull()
  })

  it('shows an upload cleaned before anything is saved, and ✓ keeps it', async () => {
    const props = draw()
    chooseFile()
    await waitFor(() => expect(PREVIEWS.length).toBe(1))
    expect(SAVES, 'the preview saved something').toEqual([])
    // The reader sees the cleaned signature, then ✓ is armed.
    await screen.findByRole('img', { name: t('identity.signature.aria', { name: 'Jane Solo' }) })
    await waitFor(() => expect(tick()?.disabled).toBeFalsy())

    await act(async () => { tick().click() })
    await waitFor(() => expect(SAVES.length).toBe(1))
    expect(SAVES[0].path).toBe('/people/id/7/signature')
    expect(SAVES[0].fields.source, 'an upload is the reader\'s own, so it names no supplier').toBeUndefined()
    expect(props.onChanged).toHaveBeenCalledTimes(1)
  })

  it('✕ throws the upload away without saving', async () => {
    const props = draw()
    chooseFile()
    await screen.findByRole('img', { name: t('identity.signature.aria', { name: 'Jane Solo' }) })
    await act(async () => { screen.getByRole('button', { name: t('common.action.close.label') }).click() })
    expect(SAVES).toEqual([])
    expect(props.onChanged).not.toHaveBeenCalled()
    expect(document.querySelector('input[type="range"]'), 'the dialog is still open').toBeNull()
  })

  it('the ink slider cleans the same file again at the strength chosen', async () => {
    draw()
    chooseFile()
    await waitFor(() => expect(PREVIEWS.length).toBe(1))
    expect(PREVIEWS[0].fields.strength).toBe('0.5')

    const slider = await screen.findByRole('slider', { name: t('identity.signature.ink.label') })
    fireEvent.change(slider, { target: { value: '0.8' } })
    fireEvent.pointerUp(slider)
    await waitFor(() => expect(PREVIEWS.length).toBe(2))
    expect(PREVIEWS[1].fields.strength).toBe('0.8')
    expect(PREVIEWS[1].file).toBe(PREVIEWS[0].file)

    // And what is kept is what was last shown.
    await waitFor(() => expect(tick()?.disabled).toBeFalsy())
    await act(async () => { tick().click() })
    await waitFor(() => expect(SAVES.length).toBe(1))
    expect(SAVES[0].fields.strength).toBe('0.8')
  })

  it('Fetch from Wikidata offers theirs in the same dialog, and keeping it credits Wikidata', async () => {
    draw()
    await act(async () => {
      screen.getByRole('button', { name: new RegExp(t('identity.signature.fetch.label')) }).click()
    })
    await waitFor(() => expect(PREVIEWS.length).toBe(1))
    expect(CALLS.some(([m, p]) => m === 'POST' && p === '/people/id/7/signature/fetch')).toBe(true)
    expect(SAVES, 'a fetch the reader has not accepted saved something').toEqual([])

    await waitFor(() => expect(tick()?.disabled).toBeFalsy())
    await act(async () => { tick().click() })
    await waitFor(() => expect(SAVES.length).toBe(1))
    expect(SAVES[0].fields.source).toBe('wikidata')
  })

  it('says so, and opens nothing, when Wikidata has no signature to offer', async () => {
    FETCH_ANSWER = { found: false }
    draw()
    await act(async () => {
      screen.getByRole('button', { name: new RegExp(t('identity.signature.fetch.label')) }).click()
    })
    await screen.findByText(t('identity.signature.fetch.none'))
    expect(PREVIEWS).toEqual([])
    expect(document.querySelector('input[type="range"]')).toBeNull()
  })

  it('Remove takes a signature off, by the record\'s own update', async () => {
    const props = draw({ path: '0123456789abcdef.png' })
    await act(async () => {
      screen.getByRole('button', { name: new RegExp(t('identity.signature.clear.label')) }).click()
    })
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1))
    expect(CALLS).toContainEqual(['PUT', '/people/id/7', { clear_signature: true }])
  })
})
