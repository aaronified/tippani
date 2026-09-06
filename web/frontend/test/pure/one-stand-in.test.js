// ONE PLACE DECIDES THAT A PICTURE IS NOT THERE.
//
// THE REPORT this comes out of, the owner's: "the character chip (delia
// sturridge) on the V for vendetta poster is a missing image glyph that looks
// like server has broke. it should be simply a random person glyph."
//
// THE SHAPE OF THE DEFECT, which is why a per-site test is not enough. Eleven
// sites drew a person's picture and every one of them asked the same wrong
// question — is a PATH STORED — where the reader's question is whether the file
// arrived. Fixing them one at a time is how ten of eleven end up right: the round
// face on Home was still raw two commits after the fix was called complete, and
// the register said "all of them".
//
// SO THE RULE IS ABOUT THE TREE, NOT ABOUT ONE SCREEN. Only a component that asks
// the picture itself — through `onError` — may draw the thing that stands in for
// one. There are two, and they are listed below with the reason each is allowed.
// A third site drawing a silhouette has its own idea of when a picture is
// missing, and that idea is the defect.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `Silhouette` is the six hashed faces in
// `silhouette.jsx`; `personImgURL` builds a person's picture address and nothing
// else's; `Face` (characterRows.jsx) and `TpMedia` (ui.jsx) are the two that ask.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC
const FILES = readdirSync(SRC).filter((f) => /\.jsx$/.test(f))

// The two that ask the picture whether it arrived, and may therefore answer for
// everyone else.
const ASKERS = {
  'characterRows.jsx': '`Face` — the one stand-in for a person’s picture, `onError` and all',
  'ui.jsx': '`TpMedia` — the pack’s media block, which already had the `onError` this rule generalises',
}

const bodyOf = (f) => readFileSync(join(SRC, f), 'utf8')

describe('the stand-in for a picture', () => {
  it('is drawn only by the components that ask whether the picture arrived', () => {
    const rogue = FILES.filter((f) => !ASKERS[f] && /<Silhouette\b/.test(bodyOf(f)))
    expect(rogue, `${rogue.join(', ')} draws a silhouette of its own — every site that does has its own idea of when a picture is missing, and that idea is the defect`)
      .toEqual([])
  })

  it('and no screen draws a person’s picture raw', () => {
    // `personImgURL` builds a PERSON's address and nothing else's, so a raw
    // <img> on one is unambiguous — unlike `coverImgURL`, which a work's cover
    // legitimately uses and which this rule therefore does not police.
    const raw = FILES.filter((f) => {
      if (ASKERS[f]) return false
      const text = bodyOf(f)
      return /<img[^>]*\bsrc=\{[^}]*personImgURL\(/.test(text.replace(/\n\s*/g, ' '))
    })
    expect(raw, `${raw.join(', ')} draws a portrait as a bare <img>, so a file that has gone shows the browser’s torn page`)
      .toEqual([])
  })

  it('and the components that ask really do ask', () => {
    // A GUARD ON AN ALLOW-LIST HAS TO CHECK THE ALLOW-LIST. Two names above are
    // exempt from the rule; if either stopped handling `onError` the exemption
    // would be hiding the very defect the rule exists for.
    for (const [file, why] of Object.entries(ASKERS)) {
      expect(bodyOf(file), `${file} is exempt as ${why}, and no longer handles onError`)
        .toMatch(/onError=/)
    }
  })
})
