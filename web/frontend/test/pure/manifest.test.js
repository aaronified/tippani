// The installed app's manifest.
//
// Everything here is a claim the PLATFORM reads, once, at install time — which is
// exactly why it wants a test. A shortcut naming a URL the app does not route is a
// long-press menu item that opens the home screen and looks broken; a file handler
// accepting an extension the importer cannot parse is a "open with Tippani" that
// ends in an error; and neither failure appears anywhere in the app itself.
//
// So each entry is checked against the app's own router and its own importer list,
// not against a copy of them.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsePath } from '../../src/routes.js'

const manifest = JSON.parse(
  readFileSync(join(process.env.TIPPANI_SRC, '..', 'public', 'manifest.json'), 'utf8'),
)

describe('the manifest', () => {
  it('still says what it is', () => {
    expect(manifest.name).toBe('Tippani')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
  })
})

describe('icon shortcuts', () => {
  it('offers the three a long press should offer', () => {
    expect(manifest.shortcuts.map((s) => s.short_name)).toEqual(['Capture', 'Quiz', 'Pending'])
  })

  it('names only URLs the app actually routes', () => {
    // A shortcut to a path parsePath falls through on lands on Home, silently — the
    // menu item exists, does nothing recognisable, and nothing in the app is wrong.
    for (const s of manifest.shortcuts) {
      const route = parsePath(s.url)
      expect(route, s.url).toBeTruthy()
      expect(route.tab, `${s.url} routes somewhere deliberate`).not.toBe('home__unknown')
    }
    // And specifically: each one reaches the surface it promises.
    expect(parsePath('/capture').tab).toBe('capture')
    expect(parsePath('/pending').tab).toBe('staging')
    expect(parsePath('/').tab).toBe('home')
  })

  it('gives every shortcut an icon, since a menu without one is a blank row', () => {
    for (const s of manifest.shortcuts) {
      expect(s.icons?.[0]?.src, s.short_name).toBeTruthy()
    }
  })
})

describe('file handlers', () => {
  it('lands a tapped file in import staging', () => {
    expect(manifest.file_handlers).toHaveLength(1)
    expect(parsePath(manifest.file_handlers[0].action).tab).toBe('import')
  })

  it('accepts the three shapes the importer can actually read', () => {
    // Markdown (Tippani's own export and Readest's), a Kindle My Clippings.txt, and
    // a Bookcision .json. Accepting anything else would be an "open with Tippani"
    // that ends in a parse error.
    const exts = Object.values(manifest.file_handlers[0].accept).flat()
    for (const want of ['.md', '.txt', '.json']) {
      expect(exts, want).toContain(want)
    }
  })

  it('focuses the window it already has', () => {
    // An installed app opening a second window per file is how you end up with two
    // copies of the staging queue disagreeing with each other.
    expect(manifest.launch_handler.client_mode).toBe('focus-existing')
  })
})
