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

// process.cwd(), not import.meta.url: under jsdom `import.meta.url` is an http
// URL (the page's origin), so readFileSync rejects it. Vitest runs from
// web/frontend, which is also where `npm test` runs from.
const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8')

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

  it('uses the span that has no clip rule', () => {
    expect(b().querySelector('.btn-label-fixed')?.textContent).toBe('Reset all data')
    expect(b().querySelector('.btn-label')).toBeNull()
  })

  it('is NOT marked as squarable', () => {
    // The bug this file was written for. With has-btn-icon, data-labels="off"
    // shrinks the button to 44px while the words are still rendered.
    expect(b().className).not.toContain('has-btn-icon')
  })

  it('applies to every button base, not just the ghost', () => {
    const s = btn(<StickerButton icon={<IconEdit />} keepLabel>Update password</StickerButton>)
    expect(s.className).toContain('btn-sticker')
    expect(s.className).not.toContain('has-btn-icon')
    expect(s.querySelector('.btn-label-fixed')).not.toBeNull()
  })
})

describe('the stylesheet holds up its half', () => {
  it('clips .btn-label under data-labels="off"', () => {
    expect(css).toMatch(/html\[data-labels="off"\]\s*\.btn-label\s*\{/)
  })

  it('squares only the buttons marked squarable', () => {
    expect(css).toMatch(/html\[data-labels="off"\]\s*\.tp-btn\.has-btn-icon\s*\{/)
  })

  it('has no rule that would clip .btn-label-fixed', () => {
    // The opt-out works by having no rule at all. A selector matching it — even
    // an attribute-prefix one like [class^="btn-label"] — would silently defeat
    // every keepLabel in the app.
    const rules = css.match(/^[^{}\n]*\{/gm) || []
    const offending = rules.filter((r) => /btn-label-fixed|btn-label[^-\s,{:]*\*|\^="btn-label/.test(r))
    expect(offending).toEqual([])
  })
})
