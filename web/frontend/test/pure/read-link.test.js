// What a pasted address is read AS, before it is committed — handoff §1.3.
//
// A key and a URL are one fact written twice, and the panel's promise is that it
// says which it made of what you typed before you press +. So the reading is a
// pure function and is tested as one: a box that decides silently is a box you
// check afterwards every time, and a box that decides WRONG silently is worse.
import { describe, expect, it } from 'vitest'
import { readLink } from '../../src/workLinks.jsx'

describe('reading a pasted link', () => {
  // A HOSTNAME IS MATCHED, NOT A SUBSTRING. "imdb.com.example.org" is somebody
  // else's domain, and a link filed under IMDb's name because its name appears
  // in the string would be the app vouching for a site it has not looked at.
  it('matches the host and not the text', () => {
    expect(readLink('https://imdb.com.example.org/x').slug).toBe('')
    expect(readLink('https://example.org/imdb.com/x').slug).toBe('')
  })
})
