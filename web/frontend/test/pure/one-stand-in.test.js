// ONE PLACE DECIDES THAT A PICTURE IS NOT THERE.
//
// THE REPORT this comes out of, the owner's: "the character chip (delia
// sturridge) on the V for vendetta poster is a missing image glyph that looks
// like server has broke. it should be simply a random person glyph."
//
// THE SHAPE OF THE DEFECT, which is why a per-site test is not enough. A dozen
// sites drew a picture of a person or a character, and every one asked the same
// wrong question — is a PATH STORED — where the reader's question is whether the
// file arrived. Fixing them one at a time is how eleven of twelve end up right:
// the round face on Home was still raw two commits after the fix was called
// complete, and the Stats breakdown was still raw one commit after THAT.
//
// SO THE RULE IS ABOUT THE TREE, NOT ABOUT ONE SCREEN. Only a component that asks
// the picture itself — through `onError` — may draw the thing that stands in for
// one, and only such a component may draw a face at all. There are two, listed
// below with the reason each is allowed.
//
// AND IT ASKS WHAT THE PICTURE IS OF, NOT WHICH FUNCTION BUILT THE ADDRESS. The
// first cut of this rule policed `personImgURL`, and a character's still is built
// by `coverImgURL` — so it could never have caught the site it was written for. A
// second escape was as cheap: put the address in a `const` one line up.
//
// WHAT A TEST WRITER NEEDS TO KNOW: `Silhouette` is the six hashed faces in
// `silhouette.jsx`; `Face` (characterRows.jsx) and `TpMedia` (ui.jsx) are the two
// components that ask a picture whether it arrived.

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

// What a picture is OF, read off the words this codebase uses for one.
const OF_A_PERSON = /\b(face|portrait|avatar|image_path|actor_image|character_image)\b/i

// The src expression of every <img> in a source, with a bare identifier resolved
// one step through its own declaration — which is as far as this needs to see,
// and as far as a regex honestly can.
function portraitSrcs(text) {
  const flat = text.replace(/\n\s*/g, ' ')
  const out = []
  for (const m of flat.matchAll(/<img\b[^>]*?\bsrc=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    let expr = m[1]
    const bare = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(expr)
    if (bare) {
      const decl = new RegExp(String.raw`\b(?:const|let|var)\s+` + bare[1] + String.raw`\s*=([^\n;]*)`).exec(text)
      if (decl) expr += ' ' + decl[1]
    }
    out.push(expr)
  }
  return out
}

describe('the stand-in for a picture', () => {
  it('is drawn only by the components that ask whether the picture arrived', () => {
    const rogue = FILES.filter((f) => !ASKERS[f] && /<Silhouette\b/.test(bodyOf(f)))
    expect(rogue, `${rogue.join(', ')} draws a silhouette of its own — every site that does has its own idea of when a picture is missing, and that idea is the defect`)
      .toEqual([])
  })

  it('and the components that ask really do ask', () => {
    // A GUARD ON AN ALLOW-LIST HAS TO CHECK THE ALLOW-LIST. Two names are exempt
    // from the rule; if either stopped handling `onError` the exemption would be
    // hiding the very defect the rule exists for.
    for (const [file, why] of Object.entries(ASKERS)) {
      expect(bodyOf(file), `${file} is exempt as ${why}, and no longer handles onError`)
        .toMatch(/onError=/)
    }
  })
})

describe('a picture of a person or a character', () => {
  it('is never drawn as a bare <img>, whichever builder made the address', () => {
    const raw = FILES.filter((f) => !ASKERS[f] && portraitSrcs(bodyOf(f)).some((e) => OF_A_PERSON.test(e)))
    expect(raw, `${raw.join(', ')} draws a face as a bare <img>, so a file that has gone shows the browser’s torn page`)
      .toEqual([])
  })

  it('and the rule can still see one when it is there', () => {
    // A REGEX THAT MATCHES NOTHING PASSES EVERYTHING, and this one has been
    // walked around twice already. It is shown a picture of each shape it must
    // catch — the inline call, and the address put in a `const` first — so a
    // pattern that quietly stopped matching fails here rather than going green.
    const inline = '<img src={coverImgURL(c.image_path)} alt="" />'
    const viaConst = 'const face = personImgURL(p.image_path)\n<img src={face} alt="" />'
    const cover = '<img src={coverImgURL(book.cover)} alt="" />'
    expect(portraitSrcs(inline).some((e) => OF_A_PERSON.test(e)),
      'the inline shape is invisible to the rule').toBe(true)
    expect(portraitSrcs(viaConst).some((e) => OF_A_PERSON.test(e)),
      'an address held in a const is invisible to the rule').toBe(true)
    expect(portraitSrcs(cover).some((e) => OF_A_PERSON.test(e)),
      'a work’s cover is not a face, and this rule is not about covers').toBe(false)
  })
})
