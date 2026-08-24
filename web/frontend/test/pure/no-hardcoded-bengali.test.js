import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// NO BENGALI IN THE SOURCE THAT ISN'T DATA, for the same reason there is no
// English: copy belongs in internal/i18n/*.txt where a translator — or an
// operator dropping a file into data/Locales — can reach it. A string baked into
// a component is a string that is English for Bengali readers or Bengali for
// everyone else, and no locale file can fix it.
//
// This is the Bengali half of the rule the locale-complete test enforces for
// keys. It scans STRING LITERALS AND JSX TEXT only: a comment explaining that
// "এপ্রিল cut at three lands mid-conjunct" is documentation, and the repository is
// full of such comments on purpose.
//
// THREE THINGS ARE ALLOWED AND EACH IS DATA RATHER THAN COPY:
//
//   the wordmark — টিপ্পনী is the app's NAME, set beside the Latin "tippani" and
//   hardcoded exactly as that is. A name is not translated; it is the same word
//   in every language, which is what makes it a name.
//
//   the font probe — a sample of glyphs used to ask the browser whether a Bengali
//   face actually loaded. Nobody reads it; it is measured.
//
//   the language-mark palette — the four letters offered as the mark a proverb
//   board wears. They are letters of the script being chosen, not words in it.
//
// Anything else is a finding. Add a locale key instead; if the string turns out
// to be dead, delete it — an orphan key fails the build, which is the lesson
// CATEGORY_OPTIONS taught.
const ALLOWED = [
  { what: 'the wordmark', re: /^টিপ্পনী$/ },
  { what: 'the font probe', re: /^[ঀ-৿]{5,}$/, files: ['fonts.js'] },
  { what: 'the language-mark palette', re: /^[ঀ-৿]$/, files: ['languages.jsx'] },
]

const BENGALI = /[ঀ-৿]/
// fileURLToPath, NOT `.pathname`, and this is a bug this file shipped with. A file
// URL's pathname is percent-encoded and keeps its leading slash, so on Windows —
// where this repository actually lives, in a directory with a space in its name —
// `new URL(...).pathname` resolved to `/D:/Code%20Projects/...`, readdirSync threw
// ENOENT, and BOTH cases in this file failed for a reason that had nothing to do
// with Bengali. It passed in CI, which is Linux with no space in the path, so the
// gate looked green while it had never once read a source file on the machine the
// code is written on.
const SRC = fileURLToPath(new URL('../../src/', import.meta.url))

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(js|jsx)$/.test(name)) out.push(p)
  }
  return out
}

// stripComments removes // and /* */ so the prose in this codebase — which
// quotes Bengali constantly, and should — is not mistaken for shipped copy. It
// is deliberately simple: a `//` inside a string literal would be over-stripped,
// which can only ever HIDE Bengali from this test, never invent it. A hidden
// string is caught by the locale tests instead, so the failure mode of the
// shortcut is a missed finding rather than a false one.
function stripComments(text) {
  let out = ''
  let inBlock = false
  for (const line of text.split('\n')) {
    let l = line
    if (inBlock) {
      const end = l.indexOf('*/')
      if (end === -1) { out += '\n'; continue }
      l = l.slice(end + 2)
      inBlock = false
    }
    for (;;) {
      const start = l.indexOf('/*')
      if (start === -1) break
      const end = l.indexOf('*/', start + 2)
      if (end === -1) { l = l.slice(0, start); inBlock = true; break }
      l = l.slice(0, start) + l.slice(end + 2)
    }
    const line0 = l.indexOf('//')
    if (line0 !== -1) l = l.slice(0, line0)
    out += l + '\n'
  }
  return out
}

// Every run of Bengali, with the literal it sits in, so a finding can be judged
// against the allowlist as a whole token rather than character by character.
const RUN = /[ঀ-৿][ঀ-৿‌‍\s]*/g

describe('no hardcoded Bengali', () => {
  it('keeps Bengali copy out of the components, the way English is', () => {
    const findings = []
    for (const path of sourceFiles(SRC)) {
      // basename, NOT split('/'), and this is the second half of the same bug. On
      // Windows a path is separated by backslashes, so `file` was the WHOLE path,
      // `a.files.includes(file)` never matched, and the allowlist did nothing —
      // which is why the three entries in it read as findings the moment the walk
      // above started working.
      const file = basename(path)
      const body = stripComments(readFileSync(path, 'utf8'))
      if (!BENGALI.test(body)) continue
      for (const raw of body.match(RUN) || []) {
        const run = raw.trim()
        if (!run) continue
        const ok = ALLOWED.some(
          (a) => a.re.test(run) && (!a.files || a.files.includes(file)),
        )
        if (!ok) findings.push(`${file}: ${run}`)
      }
    }
    expect(findings, 'Bengali in a string literal belongs in internal/i18n/bn.txt').toEqual([])
  })

  it('is actually looking at something — the wordmark is found and allowed', () => {
    // A scanner that silently matches nothing passes for ever. This pins that the
    // walk reaches real files and that the allowlist is doing work rather than
    // the regex finding nothing at all.
    const bodies = sourceFiles(SRC).map((p) => stripComments(readFileSync(p, 'utf8')))
    expect(bodies.some((b) => b.includes('টিপ্পনী'))).toBe(true)
  })
})
