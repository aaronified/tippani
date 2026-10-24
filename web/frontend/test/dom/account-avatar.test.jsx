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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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

  it('and the initial where the picture does not arrive, not the browser’s torn page', () => {
    const c = draw({ username: 'Aro', avatar_path: 'gone.jpg' })
    fireEvent.error(c.querySelector('img'))
    expect(c.querySelector('img'), 'the failed picture is still on the screen').toBeNull()
    expect(c.textContent, 'nothing replaced the failed picture').toBe('a')
  })

})

// The profile card, which is where a reader acts on that picture.

