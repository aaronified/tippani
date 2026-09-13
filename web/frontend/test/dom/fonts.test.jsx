// Settings → Type.
//
// Three things go wrong quietly here. A preference the resolver does not
// recognise leaves the app with NO font, which is indistinguishable from a
// broken stylesheet. A face swapped in the stylesheet but not in the share-image
// module leaves every exported card in the old type. And changing the Bengali
// face has to rebuild the Latin stacks too, because the Indic faces live inside
// them — which is the one thing about this file that is not obvious from
// looking at it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { SRC } from '../src-files.js'
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
  it('offers a built-in and at least two alternates for all six', () => {
    // THE FLOOR IS THREE, NOT EXACTLY THREE, and the difference is the whole point
    // of this assertion. It used to read `toBe(3)`, which described what happened
    // to be there rather than what has to be true: every role arrives with a face,
    // and a reader who dislikes it has somewhere to go. A role gaining a fourth is
    // not a regression — §6 gave display and ui an accessibility face — so a test
    // that failed on it was reporting a decision as a defect.
    expect(FONT_ROLES.length).toBe(6)
    for (const role of FONT_ROLES) {
      expect(FONT_FACES[role.key], `${role.key} has no faces`).toBeTruthy()
      expect(FONT_FACES[role.key].length, `${role.key} offers no alternates`).toBeGreaterThanOrEqual(3)
      // An id is the preference VALUE, so two faces sharing one inside a role would
      // make a stored choice ambiguous.
      const ids = FONT_FACES[role.key].map((f) => f.id)
      expect(new Set(ids).size, `${role.key} has a duplicate face id`).toBe(ids.length)
    }
  })

  it('and only one face is offered on more than one role', () => {
    // NAMED SO IT CANNOT QUIETLY BECOME A PATTERN. Faces are grouped by the job
    // they do — serifs for reading, sans for the interface — and a face in two
    // lists is a claim that it does both jobs. OpenDyslexic is the one that makes
    // that claim, and it makes it for a reason that is not about taste: a reader
    // who needs it to read a quote needs it to read the navigation as well. The
    // preference is still per role, so choosing it for one does not touch the
    // other.
    const seen = {}
    for (const role of FONT_ROLES) {
      for (const f of FONT_FACES[role.key]) (seen[f.id] ||= []).push(role.key)
    }
    const shared = Object.entries(seen).filter(([, roles]) => roles.length > 1)
    expect(Object.fromEntries(shared), 'a face is offered on roles this guard has not been told about')
      .toEqual({ opendyslexic: ['display', 'ui'] })
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

// ---- the accessibility face (§6 access) --------------------------------------
//
// THE PLAN'S OWN VERIFICATION ROW asks for one thing above the rest: the face has
// to reach the QUOTE text and not only the interface. A dyslexia face that styled
// the navigation and left a reader's own words in Newsreader would be the feature
// failing at exactly the place it exists for — and it would LOOK like it worked,
// because the app would visibly change.
//
// THE GAP IT CLOSES IS AN OFFER, NOT A CAPABILITY. Uploading a font has worked
// since 0039, so a reader who already knows about OpenDyslexic could always have
// it. What they could not do is find it without knowing to look.
describe('the dyslexia face', () => {
  const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

  it('reaches the quote, which is the whole requirement', () => {
    applyFonts({ fontDisplay: 'opendyslexic' })
    expect(fontChoice('display').family).toBe('OpenDyslexic')
    // The stack the quote text actually draws through, head first — a face further
    // down is a fallback, not a choice.
    expect(stackFor('display').startsWith("'OpenDyslexic'"),
      `the quote stack leads with ${stackFor('display').slice(0, 40)}`).toBe(true)
  })

  it('and the interface too, without either choice touching the other', () => {
    // Two roles, one family, two independent preferences. A reader may want it for
    // their own words and keep the interface as it was, or the reverse.
    applyFonts({ fontUi: 'opendyslexic' })
    expect(stackFor('ui').startsWith("'OpenDyslexic'")).toBe(true)
    expect(stackFor('display').startsWith("'OpenDyslexic'"),
      'choosing it for the interface changed the quote as well').toBe(false)

    applyFonts({ fontDisplay: 'opendyslexic' })
    expect(stackFor('display').startsWith("'OpenDyslexic'")).toBe(true)
    expect(stackFor('ui').startsWith("'OpenDyslexic'"),
      'choosing it for the quote changed the interface as well').toBe(false)
  })

  it('is BUNDLED rather than fetched, in every weight it ships', () => {
    // fonts.js's own standing rule: "Tippani never contacts the network on its own
    // — no telemetry, no CDN, no phone-home — and a type picker that loaded Google
    // Fonts would be the first thing in the app that did." A face named in the
    // picker and not imported here would be a silent fallback to a system font,
    // which reads as the setting not working.
    const main = src('main.jsx')
    for (const w of ['400', '700', '400-italic', '700-italic']) {
      expect(main, `@fontsource/opendyslexic/${w}.css is not imported`)
        .toContain(`@fontsource/opendyslexic/${w}.css`)
    }
    expect(readFileSync(join(SRC, '..', 'package.json'), 'utf8'),
      'the face is offered but not a dependency, so a fresh checkout would not have it')
      .toContain('"@fontsource/opendyslexic"')
  })
})
