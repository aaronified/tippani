// EVERY PICTURE THE APP KEEPS IS FRAMED THE SAME WAY — and the two surfaces that were
// not the covers' or the faces' are the ones this file holds to it: the profile photo
// (drawn as a circle, like any face) and a board's picture (drawn 3:2).
//
// What a person would say: I chose a picture of the wrong shape and a frame opened
// showing what the app will draw; backing out kept nothing; keeping stored what I
// framed; a picture that already fits went straight in; and a stored picture can be
// reframed. What the test knows, declared: the addresses the pictures go to
// (POST /auth/me/avatar, POST /boards/{id}/cover), and that jsdom decodes nothing, so
// the browser's Image is stubbed to give a picture the size a case names.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { t } from '../../src/i18n.js'

let SENT

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async () => ({ ok: true, data: { users: [], sessions: [] } })),
  upload: vi.fn(async (path) => {
    SENT.push(path)
    return { ok: true, data: { avatar_path: 'new.jpg' } }
  }),
  uploadWithProgress: vi.fn(async (path) => {
    SENT.push(path)
    return { ok: true, data: { image_path: 'new.jpg' } }
  }),
}))

const { Profile } = await import('../../src/Account.jsx')
const { BoardForm } = await import('../../src/boards.jsx')

const picturesAre = (w, h) => {
  vi.stubGlobal('Image', class {
    set src(_) {
      this.naturalWidth = w
      this.naturalHeight = h
      setTimeout(() => this.onload?.())
    }
  })
  HTMLCanvasElement.prototype.toBlob = (done) => done(new Blob(['framed'], { type: 'image/jpeg' }))
}
const chooseFile = async () => {
  const input = document.querySelector('input[type="file"]')
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
}
// The tick of the frame dialog itself — the screen under it may have ticks of its own.
const tick = () => document.querySelector('button[type="submit"][form="' + document.querySelector('form.frame-form')?.id + '"]')
const keepTheFraming = async () => {
  await screen.findByRole('slider', { name: t('frame.zoom.label') })
  await waitFor(() => expect(tick()?.disabled).toBe(false))
  await act(async () => { tick().click() })
}

beforeEach(() => { SENT = [] })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the profile photo', () => {
  const ME = { id: 1, username: 'Aro', is_admin: false }
  const card = (avatar_path = '', onUser = () => {}) => render(<Profile user={{ ...ME, avatar_path }} onUser={onUser} />)

  it('is shown in its circle before it is kept, and nothing is kept yet', async () => {
    picturesAre(1600, 701)
    card()
    await chooseFile()
    await screen.findByText(/^Frame — Aro/)
    expect(screen.queryByText(/dimmed part is cut off/), 'the dialog does not say what the circle cuts away').toBeTruthy()
    expect(SENT.length, 'the photo was kept before it had been framed').toBe(0)
  })

  it('keeps nothing when the reader backs out', async () => {
    picturesAre(1600, 701)
    card()
    await chooseFile()
    await screen.findByText(/^Frame — Aro/)
    await act(async () => { screen.getByRole('button', { name: t('common.action.close.label') }).click() })
    expect(SENT.length, 'a photo the reader refused was kept anyway').toBe(0)
  })

  it('keeps what the reader framed', async () => {
    picturesAre(1600, 701)
    const told = vi.fn()
    card('', told)
    await chooseFile()
    await screen.findByText(/^Frame — Aro/)
    await keepTheFraming()
    await waitFor(() => expect(SENT).toEqual(['/auth/me/avatar']))
    await waitFor(() => expect(told).toHaveBeenCalledWith({ avatar_path: 'new.jpg' }))
  })

  it('goes straight in when it is already square', async () => {
    picturesAre(900, 900)
    card()
    await chooseFile()
    await waitFor(() => expect(SENT).toEqual(['/auth/me/avatar']))
    expect(screen.queryByText(/^Frame — /), 'a square photo was sent to the editor').toBeNull()
  })

  it('can be reframed once there is one', async () => {
    picturesAre(900, 900)
    card('me.jpg')
    await act(async () => { screen.getByRole('button', { name: t('frame.reframe.label') }).click() })
    await screen.findByText(/^Frame — Aro/)
  })
})

describe('a board’s picture', () => {
  const form = (initial, onSubmit = vi.fn()) => {
    render(<BoardForm initial={initial} onSubmit={onSubmit} onCancel={() => {}} existingNames={[]} />)
    return onSubmit
  }

  it('is shown in its 3:2 frame before it is kept', async () => {
    picturesAre(900, 900)
    form({ id: 3, name: 'Shelf', image_path: '' })
    await chooseFile()
    await screen.findByText(/^Frame — Shelf/)
    expect(screen.queryByText(/3:2/), 'the dialog does not say the shape it will be drawn at').toBeTruthy()
    expect(SENT.length, 'the picture was kept before it had been framed').toBe(0)
  })

  it('keeps what the reader framed, and does not save the board by it', async () => {
    // The dialog is a portal and React carries its events up to the form it was opened
    // from, so framing a picture once also submitted the board.
    picturesAre(900, 900)
    const onSubmit = form({ id: 3, name: 'Shelf', image_path: '' })
    await chooseFile()
    await screen.findByText(/^Frame — Shelf/)
    await keepTheFraming()
    await waitFor(() => expect(SENT).toEqual(['/boards/3/cover']))
    expect(onSubmit, 'framing the picture saved the board').not.toHaveBeenCalled()
  })

  it('keeps nothing when the reader backs out', async () => {
    picturesAre(900, 900)
    form({ id: 3, name: 'Shelf', image_path: '' })
    await chooseFile()
    await screen.findByText(/^Frame — Shelf/)
    await act(async () => { screen.getByRole('button', { name: t('common.action.close.label') }).click() })
    expect(SENT.length).toBe(0)
  })

  it('goes straight in when it is already 3:2', async () => {
    picturesAre(1500, 1000)
    form({ id: 3, name: 'Shelf', image_path: '' })
    await chooseFile()
    await waitFor(() => expect(SENT).toEqual(['/boards/3/cover']))
    expect(screen.queryByText(/^Frame — /)).toBeNull()
  })

  // KEEPING A PICTURE UNMOVED CHANGES NOTHING, so it must not be re-encoded and uploaded: that
  // loses a little quality and replaces the picture's supplier credit with the reader's, for no
  // change at all.
  it('keeps nothing when a stored picture is reframed and left as it is', async () => {
    picturesAre(900, 900)
    form({ id: 3, name: 'Shelf', image_path: 'shelf.jpg' })
    await act(async () => { screen.getByRole('button', { name: t('frame.reframe.label') }).click() })
    await screen.findByText(/^Frame — Shelf/)
    await screen.findByRole('slider', { name: t('frame.zoom.label') })
    await waitFor(() => expect(tick()?.disabled).toBe(false))
    await act(async () => { tick().click() })
    await waitFor(() => expect(screen.queryByText(/^Frame — /)).toBeNull())
    expect(SENT.length, 'an unmoved picture was re-uploaded').toBe(0)
  })

  it('keeps the picture once it has been moved in its frame', async () => {
    picturesAre(900, 900)
    form({ id: 3, name: 'Shelf', image_path: 'shelf.jpg' })
    await act(async () => { screen.getByRole('button', { name: t('frame.reframe.label') }).click() })
    await screen.findByText(/^Frame — Shelf/)
    await screen.findByRole('slider', { name: t('frame.zoom.label') })
    // A square in a 3:2 frame has room to move up and down.
    await act(async () => { fireEvent.keyDown(screen.getByRole('group', { name: /Frame for/ }), { key: 'ArrowDown' }) })
    await waitFor(() => expect(tick()?.disabled).toBe(false))
    await act(async () => { tick().click() })
    await waitFor(() => expect(SENT).toEqual(['/boards/3/cover']))
  })

  it('can be reframed once there is one', async () => {
    picturesAre(900, 900)
    form({ id: 3, name: 'Shelf', image_path: 'shelf.jpg' })
    await act(async () => { screen.getByRole('button', { name: t('frame.reframe.label') }).click() })
    await screen.findByText(/^Frame — Shelf/)
  })
})
