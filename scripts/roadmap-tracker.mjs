#!/usr/bin/env node
// Writes docs/data/tracker.json from the issue tracker, so that the roadmap generator
// needs no network access and the page can be rebuilt from the repo alone.
//
// Run by .github/workflows/roadmap-bugs.yml on every issue event. Runs locally too, if
// you have `gh` and are logged in — useful for seeing what the page will say before it
// says it:
//
//   node scripts/roadmap-tracker.mjs && node scripts/roadmap-data.mjs
//
// And one mode that writes nothing, for when the page has just changed:
//
//   node scripts/roadmap-tracker.mjs --audit
//
// which fails if an open issue has no section on the page, or a closed one still has one.
// Run it in the same pass as any roadmap cull — see DEVELOPMENT.md.
//
// THE TRACKER DECIDES WHAT IS ON THE ROADMAP. Nothing in the repo does. Three queries,
// one per place an entry can land, and each needs a label only a maintainer can apply:
//
//   open_bugs        open + `bug` + `accepted`            -> Known bugs
//   open_accepted    open + `enhancement` + `accepted`    -> From your requests
//   open_considered  open + `enhancement` + `considered`  -> Later / maybe
//   closed           of the numbers referenced by docs/data/*.json, the closed ones.
//                    Only needed for the `manual` escape hatch now that everything else
//                    comes from an open-issue query: close an issue and it leaves the
//                    queries, so it leaves the page. No bookkeeping, no second edit.
//
// WHY EVERYTHING IS GATED. Filing is open to anyone and the roadmap is published, so an
// ungated pipeline puts a stranger's title and body on a public page within a minute.
// Escaping stops markup getting through; it does nothing about spam, abuse, or a report
// that is simply wrong. Applying a label needs Triage, so the gate is closed to the people
// who file and open to me, and the rule is one sentence: nothing reaches the roadmap
// without `accepted` or `considered`.
//
// Promotion and demotion are label edits. `considered` -> `accepted` moves an entry out of
// Later / maybe and into its own card; no file changes, and the prose in features.json
// follows it because that is keyed by issue number rather than by section.
//
// Pull requests are filtered out: /issues returns them too, and a PR titled like a fix
// is not a bug report.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'data', 'tracker.json')
const REPO = process.env.GITHUB_REPOSITORY || 'aaronified/tippani'
const AUDIT = process.argv.includes('--audit')

function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  } catch (e) {
    const why = (e.stderr || e.message || '').trim()
    console.error(`gh failed: ${args.join(' ')}\n${why}`)
    if (/not found|ENOENT/i.test(why)) console.error('install the GitHub CLI, or run this in Actions where it is preinstalled')
    if (/auth|credential/i.test(why)) console.error('run `gh auth login`, or set GH_TOKEN')
    process.exit(1)
  }
}

// `gh api --paginate --jq` streams one JSON object per line, which is the only shape of
// paginated output that stays parseable across gh versions.
const ndjson = (out) =>
  out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l))

// ---- --audit: does the tracker still agree with the page? ---------------------------
//
// Closing an issue is the only bookkeeping the roadmap has, so forgetting to close one is
// the only way the page can lie — and nothing else notices. `roadmap-data.mjs --check`
// validates the GENERATED regions against docs/data/*.json and never reads the
// hand-written backlog, which is where every culled section lived. Four issues sat open
// with no section on the page before this existed, across two releases.
//
// Two directions, because the drift goes both ways:
//
//   orphan   open, labelled for the page, and not on it — the section shipped or was
//            dropped and the issue was left behind. Close it, or put the section back.
//   ghost    closed, and still on the page — something is promising work whose issue is
//            already settled.
//
// It reads the page and the tracker and WRITES NOTHING: this is a question, not a fix.
// The answer includes the `gh issue close` line, so the disposition stays a decision
// rather than something a script picks.
if (AUDIT) {
  const page = readFileSync(join(ROOT, 'docs', 'roadmap.html'), 'utf8')
  const issues = ndjson(
    gh([
      'api',
      '--paginate',
      '-H', 'Accept: application/vnd.github+json',
      `repos/${REPO}/issues?state=all&per_page=100`,
      '--jq',
      '.[] | select(has("pull_request") | not) | {number, title, state, labels: [.labels[].name]}',
    ]),
  )
  // An issue is meant to be on the page if a maintainer said so with a label. Anything
  // unlabelled was filed and not accepted, and publishes nothing either way.
  const listed = (l) => l.includes('accepted') || l.includes('considered') || l.includes('roadmap')
  // The closing quote is load-bearing: matching `/issues/2` alone would let the link to
  // #23 answer for #2, and every reference the renderer writes is an `href="...">`.
  const onPage = (n) => page.includes(`/issues/${n}"`)

  const orphans = issues.filter((i) => i.state === 'open' && listed(i.labels) && !onPage(i.number))
  const ghosts = issues.filter((i) => i.state === 'closed' && onPage(i.number))

  for (const i of orphans) {
    console.error(`orphan  #${i.number}  ${i.title}`)
    console.error(`        open and labelled for the page, and not on it.`)
    console.error(`        gh issue close ${i.number} --reason completed|"not planned" --comment "..."`)
  }
  for (const i of ghosts) {
    console.error(`ghost   #${i.number}  ${i.title}`)
    console.error(`        closed, and the page still lists it. Cull the section, or reopen it.`)
  }
  console.log(
    `audit: ${issues.length} issue(s) read, ${orphans.length} orphan(s), ${ghosts.length} ghost(s)` +
      (orphans.length + ghosts.length === 0 ? ' — the page and the tracker agree' : ''),
  )
  process.exit(orphans.length + ghosts.length > 0 ? 1 : 0)
}

// `labels=` is AND, not OR: a comma-separated list matches issues carrying every one of
// them. Three queries, one per place an entry can land on the page.
//
// Note the ordering hazard: this reads the label list a moment after the event that
// triggered the run, and that index is very slightly behind — labelling an issue and
// querying immediately can miss it. In the workflow, checkout and setup-node buy ten
// seconds before this runs, which is ample; run it by hand straight after `gh issue edit`
// and you may need to run it twice.
const query = (labels) =>
  ndjson(
    gh([
      'api',
      '--paginate',
      '-H', 'Accept: application/vnd.github+json',
      `repos/${REPO}/issues?state=open&labels=${labels}&per_page=100&sort=created&direction=asc`,
      '--jq',
      '.[] | select(has("pull_request") | not) | {number, title, body, url: .html_url, created_at, user: .user.login}',
    ]),
  )

const openBugs = query('bug,accepted')
const openAccepted = query('enhancement,accepted')
const openConsidered = query('enhancement,considered')

// Which numbers do the hand-written files point at? Those are the only ones whose closed
// state can change what the page shows.
const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const bugs = readJSON('docs/data/bugs.json')
const feats = readJSON('docs/data/features.json')

const referenced = new Set(
  [
    ...(bugs.manual ?? []).map((b) => b.issue),
    ...Object.keys(bugs.overrides ?? {}),
    ...Object.keys(feats.overrides ?? {}),
  ]
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0),
)

const closed = []
for (const n of [...referenced].sort((x, y) => x - y)) {
  let state
  try {
    state = JSON.parse(gh(['api', `repos/${REPO}/issues/${n}`, '--jq', '{state: .state}'])).state
  } catch {
    console.error(`could not read issue #${n} — treating it as open`)
    continue
  }
  if (state === 'closed') closed.push(n)
}

// Preserve the header comment: it is the only documentation a generated file gets.
const previous = (() => {
  try {
    return readJSON('docs/data/tracker.json')
  } catch {
    return {}
  }
})()

// Only re-stamp `generated` when the tracker state actually moved. Otherwise every issue
// event — a comment, a label edit, an assignment — rewrites the timestamp, the workflow
// sees a changed file and commits, and the history fills with commits that say nothing.
// Two label edits produced three of those before this existed.
const same =
  JSON.stringify(previous.open_bugs ?? null) === JSON.stringify(openBugs) &&
  JSON.stringify(previous.open_accepted ?? null) === JSON.stringify(openAccepted) &&
  JSON.stringify(previous.open_considered ?? null) === JSON.stringify(openConsidered) &&
  JSON.stringify(previous.closed ?? null) === JSON.stringify(closed)

writeFileSync(
  OUT,
  JSON.stringify(
    {
      _: previous._ ?? ['GENERATED by scripts/roadmap-tracker.mjs. Do not edit.'],
      generated: same ? (previous.generated ?? null) : new Date().toISOString(),
      open_bugs: openBugs,
      open_accepted: openAccepted,
      open_considered: openConsidered,
      closed,
    },
    null,
    2,
  ) + '\n',
)

console.log(
  `tracker.json: ${openBugs.length} bug(s), ${openAccepted.length} accepted, ` +
    `${openConsidered.length} considered, ${closed.length} closed of ${referenced.size} referenced` +
    (same ? ' — unchanged, timestamp kept' : ' — state moved'),
)
