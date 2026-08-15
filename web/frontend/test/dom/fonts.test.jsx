// Settings → Type.
//
// Three things go wrong quietly here. A preference the resolver does not
// recognise leaves the app with NO font, which is indistinguishable from a
// broken stylesheet. A face swapped in the stylesheet but not in the share-image
// module leaves every exported card in the old type. And changing the Bengali
// face has to rebuild the Latin stacks too, because the Indic faces live inside
// them — which is the one thing about this file that is not obvious from
// looking at it.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyFonts,
  faceFor,
  FONT_FACES,
  FONT_ROLES,
  fontChoice,
  parseFontStyles,
  prefKey,
  serialiseFontStyles,
  stackFor,
  stylePrefKey,
  stylesFor,
} from '../../src/fonts.js'

beforeEach(() => applyFonts({}))

describe('every role arrives with a face', () => {
  it('offers a built-in and two alternates for all six', () => {
    expect(FONT_ROLES.length).toBe(6)
    for (const role of FONT_ROLES) {
      expect(FONT_FACES[role.key], `${role.key} has no faces`).toBeTruthy()
      expect(FONT_FACES[role.key].length).toBe(3)
    }
  })

  // A preference that fails to resolve must never leave the app with no font.
  it('falls back to the built-in, never to nothing', () => {
    applyFonts({ fontDisplay: 'comic-sans', fontMono: '', fontHand: 'upload:999' })
    expect(fontChoice('display').id).toBe('newsreader')
    expect(fontChoice('mono').id).toBe('ibm-plex-mono')
    expect(fontChoice('hand').id).toBe('caveat')
    expect(faceFor('display', undefined).family).toBe('Newsreader')
  })

  // The complaint that started this: the built-in Bengali face changed.
  it('ships the new Indic defaults, and keeps the old ones on the list', () => {
    expect(fontChoice('bengali').family).toBe('Noto Serif Bengali')
    expect(fontChoice('devanagari').family).toBe('Noto Serif Devanagari')
    expect(FONT_FACES.bengali.map((f) => f.family)).toContain('Tiro Bangla')
    expect(FONT_FACES.devanagari.map((f) => f.family)).toContain('Tiro Devanagari Hindi')
  })
})

describe('the stacks', () => {
  // THE THING THAT IS NOT OBVIOUS. The Indic faces sit inside the Latin stacks,
  // after the Latin face — that is what makes a Bengali quote render in a chosen
  // face rather than in whatever the operating system reaches for, and it is why
  // this cannot be a per-role substitution.
  it('carry the Indic faces inside the Latin ones, after the Latin face', () => {
    const s = stackFor('display')
    expect(s.indexOf('Newsreader')).toBeLessThan(s.indexOf('Noto Serif Bengali'))
    expect(s).toContain('Noto Serif Devanagari')
    expect(stackFor('ui')).toContain('Noto Serif Bengali')
    // A note on a Bengali quote is as likely to be in Bengali as the quote is.
    expect(stackFor('hand')).toContain('Noto Serif Bengali')
  })

  it('rebuild when the Bengali face changes, not just the Bengali row', () => {
    applyFonts({ fontBengali: 'hind-siliguri' })
    expect(stackFor('bengali')).toContain('Hind Siliguri')
    expect(stackFor('display')).toContain('Hind Siliguri')
    expect(stackFor('display')).not.toContain('Noto Serif Bengali')
    expect(stackFor('ui')).toContain('Hind Siliguri')
  })

  it('leaves the mono stack out of it — code has no Bengali', () => {
    expect(stackFor('mono')).not.toContain('Bengali')
  })
})

describe('the style modifiers', () => {
  it('drops what it does not know, so a newer client cannot break an older one', () => {
    expect(parseFontStyles('bold,italic')).toEqual(['bold', 'italic'])
    expect(parseFontStyles('bold,neon,italic')).toEqual(['bold', 'italic'])
    expect(parseFontStyles('')).toEqual([])
  })

  // One selection, one spelling — otherwise "bold,italic" and "italic,bold" are
  // the same setting stored two ways and every save looks like a change.
  it('serialises in one order', () => {
    expect(serialiseFontStyles(['italic', 'bold'])).toBe('bold,italic')
    expect(serialiseFontStyles(['bold', 'italic'])).toBe('bold,italic')
  })

  // Bengali and Devanagari have no case at all, so a caps switch on those rows
  // would be a control that does nothing.
  it('does not offer caps on a script that has none', () => {
    const latin = stylesFor('display').map((s) => s.id)
    expect(latin).toContain('smallcaps')
    expect(latin).toContain('allcaps')
    const bengali = stylesFor('bengali').map((s) => s.id)
    expect(bengali).not.toContain('smallcaps')
    expect(bengali).not.toContain('allcaps')
  })

  // ASKED FOR AND DELIBERATELY ABSENT: no CSS makes a proportional face
  // monospaced, so a modifier by that name could only lie. Tabular figures is
  // the real thing behind the request and is offered under its own name.
  it('has no "monospace" modifier, and does have lining figures', () => {
    const ids = stylesFor('mono').map((s) => s.id)
    expect(ids).not.toContain('monospace')
    expect(ids).toContain('figures')
  })
})

describe('what gets written onto the page', () => {
  it('sets a stack and five modifier properties per role', () => {
    applyFonts({ fontDisplay: 'literata', fontDisplayStyle: 'bold,allcaps' })
    const st = document.documentElement.style
    expect(st.getPropertyValue('--font-display')).toContain('Literata')
    expect(st.getPropertyValue('--font-display-weight')).toBe('700')
    expect(st.getPropertyValue('--font-display-case')).toBe('uppercase')
    // OFF IS `inherit`, NOT `normal`. A heading already set to 600 must not be
    // flattened to 400 by a role nobody has touched.
    expect(st.getPropertyValue('--font-display-style')).toBe('inherit')
    expect(st.getPropertyValue('--font-ui-weight')).toBe('inherit')
  })

  it('names its preference fields the way the server does', () => {
    expect(prefKey('display')).toBe('fontDisplay')
    expect(prefKey('ui')).toBe('fontUi')
    expect(stylePrefKey('bengali')).toBe('fontBengaliStyle')
  })
})
