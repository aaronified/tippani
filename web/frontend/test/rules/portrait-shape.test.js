// A FACE IS A CIRCLE AND A WORK IS A RECTANGLE.
//
// The owner's rule, and it is in CLAUDE.md: "work images are rectangle, which is
// fine, but people and character images should be circles. Consistency is key."
//
// WHY A SWEEP AND NOT A CASE PER SITE. The failure is one of OMISSION: the app
// had eleven portraits and the character screens' five were already round, so
// nothing looked wrong until the metadata consoles were put beside them on a
// phone and a 2:3 character sat in a column of circles. The next portrait will be
// added by somebody who has not read this paragraph, and only a sweep catches it.
//
// IT IS DERIVED FROM THE STYLESHEET, NOT FROM A LIST. A hand-written list of the
// classes to check is a list that goes stale the day a twelfth portrait is added
// under a new name — which is exactly the case this exists for. The set is every
// rule whose selector follows the repo's own portrait naming (`person-`, `char-`,
// `cast-`, `cred-` plus `face`/`portrait`/`photo`/`thumb`), so a new one is
// covered by being named the way its neighbours are.
//
// MUTATION-VERIFIED: putting `aspect-ratio: 3 / 4` back on `.person-face-btn img`
// fails the first case, and `border-radius: 4px` fails the second.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { cssRules } from '../css-rules.js'

const SRC = process.env.TIPPANI_SRC
const CSS = readFileSync(join(SRC, 'index.css'), 'utf8')

// The naming convention a portrait in this app follows. `.tp-media-face`,
// `.board-tile-face` and `.trash-face` are the front of a TILE rather than
// somebody's face, and none of them carries one of these four prefixes — which
// is why the prefix is part of the test and not just the word "face".
const PORTRAIT = /\.(person|char|cast|cred)[a-z0-9-]*-(face|portrait|photo|thumb)\b/

// A picture, as opposed to a wrapper that only positions one. These are the
// declarations that say "something is drawn in this box".
const DRAWS = /(object-fit:\s*cover|overflow:\s*hidden)/

const portraits = () => cssRules(CSS).filter((r) => PORTRAIT.test(r.sel))

const decl = (body, prop) => {
  const m = body.match(new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;}]+)`))
  return m ? m[1].trim() : null
}

describe('every portrait of a person or a character', () => {
  it('there are some, so this test is testing something', () => {
    // The sweep's own failure mode — a regex that stops matching asserts nothing
    // about an empty list, and passes for ever while the rule rots.
    expect(portraits().length).toBeGreaterThan(8)
  })

  it('is square, so the circle on it is a circle and not an egg', () => {
    const oblong = portraits()
      .map((r) => [r.sel, decl(r.body, 'aspect-ratio')])
      .filter(([, ar]) => ar && !/^1(\s*\/\s*1)?$/.test(ar))
      .map(([sel, ar]) => `${sel} (${ar})`)
    expect(oblong, 'these draw a face in a rectangle').toEqual([])
  })

  it('and where it declares its own width and height, they are the same', () => {
    const uneven = portraits()
      .map((r) => [r.sel, decl(r.body, 'width'), decl(r.body, 'height')])
      // THIS WAS WIDENED TO ACCEPT `aspect-ratio: 1` AND THE WIDENING WAS WRONG,
      // which is worth the four lines because the reasoning sounded right. The
      // argument was that a rule stating the ratio has already answered the
      // question, so `width: auto; height: 100%; aspect-ratio: 1` should pass.
      // It passed, and it drew an egg: `height: 100%` resolves against a parent
      // whose own height is `auto`, so it was dropped and `auto` fell back to the
      // stand-in's intrinsic ratio. The guard was right and the CSS was wrong.
      //
      // A DECLARATION IS NOT AN OUTCOME. `aspect-ratio` only squares a box whose
      // other axis actually resolves, and this file cannot see whether it does —
      // so it goes on asking for the thing it CAN check. The fix was to put the
      // ratio on the element the flex row stretches, which has a real height, and
      // let the picture fill it at 100% x 100%.
      .filter(([, w, h]) => w && h && w !== h && !/%$/.test(w))
      .map(([sel, w, h]) => `${sel} (${w} x ${h})`)
    expect(uneven, 'these draw a face in a rectangle').toEqual([])
  })

  it('is round wherever it draws a picture at all', () => {
    const boxy = portraits()
      .filter((r) => DRAWS.test(r.body))
      .map((r) => [r.sel, decl(r.body, 'border-radius')])
      // A rule that sets no radius inherits the shape from the box it is inside —
      // `.cast-face > img` fills a parent that is already round — so only a rule
      // that states one is asked whether it states the right one.
      .filter(([, br]) => br && !/^(50%|999px)$/.test(br))
      .map(([sel, br]) => `${sel} (${br})`)
    expect(boxy, 'these draw a face with corners').toEqual([])
  })
})
