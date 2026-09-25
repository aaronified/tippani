// ONE ACCESSIBILITY TREE PER LOOK: the harness's promise about its own cost.
//
// WHY THIS IS A TEST OF A FUNCTION AND NOT A JOURNEY. The journeys cannot tell the
// broken versions from the fixed one. A cache that swapped `send` in and out around
// each look passed all 114 journeys, and so did this one, because the failure only
// shows when two looks overlap: a journey that timed out keeps polling while the
// next one starts, and when the look started later also finished last, it put
// back the earlier look's wrapper, still holding that look's tree, for the rest of
// the file. That is a property of the function, so the function is what this
// drives.
//
// WHAT A TEST WRITER NEEDS TO KNOW, declared because a test here may not know a
// function's name: this file knows `oneTreePerLook` in
// scripts/screenshots/capture.mjs, and the one piece of Puppeteer wiring it
// relies on, that `page.accessibility.snapshot` sends Accessibility.getFullAXTree
// through `page.mainFrame().client`, and that Puppeteer's Firefox browser says
// `cdpSupported: false`. The page below is a stand-in with that shape and nothing
// else. Nothing observable could serve instead: the browser gives the
// same names either way, which is the point.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const { oneTreePerLook } = await import(pathToFileURL(join(REPO, 'scripts', 'screenshots', 'capture.mjs')).href)

// A page whose snapshots go through its frame's client, as Puppeteer's do, and
// which counts how many whole trees the client was actually asked for.
function chromePage() {
  const page = { trees: 0 }
  const client = {
    async send(method) {
      if (method === 'Accessibility.getFullAXTree') page.trees++
      await new Promise((r) => setTimeout(r, 5))
      return { nodes: [] }
    },
  }
  page.mainFrame = () => ({ client })
  page.accessibility = {
    async snapshot() {
      await client.send('Accessibility.getFullAXTree', {})
      return { role: 'button', name: 'Save' }
    },
  }
  page.client = client
  return page
}

const later = (ms) => new Promise((r) => setTimeout(r, ms))

describe('one accessibility tree per look', () => {
  it('asks for one tree however many controls the look names', async () => {
    const page = chromePage()
    await oneTreePerLook(page, async (snapshot) => {
      for (let i = 0; i < 5; i++) await snapshot({})
    })
    expect(page.trees, 'five controls cost five trees, so the look is paying per control again').toBe(1)
  })

  it('gives two overlapping looks a tree each, and leaves the page live after both', async () => {
    const page = chromePage()
    // The later-started look finishes last: the order that used to leave the
    // first look's wrapper, and its tree, installed on the page.
    await Promise.all([
      oneTreePerLook(page, async (snapshot) => { await snapshot({}) }),
      later(1).then(() => oneTreePerLook(page, async (snapshot) => { await snapshot({}); await later(20); await snapshot({}) })),
    ])
    expect(page.trees, 'two looks, two trees').toBe(2)
    await page.client.send('Accessibility.getFullAXTree', {})
    await oneTreePerLook(page, async (snapshot) => { await snapshot({}) })
    expect(page.trees, 'a call outside a look and a later look were served a cached tree').toBe(4)
  })

  it('says so when Puppeteer stops sending through the frame it knows', async () => {
    const page = chromePage()
    page.accessibility.snapshot = async () => ({ role: 'button', name: 'Save' })
    await expect(oneTreePerLook(page, async (snapshot) => { await snapshot({}) }))
      .rejects.toThrow(/no longer sends Accessibility.getFullAXTree/)
  })

  it('asks again after a refused tree, inside the same look', async () => {
    const page = chromePage()
    const send = page.client.send
    let refuse = true
    page.client.send = async function (method, params) {
      if (method === 'Accessibility.getFullAXTree' && refuse) {
        refuse = false
        page.trees++
        throw new Error('Target closed')
      }
      return send.call(this, method, params)
    }
    await oneTreePerLook(page, async (snapshot) => {
      await expect(snapshot({})).rejects.toThrow(/Target closed/)
      await snapshot({})
    })
    expect(page.trees, 'a refused tree was kept, so the rest of the look was served the refusal').toBe(2)
  })

  // Puppeteer's Firefox page, as it is built: its frame DOES have a client, whose
  // send refuses, and its browser says so. A page with no client at all is a shape
  // no Puppeteer page has.
  it('refuses Firefox, whose frame has a session that cannot send', async () => {
    const page = chromePage()
    page.browser = () => ({ protocol: 'webDriverBiDi', cdpSupported: false })
    page.client.send = async () => { throw new Error('CDP support is required for this feature.') }
    await expect(oneTreePerLook(page, async (snapshot) => { await snapshot({}) }))
      .rejects.toThrow(/needs a page with a CDP session/)
  })
})
