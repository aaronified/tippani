// Every accent-filled control wears the accent grain, and every grain has an off
// switch THAT WORKS.
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
// turn any of them off.
//
// HOW THIS TEST USED TO BE WRONG, WHICH IS THE REASON FOR EVERYTHING BELOW IT.
// It asserted that each selector's *text appeared inside* the contrast block, and
// then said the promise was kept. Every selector was present, every assertion
// passed, and the block did nothing: it sat in `@layer components` where
// `html[data-theme="dark"] .grain-overlay` out-specified it, three later `::before`
// rules out-ordered it, and `.topbar::before` and the whole drawer group — which
// live after the last `@layer components` closes, and so are unlayered — beat it
// however specific it was. A reader who asked their operating system for more
// contrast got the grain anyway, and a green test said otherwise.
//
// So this no longer reads the stylesheet as prose. It parses it, tracks which layer
// and which media context every declaration is in, and RESOLVES the cascade —
// importance, then layer order (reversed for important declarations, which is the
// entire trick), then specificity, then source order. Then it asserts the resolved
// value, because the resolved value is the only thing a reader can see.

import { describe, expect, it } from 'vitest'

import { CSS_TEXT as css, resolveOn as resolve, rightmost, rules } from '../css-cascade.js'

// THE CASCADE RESOLVER MOVED, and this file is where it was written. It reads the
// stylesheet, tracks which layer and which media context every declaration is in,
// and resolves importance → layer order (reversed for important declarations,
// which is the whole trick) → specificity → source order, so an assertion can be
// about the value a reader actually sees. Three other suites were matching exact
// bytes for the same kind of fact, so it now lives in `test/css-cascade.js` where
// all four can reach one copy of it.
// A TEXTURE IS NOW NAMED BY SLOT, NOT BY FILE. index.css declares every tile once
// as --tile-<material> and theme.js aliases --tile-card to whichever of them the
// chosen material set puts on the page, so a stylesheet rule says
// `background-image: var(--tile-card)` and never learns a filename. Both spellings
// count as texture here: the aliases, and the one `:root` block that still holds
// real url()s.
const isTexture = (v) => /textures\/|feTurbulence|var\(--tile-/.test(v)
const inContrast = (d) => !!d && d.media.some((m) => m.includes('prefers-contrast: more'))

// A surface is off when it is faded to nothing, or when its fill no longer names a
// tile. Both techniques are in use and both are correct: a ::before overlay can be
// faded, but a tile riding inside a `background-image` stack has no pseudo-element
// to fade and has to be replaced outright.
function offState(target) {
  const op = resolve(target, 'opacity')
  const bg = resolve(target, 'background-image')
  const faded = !!op && parseFloat(op.value) === 0
  const untiled = !!bg && !isTexture(bg.value)
  return { off: faded || untiled, op, bg, faded, untiled }
}

// ---------------------------------------------------------------------------

// Controls that carry a full accent FILL and therefore the ::before grain overlay.
//
// .btn-film is in this list now and used to be excluded from it. It was the
// film-aesthetic button, so it was rubber in both aesthetics by definition rather
// than by branch, and asserting a paper branch for it would have been asserting a
// bug. With one material per slot there is no branch to be absent from.
const GRAIN_OVERLAY = ['.btn-sticker', '.btn-film', '.tp-btn-primary', '.topbar-add-btn', '.user-chip']
// Surfaces whose grain rides inside background-image, so it cannot be faded by a
// pseudo-element and has to be replaced outright in the contrast block.
const LAYERED_FILL = ['.tp-toggle-thumb', '.tp-select-thumb', '.tp-filter-chip.active', '.drawer-item.active', '.mobile-dock-btn.active']

describe('the stylesheet parses into something worth resolving', () => {
  it('finds the contrast block, in a layer, and every declaration important', () => {
    const inside = rules.filter((r) => r.media.some((m) => m.includes('prefers-contrast: more')))
    expect(inside.length, 'the contrast block was not found').toBeGreaterThan(2)
    // Cascade placement is the whole fix. Important declarations in the earliest
    // layer beat every later layer AND every unlayered rule; a normal declaration
    // in `components` beats nothing that matters.
    const misplaced = inside.filter((r) => r.layer !== 'base')
    expect(misplaced.map((r) => r.selectors[0]), 'a contrast rule outside @layer base').toEqual([])
    const soft = []
    for (const r of inside) {
      for (const [prop, d] of Object.entries(r.decls)) {
        if (!d.important) soft.push(`${r.selectors[0]} { ${prop} }`)
      }
    }
    expect(soft, 'a contrast-mode declaration with no !important').toEqual([])
  })

  it('never smuggles a tile through the background shorthand', () => {
    // resolve() reads `background-image`, so a tile set through the `background`
    // shorthand would be invisible to every assertion below it.
    const smuggled = rules
      .filter((r) => r.decls.background && isTexture(r.decls.background.value))
      .map((r) => r.selectors[0])
    expect(smuggled, 'a texture set through the background shorthand').toEqual([])
  })
})

describe('accent-filled controls are textured', () => {
  // Two tests over all nine selectors rather than one per selector: within each
  // family the assertion is identical and only the selector changes, so the
  // collected list names every untextured control at once. The two families stay
  // APART because they assert different things — a ::before overlay against a
  // tile inside the fill — not different data.
  // Both now resolve the cascade rather than matching a selector string, so they
  // answer what a reader gets instead of what somebody typed. An accent fill is
  // furniture, so both families take the SHELL slot: --tile-shell is what the set
  // put on the bars these controls sit in.
  it('every accent fill gets the grain overlay from the shell material', () => {
    const missing = []
    for (const sel of GRAIN_OVERLAY) {
      const bg = resolve(`${sel}::before`, 'background-image', { skipContrast: true })
      if (!bg) missing.push(`${sel} has no grain layer at all`)
      else if (!bg.value.includes('var(--tile-shell)')) missing.push(`${sel} grain is ${bg.value.slice(0, 40)}`)
    }
    expect(missing, 'an accent fill with no grain on it').toEqual([])
  })

  it('every layered surface carries the same material inside its fill', () => {
    const missing = []
    for (const sel of LAYERED_FILL) {
      const bg = resolve(sel, 'background-image', { skipContrast: true })
      if (!bg) missing.push(`${sel} has no fill at all`)
      else if (!bg.value.includes('var(--tile-shell)')) missing.push(`${sel} fill is ${bg.value.slice(0, 40)}`)
    }
    expect(missing, 'a layered fill with no tile in it').toEqual([])
  })
})

describe('every texture is actually turned off, not merely mentioned', () => {
  // The list is DERIVED from the stylesheet rather than typed here, so a texture
  // added tomorrow to a surface nobody thought about is in scope the moment it
  // lands. That is the invariant the hand-written list could only approximate: it
  // asserted that ten names appeared in a block, and could say nothing at all
  // about an eleventh.
  const textured = [...new Set(
    rules.flatMap((r) => {
      const bg = r.decls['background-image']
      if (!bg || !isTexture(bg.value)) return []
      // The off switch re-declares some of these fills; it is not a surface that
      // needs switching off.
      if (r.media.some((m) => m.includes('prefers-contrast: more'))) return []
      return r.selectors.map(rightmost)
    }),
  )].sort()

  it('found the textured surfaces to check', () => {
    expect(textured.length).toBeGreaterThan(8)
  })

  it('resolves to no visible texture for every one of them', () => {
    const on = []
    for (const t of textured) {
      const s = offState(t)
      if (!s.off) {
        const beat = s.op ? `opacity ${s.op.value} from \`${s.op.sel}\` (${s.op.layer || 'unlayered'})` : 'no opacity rule'
        on.push(`${t}: ${beat}`)
      }
    }
    expect(on, 'a texture still on screen for a reader who asked for more contrast').toEqual([])
  })

  it('lets the contrast block win, rather than merely contain the selector', () => {
    // The distinction this file exists for. Every surface the block names must
    // resolve THROUGH the block; a surface that happens to be off because some
    // other rule got there first is luck, not an off switch.
    const named = [...new Set(
      rules
        .filter((r) => r.media.some((m) => m.includes('prefers-contrast: more')))
        .flatMap((r) => r.selectors.map(rightmost)),
    )]
    const lost = []
    for (const t of named) {
      const s = offState(t)
      const byBlock = (s.faded && inContrast(s.op)) || (s.untiled && inContrast(s.bg))
      if (!byBlock) lost.push(`${t}: won by \`${(s.op || s.bg || {}).sel}\` in ${(s.op || s.bg || {}).layer || 'unlayered'}`)
    }
    expect(lost, 'the contrast block names a surface it does not win').toEqual([])
  })

  it('replaces layered fills rather than trying to fade them', () => {
    // The tile is inside background-image, so there is nothing to set opacity on.
    // The winning declaration must re-declare the stack WITHOUT a tile in it.
    for (const sel of LAYERED_FILL) {
      const bg = resolve(sel, 'background-image')
      expect(bg, `${sel} has no background-image at all`).not.toBeNull()
      expect(isTexture(bg.value), `${sel} still resolves to a texture tile`).toBe(false)
    }
  })
})

describe('a selected thing wears the selected material', () => {
  it('does not tint the mobile selections with a flat accent wash', () => {
    // What both of these used to be: `color-mix(in srgb, var(--accent) 13%, transparent)`.
    // It ignored the aesthetic entirely, so a phone showed the same rectangle on
    // paper and on film while every desktop selection wore grain.
    for (const sel of ['.drawer-item.active', '.mobile-dock-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      expect(at, `${sel} rule not found`).toBeGreaterThan(-1)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} is still a flat wash`).not.toMatch(/accent\)\s*13%/)
    }
  })

  it('rides its label on the ink meant for an accent fill', () => {
    for (const sel of ['.drawer-item.active', '.mobile-dock-btn.active']) {
      const at = css.indexOf(`\n${sel} {`)
      const body = css.slice(at, css.indexOf('}', at))
      expect(body, `${sel} label colour`).toContain('var(--on-accent)')
    }
  })

  it('keeps the drawer review dot visible on the selected row', () => {
    // accent-on-accent would be a waiting deck announcing itself in the one place
    // you cannot see it.
    //
    // RESOLVED, NOT MATCHED. `\{[^}]*var\(--on-accent\)/` asserted that the ink
    // appears somewhere inside that one block — which says nothing about whether
    // that block wins, and goes red the day the declaration moves to a rule that
    // also wins. The dot's colour is what a reader sees, so ask for the colour.
    const ink = resolve('.drawer-item.active .review-dot', 'background')
      || resolve('.drawer-item.active .review-dot', 'background-color')
      || resolve('.drawer-item.active .review-dot', 'color')
    expect(ink, 'the dot on the selected row takes no colour of its own').toBeTruthy()
    expect(ink.value, 'the dot is drawn in the accent, on the accent')
      .toContain('var(--on-accent)')
  })
})
