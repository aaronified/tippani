// The label-collapse contract: which words a button is allowed to lose.
//
// `icon` puts a glyph before the words and wraps them in .btn-label, the one
// span index.css clips under html[data-labels="off"]. `keepLabel` opts out. The
// whole mechanism is two class names, which is why it is worth pinning: every
// way it can be wrong is a silent layout bug rather than an error.
//
// One of those bugs shipped in this file's first draft. `has-btn-icon` — the
// class that squares a collapsed button to 44px — was set by `icon ? ... : ''`,
// so a keepLabel button carrying a glyph was crushed to icon width with its
// words still inside it. It is set by `icon && !keepLabel` now, because the
// class marks a button whose words CAN disappear, not one that merely has a
// glyph.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GhostButton, IconEdit, StickerButton } from '../../src/ui.jsx'

// TIPPANI_SRC is set by vitest.config.js, which is the only place that knows the
// answer for certain: under jsdom `import.meta.url` is an http URL, and
// process.cwd() differs between `npm test` (web/frontend) and
// `npx vitest --root web/frontend` (the repo root). Both are real invocations.
const SRC = process.env.TIPPANI_SRC

const css = readFileSync(join(SRC, 'index.css'), 'utf8')

const btn = (ui) => {
  const { container } = render(ui)
  return container.querySelector('button')
}

describe('a button with no icon is untouched', () => {
  it('renders its children directly, with no label span to clip', () => {
    const b = btn(<GhostButton>Log out</GhostButton>)
    expect(b.querySelector('.btn-icon')).toBeNull()
    expect(b.querySelector('.btn-label')).toBeNull()
    expect(b.className).not.toContain('has-btn-icon')
    expect(b.textContent).toBe('Log out')
  })
})

describe('a collapsible button', () => {
  const b = () => btn(<GhostButton icon={<IconEdit />}>Edit fields</GhostButton>)

  it('wraps its words in the span the stylesheet clips', () => {
    expect(b().querySelector('.btn-label')?.textContent).toBe('Edit fields')
  })

  it('is marked as squarable', () => {
    expect(b().className).toContain('has-btn-icon')
  })

  it('keeps its words in the accessibility tree', () => {
    // Clipped, not display:none — this is the entire reason the collapse is a
    // CSS rule rather than a conditional render. An icon-only row still reads
    // as "Edit fields" instead of an unnamed button, with no aria-label to
    // bolt on and then keep in sync with the visible text.
    render(<GhostButton icon={<IconEdit />}>Edit fields</GhostButton>)
    expect(screen.getByRole('button', { name: 'Edit fields' })).toBeTruthy()
  })
})

describe('a keepLabel button', () => {
  const b = () => btn(<GhostButton icon={<IconEdit />} keepLabel>Reset all data</GhostButton>)

  it('uses the span the resolved preference does not clip', () => {
    expect(b().querySelector('.btn-label-fixed')?.textContent).toBe('Reset all data')
    expect(b().querySelector('.btn-label')).toBeNull()
  })

  it('is NOT marked as squarable', () => {
    // The bug this file was written for. With has-btn-icon, data-labels="off"
    // shrinks the button to 44px while the words are still rendered.
    expect(b().className).not.toContain('has-btn-icon')
  })

  it('IS marked as squarable by an explicit hide', () => {
    // Its counterpart, and the two must stay distinct: has-btn-icon is read by
    // [data-labels] (the resolved value) and has-fixed-label by
    // [data-labels-mode] (the raw one). One class doing both jobs would square
    // every opt-out on every phone, words and all.
    expect(b().className).toContain('has-fixed-label')
  })

  it('applies to every button base, not just the ghost', () => {
    const s = btn(<StickerButton icon={<IconEdit />} keepLabel>Update password</StickerButton>)
    expect(s.className).toContain('btn-sticker')
    expect(s.className).not.toContain('has-btn-icon')
    expect(s.querySelector('.btn-label-fixed')).not.toBeNull()
  })

  it('a button with no glyph is marked neither way', () => {
    // Nothing to square down to. A wordless text button is a blank button.
    const plain = btn(<GhostButton keepLabel>Log out</GhostButton>)
    expect(plain.className).not.toContain('has-btn-icon')
    expect(plain.className).not.toContain('has-fixed-label')
  })
})

describe('the stylesheet holds up its half', () => {
  it('clips .btn-label under data-labels="off"', () => {
    expect(css).toMatch(/html\[data-labels="off"\]\s*\.btn-label\s*\{/)
  })

  it('squares only the buttons marked squarable', () => {
    expect(css).toMatch(/html\[data-labels="off"\]\s*\.tp-btn\.has-btn-icon\s*\{/)
  })

  it('clips .btn-label-fixed under an explicit hide, and under nothing else', () => {
    // THE OPT-OUT USED TO WORK BY HAVING NO RULE AT ALL, and this test said so.
    // It now has exactly one, and which selector carries it is the whole of the
    // change: [data-labels-mode="off"] is the RAW preference, so it fires only
    // when a reader has chosen "Hide" and never when auto resolved to off on a
    // phone. A rule reached through [data-labels] — the resolved value — would
    // defeat every keepLabel in the app on every phone, which is the failure
    // this test was originally written to prevent and still is.
    const rules = css.match(/^[^{}\n]*\{/gm) || []
    const touching = rules
      .map((r) => r.trim())
      .filter((r) => /btn-label-fixed|btn-label[^-\s,{:]*\*|\^="btn-label/.test(r))
    expect(touching).toEqual(['html[data-labels-mode="off"] .btn-label-fixed {'])
  })

  it('squares the opt-outs under an explicit hide only', () => {
    expect(css).toMatch(/html\[data-labels-mode="off"\]\s*\.tp-btn\.has-fixed-label\s*\{/)
    // And never through the resolved attribute, which is on for every phone.
    expect(css).not.toMatch(/html\[data-labels="off"\][^{]*has-fixed-label/)
  })
})

// The preference has three settings and the third one had no teeth.
//
// "Auto" and "Show" always worked. "Hide" did not mean hide: a keepLabel button
// kept its words whatever the reader chose, because the opt-out was written
// against the RESOLVED value and there was nothing in the DOM that could tell
// "the reader asked for glyphs" apart from "auto resolved to off". So the app
// had a setting whose most explicit option it partly ignored, in exactly the
// cases it had decided were important — which is the definition of a preference
// in name only.
describe('the raw preference reaches the DOM', () => {
  const html = () => document.documentElement

  it.each([
    ['auto', 'auto'],
    ['on', 'on'],
    ['off', 'off'],
  ])('%s is written as data-labels-mode', async (pref, expected) => {
    const { applyLabels } = await import('../../src/theme.js')
    applyLabels(pref)
    expect(html().dataset.labelsMode).toBe(expected)
  })

  it('still resolves the concrete value beside it', async () => {
    const { applyLabels } = await import('../../src/theme.js')
    applyLabels('on')
    expect(html().dataset.labels).toBe('on')
    applyLabels('off')
    expect(html().dataset.labels).toBe('off')
    // Auto resolves against the breakpoint, so it is on or off but never 'auto'.
    applyLabels('auto')
    expect(['on', 'off']).toContain(html().dataset.labels)
    expect(html().dataset.labelsMode).toBe('auto')
  })
})
