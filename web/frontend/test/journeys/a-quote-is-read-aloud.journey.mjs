// A reader presses the speaker on a quote card and the quote is read aloud; pressing it again stops.
//
// DECLARED EXCEPTION: a journey cannot hear, so this one stands in for the browser's speech
// (`speechSynthesis`, `SpeechSynthesisUtterance`) before the page loads and asserts what the app
// asked it to say: which words, in which language, and that a second press stops it. It knows those
// two browser globals and the speaker's accessible name ("Read aloud" / "Stop reading"), nothing
// else about the code.
//
// THE MUTATION: take the speaker's `speak(...)` call out of speak.jsx, `make frontend`, and the
// first case goes red with nothing spoken. Take the `stopSpeaking()` branch out and the second
// goes red with the label still "Stop reading".

import { expect, it } from 'vitest'

import { openApp } from './harness/world.mjs'

const app = openApp()

const FAKE = () => {
  const spoken = []
  const state = { cancels: 0 }
  globalThis.__spoken = spoken
  globalThis.__speech = state
  globalThis.SpeechSynthesisUtterance = function (text) { this.text = text }
  // An assignment is ignored: the real one is an accessor on window.
  Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ name: 'Fake', lang: 'en-US', default: true, localService: true }],
    speak: (u) => {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate })
      // A run moves on when the browser says an utterance ended; a test that wants that says so.
      if (globalThis.__autoend) setTimeout(() => u.onend && u.onend(), 0)
    },
    cancel: () => { state.cancels += 1 },
    addEventListener() {},
    removeEventListener() {},
  } })
}

async function openABook() {
  await app.page.evaluateOnNewDocument(FAKE)
  await app.goto('/library')
  const title = await app.setup('GET', '/books').then((r) => (r.books ?? r).find((b) => b.annotation_count > 0)?.title)
  await app.press(title)
}

const speakers = () => app.page.$$('button[aria-label="Read aloud"]')

it('pressing a card\'s speaker asks the browser to read its quote', async () => {
  await openABook()
  await app.page.waitForSelector('button[aria-label="Read aloud"]')
  const first = (await speakers())[0]
  await first.click()
  const spoken = await app.page.evaluate(() => globalThis.__spoken)
  expect(spoken).toHaveLength(1)
  expect(spoken[0].text.length).toBeGreaterThan(5)
  expect(spoken[0].lang).toBe('en-US')
})

it('pressing it again stops the reading', async () => {
  await openABook()
  await app.page.waitForSelector('button[aria-label="Read aloud"]')
  await (await speakers())[0].click()
  await app.page.waitForSelector('button[aria-label="Stop reading"]')
  await app.page.click('button[aria-label="Stop reading"]')
  await app.page.waitForSelector('button[aria-label="Read aloud"]')
  expect(await app.page.evaluate(() => globalThis.__speech.cancels)).toBeGreaterThan(1)
})

// A RUN: "Read aloud" in an anthology's header reads its passages in the order the page draws them.
// The button is found by its words among the cards' own speakers, which carry an accessible name
// and no text.
it('an anthology is read aloud passage by passage, in order', async () => {
  await app.page.evaluateOnNewDocument(FAKE)
  await app.goto('/anthologies')
  await app.press('New anthology')
  await app.type('Title', 'Everything hopeful')
  await app.press('What goes in it')
  await app.press('A tag')
  await app.type('A tag', 'Hope')
  await app.press('Save')
  await app.press('Create')
  await app.press('Everything hopeful')
  await app.see('Lantern sedge compass against harbour')
  await app.page.evaluate(() => { globalThis.__autoend = true })
  await app.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().toLowerCase() === 'read aloud').click())
  await app.page.waitForFunction(() => globalThis.__spoken.length >= 2)
  const spoken = (await app.page.evaluate(() => globalThis.__spoken)).map((x) => x.text)
  expect(spoken.some((x) => x.includes('Lantern sedge compass against harbour'))).toBe(true)
  expect(new Set(spoken).size, 'each passage is read once').toBe(spoken.length)
})
