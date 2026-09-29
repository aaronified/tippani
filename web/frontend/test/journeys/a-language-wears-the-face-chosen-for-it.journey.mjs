// A reader chooses a face for German, and their German quote is drawn in it.
//
// WHAT WENT WRONG (#43). The per-language rules were written into a <style> element,
// and the app's own Content-Security-Policy, which has no style-src, refuses the text
// of a <style> a page writes. So every face a reader chose for a language was dropped,
// with a console error on each load and nothing on screen, and the quote stayed in the
// default face. It shipped that way from 12 September.
//
// THE MUTATION. Put fonts.js's writeSheet back to the <style> element alone and this
// goes red: the quote's face is the default, not Literata. It has to be BUILT to bite,
// since this tier runs the real binary and its policy.
//
// SETUP USES THE API, and knows these addresses and fields: POST /quotes with `quote`,
// `language` and `speaker`, reading the new row's `id` (or `utterance.id`) from the
// answer; PUT /auth/me/preferences with `fontsByLanguage`, a JSON string keyed by the
// folded language, as the language picker would store it; and DELETE /quotes/:id. Both
// are undone afterwards so the file ends as it began; the server and its database are
// this file's own. THE FACE IS READ THROUGH `page`, the harness's escape hatch, because no verb
// says what face a word is drawn in, and there is nothing else on the screen to read:
// the words are the same words in either face.

import { afterAll, expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const SENTENCE = 'Wer immer strebend sich bemüht, den können wir erlösen.'
let made = null

afterAll(async () => {
  await app.setup('PUT', '/auth/me/preferences', { fontsByLanguage: '' })
  if (made) await app.setup('DELETE', `/quotes/${made}`)
})

it('a German quote is drawn in the face the reader chose for German', async () => {
  const q = await app.setup('POST', '/quotes', { quote: SENTENCE, language: 'German', speaker: 'Goethe' })
  made = q?.id ?? q?.utterance?.id ?? null
  await app.setup('PUT', '/auth/me/preferences', { fontsByLanguage: JSON.stringify({ german: 'literata' }) })
  await app.goto('/quotes')
  await app.press('All quotes')
  await app.see(SENTENCE)
  const face = await app.page.evaluate((s) => {
    const el = [...document.querySelectorAll('body *')]
      .find((n) => n.childElementCount === 0 && n.textContent.trim() === s)
    return el ? getComputedStyle(el).fontFamily : ''
  }, SENTENCE)
  expect(face).toContain('Literata')
})
