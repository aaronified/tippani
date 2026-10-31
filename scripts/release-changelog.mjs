#!/usr/bin/env node
// Cut a release out of CHANGELOG.md: the `## [Unreleased]` section becomes `## [X.Y.Z] - DATE`,
// and an empty `## [Unreleased]` is left above it for the next change.
//
// WHY THIS EXISTS. A release used to be a changelog section somebody wrote at release time from
// the range since the last tag, then a commit, then a tag, by hand. The workflow now does the
// commit and the tag (.github/workflows/release.yml), so the section has to exist without
// anybody writing it that day. Entries are added to `## [Unreleased]` as the changes are made
// (`scripts/changelog-entry.mjs`), and this moves them.
//
// WHEN THERE IS NOTHING UNDER [Unreleased]: the section is built from the commit subjects since
// the previous tag (feat → Added, fix → Fixed, perf and refactor → Changed; docs, chore, test,
// ci, build and style are not user-visible and are left out). That is a worse changelog than one
// somebody wrote, and it says where it came from on stdout, but a release with a stub for notes is
// worse than both. With no entries and no such commits it refuses.
//
// WHAT IT REFUSES, so a workflow that runs it cannot publish something wrong:
//   - a version that already has a heading;
//   - a version that is not X.Y.Z (a pre-release suffix is allowed);
//   - nothing to release;
//   - a result in which the entries moved are not the entries that were there.
//
// usage:
//   node scripts/release-changelog.mjs 3.5.0 [--date 2026-10-31] [--from v3.4.2]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'CHANGELOG.md'
export const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/

const UNRELEASED = /^## \[Unreleased\][ \t]*$/i

// The sections a commit type files under, in the order a release lists them. Anything not here
// is not something a reader of the changelog needs.
const SECTION_OF = { feat: 'Added', perf: 'Changed', refactor: 'Changed', fix: 'Fixed' }
const ORDER = ['Added', 'Changed', 'Fixed']

// "feat(sources): read MOBI (#62)" → { section: 'Added', text: '**sources:** Read MOBI (#62).' }
export function entriesFromSubjects(subjects) {
  const out = []
  for (const raw of subjects) {
    const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/.exec(raw.trim())
    if (!m) continue
    const [, type, scope, , rest] = m
    if (type === 'chore' && scope === 'release') continue
    const section = SECTION_OF[type.toLowerCase()]
    if (!section) continue
    const sentence = rest.charAt(0).toUpperCase() + rest.slice(1)
    out.push({ section, text: `${scope ? `**${scope}:** ` : ''}${sentence.replace(/[.\s]+$/, '')}.` })
  }
  return out
}

function renderFallback(entries) {
  const parts = []
  for (const s of ORDER) {
    const mine = entries.filter((e) => e.section === s)
    if (!mine.length) continue
    parts.push(`### ${s}\n\n${mine.map((e) => `- ${e.text}`).join('\n')}\n`)
  }
  return parts.join('\n')
}

const countEntries = (text) => text.split('\n').filter((l) => l.startsWith('- ')).length

// The Unreleased section: where its heading is, where its body ends, and the body.
function findUnreleased(lines) {
  const at = lines.findIndex((l) => UNRELEASED.test(l))
  if (at < 0) return null
  let end = lines.length
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break }
  }
  return { at, end, body: lines.slice(at + 1, end).join('\n').replace(/^\n+|\n+$/g, '') }
}

// cutRelease(md, version, date, fromCommits) → { md, source, entries }
//
// `fromCommits` is a list of commit subjects, used only when [Unreleased] holds no entries.
export function cutRelease(md, version, date, fromCommits = []) {
  if (!VERSION.test(version)) throw new Error(`'${version}' is not a version like 3.5.0`)
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) throw new Error(`'${date}' is not a date like 2026-10-31`)
  const lines = md.split('\n')
  if (lines.some((l) => l.startsWith(`## [${version}]`))) throw new Error(`CHANGELOG.md already has a section for ${version}`)

  const un = findUnreleased(lines)
  let body = un ? un.body : ''
  let source = 'unreleased'
  if (countEntries(body) === 0) {
    const fallback = entriesFromSubjects(fromCommits)
    if (!fallback.length) {
      throw new Error('nothing to release: add entries under "## [Unreleased]" (node scripts/changelog-entry.mjs), or have feat/fix commits since the last tag')
    }
    body = renderFallback(fallback).replace(/\n+$/, '')
    source = 'commits'
  }
  const entries = countEntries(body)

  const heading = `## [${version}] - ${date}`
  const block = `## [Unreleased]\n\n${heading}\n\n${body}\n\n`
  let head
  let tail
  if (un) {
    head = lines.slice(0, un.at).join('\n')
    tail = lines.slice(un.end).join('\n')
  } else {
    // No Unreleased heading yet: it goes above the newest release.
    const first = lines.findIndex((l) => l.startsWith('## '))
    if (first < 0) throw new Error('no release heading in CHANGELOG.md')
    head = lines.slice(0, first).join('\n')
    tail = lines.slice(first).join('\n')
  }
  // `join` leaves off the newline that ended the last head line, so it is put back.
  const out = `${head}${head === '' ? '' : '\n'}${block}${tail}`

  // THE RESULT, READ BACK. The new section holds exactly the entries that were cut, [Unreleased] is
  // empty, and everything below is the file as it was.
  const back = out.split('\n')
  const cut = back.findIndex((l) => l.startsWith(heading))
  let cutEnd = back.length
  for (let i = cut + 1; i < back.length; i++) if (back[i].startsWith('## ')) { cutEnd = i; break }
  if (countEntries(back.slice(cut, cutEnd).join('\n')) !== entries) throw new Error('refusing to write: the new section does not hold the entries that were cut')
  const after = findUnreleased(back)
  if (!after || countEntries(after.body) !== 0) throw new Error('refusing to write: [Unreleased] is not empty afterwards')
  if (back.slice(cutEnd).join('\n') !== tail) throw new Error('refusing to write: the older releases changed')

  return { md: out, source, entries }
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function main(argv) {
  const args = argv.slice()
  const flag = (name) => {
    const i = args.indexOf(name)
    if (i < 0) return null
    const v = args[i + 1]
    args.splice(i, 2)
    return v
  }
  const date = flag('--date') || new Date().toISOString().slice(0, 10)
  let from = flag('--from')
  const version = (args[0] || '').replace(/^v/, '')
  if (!version) {
    console.error('usage: node scripts/release-changelog.mjs <version> [--date YYYY-MM-DD] [--from <tag>]')
    process.exit(2)
  }
  const md = readFileSync(join(ROOT, FILE), 'utf8')

  // The commits are read only when they are needed.
  let subjects = []
  const un = findUnreleased(md.split('\n'))
  if (!un || countEntries(un.body) === 0) {
    if (!from) {
      try { from = git('describe', '--tags', '--abbrev=0', '--match', 'v*') } catch { from = '' }
    }
    const range = from ? `${from}..HEAD` : 'HEAD'
    subjects = git('log', '--no-merges', '--pretty=format:%s', range).split('\n').filter(Boolean)
    console.log(`[Unreleased] is empty: reading the commits in ${range}`)
  }

  const r = cutRelease(md, version, date, subjects)
  writeFileSync(join(ROOT, FILE), r.md)
  console.log(`cut ${version} from ${r.source === 'unreleased' ? '[Unreleased]' : 'commit subjects'}: ${r.entries} entries, dated ${date}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (err) {
    console.error(`release-changelog: ${err.message}`)
    process.exit(1)
  }
}
