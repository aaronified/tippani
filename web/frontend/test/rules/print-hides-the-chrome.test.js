// THE PRINT STYLESHEET HIDES EVERY BAR THE APP HAS (roadmap §15).
//
// WHAT GOES WRONG WITHOUT THIS. A print block that hides chrome by naming it is
// only as true as the day it was written: the next sticky bar somebody adds is
// printed on top of the first page of every document, over the words, and nobody
// finds out until a reader prints something. There is no automated way to see it —
// the app looks correct on screen and the test suite is green.
//
// SO THE LIST IS NOT THIS FILE'S TO INVENT. index.css already has one: the group
// that takes `isolation: isolate`, whose own comment says "Every one of them is
// already sticky or fixed; isolation is the only thing that had to be added."
// That makes it the file's existing answer to "what is chrome", maintained for a
// different reason and therefore not something anyone can forget to update while
// adding a bar — a bar that skips it draws its tile behind the page, which IS
// visible on screen. This test only holds the print rule to it.
//
// `.to-top` AND `.tp-scrim` ARE EXTRA, not from that group: a floating button and
// a modal wash are not isolated (they have nothing tiled behind them) and are
// just as unwelcome on paper. They are asserted separately, by name, because
// their being here is this rule's own decision rather than a consequence of the
// group.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const CSS = readFileSync(join(ROOT, 'web', 'frontend', 'src', 'index.css'), 'utf8')

// The isolation group — and there is MORE THAN ONE `isolation: isolate` rule in
// this stylesheet, which is why this is anchored on the sentence rather than on
// the declaration. The first match is `.btn-film, .tp-btn-primary,
// .topbar-add-btn, .user-chip`: controls that isolate so an accent fill does not
// bleed, and nothing to do with chrome. Written naively, this test demanded that
// the print block hide every primary button on the page — which it caught itself
// doing on the first run.
const CHROME_MARKER = 'Every one of them is already sticky or fixed'
const isolationGroup = () => {
  const after = CSS.split(CHROME_MARKER)[1] || ''
  const m = after.match(/([^{}]+)\{\s*isolation:\s*isolate;\s*\}/)
  if (!m) return []
  return m[1].split(',').map((s) => s.trim()).filter((s) => s.startsWith('.'))
}

// The print block's `display: none` rule — the selector list before it.
const printHidden = () => {
  const block = CSS.split('PAPER — the print stylesheet')[1] || ''
  const m = block.match(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/)
  if (!m) return []
  return m[1].split(',').map((s) => s.trim()).filter((s) => s.startsWith('.'))
}

describe('paper shows the document and not the app', () => {
  it('finds both lists, so a silent no-match cannot pass this file', () => {
    // A regex that stops matching is how a guard like this dies: it goes on
    // passing over two empty arrays and nobody hears from it again.
    expect(CSS).toContain(CHROME_MARKER)
    expect(isolationGroup().length).toBeGreaterThan(4)
    expect(printHidden().length).toBeGreaterThan(4)
  })

  it('hides every bar that is sticky or fixed', () => {
    const missing = isolationGroup().filter((sel) => !printHidden().includes(sel))
    expect(missing, 'these are sticky or fixed and would print over the page').toEqual([])
  })

  it('hides the floating button, the modal wash, and the per-screen opt-out', () => {
    for (const sel of ['.to-top', '.tp-scrim', '.no-print']) {
      expect(printHidden()).toContain(sel)
    }
  })

  it('forces a light palette, because a dark theme prints white on black', () => {
    // theme.js writes the palette as INLINE custom properties, so these have to be
    // `!important` to reach the page at all. The failure this catches is somebody
    // tidying the `!important` away: the rule stays, stops working, and the only
    // symptom is an emptied cartridge.
    const block = CSS.split('PAPER — the print stylesheet')[1] || ''
    for (const token of ['--bg', '--card', '--ink', '--line']) {
      expect(block).toMatch(new RegExp(`${token}:\\s*#[0-9A-Fa-f]{3,8}\\s*!important`))
    }
  })
})
