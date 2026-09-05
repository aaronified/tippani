// A filter chip that can carry a glyph and lose its words.
//
// The search screen's scope row is six controls above a search box, and on a
// 320px phone six words do not fit. The fix is not a new collapse: it is the one
// the app already has — `.btn-icon` + `.btn-label`, clipped by the single rule
// under html[data-labels="off"], resolved auto→on/off once in theme.js against the
// 768px breakpoint, with its preference already sitting in Settings → Appearance.
//
// SO WHAT IS PINNED HERE IS THAT THE CHIP REUSES THAT MECHANISM RATHER THAN
// ANSWERING THE SAME QUESTION TWICE. A chip row that collapsed on its own measured
// width, or on a media query of its own, would look identical on the day it landed
// and disagree with every button in the app the day either was touched. The
// assertions are therefore about class names, which is an odd-looking thing to
// test until you notice that the class names ARE the contract: `.btn-label` is
// what the stylesheet clips, and `has-btn-icon` is what squares the box.
//
// The keepLabel half matters as much as the collapsing half. `All` is the default
// scope and the way back from a narrowed search, and a glyph is a thing you have
// to have learned already — so it keeps its three characters at every width, and
// must NOT carry the class that squares a chip to a glyph's width while its words
// are still inside it. That exact bug shipped once on buttons (see
// button-labels.test.jsx) which is why it is checked on chips before it can.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FilterChip, IconBooks, filterChipClass } from '../../src/ui.jsx'
import { valueOf } from '../css-cascade.js'

const css = readFileSync(join(process.env.TIPPANI_SRC, 'index.css'), 'utf8')

const chip = (ui) => {
  cleanup()
  const { container } = render(ui)
  return container.querySelector('button')
}

describe('a chip with no glyph', () => {
  it('is exactly the chip it always was', () => {
    // Every existing filter row passes no icon, so the shape they render must not
    // have changed at all — no wrapper spans, nothing to clip.
    const b = chip(<FilterChip label="wishlist" onClick={() => {}} />)
    expect(b.className).toBe(filterChipClass(false))
    expect(b.querySelector('.btn-icon')).toBeNull()
    expect(b.querySelector('.btn-label')).toBeNull()
    expect(b.textContent).toBe('wishlist')
  })

  it('carries the pressed state a toggle needs', () => {
    expect(chip(<FilterChip label="x" active />).getAttribute('aria-pressed')).toBe('true')
    expect(chip(<FilterChip label="x" />).getAttribute('aria-pressed')).toBe('false')
    expect(chip(<FilterChip label="x" active />).className).toContain('active')
  })
})

describe('a chip that can lose its words', () => {
  const b = () => chip(<FilterChip icon={<IconBooks />} label="Books" />)

  it('wraps them in the span the stylesheet already clips', () => {
    expect(b().querySelector('.btn-label')?.textContent).toBe('Books')
    expect(b().querySelector('.btn-icon svg')).toBeTruthy()
  })

  it('is marked squarable', () => {
    expect(b().className).toContain('has-btn-icon')
  })

  it('keeps its words in the accessibility tree', () => {
    // Clipped, not display:none. An icon-only scope row still reads as "Books"
    // rather than as an unnamed button, with no aria-label to keep in sync.
    cleanup()
    render(<FilterChip icon={<IconBooks />} label="Books" />)
    expect(screen.getByRole('button', { name: 'Books' })).toBeTruthy()
  })

  it('names itself in a bubble, because that is the only label left on a phone', () => {
    cleanup()
    render(<FilterChip icon={<IconBooks />} label="Books" tooltip="Search books only" />)
    expect(document.querySelector('.tp-tip-wrap')).toBeTruthy()
  })

  it('still fires its click through the tooltip wrapper', () => {
    // The Tooltip wraps the button, so a chip that gained a bubble and lost its
    // click would look completely fine.
    const onClick = vi.fn()
    cleanup()
    render(<FilterChip icon={<IconBooks />} label="Books" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Books' }))
    expect(onClick).toHaveBeenCalled()
  })
})

describe('a keepLabel chip', () => {
  const b = () => chip(<FilterChip icon={<IconBooks />} keepLabel label="All" />)

  it('uses the span that has no clip rule', () => {
    expect(b().querySelector('.btn-label-fixed')?.textContent).toBe('All')
    expect(b().querySelector('.btn-label')).toBeNull()
  })

  it('is NOT marked squarable', () => {
    // The bug this borrows from buttons: with has-btn-icon, data-labels="off"
    // shrinks the chip to a glyph's width while its words are still rendered.
    expect(b().className).not.toContain('has-btn-icon')
  })

  it('gets no bubble, having nothing a bubble would explain', () => {
    cleanup()
    render(<FilterChip icon={<IconBooks />} keepLabel label="All" />)
    expect(document.querySelector('.tp-tip-wrap')).toBeNull()
  })
})

describe('the stylesheet holds up its end', () => {
  it('clips .btn-label without scoping it to a button', () => {
    // This is what lets a chip opt in by rendering the same two spans. Scope the
    // rule to `.tp-btn` and the chips silently stop collapsing.
    expect(css).toMatch(/html\[data-labels="off"\] \.btn-label \{/)
  })

  it('squares a collapsed chip at the chip’s own size, not a button’s', () => {
    // 34px, because a chip is 34 at rest and squaring it to a button's 44 would
    // make the scope row taller than the controls beside it.
    const rule = css.match(/html\[data-labels="off"\] \.tp-filter-chip\.has-btn-icon \{[^}]*\}/)
    expect(rule, 'no squaring rule for a collapsed chip').toBeTruthy()
    expect(rule[0]).toMatch(/width:\s*34px/)
  })

  it('raises that to a thumb’s 44px on a phone, where the chips already are', () => {
    // The phone block sets .tp-filter-chip to 44 tall; a 34-wide, 44-tall glyph
    // chip is not square, and squares are what a row of glyphs has to be.
    // THE VALUE, NOT ITS BYTES. This matched the rule with its spaces and its
    // semicolon in place — reformat the stylesheet and it goes red having caught
    // nothing, and a width that changed inside a differently-spelled rule would
    // leave it green. `test/css-cascade.js` resolves what actually wins.
    expect(valueOf('html[data-labels="off"] .tp-filter-chip.has-btn-icon', 'width'),
      'a glyph-only filter chip is not a thumb wide').toBe('44px')
  })
})
