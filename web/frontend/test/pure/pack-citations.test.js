// A CITATION OF THE DESIGN PACK POINTS AT THE LINE IT CLAIMS.
//
// THE CONVENTION THIS REPO ALREADY USES, in comments and in the audit: a
// backticked literal, then the line it is on —
//
//   `not named` (`work-details-popup.dc.html:1123`)
//   `credit: 'org'` (`:1174`)
//
// and the second form leans on the pack file named earlier in the same file.
//
// WHY IT NEEDS A GUARD. The owner's standing rule is that nothing may deviate
// from the prototype unless it is expounded upon in detail, so a citation is how
// a departure is argued and how a match is claimed. A citation to the wrong line
// is worse than none: it reads as evidence, it is checkable only by opening a
// six-thousand-line artboard, and nobody does. One shipped in this branch —
// `credit: 'org'` was cited at `:1174`, which is `scopeTitle: 'The picker — a
// match is proposed, never applied'` in a different artboard; the real line is
// `:1067`. It was found by a reviewer reading the pack, which is exactly the
// labour a test exists to replace.
//
// WHAT IS CHECKED, and it is deliberately narrow: the cited line must EXIST, and
// the literal quoted immediately before it must appear within a few lines of it.
// Nothing here can tell whether a citation SUPPORTS the claim around it; what it
// can tell is whether the citation points at the text it says it does, which is
// the failure that actually happened.
//
// WHAT A TEST WRITER NEEDS TO KNOW: the paragraphs above, and that
// `docs/design/prototypes/` holds the artboards.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = join(process.env.TIPPANI_SRC, '..', '..', '..')
const PACK = join(REPO, 'docs', 'design', 'prototypes')

// Every file that carries citations: the app's own source, and the planning
// documents that argue departures.
//
// AND docs/PLAN.md ABOVE ALL, which this list left out for a while. CLAUDE.md
// names it as WHERE a design departure goes, so it is the document whose
// citations most need to be right — and three were written into it in a shape
// the resolver could not even see, which passed as "no citations here" rather
// than as a miss. A guard that skips the file it exists for is the wrong half of
// the tree.
const SOURCES = [
  ...readdirSync(join(REPO, 'web', 'frontend', 'src'))
    .filter((f) => /\.(jsx?|css)$/.test(f))
    .map((f) => join('web/frontend/src', f)),
  ...readdirSync(join(REPO, 'docs', 'plans'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => join('docs/plans', f)),
  'docs/PLAN.md',
]

// ``literal` (`[file.dc.html]:N[-M]`)` — the convention, with the file optional.
const CITE = /`([^`\n]{1,80})`\s*\(`?((?:[a-z0-9-]+\.dc\.html)?):(\d+)(?:-(\d+))?`?\)/g

// WHAT A BARE `:N` MEANS is whatever file was named last, and that is not always
// an artboard: `entry-helpers.md` writes ``AddSurface.jsx:718-732`` and then
// ``(`:943`)`` of the same file, which is a source citation and none of this
// guard's business. So the resolver looks for the nearest preceding FILE of any
// kind and only takes the citation when that file is an artboard. Getting this
// wrong in the other direction — assuming every bare `:N` is the pack — is what
// the first cut did, and it reported two correct source citations as broken.
const FILE_MENTION = /([A-Za-z0-9_-]+\.(?:dc\.html|jsx|js|mjs|css|go|md))/g

let skipped = 0
function citationsIn(rel) {
  const text = readFileSync(join(REPO, rel), 'utf8')
  const out = []
  for (const m of text.matchAll(CITE)) {
    let file = m[2]
    if (!file) {
      const names = [...text.slice(0, m.index).matchAll(FILE_MENTION)]
      file = names.length ? names[names.length - 1][1] : ''
    }
    if (!file.endsWith('.dc.html')) { skipped++; continue }
    out.push({ where: `${rel}`, literal: m[1], file, from: Number(m[3]), to: Number(m[4] || m[3]) })
  }
  return out
}

const ALL = SOURCES.flatMap(citationsIn)

// A CITATION SET THAT EMPTIES ITSELF IS A GUARD THAT STOPPED GUARDING. The
// convention is a handful of sites, so a regex that stops matching them — a
// reformat, a different quote — would leave every case vacuously passing.
describe('the pack citations in this repo', () => {
  it('are still being found at all', () => {
    expect(ALL.length, 'no citation of the shape `literal` (`:N`) was found anywhere — the pattern has drifted')
      .toBeGreaterThan(5)
    // Said out loud so a resolver that quietly stopped resolving is visible: a
    // rule that skips everything passes everything.
    expect(skipped, `every citation resolved to a source file rather than an artboard (${skipped} skipped)`)
      .toBeLessThan(ALL.length)
  })

  it.each(ALL.map((c) => [`${c.where}: \`${c.literal}\` at ${c.file || '(no artboard named)'}:${c.from}`, c]))(
    '%s points at a line that exists',
    (_label, c) => {
      expect(c.file, `a bare :${c.from} with no artboard named anywhere before it — unciteable`).toBeTruthy()
      const path = join(PACK, c.file)
      expect(existsSync(path), `${c.file} is not in docs/design/prototypes`).toBe(true)
      const lines = readFileSync(path, 'utf8').split('\n')
      expect(c.to, `${c.file} has ${lines.length} lines`).toBeLessThanOrEqual(lines.length)
    },
  )

  it.each(ALL.map((c) => [`${c.where}: \`${c.literal}\` at ${c.file}:${c.from}`, c]))(
    '%s finds its own words there',
    (_label, c) => {
      const lines = readFileSync(join(PACK, c.file), 'utf8').split('\n')
      // A few lines either way: the convention cites the line a declaration is
      // ON, and a declaration wraps.
      const window = lines.slice(Math.max(0, c.from - 4), Math.min(lines.length, c.to + 3)).join('\n')
      expect(window.includes(c.literal),
        `${c.file}:${c.from} does not contain ${JSON.stringify(c.literal)} — it reads ` +
        JSON.stringify((lines[c.from - 1] || '').trim().slice(0, 70)))
        .toBe(true)
    },
  )
})
