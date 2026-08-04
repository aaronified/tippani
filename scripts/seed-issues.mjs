#!/usr/bin/env node
// One-time-ish backfill: give every item already ON the roadmap an issue number, so the
// tracker and the roadmap describe the same world.
//
// The automation only knows about things that were filed. Everything written before it
// landed — the twenty-five backlog sections, the Later / maybe entries, the bug I found
// myself — exists only as prose in docs/roadmap.html, with nothing to subscribe to,
// nothing to comment on and no number to quote. This files one issue per item and
// records the numbers in docs/data/issue-map.json, which the roadmap renders as a link
// on each section.
//
//   node scripts/seed-issues.mjs                 dry run: print exactly what it would file
//   node scripts/seed-issues.mjs --only=s4,s7    dry run, just those
//   node scripts/seed-issues.mjs --confirm       actually file them
//
// DRY RUN IS THE DEFAULT, and deliberately so: this opens issues on a public repository,
// they notify anyone watching, and closing an issue is not the same as never having
// filed it. Read the dry run before passing --confirm.
//
// Safe to re-run. An item already in issue-map.json is skipped, and before filing
// anything it checks the tracker for an open issue with the same title — so an
// interrupted run resumes instead of duplicating.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = join(ROOT, 'docs', 'roadmap.html')
const MAP = join(ROOT, 'docs', 'data', 'issue-map.json')
const REPO = process.env.GITHUB_REPOSITORY || 'aaronified/tippani'
const PAGE_URL = 'https://aaronified.github.io/tippani/roadmap.html'

const CONFIRM = process.argv.includes('--confirm')
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7)
const ONLY = only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()

// ---- read what is already on the page ----------------------------------------------

const html = readFileSync(PAGE, 'utf8')

const text = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const items = []

// The numbered backlog: <details class="sec" id="sN"><summary><h3><span class="n">§N</span>Title</h3>
// Anything may follow the </h3> inside the summary — the issue-number fill point lives
// there — so do not anchor on </h3></summary>. The first cut of this did, the fill point
// was added afterwards, and the regex quietly matched nothing at all: it filed the Later
// entries and skipped all twenty-five sections without a word. Hence the count check
// below, which would have caught it.
const secRe =
  /<details class="sec" id="(s\d+)">\s*<summary><h3><span class="n">(§\d+)<\/span>([\s\S]*?)<\/h3>[\s\S]*?<\/summary>([\s\S]*?)\n<\/details>/g
for (const m of html.matchAll(secRe)) {
  const [, id, num, rawTitle, rawBody] = m
  const first = (rawBody.match(/<p>([\s\S]*?)<\/p>/) ?? [, ''])[1]
  items.push({
    id,
    kind: 'section',
    title: text(rawTitle),
    ref: `${num} ${text(rawTitle)}`,
    excerpt: text(first),
    labels: ['enhancement', 'roadmap'],
  })
}

// Later / maybe: <li id="later-x"><strong>Title.</strong> body
const laterRe = /<li id="(later-[a-z0-9-]+)">\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/li>/g
for (const m of html.matchAll(laterRe)) {
  const [, id, rawTitle, rawBody] = m
  const title = text(rawTitle).replace(/\.$/, '')
  items.push({
    id,
    kind: 'later',
    title,
    ref: title,
    excerpt: text(rawBody).slice(0, 600),
    labels: ['enhancement', 'considered'],
  })
}

// The hand-written bugs, from their own data file.
const bugsFile = JSON.parse(readFileSync(join(ROOT, 'docs', 'data', 'bugs.json'), 'utf8'))
for (const b of bugsFile.manual ?? []) {
  if (b.fixed_in) continue
  items.push({
    id: b.id,
    kind: 'bug',
    title: b.title,
    ref: b.title,
    excerpt: text((b.html ?? []).join(' ')),
    labels: ['bug'],
  })
}

// ---- what is already mapped --------------------------------------------------------

const map = existsSync(MAP)
  ? JSON.parse(readFileSync(MAP, 'utf8'))
  : {
      _: [
        'Anchor on the roadmap -> the issue number that tracks it. Written by',
        'scripts/seed-issues.mjs, and appended by hand when a new section is added and',
        'filed. scripts/roadmap-data.mjs renders each number as a link on its section,',
        'so the page and the tracker point at each other.',
      ],
      sections: {},
    }
map.sections ??= {}

const pending = items.filter((i) => !map.sections[i.id] && (!ONLY || ONLY.has(i.id)))

// ---- bodies -------------------------------------------------------------------------

// The issue body says where the item came from and does not pretend to be a fresh
// report. Anyone arriving from a search should be able to tell in one line that this is
// planned work with a written-up section behind it, not an unread request.
function bodyFor(i) {
  const anchor = `${PAGE_URL}#${i.id}`
  if (i.kind === 'bug') {
    return [
      `Tracking issue for a bug listed on the roadmap. **Found by me, not reported** — filed here so it has a number, and so that closing it is what takes it off the page.`,
      ``,
      `**Roadmap:** ${anchor}`,
      ``,
      `### What happens`,
      ``,
      i.excerpt,
      ``,
      `---`,
      ``,
      `Filed by \`scripts/seed-issues.mjs\`. The prose on the roadmap is the canonical write-up; it lives in \`docs/data/bugs.json\`.`,
    ].join('\n')
  }
  const what =
    i.kind === 'section'
      ? 'Tracking issue for a numbered section of the roadmap — planned work, already written up.'
      : 'Tracking issue for a **Later / maybe** entry — being considered, not committed.'
  return [
    `${what} Filed so it has a number to quote, subscribe to and argue with.`,
    ``,
    `**Roadmap:** ${anchor}`,
    ``,
    i.excerpt,
    ``,
    `---`,
    ``,
    `Filed by \`scripts/seed-issues.mjs\`. The roadmap section is the canonical write-up — read it there before commenting, because it probably answers the obvious question. Ordering is not a promise: see the page.`,
  ].join('\n')
}

const titleFor = (i) => (i.kind === 'bug' ? `[bug]: ${i.title}` : `[roadmap]: ${i.ref}`)

// ---- report -------------------------------------------------------------------------

console.log(`${items.length} item(s) on the roadmap; ${items.length - pending.length} already mapped.`)
if (!pending.length) {
  console.log('nothing to file.')
  process.exit(0)
}
console.log(`\nwould file ${pending.length} issue(s) in ${REPO}:\n`)
for (const i of pending) {
  console.log(`  ${i.id.padEnd(18)} [${i.labels.join(',')}]  ${titleFor(i)}`)
}

if (!CONFIRM) {
  console.log(`\nDRY RUN — nothing was filed.`)
  console.log(`These are real issues on a public repository and they notify watchers.`)
  console.log(`Re-run with --confirm to file them, or --only=s4,s7 to try a couple first.`)
  process.exit(0)
}

// ---- file ---------------------------------------------------------------------------

// Titles already open, so an interrupted run resumes rather than duplicating.
const openTitles = new Map()
for (const line of gh([
  'api',
  '--paginate',
  `repos/${REPO}/issues?state=all&per_page=100`,
  '--jq',
  '.[] | select(has("pull_request") | not) | "\\(.number)\\t\\(.title)"',
]).split('\n')) {
  const [n, ...rest] = line.split('\t')
  if (n) openTitles.set(rest.join('\t'), Number(n))
}

let filed = 0
for (const i of pending) {
  const title = titleFor(i)
  const already = openTitles.get(title)
  if (already) {
    console.log(`  ${i.id}: already filed as #${already}`)
    map.sections[i.id] = already
    continue
  }
  const url = gh([
    'issue',
    'create',
    '--repo',
    REPO,
    '--title',
    title,
    '--body',
    bodyFor(i),
    '--label',
    i.labels.join(','),
  ])
  const n = Number((url.match(/\/issues\/(\d+)\s*$/) ?? [])[1])
  if (!n) {
    console.error(`  ${i.id}: filed but could not read the number from ${url}`)
    continue
  }
  map.sections[i.id] = n
  filed++
  console.log(`  ${i.id}: #${n}`)
  // Write after each one. A run interrupted halfway must not lose the numbers it got.
  writeFileSync(MAP, JSON.stringify(map, null, 2) + '\n')
}

writeFileSync(MAP, JSON.stringify(map, null, 2) + '\n')
console.log(`\nfiled ${filed}; docs/data/issue-map.json updated.`)
console.log(`next: node scripts/roadmap-data.mjs   (renders the numbers onto the page)`)
