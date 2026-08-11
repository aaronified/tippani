// Every accent-filled control wears the accent grain, and every grain has an off
// switch.
//
// Two invariants, and both fail silently. A new accent-filled control that nobody
// remembers to texture looks *fine* — it is the right colour, the right size, in
// the right place — and only reads as wrong beside the ones that are textured. That
// is how the ＋ Add pill, the top-bar search and help pills, the user chip, and both
// mobile selection states ended up as flat colour while every comparable control
// carried leather or rubber.
//
// The second is worse, because it is an accessibility promise. index.css drops every
// decorative layer under `prefers-contrast: more` and `prefers-reduced-transparency:
// reduce`, and its own comment says why that rule was written when it was: the
// alternative was shipping a release that added six textured surfaces with no way to
// turn any of them off. A texture added without a matching entry in that block is
// exactly that regression, and nothing on screen says so unless you are the person
// who asked for less.
//
// So this reads the stylesheet as text. It is coarse on purpose — it does not care
// what the surfaces look like, only that the two lists agree.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const css = readFileSync(join(SRC, 'index.css'), 'utf8')

// The contrast/reduced-transparency block, sliced out by its opening at-rule.
const CONTRAST_AT = '@media (prefers-contrast: more), (prefers-reduced-transparency: reduce) {'
const contrastBlock = (() => {
  const start = css.indexOf(CONTRAST_AT)
  if (start < 0) return ''
  // Brace-match from the at-rule's own opening brace.
  let depth = 0
  for (let i = start + CONTRAST_AT.length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(start, i + 1)
    }
  }
  return ''
})()

// Controls that carry a full accent FILL and therefore the ::before grain overlay,
// leather on paper and rubber on film.
//
// .btn-film is deliberately absent from this list and present in the off-switch one
// below: it is the film-aesthetic button, so it is rubber in BOTH aesthetics by
// definition rather than by branch. Asserting a paper branch for it would be
// asserting a bug.
const GRAIN_OVERLAY = ['.btn-sticker', '.tp-btn-primary', '.topbar-add-btn', '.user-chip']
const GRAIN_OVERLAY_ALL = [...GRAIN_OVERLAY, '.btn-film']
// Surfaces whose grain rides inside background-image, so it cannot be faded by a
// pseudo-element and has to be replaced outright in the contrast block.
const LAYERED_FILL = ['.tp-toggle-thumb', '.tp-select-thumb', '.tp-filter-chip.active', '.drawer-item.active', '.mobile-bottom-nav-btn.active']

describe('the contrast block exists at all', () => {
  it('is found and is not empty', () => {
    expect(contrastBlock.length).toBeGreaterThan(200)
  })
})

describe('accent-filled controls are textured', () => {
  it.each(GRAIN_OVERLAY)('%s gets the grain overlay in both aesthetics', (sel) => {
    // fabric on paper, rubber on film — the two halves of the same rule.
    expect(css, `${sel} paper grain`).toMatch(
      new RegExp(`html\\[data-aesthetic="paper"\\]\\s*${sel.replace('.', '\\.')}::before`),
    )
    expect(css, `${sel} film grain`).toMatch(
      new RegExp(`html\\[data-aesthetic="film"\\]\\s*${sel.replace('.', '\\.')}::before`),
    )
  })

  it.each(LAYERED_FILL)('%s carries a texture tile in its fill', (sel) => {
    const esc = sel.replace(/\./g, '\\.')
    expect(css, `${sel} paper tile`).toMatch(new RegExp(`html\\[data-aesthetic="paper"\\][^{]*${esc}[^{]*\\{[^}]*fabric\\.webp`))
    expect(css, `${sel} film tile`).toMatch(new RegExp(`html\\[data-aesthetic="film"\\][^{]*${esc}[^{]*\\{[^}]*rubber\\.webp`))
  })
})

describe('every texture can be turned off', () => {
  it.each(GRAIN_OVERLAY_ALL)('%s::before is faded under prefers-contrast', (sel) => {
    expect(contrastBlock).toContain(`${sel}::before`)
  })

  it.each(LAYERED_FILL)('%s has its layered fill replaced under prefers-contrast', (sel) => {
    expect(contrastBlock).toContain(sel)
  })

  it('replaces layered fills rather than trying to fade them', () => {
    // The tile is inside background-image, so there is nothing to set opacity on.
    // The block must re-declare the stack WITHOUT a .webp in it.
    const replacements = contrastBlock.split('background-image:').slice(1)
    expect(replacements.length).toBeGreaterThan(0)
    for (const r of replacements) {
      const decl = r.slice(0, r.indexOf(';'))
      expect(decl, 'a contrast-mode fill still references a texture tile').not.toMatch(/\.webp/)
    }
  })
})

describe('a selected thing wears the selected material', () => {
  it('does not tint the mobile selections with a flat accent wash', () => {
    // What both of these used to be: `color-mix(in srgb, var(--accent) 13%, transparent)`.
    // It ignored the aesthetic entirely, so a phone showed the same rectangle on
    // paper and on film while every desktop selection wore grain.
    for (const sel of ['.drawer-item.active', '.mobile-bottom-nav-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      expect(at, `${sel} rule not found`).toBeGreaterThan(-1)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} is still a flat wash`).not.toMatch(/accent\)\s*13%/)
    }
  })

  it('rides its label on the ink meant for an accent fill', () => {
    for (const sel of ['.drawer-item.active', '.mobile-bottom-nav-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} label colour`).toContain('var(--on-accent)')
    }
  })

  it('keeps the drawer review dot visible on the selected row', () => {
    // accent-on-accent would be a waiting deck announcing itself in the one place
    // you cannot see it.
    expect(css).toMatch(/\.drawer-item\.active \.review-dot \{[^}]*var\(--on-accent\)/)
  })
})
