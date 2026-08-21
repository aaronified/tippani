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
  hasScript,
  scriptProbe,
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
  verifyUpload,
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

  // THIS ASSERTION USED TO RUN THE OTHER WAY, and the reason it flipped is worth
  // keeping. It read "leaves the mono stack out of it — code has no Bengali",
  // which was true about half of what the role does: --font-mono is also what
  // MonoLabel draws with, and MonoLabel is a UI label — the bin's keep-for row, a
  // diff's column heads, the shortcut sheet's headings, every small-caps chip.
  // Those are words, and once the interface spoke Bengali they were Bengali words
  // falling through to whatever face the OS reached for, in the middle of a
  // typography system the reader had chosen every other part of. locale.jsx
  // carried the gap as a named TODO for exactly as long as it took the migration
  // to make it visible.
  it('carries the Indic faces in the mono stack too — a mono LABEL is words', () => {
    const s = stackFor('mono')
    expect(s).toContain('Bengali')
    expect(s).toContain('Devanagari')
    // After the Latin face, or its Latin subset wins and the face stops being
    // monospaced; before the generics, or `monospace` catches Bengali first and
    // we are back to an OS guess.
    expect(s.indexOf('IBM Plex Mono')).toBeLessThan(s.indexOf('Bengali'))
    expect(s.indexOf('Bengali')).toBeLessThan(s.indexOf('ui-monospace'))
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

describe('the script check on an uploaded font', () => {
  // Replace the Bengali face with something that has no Bengali in it and every
  // Bengali quote turns into boxes, silently. The check exists to say so.
  it('probes the script the role actually needs', () => {
    expect(scriptProbe('bengali')).toMatch(/[ঀ-৿]/)
    expect(scriptProbe('devanagari')).toMatch(/[ऀ-ॿ]/)
    // A role with no script of its own is checked against Latin.
    expect(scriptProbe('display')).toBe(scriptProbe('latin'))
  })

  // UNDECIDABLE IS NOT A FAILURE. jsdom has no canvas, so this is also the path
  // every test in this file runs on — and the rule it pins is the one that
  // matters on a real browser too: "I could not check" must never render as
  // "your font is wrong".
  it('answers null rather than false when it cannot measure', () => {
    expect(hasScript('Nothing At All', 'bengali')).toBe(null)
    expect(verifyUpload('Nothing At All', 'bengali')).toBe(null)
  })
})
