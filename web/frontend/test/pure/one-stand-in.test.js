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

import { describe, expect, it } from 'vitest'

import { parse } from '@babel/parser'

import { declaredIn } from '../css-cascade.js'
import { readSource, sourcesUnder } from '../src-files.js'

// EVERY .jsx UNDER src, not the top level of it. `readdirSync` without recursion
// answers a question about one directory, and the rule is about the tree — a
// screen moved into a folder would leave it silently.
//
// AND THE WALK IS THE SHARED ONE, which throws rather than returning a short
// list. This file had its own copy and a rater proved the copy silent: narrowing
// the extension to `.zzz` left all seven cases green. The same hole had just been
// closed in `no-free-names.test.js` with a per-file assertion, in the very commit
// that edited this one — which is the argument for the floor living in the walk
// rather than in a line each.
const FILES = sourcesUnder((n) => /\.jsx$/.test(n), 40)

// The two that ask the picture whether it arrived, and may therefore answer for
// everyone else.
const ASKERS = {
  'characterRows.jsx': '`Face` — the one stand-in for a person’s picture, `onError` and all',
  'ui.jsx': '`TpMedia` — the pack’s media block, which already had the `onError` this rule generalises',
}

const bodyOf = (f) => readSource(f)

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
// AND IT IS A VOCABULARY, WHICH IS A LIMIT WORTH STATING. A field this codebase
// has never used for a face — `p.pic`, say — would pass, and no regex over
// identifiers can close that. What it can do is know every word actually in use,
// and fail loudly the day one of them stops being matched, which is the case
// below. The Silhouette rule beside it is the belt to this brace: a new site
// drawing a stand-in of its own is caught whatever it calls the field.
//
// AND IT IS ABOUT PICTURES THE LIBRARY HOLDS. The candidate strips in the image
// pickers draw remote thumbnails a reader is choosing BETWEEN, and one that fails
// there says something true about that candidate rather than about the library —
// which is a different question with a different right answer, and not this
// rule's. `thumb` was briefly in the vocabulary above and caught exactly those
// two; it is out again, deliberately, rather than the pickers being converted to
// hide a signal.
const OF_A_PERSON = /(face|portrait|avatar|image_path|actor_image|character_image|characterImage|still|photo|headshot)/i

// The src expression of every <img> in a source, with a bare identifier resolved
// one step through its own declaration — which is as far as this needs to see,
// and as far as a regex honestly can.
function portraitTags(text) {
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
    // COMMENTS ARE NOT ATTRIBUTES. `/* onError */` written inside a tag would
    // otherwise satisfy the check for one, which is a way of passing this rule by
    // typing its own name at it.
    const tag = flat.slice(at, end).replace(/\/\*[\s\S]*?\*\//g, ' ')
    const src = /\bsrc=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/.exec(tag)
    // NO `src={…}` MEANS THE WHOLE TAG IS THE EXPRESSION — a spread
    // (`<img {...{ src: personImgURL(p) }} />`) puts the address somewhere this
    // has no name for, and reading the tag entire is the only honest answer.
    let expr = src ? src[1] : tag
    // A SPREAD OF A VARIABLE hides the address one name away — `const shot = {
    // src: … }` and then `<img {...shot} />`. The object it spreads is looked up
    // the same way a bare `src` identifier is, because it is the same evasion
    // written in a different place.
    for (const sp of tag.matchAll(/\{\s*\.\.\.\s*([A-Za-z_$][\w$]*)\s*\}/g)) {
      const decl = new RegExp(String.raw`\b(?:const|let|var)\s+` + sp[1] + String.raw`\s*=([^;]*)`).exec(flat)
      if (decl) expr += ' ' + decl[1]
    }
    const bare = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(expr)
    if (bare) {
      // OVER THE FLATTENED TEXT. `[^\n;]*` against the original stopped at the
      // first newline, so `const u =` on one line and its value on the next was
      // invisible — which is how most of this codebase writes a long call.
      const decl = new RegExp(String.raw`\b(?:const|let|var)\s+` + bare[1] + String.raw`\s*=([^;]*)`).exec(flat)
      if (decl) expr += ' ' + decl[1]
    }
    out.push({ tag, expr })
  }
  return out
}

// A tag that draws a face and never asks whether the picture arrived.
// `onError={undefined}` IS NOT ASKING, and neither is `onError={() => {}}`. Both
// satisfy the word and do nothing, which is the difference between a guard and
// the shape of one — and the empty arrow is the likelier of the two to be
// written, because it looks like code.
//
// PARSED, NOT PATTERN-MATCHED, and the second try at this is the point. The first
// was a lookahead listing the values that do not count; the second was a longer
// list of the same kind, and a rater walked around it in three tries —
// `async () => {}`, `() => false`, `() => {;}` all read as guards. A deny-list of
// no-ops can only ever name the no-ops somebody has already thought of.
//
// So the handler is PARSED and asked whether its body contains anything that can
// have an effect: a call, an assignment, an increment, an await, a throw. That is
// a property of the code rather than of its spelling, and it is why a
// one-expression handler like `() => setBroken(true)` still counts — the rule has
// to stay satisfiable or it gets worked around instead of obeyed.
//
// A HANDLER PASSED BY NAME COUNTS TOO. `onError={boom}` puts the body in another
// function this rule cannot read, and refusing those would make it unsatisfiable
// for every screen that names its handler. `undefined` is an Identifier like any
// other, so it is the one name spelled out here.
const ACTS = new Set([
  'CallExpression', 'OptionalCallExpression', 'NewExpression', 'TaggedTemplateExpression',
  'AssignmentExpression', 'UpdateExpression', 'AwaitExpression', 'ThrowStatement', 'YieldExpression',
])

function anyNode(node, seen) {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some((n) => anyNode(n, seen))
  if (typeof node.type === 'string' && seen(node)) return true
  return Object.values(node).some((v) => v && typeof v === 'object' && anyNode(v, seen))
}

function doesSomething(src) {
  let node
  try {
    node = parse(`(${src})`, { plugins: ['jsx'], errorRecovery: false }).program.body[0].expression
  } catch {
    return false // unparseable is not a guard
  }
  if (node.type !== 'ArrowFunctionExpression' && node.type !== 'FunctionExpression') {
    if (node.type === 'Identifier') return node.name !== 'undefined'
    return node.type === 'MemberExpression' || node.type === 'CallExpression'
  }
  return anyNode(node.body, (n) => ACTS.has(n.type))
}

function handlerIn(tag) {
  const at = tag.search(/\bonError\s*=\s*\{/)
  if (at < 0) return null
  const open = tag.indexOf('{', at)
  let depth = 0
  for (let i = open; i < tag.length; i++) {
    if (tag[i] === '{') depth++
    else if (tag[i] === '}' && --depth === 0) return tag.slice(open + 1, i).trim()
  }
  return '' // unbalanced — the tag was cut short, so it is not asking
}

const ASKS = (tag) => {
  const body = handlerIn(tag)
  return body !== null && body !== '' && doesSomething(body)
}
const unguarded = (text) => portraitTags(text)
  .filter(({ tag, expr }) => OF_A_PERSON.test(expr) && !ASKS(tag))

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
  it('always asks whether the picture arrived, in every file including the two that answer', () => {
    // NO FILE IS EXEMPT FROM THIS HALF, and the previous spelling of the rule
    // exempted two — which meant a raw portrait added anywhere INSIDE
    // `characterRows.jsx` or `ui.jsx` passed, and those are the two files most
    // likely to grow another one. The exemption belongs to the SILHOUETTE rule,
    // where it is about which component may decide; a tag that draws a face and
    // does not listen for `error` is wrong wherever it is written.
    const raw = FILES.filter((f) => unguarded(bodyOf(f)).length)
    expect(raw, `${raw.join(', ')} draws a face and never asks whether the picture arrived, so a file that has gone shows the browser’s torn page`)
      .toEqual([])
  })

  it('and nothing reaches for the element by hand to get around that', () => {
    // `React.createElement('img', …)` is JSX with the sugar taken off, and the
    // scan above reads tags. Cheap to say, and it closes the door rather than
    // leaving it ajar behind a rule that looks thorough.
    const sneaky = FILES.filter((f) => /createElement\(\s*['"]img['"]/.test(bodyOf(f)))
    expect(sneaky, `${sneaky.join(', ')} builds an <img> by hand, where this rule cannot read its attributes`)
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
      'a declaration broken across lines': 'const shot =\n  personImgURL(p.image_path)\n<img src={shot} alt="" />',
      'an address arriving through a spread': '<img {...{ src: personImgURL(p.image_path) }} alt="" />',
      'a spread of a variable built elsewhere': 'const shot = { src: coverImgURL(p.image_path) }\n<img {...shot} alt="" />',
      'an onError that does nothing': '<img src={coverImgURL(c.image_path)} onError={undefined} alt="" />',
      // THE ONE THAT LOOKS LIKE CODE. `onError={undefined}` reads as an
      // oversight; an empty arrow reads as a handler, and is the shape somebody
      // writes to make this rule go quiet.
      'an onError that is an empty arrow': '<img src={coverImgURL(c.image_path)} onError={() => {}} alt="" />',
      'an onError that swallows with a named parameter': '<img src={coverImgURL(c.image_path)} onError={e => null} alt="" />',
      'an onError that is an empty function': '<img src={coverImgURL(c.image_path)} onError={function (e) {}} alt="" />',
      // The three a rater walked the deny-list around with, in three tries.
      'an onError that is an empty async arrow': '<img src={coverImgURL(c.image_path)} onError={async () => {}} alt="" />',
      'an onError that returns a value and does nothing': '<img src={coverImgURL(c.image_path)} onError={() => false} alt="" />',
      'an onError whose body is a bare semicolon': '<img src={coverImgURL(c.image_path)} onError={() => {;}} alt="" />',
      'the word onError typed in a comment': '<img src={coverImgURL(c.image_path)} /* onError */ alt="" />',
    }
    for (const [what, code] of Object.entries(shapes)) {
      expect(unguarded(code).length, `${what} is invisible to the rule`).toBeGreaterThan(0)
    }
    const cover = '<img src={coverImgURL(book.cover)} alt="" />'
    expect(unguarded(cover).length,
      'a work’s cover is not a face, and this rule is not about covers').toBe(0)
    const asked = '<img src={coverImgURL(c.image_path)} onError={boom} alt="" />'
    expect(unguarded(asked).length,
      'a tag that DOES ask is reported anyway, which would make the rule unfixable').toBe(0)
    // AND A HANDLER WITH A BODY IS ASKING, however short. The empty-body rule
    // above must not become "an arrow is never a guard" — that is how a rule
    // stops being fixable and starts being worked around.
    const short = '<img src={coverImgURL(c.image_path)} onError={() => setBroken(true)} alt="" />'
    expect(unguarded(short).length,
      'a one-line handler is not an empty one, and the rule cannot say it is').toBe(0)
    // AND THE SHAPES THIS APP ACTUALLY WRITES. A rule that cannot be satisfied is
    // a rule that gets deleted, so the ways a handler really is written are shown
    // to it beside the ways it is faked.
    const real = {
      'a block that sets state': '<img src={coverImgURL(c.image_path)} onError={() => { setBroken(true); onBroken?.() }} alt="" />',
      'a method on an object': '<img src={coverImgURL(c.image_path)} onError={this.onBroken} alt="" />',
      'an async handler with a body': '<img src={coverImgURL(c.image_path)} onError={async (e) => { await report(e) }} alt="" />',
      'an assignment': '<img src={coverImgURL(c.image_path)} onError={(e) => { e.target.hidden = true }} alt="" />',
    }
    for (const [what, code] of Object.entries(real)) {
      expect(unguarded(code).length, `${what} IS asking, and the rule calls it a defect`).toBe(0)
    }
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
    // ASKED OF THE VALUES, NOT OF THE RULE'S EXISTENCE. A presence check passes
    // on `width: 4%; display: inline`, which `css-cascade.js`'s own header
    // condemns in as many words. The inline width and height are on the slot; the
    // picture inside has to be told to fill it, or a 24px box holds a full-size
    // still.
    // One selector at a time: `declaredIn` matches a rule's selectors as they
    // are written, and this rule lists two.
    const inner = '.stat-face-round img'
    expect(declares(inner, 'width'), 'the picture does not fill its box').toContain('100%')
    expect(declares(inner, 'height'), 'the picture does not fill its box').toContain('100%')
    expect(declares(inner, 'object-fit'), 'the picture is stretched rather than cropped').toContain('cover')
    expect(declares('.stat-face-round', 'border-radius'), 'the Stats still stopped being round')
      .toContain('50%')
    // AND THE STAND-IN IS SIZED TOO. The rule lists the picture and the glyph
    // together, and only the picture was asked for — so deleting the glyph's half
    // passed, which is a silhouette at its natural size inside a 24px circle.
    // ALL FOUR, THE SAME FOUR THE PICTURE IS ASKED FOR — which is the only thing
    // the split bought. Asking the glyph's block for `width` alone left `height`,
    // `object-fit` and `display` deletable green, and a silhouette at its natural
    // height inside a 24px circle is exactly the defect the split was made for.
    const stand = '.stat-face-round svg'
    expect(declares(stand, 'width'), 'the stand-in is not sized to its box').toContain('100%')
    expect(declares(stand, 'height'), 'the stand-in is not sized to its box').toContain('100%')
    expect(declares(stand, 'display'), 'the stand-in keeps a text baseline’s gap under it').toContain('block')
    // NOT object-fit. It is inert on an inline <svg> — the property governs a
    // REPLACED element, and `Silhouette` renders the markup itself — so asserting
    // it was asserting nothing and would have gone on passing with the stand-in
    // letterboxed. What actually makes it fill a square box is its own square
    // viewBox under the default `preserveAspectRatio: xMidYMid meet`.
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(readSource('silhouette.jsx'))
    expect(box, 'the stand-in lost its viewBox, so nothing decides how it fits its box').toBeTruthy()
    expect(box[1], 'the stand-in’s viewBox is not square, so it letterboxes inside a round one').toBe(box[2])
    expect(declares(inner, 'display'), 'the picture keeps a text baseline’s gap under it').toContain('block')
  })
})
