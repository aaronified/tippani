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

})
