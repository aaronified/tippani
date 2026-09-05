// A SCREEN'S GLYPHS ARE THE APP'S OWN, NEVER A CHARACTER.
//
// THE RULE, from CLAUDE.md's standing UI rules, and it is the app's own words:
// "A screen's glyphs are the app's own, never an emoji. `NavIcon`, `Icon*` in
// `ui.jsx`, and nothing hand-picked beside them. An emoji is the platform's
// drawing: it changes with the reader's font, sits off the baseline every other
// glyph shares, and is the one picture `docs/ui-glossary.html` cannot document. A
// lookalike next to the real glyph is two pictures of one thing."
//
// IT IS NOT ONLY ABOUT EMOJI, and reading it that way is how forty-three of these
// survived. `♥`, `▲`, `▾`, `→`, `✓`, `✕`, `⚠`, `↗`, `⌃` are Unicode symbols
// rather than emoji, and every word of the reasoning applies to them unchanged:
// they render in whatever face the reader has, at whatever weight it draws them,
// on whatever baseline it puts them — beside an SVG that does none of those
// things. The repo had already fixed exactly this class once, on the credit row
// (`identityLocal.jsx`'s `'✎'`, `'✕'`, `'▾'`), and nothing stopped the next one.
//
// WHAT THIS DOES NOT TOUCH. Typographic characters that are TEXT rather than
// pictures — the em dash standing for "nothing here", the middle dot joining two
// facts, a quotation mark — are prose and stay. The list below is symbols that
// stand in for a control or a state, which is what an icon is.
//
// AND IT IS A RATCHET, NOT A BAN. The count may fall and never rise. A file that
// genuinely needs one adds itself here with the reason, in a review where somebody
// has to read the reason.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = process.env.TIPPANI_SRC

// Symbols that stand in for a picture. Emoji proper, plus the dingbats, arrows and
// geometric shapes an interface reaches for when it has no icon to hand.
//
// AND THE LOOKALIKES OUTSIDE THOSE BLOCKS, which is how five of them survived a
// sweep that reported forty-three. `×` is U+00D7 MULTIPLICATION SIGN and `＋` is
// U+FF0B FULLWIDTH PLUS: both sit in Latin-1 and Halfwidth-and-Fullwidth Forms
// rather than in any of the symbol blocks above, so a class built out of those
// blocks reads them as ordinary letters. A reader cannot tell U+00D7 from U+2715
// on screen — which is the entire point of the rule — so the class has to be
// drawn around what the character LOOKS LIKE, not around where Unicode files it.
const DRAWN_AS_TEXT = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u2665\u2661\u2764\u2713\u2714\u2715\u2716\u2717\u2718\u00D7\u00F7\u2212\uFF0B\uFF0D\uFF1C\uFF1E]/u

// Comments are prose about the code and may name the character they replaced —
// several of the fixes explain themselves by quoting it, and a dozen `name→metadata`
// notes have used an arrow to mean "maps to" since long before this rule existed.
//
// A TRAILING `//` NEEDS THE QUOTE STATE, not a regex. `'https://…'` is a string
// containing two slashes and no comment, and a regex that cuts at the first `//`
// on a line silently truncates every URL in the file — which would have hidden a
// violation sitting after one. So the line is walked, and only a `//` outside a
// string starts a comment.
function withoutComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlocks.split('\n').map((line) => {
    let quote = null
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i]
      if (quote) {
        if (c === '\\') i += 1
        else if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i)
    }
    return line
  }).join('\n')
}

function violations() {
  const out = []
  for (const f of readdirSync(SRC)) {
    if (!f.endsWith('.jsx') && !f.endsWith('.js')) continue
    const clean = withoutComments(readFileSync(join(SRC, f), 'utf8'))
    clean.split('\n').forEach((line, i) => {
      const m = line.match(DRAWN_AS_TEXT)
      if (m) out.push(`${f}:${i + 1}  ${JSON.stringify(m[0])}  ${line.trim().slice(0, 80)}`)
    })
  }
  return out
}

describe('every glyph on a screen', () => {
  it('is drawn by the app, not typed as a character', () => {
    const found = violations()
    expect(found, `these are the platform's drawings, not the app's:\n  ${found.join('\n  ')}`)
      .toEqual([])
  })

  it('and there is something to check, so this is not passing on an empty read', () => {
    // The extraction's own failure mode. Every file in src/ is read; if the
    // directory moved this would report zero violations and mean nothing.
    const files = readdirSync(SRC).filter((f) => f.endsWith('.jsx'))
    expect(files.length, 'no source files found — TIPPANI_SRC is wrong').toBeGreaterThan(20)
  })

  it('and the two a chip needs can be drawn at the chip\'s own scale', () => {
    // THE REASON THE FIVE STAYED TYPED. A remove key on a token pill and an add
    // key on a dashed sticker card are sized by the words around them, and the
    // app's drawings were fixed at 24px — so replacing the character with the
    // drawing would have put a 24px glyph beside a 15px word. Both now take a
    // size, which is what makes the sweep possible rather than merely required.
    const ui = readFileSync(join(SRC, 'ui.jsx'), 'utf8')
    for (const icon of ['IconClose', 'IconPlus']) {
      const decl = ui.match(new RegExp(`export function ${icon}\\(([^)]*)\\)`))
      expect(decl, `${icon} is gone`).toBeTruthy()
      expect(decl[1], `${icon} cannot be drawn at a chip's scale — it takes no size`)
        .toMatch(/size/)
    }
  })

  it('and the app has a drawing for each of the jobs those characters were doing', () => {
    // The other half of "never a character": there has to be something to use
    // instead. These are the ones the sweep replaced.
    const ui = readFileSync(join(SRC, 'ui.jsx'), 'utf8')
    for (const icon of [
      'IconArrow', 'IconWarning', 'IconHeart', 'IconHeartOn', 'IconCheck', 'IconClose',
      'IconChevron', 'IconSortAsc', 'IconSortDesc', 'IconOpen', 'IconBack', 'IconEdit',
      'IconDelete', 'IconMerge', 'IconQuote', 'IconDetails', 'IconPlus',
    ]) {
      expect(ui, `${icon} is gone, and something was drawn with it`)
        .toMatch(new RegExp(`export function ${icon}\\b`))
    }
  })
})
