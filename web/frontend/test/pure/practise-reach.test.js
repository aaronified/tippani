// "Quiz me on this book" reaches the screen you would ask it from.
//
// THE ENGINE WAS NEVER THE MISSING PART. `review_theme.go` has taken `?book=`
// and `?movie=` since themed practice shipped, `usePractice()` exists with a
// doc-comment whose example is literally
//
//     <button onClick={() => practise({ book: id, label: title })}>Practise</button>
//
// and the action registry carries a Practise entry marked works-only. All of it
// was wired from a person's panel and from a colour tile on Stats — and from
// nowhere on the one screen that is entirely about a single work.
//
// A source-level test, like icon-imports and favourite-tools, because the defect
// was an ABSENCE: nothing rendered, nothing threw, and no behavioural test can
// fail on a button that was never there. Reading the screens is what catches it.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { value } from '../locale-file.js'

const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const read = (f) => readFileSync(join(SRC, f), 'utf8')

// The fourth column is the key namespace the screen's own words live under — `book`
// for the Library's work page, `film` for the Catalogue's. The label used to be the
// English in the source and the assertion matched it; it is a key now, so the
// assertion matches the key and the WORDS are checked once, below, against
// internal/i18n/en.txt. That split is the point: this file is about a control
// existing at both widths, and a copy edit should never look like a missing button.
const SCREENS = [
  ['Library.jsx', 'book', 'book', 'book'],
  ['Movies.jsx', 'movie', 'movie', 'film'],
]

describe('every work-detail screen can start a themed round', () => {
  for (const [file, themeKey, noun, place] of SCREENS) {
    const src = read(file)

    it(`${file} takes the hook`, () => {
      expect(src).toMatch(/const \{ practise, practiceDialog \} = usePractice\(\)/)
      // The hook returns a dialog, and a dialog nobody renders is a button that
      // does nothing — which is the failure mode this pair is most likely to hit
      // when copied to a third screen.
      expect(src, `${file} renders practiceDialog`).toMatch(/\{practiceDialog\}/)
      expect(src, `${file} imports it`).toMatch(/import \{ usePractice \} from '\.\/review\.jsx'/)
    })

    it(`${file} themes the round on this ${noun}`, () => {
      const re = new RegExp(`practise\\(\\{ ${themeKey}: ${noun}\\.id, label: ${noun}\\.title \\}\\)`)
      expect(src).toMatch(re)
    })

    // Both widths. The mobile bar REPLACES the desktop one, so a control added
    // to only the hero row is missing on a phone entirely — the same gap that
    // left work-details with no Search until 1.15.3.
    it(`${file} offers it on desktop and on a phone`, () => {
      const inMenu = src.includes(`label: t('${place}.practise.menu.label')`)
      const inHero = src.includes(`ariaLabel={t('${place}.practise.aria')}`)
      expect(inMenu, `${file}: missing from the phone's ⋯ menu`).toBe(true)
      expect(inHero, `${file}: missing from the desktop hero row`).toBe(true)
    })

    it(`${place}.practise.* says what the control does`, () => {
      // The words, once, in the file that holds them. A key with nothing written
      // for it renders "Aria" or "Label" — which is a button that exists at both
      // widths and still teaches nobody anything.
      for (const role of ['aria', 'menu.label', 'tip']) {
        expect(value(`${place}.practise.${role}`), `${place}.practise.${role}`).toMatch(/^(Practise|Quiz me on) /)
      }
    })
  }
})
