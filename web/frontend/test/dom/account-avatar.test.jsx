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
// WHAT A TEST WRITER NEEDS TO KNOW: `UserAvatar` takes `{ user, onBroken }` and
// draws through `Face`, which is the one component in this app that asks a
// picture whether it arrived.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { UserAvatar } from '../../src/avatar.jsx'

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
