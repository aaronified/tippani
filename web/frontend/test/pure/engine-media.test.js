// THE THEME A PROBE ASKS FOR IS THE THEME IT GETS, OR IT IS TOLD.
//
// emulateEngineMedia used to return quietly on any value but the string 'chrome'.
// shots, surfaces and glyph-align passed the whole findBrowser result, so on Chrome
// they ran without the colour scheme or reduced motion they asked for (shots.mjs
// from 5 September, surfaces from the 19th, glyph-align from the 21st). overlay-scroll
// passed a raw TIPPANI_BROWSER; it asks for light and takes no screenshot, so under
// 'chromium' or 'Chrome' it lost only reduced motion. It now takes an engine's name
// or findBrowser's result, and throws on anything else.
//
// WHAT A TEST WRITER NEEDS TO KNOW, declared because a test here may not know a
// function's name: this file knows `emulateEngineMedia` in
// scripts/screenshots/capture.mjs, and that it calls `page.emulateMediaFeatures`.
// Nothing observable could serve: every caller in the tree passes a valid engine,
// so no run ever reaches the refusal.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const { emulateEngineMedia } = await import(pathToFileURL(join(REPO, 'scripts', 'screenshots', 'capture.mjs')).href)

const stand = () => ({ calls: [], emulateMediaFeatures(f) { this.calls.push(f) } })

describe('emulateEngineMedia', () => {
  it('emulates the scheme and reduced motion on Chrome, by name or by findBrowser result', async () => {
    for (const engine of ['chrome', { browser: 'chrome', executablePath: '/x' }]) {
      const page = stand()
      await emulateEngineMedia(page, engine, 'dark')
      expect(page.calls).toEqual([[
        { name: 'prefers-color-scheme', value: 'dark' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ]])
    }
  })

  it('asks for light when the probe names no theme, or names light', async () => {
    for (const theme of [undefined, 'light']) {
      const page = stand()
      await emulateEngineMedia(page, 'chrome', theme)
      expect(page.calls[0][0], `theme ${theme}`).toEqual({ name: 'prefers-color-scheme', value: 'light' })
    }
  })

  it('does nothing on Firefox, whose profile already carries both', async () => {
    for (const engine of ['firefox', { browser: 'firefox' }]) {
      const page = stand()
      await emulateEngineMedia(page, engine, 'dark')
      expect(page.calls).toEqual([])
    }
  })

  it('refuses anything else, rather than capture in the wrong scheme', async () => {
    for (const engine of [undefined, 'chromium', 'Chrome', {}]) {
      const page = stand()
      await expect(emulateEngineMedia(page, engine, 'dark')).rejects.toThrow(/emulateEngineMedia wants/)
      expect(page.calls).toEqual([])
    }
  })
})
