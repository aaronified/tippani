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

import { declaredIn } from '../css-cascade.js'

const SRC = process.env.TIPPANI_SRC

// EVERY .jsx UNDER src, not the top level of it. `readdirSync` without recursion
// answers a question about one directory, and the rule is about the tree — a
// screen moved into a folder would leave it silently.
function jsxUnder(dir, base = '', out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) jsxUnder(join(dir, e.name), rel, out)
    else if (/\.jsx$/.test(e.name)) out.push(rel)
  }
  return out
}
const FILES = jsxUnder(SRC)

// The two that ask the picture whether it arrived, and may therefore answer for
// everyone else.
const ASKERS = {
  'characterRows.jsx': '`Face` — the one stand-in for a person’s picture, `onError` and all',
  'ui.jsx': '`TpMedia` — the pack’s media block, which already had the `onError` this rule generalises',
}

const bodyOf = (f) => readFileSync(join(SRC, f), 'utf8')

// What a picture is OF, read off the words this codebase uses for one.
//
// NO WORD BOUNDARIES. `\bavatar\b` does not match `avatar_path`, and four live
// raw portraits sat behind exactly that — a boundary is a claim that the word
// stands alone, and in this codebase these words are nearly always part of a
// longer one. Substrings, so `still`, `avatar_path` and `characterImage` all
// answer.
//
// AND `still` IS HERE because the commit that widened this rule used that very
// word for the picture it was widening the rule to catch, and left it out.
const OF_A_PERSON = /(face|portrait|avatar|image_path|actor_image|character_image|characterImage|still|photo|headshot)/i

// The src expression of every <img> in a source, with a bare identifier resolved
// one step through its own declaration — which is as far as this needs to see,
// and as far as a regex honestly can.
function portraitSrcs(text) {
  const flat = text.replace(/\n\s*/g, ' ')
  const out = []
  // ANCHORED ON THE TAG, NOT ON `src=` AFTER A RUN OF NON-`>`. `[^>]*?` cannot
  // cross a `>`, and one `onClick={() => …}` written before `src` puts a `>`
  // between them — so the reverted defect passed with an arrow function in front
  // of it. The tag is read to its own end instead, with `>` inside braces not
  // counting as that end, which is the only way an arrow can be told from a
  // closing bracket.
  for (const at of [...flat.matchAll(/<img\b/g)].map((m) => m.index)) {
    let depth = 0
    let end = at
    while (end < flat.length) {
      const ch = flat[end]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
      end++
    }
    const tag = flat.slice(at, end)
    const src = /\bsrc=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/.exec(tag)
    if (!src) continue
    let expr = src[1]
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
    const shapes = {
      'the inline call': '<img src={coverImgURL(c.image_path)} alt="" />',
      'an address held in a const': 'const face = personImgURL(p.image_path)\n<img src={face} alt="" />',
      'an arrow function written before src': '<img onClick={() => go(1)} src={coverImgURL(c.image_path)} alt="" />',
      'a word that is part of a longer one': '<img src={coverImgURL(u.avatar_path)} alt="" />',
      'the word this rule was widened for': '<img src={coverImgURL(row.still)} alt="" />',
    }
    for (const [what, code] of Object.entries(shapes)) {
      expect(portraitSrcs(code).some((e) => OF_A_PERSON.test(e)), `${what} is invisible to the rule`)
        .toBe(true)
    }
    const cover = '<img src={coverImgURL(book.cover)} alt="" />'
    expect(portraitSrcs(cover).some((e) => OF_A_PERSON.test(e)),
      'a work’s cover is not a face, and this rule is not about covers').toBe(false)
  })
})

// THE RULES THE CONVERSION DEPENDS ON, which nothing was watching: deleting all
// three left the whole suite green. `Face` puts a span between a class and its
// picture, and three screens rely on that span generating no box at all — take
// `display: contents` away and a bin row, a board tile and a board form each get
// an unstyled block where a flex item was.
describe('the box a shared face draws inside', () => {
  const declares = (sel, prop) => declaredIn(sel)
    .map((r) => r.decls?.[prop]?.value)
    .filter(Boolean)
    .map((v) => String(v).trim())

  it('generates no box where a screen already had one', () => {
    expect(declares('.face-slot', 'display'),
      'the slot became a box, so three screens gained a layer they do not style')
      .toContain('contents')
  })

  it('and the Stats still is sized where it is drawn', () => {
    // The inline width and height are on the slot; the picture inside has to be
    // told to fill it, or a 24px box holds a full-size still.
    expect(declaredIn('.stat-face-round img, .stat-face-round svg').length
      + declaredIn('.stat-face-round img').length,
      'nothing sizes the picture inside the Stats still’s box').toBeGreaterThan(0)
  })
})
