#!/usr/bin/env node
// Add an entry to the newest release's section, without breaking the file.
//
// WHY THIS EXISTS. Three separate hand-edits of `CHANGELOG.md` in one afternoon
// damaged it the same way, and the third one damaged it after the guard that
// catches the damage had already been written. Every one was an offset computed
// instead of found: `s.index('### Fixed') + len('### Fixed\n\n')` assumes a blank
// line after the heading, this file has none, so the insertion landed one
// character INSIDE the bullet below — producing `-- **New entry` and stripping the
// `-` off the entry underneath. `changelog.go` matches `"- "` only, so both notes
// then vanished from the app's own Changelog screen with nothing failing.
//
// `internal/changelog` catches it now, which is why the third one was noticed at
// all. This is the other half: a habit that fails three times out of three is a
// tool's job. Two properties matter and both are about not trusting the author:
//
//   THE POSITION IS FOUND, NOT COMPUTED. The insertion goes after the heading's
//   own newline, wherever that is, with no assumption about what follows it.
//
//   THE RESULT IS PARSED BEFORE IT IS WRITTEN. The file is rendered by
//   `internal/changelog`'s parser, so this re-implements the one rule that matters
//   — a line at column zero starting `- ` opens an entry, an indented line
//   continues it — and refuses to write a file where the entry it just added would
//   not come back out. A tool that can produce the defect it exists to prevent is
//   not worth having.
//
// usage:
//   node scripts/changelog-entry.mjs Fixed "**It no longer does the thing.** Because…"
//
// The text is one entry. Wrap it yourself or let `--wrap` do it at 96 columns; the
// continuation lines are indented two spaces, which is what the parser wants.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COPIES = ['CHANGELOG.md', join('internal', 'changelog', 'CHANGELOG.md')]

function parseEntries(md, section) {
  // The parser's rule, and only the part this tool has to agree with.
  const out = []
  let inRelease = false
  let inSection = false
  let entry = null
  for (const line of md.replaceAll('\r\n', '\n').split('\n')) {
    if (line.startsWith('## ')) {
      if (inRelease) break // only the newest release
      inRelease = true
      inSection = false
      continue
    }
    if (!inRelease) continue
    if (line.startsWith('### ')) {
      if (entry) { out.push(entry); entry = null }
      inSection = line.slice(4).trim() === section
      continue
    }
    if (!inSection) continue
    if (line.startsWith('- ')) {
      if (entry) out.push(entry)
      entry = line.slice(2)
    } else if (entry && line.startsWith('  ')) {
      entry += ' ' + line.trim()
    } else if (line.trim() === '') {
      // held: a blank line inside an entry is a paragraph break
    } else {
      if (entry) { out.push(entry); entry = null }
    }
  }
  if (entry) out.push(entry)
  return out
}

function wrap(text, width = 96) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const first = lines.length === 0
    const room = width - (first ? 2 : 2) // "- " and "  " are both two
    if (line && (line + ' ' + w).length > room) { lines.push(line); line = w } else line = line ? line + ' ' + w : w
  }
  if (line) lines.push(line)
  return lines.map((l, i) => (i === 0 ? '- ' : '  ') + l).join('\n')
}

const [section, ...rest] = process.argv.slice(2).filter((a) => a !== '--wrap')
const text = rest.join(' ')
if (!section || !text) {
  console.error('usage: node scripts/changelog-entry.mjs <Section> "<entry text>"')
  process.exit(2)
}

const bullet = wrap(text)
const primary = readFileSync(join(ROOT, COPIES[0]), 'utf8')

// THE POSITION, FOUND. The newest release is the first `## `; the section is the
// first `### <name>` after it; the insertion point is just past that heading's own
// newline, whatever comes next.
const relAt = primary.indexOf('\n## ')
if (relAt < 0) throw new Error('no release heading in CHANGELOG.md')
const secAt = primary.indexOf(`\n### ${section}\n`, relAt)
if (secAt < 0) {
  console.error(`the newest release has no "### ${section}" section — add the heading first, or name an existing one`)
  process.exit(1)
}
const at = secAt + `\n### ${section}\n`.length

const before = parseEntries(primary, section)
const next = primary.slice(0, at) + bullet + '\n\n' + primary.slice(at)
const after = parseEntries(next, section)

// THE RESULT, PARSED. One more entry than before, it is the one asked for, and
// nothing that was there has changed.
const wanted = text.replace(/\s+/g, ' ').trim()
if (after.length !== before.length + 1) {
  console.error(`refusing to write: the section held ${before.length} entries and would hold ${after.length}`)
  process.exit(1)
}
if (after[0].replace(/\s+/g, ' ').trim() !== wanted) {
  console.error('refusing to write: the new entry does not come back out of the parser as it went in')
  process.exit(1)
}
for (let i = 0; i < before.length; i++) {
  if (after[i + 1] !== before[i]) {
    console.error(`refusing to write: entry ${i + 1} changed — ${JSON.stringify(before[i].slice(0, 60))}`)
    process.exit(1)
  }
}

for (const rel of COPIES) writeFileSync(join(ROOT, rel), next)
console.log(`added to ${section}: ${wanted.slice(0, 72)}${wanted.length > 72 ? '…' : ''}`)
console.log(`both copies written — ${COPIES.join(', ')}`)
