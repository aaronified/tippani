// The geometry constants agree with the stylesheet that renders them.
//
// THE BUG CLASS THIS EXISTS FOR. `docs/ui-glossary.html` stated these numbers in
// prose while `index.css` stated them as literals, and nothing compared the two. The
// glossary went on saying "44px is the floor for anything tappable" for as long as
// somebody kept typing it, whether or not a button still measured 44 — and because
// documentation is not executed, the only way to notice was for a person to read both
// files side by side and care.
//
// So `tokens.js` authors each number once and carries a `proof`: the literal the
// stylesheet must still contain. This file is the binding. Change the number in
// tokens.js and the proof stops matching the CSS; change the CSS and the proof stops
// matching that. Either way somebody is told, in the same run that would have shipped
// the drift.
//
// It reads the SOURCE stylesheet rather than the built one on purpose. The built CSS
// is minified — `min-height:44px` with no space — so a proof written the way a human
// writes CSS would never match it, and rewriting the proofs to survive minification
// would make them unreadable in the file whose whole job is to be read.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { GEOMETRY, INK_ROLES } from '../../src/tokens.js'

// TIPPANI_SRC, the same seam palette.test.jsx and help-budget.test.js use: vitest
// runs from web/frontend for `npm test` and from the repo root for
// `npx vitest --root web/frontend`, and only the config knows which.
const SRC = process.env.TIPPANI_SRC || join(process.cwd(), 'src')
const css = readFileSync(join(SRC, 'index.css'), 'utf8')
const theme = readFileSync(join(SRC, 'theme.js'), 'utf8')

describe('the geometry constants', () => {
  it('are each still written in the stylesheet exactly as recorded', () => {
    for (const [name, token] of Object.entries(GEOMETRY)) {
      expect(
        css.includes(token.proof),
        `tokens.js records ${name} as \`${token.proof}\`, and index.css no longer says that. ` +
        'One of the two moved — decide which is right, then change both.',
      ).toBe(true)
    }
  })

  // Without this, a proof could quietly stop being about its own token: someone
  // edits `value` to 48px, leaves the proof saying 44px, and the check above still
  // passes because the CSS still says 44px. The token would then be documenting a
  // number the stylesheet does not use, which is the exact failure being prevented.
  it('and every proof is actually about the value it proves', () => {
    for (const [name, token] of Object.entries(GEOMETRY)) {
      expect(
        token.proof.includes(token.value),
        `${name}'s proof does not contain its own value (${token.value})`,
      ).toBe(true)
    }
  })

  it('each say what they are for, so the glossary never has to guess', () => {
    for (const [name, token] of Object.entries(GEOMETRY)) {
      expect(typeof token.of, `${name} has no \`of\``).toBe('string')
      // A one-word gloss is not an explanation, and the generated glossary prints
      // this verbatim — an empty-ish `of` would ship as an empty entry.
      expect(token.of.length, `${name}'s \`of\` is too short to be an explanation`).toBeGreaterThan(30)
    }
  })
})

describe('the ink roles', () => {
  // These are a rule about USAGE, so there is no literal to grep for. What can be
  // checked is that every token named here is one the theme actually writes — a role
  // assigned to a custom property nothing sets would be advice about a colour that
  // does not exist.
  it('name only tokens the theme actually writes', () => {
    for (const [token] of INK_ROLES) {
      const bare = token.replace(/^--/, '')
      const written = theme.includes(`'${bare}'`) || theme.includes(`${bare}:`) ||
        css.includes(`${token}:`)
      expect(written, `${token} is given an ink role but nothing defines it`).toBe(true)
    }
  })

  it('and cover the tokens a screen actually has to choose between', () => {
    const named = INK_ROLES.map(([t]) => t)
    for (const required of ['--ink', '--soft', '--faint', '--error', '--ok']) {
      expect(named, `${required} has no stated role`).toContain(required)
    }
  })
})
