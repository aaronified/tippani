// THE ACCOUNT CHIP'S PICTURE, AND WHAT IT FALLS BACK TO.
//
// FOUR COPIES OF ONE VERB is what `avatar.jsx` replaced — the top bar, the
// drawer, the profile card, the switcher and the admin list each wrote the same
// three lines. The extraction shipped with nothing asserting it: dropping the
// `onBroken` wiring, or swapping the initial for a silhouette, left the whole
// suite green.
//
// AND THE LETTER IS THE POINT. An account is not a person in the library, so the
// six hashed silhouettes are wrong here — the initial is what this chip has
// always drawn. What the chip may not do is treat a stored PATH as a picture.
//
// AND THE CARD AROUND IT HAS TO GO WITH IT. `AvatarRow` draws "Change photo" and
// a Remove key off the STORED PATH, which is the same wrong question the chip
// had just stopped asking — so a picture whose file has gone offered to remove
// something that is not there. It listens to the chip now, and the second half
// of this file is what says so: the rating that found the chip untested counted
// three mutations and the first version of this file closed two.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `UserAvatar` takes `{ user, onBroken }` and
// draws through `Face`, which is the one component in this app that asks a
// picture whether it arrived. `AvatarRow` is not exported — it is reached
// through `Profile`, the way the screen reaches it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

let CALLS

vi.mock('../../src/api.js', async (orig) => ({
  ...(await orig()),
  json: vi.fn(async (method, path) => {
    CALLS.push([method, path])
    return { ok: true, data: { users: [], sessions: [] } }
  }),
  upload: vi.fn(async () => ({ ok: true, data: { avatar_path: 'new.jpg' } })),
}))

const { UserAvatar } = await import('../../src/avatar.jsx')
const { Profile } = await import('../../src/Account.jsx')

beforeEach(() => { CALLS = [] })
afterEach(() => cleanup())

const draw = (user, onBroken) => render(<UserAvatar user={user} onBroken={onBroken} />).container

describe('the account chip', () => {
  it('draws the picture when there is one', () => {
    const c = draw({ username: 'Aro', avatar_path: 'me.jpg' })
    expect(c.querySelector('img'), 'a stored avatar drew no picture').toBeTruthy()
    expect(c.textContent, 'the initial is drawn over the picture').toBe('')
  })

  it('and the initial where there is none — a letter, not a silhouette', () => {
    const c = draw({ username: 'Aro', avatar_path: '' })
    expect(c.textContent, 'the chip lost its initial').toBe('a')
    expect(c.querySelector('svg'), 'an account wears one of the library’s six faces').toBeNull()
  })

  it('and the initial where the picture does not arrive, not the browser’s torn page', () => {
    const c = draw({ username: 'Aro', avatar_path: 'gone.jpg' })
    fireEvent.error(c.querySelector('img'))
    expect(c.querySelector('img'), 'the failed picture is still on the screen').toBeNull()
    expect(c.textContent, 'nothing replaced the failed picture').toBe('a')
  })

  it('and tells the screen, so the controls that act on a picture can go with it', () => {
    const told = vi.fn()
    const c = draw({ username: 'Aro', avatar_path: 'gone.jpg' }, told)
    fireEvent.error(c.querySelector('img'))
    expect(told, 'the picture failed and nothing told the screen').toHaveBeenCalled()
  })

  it('and answers a nameless account rather than throwing at it', () => {
    // `?` is what the chip has always drawn for an account with no name, and the
    // extraction moved that decision — so it is asked here rather than assumed.
    expect(draw({}).textContent).toBe('?')
    expect(draw(null).textContent).toBe('?')
  })
})

// The profile card, which is where a reader acts on that picture.
describe('the photo card', () => {
  const ME = { id: 1, username: 'Aro', is_admin: false }
  const card = (avatar_path, onUser = () => {}) =>
    render(<Profile user={{ ...ME, avatar_path }} onUser={onUser} />)

  const changeKey = () => screen.queryByText(/Change photo/i)
  const uploadKey = () => screen.queryByText(/Upload photo/i)
  const removeKey = () => screen.queryByRole('button', { name: /Remove photo/i })

  it('offers Change and Remove for a picture that is there', () => {
    card('me.jpg')
    expect(changeKey(), 'a stored photo is not offered a change').toBeTruthy()
    expect(removeKey(), 'a stored photo is not offered a removal').toBeTruthy()
  })

  it('and neither for an account that has none', () => {
    card('')
    expect(uploadKey(), 'an account with no photo is not invited to add one').toBeTruthy()
    expect(removeKey(), 'there is a Remove key for a photo that does not exist').toBeNull()
  })

  it('and drops both the moment the picture turns out to be gone', () => {
    // THE DEFECT THIS GATE IS FOR: the row read the stored PATH, so a file that
    // has gone still said "Change photo" and still offered to remove it. The
    // only thing that knows is the picture itself.
    const { container } = card('gone.jpg')
    expect(changeKey(), 'the row did not start from the stored path').toBeTruthy()
    fireEvent.error(container.querySelector('img'))
    expect(changeKey(), 'a picture that never arrived is still offered as one to change').toBeNull()
    expect(uploadKey(), 'the row offers nothing at all once the picture has gone').toBeTruthy()
    expect(removeKey(), 'a photo that is not there is still offered a Remove key').toBeNull()
  })

  it('and asks the server to forget it when Remove is pressed', async () => {
    // The key is the only way an account clears its own photo, and nothing else
    // in the suite presses it.
    const told = vi.fn()
    card('me.jpg', told)
    fireEvent.click(removeKey())
    await waitFor(() => expect(CALLS).toContainEqual(['DELETE', '/auth/me/avatar']))
    await waitFor(() => expect(told, 'the screen was never told the photo went')
      .toHaveBeenCalledWith({ avatar_path: '' }))
  })

  it('and a new picture starts the question again', () => {
    // `gone` is per-path. Without the reset, uploading a replacement for a photo
    // that had failed left the row insisting there is no photo — the state would
    // outlive the file it was about.
    const { container, rerender } = card('gone.jpg')
    fireEvent.error(container.querySelector('img'))
    expect(removeKey()).toBeNull()
    rerender(<Profile user={{ ...ME, avatar_path: 'fresh.jpg' }} onUser={() => {}} />)
    expect(removeKey(), 'a replacement photo inherited the failure of the one before it').toBeTruthy()
  })
})
