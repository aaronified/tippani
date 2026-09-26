// A reader on an instance with single sign-on signs out, and the sign-in form
// offers the provider's button straight away.
//
// WHY THIS EXISTS. The owner, of Authelia: "I linked it and then signed out. the
// login screen did not show the authelia option right away, i had to refresh
// once." The app asked the server for its provider only when a page opened
// signed out. Signing out swaps the screen in place, with no reload, so a page
// that opened signed in came back to a sign-in form that had never been told.
//
// THE PROVIDER CANNOT BE REACHED, AND DOES NOT NEED TO BE. The server offers the
// button from its configuration alone and dials the provider only when the
// button is pressed, which this journey never does.
//
// THE MUTATION. Delete the effect in App that asks for the status when a session
// ends, and "Sign in with Authelia" never appears after Log out.
//
// It knows the words on the screen, plus one declared exception: the three
// settings an operator writes to switch single sign-on on, because nothing on a
// screen can configure a provider.

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp({
  env: {
    TIPPANI_OIDC_ISSUER: 'http://127.0.0.1:9',
    TIPPANI_OIDC_CLIENT_ID: 'tippani',
    TIPPANI_OIDC_NAME: 'Authelia',
  },
})

it('signing out offers the sign-on provider without a reload', async () => {
  // A page that OPENS signed in, which is the case that lost the button: a
  // sign-in form reached through the form itself had already been told.
  await app.goto('/profile')
  await app.see('Log out')

  await app.press('Log out')
  await app.see('Sign in with Authelia')

  expect(app.pageErrors(), 'the page threw on the way').toEqual([])
})
