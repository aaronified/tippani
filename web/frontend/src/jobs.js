// JOBS AND LOGS, SEEN FROM THE BROWSER — the one module that knows the wire.
//
// WHY ONE MODULE. The server and this app were built to one written contract at
// the same time, by two different hands (the plan, now Design-decisions §18, and
// the spec's D0),
// and a contract two sides implement independently is exactly where a field name
// drifts. So every path under /jobs and /admin/logs, and every field read out of
// their answers, is spelled HERE and nowhere else: a screen asks this module for
// "the current jobs" or "a job's log" and gets plain objects back. The day the
// contract needs a correction it is one file, and a grep for `'/jobs` that finds
// a second file is the bug.
//
// THE SERVER STORES DATA, NOT PROSE. A job is a kind ("fill"), a subject (what was
// searched, the file's name — the reader's own words) and some counts. The title a
// reader sees — "Fill gaps", "Book lookup · Dune", "12 fields filled · 2 failed" —
// is composed below from locale keys, so it is in the reader's language and the
// database never holds a sentence that a language switch cannot reach.
//
// AND NOTHING HERE WAKES ON A TIMER WHILE NOTHING IS LOOKING. The server's own
// invariant is that nothing runs unless somebody started it; the polls below are
// the screen asking while the screen is up, they back off when nothing moves, and
// they stand still while the tab is hidden.
import { useEffect, useRef, useState } from 'react'

import { apiURL, errText, json } from './api.js'
import { t } from './i18n.js'

// ---- the vocabulary ----------------------------------------------------------

// The six states a job can be in (internal/jobs/states.go). Two are alive.
export const JOB_STATES = ['queued', 'running', 'succeeded', 'failed', 'stopped', 'interrupted']
export const FINISHED_STATES = ['succeeded', 'failed', 'stopped', 'interrupted']
export const isLive = (job) => !!job && (job.state === 'queued' || job.state === 'running')

// THE KINDS THIS SCREEN HAS WORDS FOR. A kind is data (lower case, dots and
// hyphens — the server's `kindShape`), and a key cannot hold a dot inside one
// segment, so `lookup.book` is looked up as `settings.jobs.kind.lookup-book`. A
// kind not on this list is still a job and still shown — as "Job", with its
// subject — rather than as a key rendered raw or a humanised stub nobody wrote:
// the server may learn a kind before this screen does, and the row has to survive
// that release.
export const JOB_KINDS = [
  // The queued ones: the five loops a reader starts from a screen, the backup,
  // and — from 3.1.0 — an import and its approval, which their own routes queue.
  'fill', 'covers', 'people', 'reverify', 'reverify-apply', 'backup', 'import', 'import.approve',
  // Recorded in their request (F2): lookups a reader starts one at a time,
  // saves that fetch a picture from an address, and the acts that swap the
  // database under the queue. THE SERVER'S ROUTE TABLE IS THE LIST TO KEEP THIS
  // BESIDE (internal/httpapi/jobkinds.go, plus the kinds a handler names through
  // jobs.Begin): a kind missing here still shows, as "Job", which is survivable
  // and wrong — the People row's Fetch was one of those for a stage.
  'lookup.book', 'lookup.movie', 'lookup.images', 'lookup.portrait', 'lookup.links',
  'lookup.person', 'lookup.reverify', 'lookup.cast-image', 'lookup.cast-imdb',
  'lookup.cast-tvdb', 'lookup.cast-art',
  'update.check', 'update.apply', 'metadata.test', 'notify.test', 'signin.oidc',
  'work.save', 'person.save', 'character.save',
  'restore', 'reset', 'backup.safety', 'notify.daily', 'request',
]
const kindSlug = (kind) => (JOB_KINDS.includes(kind) ? kind.replace(/\./g, '-') : 'other')

// The counts a job's result can carry, in the order a summary reads them, each with
// the plural family that says it. Anything else in `counts` is not a number a
// reader can do anything with (the first error's text rides there for the people
// fetch) and is left to the details.
//
// A TABLE OF WHOLE KEYS RATHER THAN A TEMPLATE, because each is a plural family —
// `…count.fields.one`, `…count.fields.other` — and a template's hole stands for
// one segment, so `settings.jobs.count.${k}` would name a namespace with nothing
// directly in it and the locale scan would rightly call it pointing at nothing.
export const COUNT_KEYS = [
  // An import's and an approval's, first because each is the whole of what its
  // job did: the quotes it staged, the quotes it put in the library.
  ['staged', 'settings.jobs.count.staged'],
  ['added', 'settings.jobs.count.added'],
  ['fields', 'settings.jobs.count.fields'],
  ['fetched', 'settings.jobs.count.fetched'],
  ['enriched', 'settings.jobs.count.enriched'],
  ['ok', 'settings.jobs.count.ok'],
  ['items', 'settings.jobs.count.items'],
  ['changes', 'settings.jobs.count.changes'],
  ['applied', 'settings.jobs.count.applied'],
  ['unpinned', 'settings.jobs.count.unpinned'],
  ['skipped', 'settings.jobs.count.skipped'],
  ['failed', 'settings.jobs.count.failed'],
]

// The system log's levels, as the server spells them, and the four a reader sees
// before choosing: every level but the file reads and the trace, which are the two
// that would bury everything else (F4).
export const LOG_LEVELS = ['error', 'warn', 'info', 'request', 'asset', 'trace']
export const DEFAULT_LOG_LEVELS = ['error', 'warn', 'info', 'request']

// The windows a reader can look back over. Thirty days is everything the server
// keeps, so there is no "all time" to offer.
export const LOG_RANGES = [
  ['hour', 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
]
export const DEFAULT_LOG_RANGE = 'day'

// ---- what a job is called ----------------------------------------------------

export function jobTitle(job) {
  return t(`settings.jobs.kind.${kindSlug(job?.kind)}`)
}

// The title with what the job was about — "Book lookup · Dune" — for a name that
// has to stand alone, like a control's: two jobs of one kind share a title, and
// the subject is the reader's own words for which one this is.
export function jobLabel(job) {
  const title = jobTitle(job)
  return job?.subject ? `${title} · ${job.subject}` : title
}

export function jobStateLabel(state) {
  return JOB_STATES.includes(state) ? t(`settings.jobs.state.${state}`) : state || ''
}

// WHERE A WAITING JOB STANDS — "Waiting — 2 jobs ahead", "Waiting — next". One
// function because two surfaces say it: the job's own row in Current jobs, and
// the screen that just started it and has to explain why nothing has moved yet
// (a fill pressed behind somebody's two-hour cover fetch). `ahead` counts across
// every reader's queue, which is the honest answer to "when will mine run".
export function jobWaitingText(job) {
  const ahead = job?.ahead || 0
  return ahead > 0 ? t('settings.jobs.current.ahead', { count: ahead, n: ahead }) : t('settings.jobs.current.next')
}

// WHAT A PROMPT THAT SWAPS THE DATABASE SAYS ABOUT THE QUEUE, before its first
// step. A restore and a factory reset replace the file the queue lives in, so
// the server refuses them while a job runs, and the jobs still waiting are ended
// by it; a reader should learn that at the top of the dialog, not from a refusal
// after downloading a safety copy. `keys` names the dialog's own two sentences —
// the running one takes the job's name, the waiting one is a plural family — so
// each act words its own consequence. Empty when nothing runs or waits.
export function queueNotice(summary, keys) {
  if (!summary) return ''
  const parts = []
  if (summary.running) parts.push(t(keys.running, { title: jobLabel(summary.running) }))
  if (summary.waiting > 0) parts.push(t(keys.waiting, { count: summary.waiting, n: summary.waiting }))
  return parts.join(' ')
}

// The counts, one phrase each — "12 fields filled", "2 failed". An array rather
// than one string so a caller can lay them out; `jobSummary` joins them.
export function jobCounts(job) {
  const counts = job?.counts && typeof job.counts === 'object' ? job.counts : {}
  const out = []
  for (const [k, key] of COUNT_KEYS) {
    const n = counts[k]
    if (typeof n === 'number' && n > 0) out.push(t(key, { count: n, n }))
  }
  return out
}

// jobOutcome — what a finished job did, by what each count MEANS to the screen
// that started it: the fill's toast, the covers fetch's line, the people fetch's
// flash. The wire names of the counts (`fields`, `ok`, `first_error`…) are spelled
// here and in COUNT_KEYS above and nowhere else, so a contract correction to one
// of them is this file; every number is a number, zero when the job did not say.
//
// `first_error` IS THE ONE COUNT THAT IS NOT A NUMBER, and it rests on a reading
// of the contract rather than on its letter: the spec's people result is
// `{ok, failed, first_error}`, and D0's `counts` is "the result's counts, no big
// arrays" — which a string satisfies and a server keeping only numbers would not.
// Such a server costs the reason and nothing else: the flash says "1 failed"
// without "(not found)". The backend's contract test is where this is held.
export function jobOutcome(job) {
  const c = job?.counts && typeof job.counts === 'object' ? job.counts : {}
  return {
    filled: num(c.fields),
    fetched: num(c.fetched),
    enriched: num(c.enriched),
    ok: num(c.ok),
    unpinned: num(c.unpinned),
    skipped: num(c.skipped),
    failed: num(c.failed),
    firstError: typeof c.first_error === 'string' ? c.first_error : '',
  }
}

// jobHasFindings — whether a finished re-verify found anything to review, which
// is what Past jobs' Review and the dialog's "kept" toast hang on: a check that
// found everything up to date has nothing to decide, and a Review press that only
// opens "everything is up to date" is a dead end kept for thirty days.
//
// `changes` (items with at least one difference) when the job says it, else
// `items` (nothing checked, nothing found). A check whose counts say neither is
// OFFERED, not hidden: the contract (D0) leaves a check's counts to the server,
// and a count named differently should cost a dead-end press, not every Review.
export function jobHasFindings(job) {
  const c = job?.counts && typeof job.counts === 'object' ? job.counts : {}
  if (typeof c.changes === 'number') return c.changes > 0
  if (typeof c.items === 'number') return c.items > 0
  return true
}

// THE ONE LINE UNDER A JOB'S TITLE. A running job says how far it has got; a
// finished one says what it did. The middle dot is the house joiner for facts on
// one line, and the joining is code so a language's own word order lives inside
// each phrase rather than across them.
export function jobSummary(job) {
  if (!job) return ''
  if (job.state === 'running' && job.total > 0) return t('settings.jobs.progress', { done: job.done || 0, total: job.total })
  return jobCounts(job).join(' · ')
}

// A duration as a reader reads one: "45s", "2m 3s", "1h 12m".
export function formatTook(ms) {
  if (!(ms >= 0)) return ''
  const s = Math.round(ms / 1000)
  if (s < 60) return t('settings.jobs.took.s', { s })
  const m = Math.floor(s / 60)
  if (m < 60) return t('settings.jobs.took.m', { m, s: s % 60 })
  return t('settings.jobs.took.h', { h: Math.floor(m / 60), m: m % 60 })
}

export function jobTook(job) {
  if (!job) return ''
  const from = job.started_at || job.created_at
  const to = job.finished_at || (isLive(job) ? Date.now() : null)
  return from && to ? formatTook(to - from) : ''
}

// WESTERN DIGITS, ALWAYS, and padded by hand rather than by the browser's locale:
// a log is read down a column, so every line's clock has to be the same width,
// and the Bengali sheet's §3.0 holds that `{n}` and every time are Latin digits.
const two = (n) => String(n).padStart(2, '0')
export function formatClock(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
export function formatWhen(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// ---- a job changed: who else needs to look again ----------------------------
//
// THREE CARDS READ THE SAME QUEUE and only one of them polls it. A press on one —
// Stop all on the phone's tile, Run again on a past row — has to reach the others
// now, not at their next tick; and a job that leaves the current list has to
// appear in the past list without anybody reloading. A module-level set of
// listeners is the smallest thing that says so: no context to thread through a
// Settings screen that already carries six sections.
//
// `reason` is 'acted' for a press (everyone looks again) and 'settled' for a job
// the current poll saw finish (the past list looks again; the current poll is the
// one that noticed, so it does not answer itself).
const listeners = new Set()
export function announceJobs(reason = 'acted') {
  for (const fn of [...listeners]) fn(reason)
}
export function useJobsAnnounced(fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const call = (reason) => ref.current?.(reason)
    listeners.add(call)
    return () => listeners.delete(call)
  }, [])
}

// ---- a Stop: shown at once, then watched closely -----------------------------
//
// THE SERVER STOPS A JOB AT ONCE. The owner's, for 3.1.0: "the job cancel button
// must also be the most responsive kill switch. No dillydallying after it has been
// pressed." So a job reads stopped a moment after the press — and a screen that
// went on looking at its ordinary two seconds would keep a row the server has
// already ended on the screen for most of them. So the screen that pressed says
// "Stopping…" the instant of the press (the caller draws that), and every poll
// watching one of the jobs asks every STOP_POLL_MS until it reads stopped, for
// STOP_WATCH_MS at most, and then goes back to its own cadence. The bound is for a
// job that takes longer to end — a database write it had begun finishes whole —
// which the ordinary polls then pick up.
export const STOP_POLL_MS = 200
export const STOP_WATCH_MS = 3000

const stopWatchers = new Set()

// Tells every watcher that these jobs were just asked to stop.
function announceStop(ids) {
  const set = new Set(ids)
  for (const fn of [...stopWatchers]) fn(set)
}

function watchStops(fn) {
  stopWatchers.add(fn)
  return () => stopWatchers.delete(fn)
}

// ---- the requests ------------------------------------------------------------

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const list = (v) => (Array.isArray(v) ? v : [])

// A refusal, in the shape every caller branches on. The server adds `busy` to the
// 409 a restore or a stale session gets, `job_id` to the one a duplicate gets, and
// `limit` to a 429 — so a caller can say "that one is already running" and point
// at it rather than repeating the server's sentence.
function refusal(r) {
  const d = r.data || {}
  return { ok: false, status: r.status, error: errText(r), busy: !!d.busy, jobId: d.job_id || null, limit: d.limit || null }
}

// ---- how much one job may hold ------------------------------------------------
//
// THE SERVER'S CAPS, per kind (the spec's D): a fill or a people fetch of at most
// 2,000 records, a re-verify of at most 500 items, and an apply of at most 500.
// Past the cap the server refuses the whole job — so a screen that sends a set
// without looking gets a refusal after the press for a set it knew the size of
// before it. The loops these jobs replaced chunked in the browser and had no
// ceiling at all, so "Select all → Fill gaps" on a big library used to work.
export const JOB_CAPS = { fill: 2000, people: 2000, reverify: 500, 'reverify-apply': 500 }

// THE LISTS A KIND'S SET IS MADE OF, in the order they are counted and cut.
const SET_KEYS = {
  fill: ['book_ids', 'movie_ids'],
  people: ['ids'],
  reverify: ['book_ids', 'movie_ids', 'people'],
  'reverify-apply': ['items'],
}

const setSize = (kind, params) =>
  (SET_KEYS[kind] || []).reduce((n, k) => n + (Array.isArray(params?.[k]) ? params[k].length : 0), 0)

// The set cut into consecutive pieces of at most the cap, each piece the same
// params with only its share of the lists. A set within the cap is one piece and
// goes exactly as it came.
function cutSet(kind, params) {
  const cap = JOB_CAPS[kind]
  const keys = SET_KEYS[kind] || []
  if (!cap || setSize(kind, params) <= cap) return [params]
  const rest = { ...params }
  for (const k of keys) delete rest[k]
  const all = keys.flatMap((k) => (Array.isArray(params[k]) ? params[k].map((v) => [k, v]) : []))
  const out = []
  for (let i = 0; i < all.length; i += cap) {
    // Every list the set came with is in every piece, empty where this piece has
    // none of it, so each job's params keep the shape the caller sent.
    const piece = { ...rest }
    for (const k of keys) if (Array.isArray(params[k])) piece[k] = []
    for (const [k, v] of all.slice(i, i + cap)) piece[k].push(v)
    out.push(piece)
  }
  return out
}

// limitJob — the first cap's worth of a set, and how much was left out. For the
// one kind whose pieces could not be separate jobs: a re-verify ends in ONE review
// the reader decides as a whole, and several checks would be several reviews.
// `kept < total` is the screen's cue to say so before anything is checked.
export function limitJob(kind, params) {
  const total = setSize(kind, params)
  const [first] = cutSet(kind, params)
  return { params: first, total, kept: setSize(kind, first) }
}

// A POLL'S READ HAS A BOUND, AND IT IS THE ONE PLACE IN THIS MODULE THAT DOES.
//
// Both polls below hold a `busy` flag so two reads never overlap — which means a
// read that is ACCEPTED AND NEVER ANSWERED stops the poll for as long as the card
// is up. api.js records that this is not hypothetical: Docker's port proxy keeps
// accepting on the host port while the container behind it is recreated, and the
// update this app applies restarts exactly that container. So the two poll reads
// give up after ten seconds and come back as the {ok:false, status:0} an
// unreachable server gives, which the polls already retry. Nothing else here is
// bounded: a list read on a press, a result, a stop — a slow answer to those is
// slow, not lost, and a press can be pressed again.
const POLL_TIMEOUT_MS = 10000

// readJob — one poll's worth: the job, and whatever log lines arrived after the
// last one this caller has.
export async function readJob(id, after = 0) {
  const r = await json('GET', `/jobs/${id}?log_after=${after}`, undefined, { timeoutMs: POLL_TIMEOUT_MS })
  if (!r.ok) return refusal(r)
  const d = r.data || {}
  return { ok: true, job: d.job || null, lines: list(d.lines), more: !!d.more }
}

// startJob — ask for one, and read it back straight away: a job can be waiting,
// running or (offline, on a small list) already finished by the time the first
// answer arrives, and a caller that drew "waiting" from the POST alone would be
// wrong about the most common case.
export async function startJob(kind, params = {}) {
  const r = await json('POST', '/jobs', { kind, params })
  if (!r.ok) return refusal(r)
  let job = r.data?.job || null
  if (job?.id) {
    const again = await readJob(job.id)
    if (again.ok && again.job) job = again.job
  }
  announceJobs()
  return { ok: true, status: r.status, job }
}

// startJobs — a set over one job's cap as consecutive jobs, for the kinds whose
// items stand alone (a fill, a people fetch: nothing about one work's gaps waits on
// another's). They queue in the order started and run one after another, as any
// jobs do. A piece the server already has running comes back as its id and is
// joined, the way a single duplicate is.
//
// `jobs` holds every job that is now on the server. When the first piece is
// refused nothing started, and the refusal is the answer; when a later one is —
// five of this reader's jobs already queued, a restore begun between two presses
// — the pieces before it still run, and `cut` carries the refusal so the screen
// can say the rest did not start.
export async function startJobs(kind, params = {}) {
  const pieces = cutSet(kind, params)
  const jobs = []
  let status = 0
  for (const piece of pieces) {
    const r = await startJob(kind, piece)
    if (r.ok) {
      if (r.job?.id) jobs.push(r.job)
      status = r.status
      continue
    }
    if (r.jobId) {
      jobs.push({ id: r.jobId })
      continue
    }
    if (!jobs.length) return r
    return { ok: true, status, job: jobs[0], jobs, cut: r }
  }
  return { ok: true, status, job: jobs[0] || null, jobs, cut: null }
}

// mergeJobs — what a run of several jobs did, as one job a screen already knows
// how to read: the counts added up, the run's state the first piece's that did not
// succeed (a stop or a failure part-way is what the reader needs to hear first),
// and its error with it. Null when any piece could not be read to its end — a run
// with a hole in it has no honest total.
export function mergeJobs(jobs) {
  if (!jobs.length || jobs.some((j) => !j)) return null
  if (jobs.length === 1) return jobs[0]
  const counts = {}
  for (const j of jobs) {
    for (const [k, v] of Object.entries(j.counts && typeof j.counts === 'object' ? j.counts : {})) {
      if (typeof v === 'number') counts[k] = (counts[k] || 0) + v
      else if (counts[k] === undefined && v) counts[k] = v
    }
  }
  const odd = jobs.find((j) => j.state !== 'succeeded')
  return {
    ...jobs[jobs.length - 1],
    state: odd ? odd.state : 'succeeded',
    error: odd?.error || '',
    counts,
    total: jobs.reduce((n, j) => n + num(j.total), 0),
    done: jobs.reduce((n, j) => n + num(j.done), 0),
  }
}

export async function listJobs({ view = 'past', state = '', kind = '', before = null, limit = 30, prune = false } = {}) {
  const q = new URLSearchParams({ view })
  if (state) q.set('state', state)
  if (kind) q.set('kind', kind)
  if (before) q.set('before', String(before))
  if (limit) q.set('limit', String(limit))
  // THE FIRST PAGE OF THE TAB'S FIRST LOAD ASKS FOR A PRUNE, and it is the only
  // thing on the client side of "pruned when the tab opens, with no timer".
  if (prune) q.set('prune', '1')
  // The current view is the one that is polled (useCurrentJobs); the past list is
  // read when somebody opens it or presses something, so only the first is bounded.
  const r = await json('GET', `/jobs?${q.toString()}`, undefined, view === 'current' ? { timeoutMs: POLL_TIMEOUT_MS } : undefined)
  if (!r.ok) return refusal(r)
  const d = r.data || {}
  return { ok: true, jobs: list(d.jobs), running: num(d.running), waiting: num(d.waiting), more: !!d.more }
}

// findLiveJobs — the reader's own jobs of one kind that are running or waiting,
// in the order they run (a set over one job's cap is several). The screens that
// start a covers or a people fetch ask this first, so a second press — or a press
// on a second device — shows the run already under way instead of queueing the
// same work twice behind it. Own only: an admin's current view holds every
// reader's jobs, and somebody else's fetch is not this reader's progress bar.
export async function findLiveJobs(kind) {
  const r = await listJobs({ view: 'current', kind, limit: 0 })
  if (!r.ok) return []
  return r.jobs.filter((j) => j.kind === kind && j.own && isLive(j)).sort((a, b) => (a.id || 0) - (b.id || 0))
}

export async function readJobsSummary() {
  const r = await json('GET', '/jobs/summary')
  if (!r.ok) return refusal(r)
  const d = r.data || {}
  return { ok: true, running: d.running || null, waiting: num(d.waiting) }
}

export async function readJobResult(id) {
  const r = await json('GET', `/jobs/${id}/result`)
  if (!r.ok) return refusal(r)
  return { ok: true, kind: r.data?.kind || '', result: r.data?.result ?? null }
}

// stopJob — Stop one job, and watch it closely until it reads stopped (see
// "a Stop" above).
export async function stopJob(id) {
  const r = await json('POST', `/jobs/${id}/stop`)
  if (!r.ok) return refusal(r)
  announceStop([id])
  announceJobs()
  return { ok: true, job: r.data?.job || null }
}

// stopAllJobs — Stop all. `ids` are the jobs the screen showed at the press, the
// ones to watch closely until each reads stopped; the server stops what the
// viewer may see whether this screen had drawn it or not.
export async function stopAllJobs(ids = []) {
  const r = await json('POST', '/jobs/stop-all')
  if (!r.ok) return refusal(r)
  announceStop(ids)
  announceJobs()
  return { ok: true, stopping: num(r.data?.stopping), stoppedWaiting: num(r.data?.stopped_waiting) }
}

// rerunJob — the same job again, as a new one. A backup needs its credential
// again (the server never keeps it), so `secret` is `{password}` or
// `{passphrase}` for that kind and nothing for the rest.
export async function rerunJob(id, secret) {
  const r = await json('POST', `/jobs/${id}/rerun`, secret || undefined)
  if (!r.ok) return refusal(r)
  announceJobs()
  return { ok: true, job: r.data?.job || null }
}

// A job's log as a Markdown file. An address rather than a fetch, because the
// browser saves an attachment itself and a real href gives middle-click and
// "save link as" for free — the same reasoning as the backup's download.
export const jobLogURL = (id) => apiURL(`/jobs/${id}/log.md`)

// ---- the system log ----------------------------------------------------------

// The query both the read and the export send, built once so "export what is
// shown" cannot drift from what is shown. The level list is joined by hand
// rather than through URLSearchParams, which would write every comma as %2C: the
// values are fixed tokens, and a query a person can read in the address bar of a
// download is worth one line.
//
// THE WINDOW IS THE SERVER'S, NEVER THIS BROWSER'S CLOCK. A first read sends the
// range as a length of time (`since`), which the server ends at its own now, and
// its answer says the window it read: `from`, and `upto`, the newest line then.
// The next page and "what is shown" send those two back, so the export holds the
// lines the reader is looking at and not those plus whatever arrived while they
// read. The query used to carry this browser's now, and a browser whose clock ran
// behind the server's exported a window that ended before the newest lines, the
// ones a reader exports a log for; months behind, the file held none.
export function logQuery({ levels = DEFAULT_LOG_LEVELS, range = DEFAULT_LOG_RANGE, q = '', before = null, limit = 0, from = null, upto = null } = {}) {
  const span = (LOG_RANGES.find(([id]) => id === range) || LOG_RANGES[1])[1]
  const parts = [`level=${levels.join(',')}`, from ? `from=${from}` : `since=${span}`]
  if (upto) parts.push(`upto=${upto}`)
  const term = String(q || '').trim()
  if (term) parts.push(`q=${encodeURIComponent(term)}`)
  if (before) parts.push(`before=${before}`)
  if (limit) parts.push(`limit=${limit}`)
  return parts.join('&')
}

export async function readSystemLogs(filters) {
  const r = await json('GET', `/admin/logs?${logQuery({ limit: 200, ...filters })}`)
  if (!r.ok) return refusal(r)
  return { ok: true, lines: list(r.data?.lines), more: !!r.data?.more, from: r.data?.from || null, upto: r.data?.upto || null }
}

export const systemLogsURL = (filters) => apiURL(`/admin/logs.md?${logQuery(filters)}`)
export const allSystemLogsURL = () => apiURL('/admin/logs.md?all=1')

// ---- watching ----------------------------------------------------------------

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

// THE LINES A PANE HOLDS. A long fill writes a line per work, and a pane that
// kept every one would grow without bound for as long as the tab stayed open;
// the export has the whole log, and the pane says so when it has let go of the
// start.
export const LOG_PANE_MAX = 2000

// useJob — one job, and its log as it grows.
//
// One request per poll answers both questions (the state and the new lines), at
// a second while the job is alive — which is what makes a log feel live — and at
// three once ten polls in a row have brought nothing new, because a job waiting
// behind a two-hour fill has nothing to say every second. A hidden tab asks
// nothing. After the job turns final it reads ONCE more, because the last lines
// the job wrote can land a beat after the state that says it finished, and then
// it stops: a finished job's log does not change.
//
// `final` IS THE CALLER SAYING THE JOB HAD ALREADY FINISHED when it asked — a
// row in Past jobs. There is no "turns final" to wait out, so the first answer
// that holds every line is the last read.
//
// A READ THAT FAILS IS ASKED AGAIN, slowly, while the job may still be moving —
// a server coming back from a restart answers the next one. Once the last job
// seen had finished, three failures in a row end it: nothing about a finished
// job is coming that is worth a request every three seconds for as long as its
// row is open, and the error is on the screen.
export function useJob(id, { final = false } = {}) {
  const [state, setState] = useState({ job: null, lines: [], trimmed: false, error: '', loaded: false })
  useEffect(() => {
    setState({ job: null, lines: [], trimmed: false, error: '', loaded: false })
    if (!id) return undefined
    let alive = true
    let timer = null
    let busy = false
    let after = 0
    let quiet = 0
    let last = ''
    let finalReads = 0
    let done = false
    let failures = 0
    let settled = final
    // Until when this job is watched closely, after a Stop pressed on it.
    let hurry = 0
    const schedule = (ms) => {
      clearTimeout(timer)
      timer = setTimeout(tick, ms)
    }
    const unwatch = watchStops((ids) => {
      if (!ids.has(id) || done) return
      hurry = Date.now() + STOP_WATCH_MS
      if (!busy) schedule(0)
    })
    async function tick() {
      timer = null
      if (!alive || done || busy) return
      if (hidden()) return // the visibility listener picks it back up
      busy = true
      const r = await readJob(id, after)
      busy = false
      if (!alive) return
      if (!r.ok) {
        setState((s) => ({ ...s, error: r.error, loaded: true }))
        // A job that is not there any more is not coming back; anything else is
        // worth asking about again, slowly — up to the bound above.
        failures += 1
        if (r.status === 404 || (settled && failures >= 3)) done = true
        else schedule(3000)
        return
      }
      failures = 0
      settled = !isLive(r.job)
      const fresh = r.lines
      if (fresh.length) after = fresh[fresh.length - 1].id
      setState((s) => {
        const joined = fresh.length ? s.lines.concat(fresh) : s.lines
        const over = joined.length - LOG_PANE_MAX
        return {
          job: r.job,
          lines: over > 0 ? joined.slice(over) : joined,
          trimmed: s.trimmed || over > 0,
          error: '',
          loaded: true,
        }
      })
      // MORE LINES THAN ONE ANSWER HOLDS: keep reading, now, whatever the state.
      if (r.more) return schedule(0)
      if (!isLive(r.job)) {
        if (final || finalReads >= 1) { done = true; return }
        finalReads += 1
        return schedule(500)
      }
      const sig = `${r.job?.state}|${r.job?.done}|${fresh.length ? after : ''}`
      quiet = sig === last ? quiet + 1 : 0
      last = sig
      if (Date.now() < hurry) return schedule(STOP_POLL_MS)
      schedule(quiet >= 10 ? 3000 : 1000)
    }
    const onVisible = () => {
      if (!hidden() && !timer && !busy && !done) tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    tick()
    return () => {
      alive = false
      clearTimeout(timer)
      unwatch()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [id, final])
  return state
}

// useCurrentJobs — what is running and what is waiting, for as long as a screen
// shows it. Every two seconds while anything is current, every ten while nothing
// is: fast enough that a job started on another screen appears while the reader
// is looking, slow enough that an idle Settings tab is a request every ten
// seconds rather than a heartbeat.
//
// IT TELLS THE PAST LIST WHEN A JOB LEAVES. A job that was current and is not any
// more has finished, so the list of finished ones is stale; this is the one poll
// that can see that happen.
export function useCurrentJobs({ enabled = true } = {}) {
  const [state, setState] = useState({ jobs: [], running: 0, waiting: 0, loaded: false, error: '' })
  const kick = useRef(() => {})
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    let timer = null
    let busy = false
    let again = false
    let seen = null
    // The jobs a Stop was just pressed on, watched closely until none of them is
    // current any more or the watch is over: {ids, until}, or null.
    let hurry = null
    async function read() {
      clearTimeout(timer)
      timer = null
      if (!alive) return
      if (busy) { again = true; return }
      if (hidden()) return
      busy = true
      const r = await listJobs({ view: 'current', limit: 0 })
      busy = false
      if (!alive) return
      let current = 0
      if (r.ok) {
        // The one running first, then the queue in the order it will run — the
        // order a reader reads "what happens next" in.
        const jobs = [...r.jobs].sort((a, b) =>
          (a.state === 'running' ? 0 : 1) - (b.state === 'running' ? 0 : 1) || (a.id || 0) - (b.id || 0))
        current = r.running + r.waiting
        const ids = jobs.map((j) => j.id).join(',')
        if (seen !== null && seen.split(',').some((id) => id && !ids.split(',').includes(id))) announceJobs('settled')
        seen = ids
        setState({ jobs, running: r.running, waiting: r.waiting, loaded: true, error: '' })
      } else {
        setState((s) => ({ ...s, loaded: true, error: r.error }))
      }
      if (again) { again = false; return read() }
      if (hurry && (Date.now() >= hurry.until || (r.ok && !r.jobs.some((j) => hurry.ids.has(j.id))))) hurry = null
      timer = setTimeout(read, hurry ? STOP_POLL_MS : current > 0 ? 2000 : 10000)
    }
    kick.current = read
    const onVisible = () => { if (!hidden()) read() }
    document.addEventListener('visibilitychange', onVisible)
    // The press that set the watch reads the list itself (announceJobs), so the
    // watch only brings the next read forward, to now at the latest.
    const unwatch = watchStops((ids) => {
      if (!ids.size) return
      hurry = { ids, until: Date.now() + STOP_WATCH_MS }
      clearTimeout(timer)
      timer = setTimeout(read, 0)
    })
    read()
    return () => {
      alive = false
      clearTimeout(timer)
      kick.current = () => {}
      unwatch()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled])
  useJobsAnnounced((reason) => { if (reason === 'acted') kick.current() })
  return { ...state, reload: () => kick.current() }
}

// ---- a screen that started a job and waits for its end -----------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shown = () => new Promise((resolve) => {
  const on = () => {
    if (hidden()) return
    document.removeEventListener('visibilitychange', on)
    resolve()
  }
  document.addEventListener('visibilitychange', on)
})

// followJob — one job, until it finishes, as a promise: the final job, or null
// when the caller stopped caring (`alive()` turned false) or the job cannot be
// read any more.
//
// WHY A PROMISE AS WELL AS useJob. A selection's Fill gaps is a press inside a
// hook that can be pressed again while the first job still runs — each press is
// a job of its own — so the thing waiting is the press, not the screen, and a
// screen-level hook holds one id. The cadence is useJob's (a second while
// something moves, three once ten reads in a row brought nothing, nothing at all
// while the tab is hidden), minus the log: a press wants the end, not the lines,
// so each line is fetched once and dropped.
//
// `alive` IS THE SCREEN'S "AM I STILL HERE". A reader who leaves the screen has
// not stopped the job — it is on the server and in Settings › Jobs — so the
// follower just stops asking, and no toast lands on a screen they left.
export async function followJob(id, { alive = () => true, onJob = null } = {}) {
  let after = 0
  let quiet = 0
  let last = ''
  let failures = 0
  for (;;) {
    if (!alive()) return null
    if (hidden()) {
      await shown()
      continue
    }
    const r = await readJob(id, after)
    if (!alive()) return null
    if (!r.ok) {
      // A job that is gone is not coming back; anything else — a server coming
      // back from a restart — is worth a few slow tries.
      failures += 1
      if (r.status === 404 || failures >= 5) return null
      await sleep(3000)
      continue
    }
    failures = 0
    if (r.lines.length) after = r.lines[r.lines.length - 1].id
    onJob?.(r.job)
    if (r.more) continue
    if (!isLive(r.job)) return r.job
    const sig = `${r.job?.state}|${r.job?.done}`
    quiet = sig === last ? quiet + 1 : 0
    last = sig
    await sleep(quiet >= 10 ? 3000 : 1000)
  }
}

// jobAnswer — what a route that queues its work answered, as the screen always
// read it: {ok, status, data}.
//
// AN IMPORT AND AN APPROVAL ARE JOBS (3.1.0). Their routes used to answer with
// what they had done; now they answer 202 {job}, and what they used to answer is
// the job's result, {status, body}. So a 202 is followed to its end (followJob)
// and its result read back, and the screen maps `ok` and `data` exactly as it
// mapped the request's. A route that refused before anything queued — no file, a
// file over the limit, a restore under way, five jobs already waiting — is its own
// answer, unchanged, and so is a 409 that names no job. A 409 that does name one
// (the same approval pressed twice) is that job, followed as if this press had
// started it.
//
// `onJob` sees the job whenever it is read, which is what a screen draws while it
// waits: where it stands in the queue, then that it runs. `alive` is the screen's
// "am I still here" (followJob): a screen that is gone gets `{gone: true}` and
// draws nothing. A job that ended with no answer to read — stopped before it ran,
// cut off by a restart — comes back as a refusal carrying the job, its error the
// job's own or the name of its state.
export async function jobAnswer(r, { alive = () => true, onJob = null } = {}) {
  const queued = r?.status === 202 ? r.data?.job : r?.status === 409 && r.data?.job_id ? { id: r.data.job_id } : null
  if (!queued?.id) return r
  let job = queued
  if (job.state) onJob?.(job)
  if (!job.state || isLive(job)) {
    job = await followJob(job.id, { alive, onJob })
    if (!job) return { ok: false, status: 0, data: null, gone: true }
  }
  const res = await readJobResult(job.id)
  const answer = res.ok && res.result && typeof res.result === 'object' ? res.result : null
  if (answer && typeof answer.status === 'number') {
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, data: answer.body ?? null, job }
  }
  return { ok: false, status: 0, data: { error: job.error || jobStateLabel(job.state) }, job }
}

// useKindJob — the one run of a kind this screen shows: a covers fetch on
// Metadata, a people fetch on its console, a backup on the Server card.
//
// A RUN IS USUALLY ONE JOB, and several when the set was over one job's cap
// (startJobs) or several were found waiting. The screen draws the run as one:
// the job in hand, with the run's done and total, and `onSettled` once, with
// what the whole run did (mergeJobs). One job at a time is watched — the next
// piece cannot start before the one ahead of it has finished anyway.
//
// IT LOOKS BEFORE IT STARTS, and — with `discover` — once when the screen opens.
// A fetch started on the phone and still running when the reader sits down at
// the desk is the same fetch, and the console should be drawing its progress
// bar rather than offering to start another. `looked` says the first look has
// answered, which is what a screen arriving with "fetch" already asked for waits
// on: pressing before it knows what is running is how two fetches get queued.
//
// `start(params, {reuse})` shows the run already going when there is one (reuse,
// the default) or asks for a new one; either way a duplicate the server refuses
// with the running job's id is joined rather than reported, because "that one is
// already running" is not an error to the reader who wanted it running.
//
// `onSettled(job)` IS CALLED ONCE PER RUN, when the last job of the run this
// screen is watching turns final while the screen is up: the moment to reload the
// rows the run wrote and say what it did. A run that finishes after the screen
// closed says so in Settings › Jobs instead.
export function useKindJob(kind, { discover = true, onSettled = null } = {}) {
  const [run, setRun] = useState([])
  const [at, setAt] = useState(0)
  const [looked, setLooked] = useState(!discover)
  const id = run[at] ?? null
  const watched = useJob(id)
  // useJob resets on a new id one render late; a job from the last id is not
  // this one.
  const current = watched.job && watched.job.id === id ? watched.job : null
  const settle = useRef(onSettled)
  settle.current = onSettled
  // What is known of each job of the run before it is watched (the start's
  // answer, the list's row), and each one as it finished.
  const known = useRef(new Map())
  const ended = useRef(new Map())

  const begin = (jobs) => {
    for (const j of jobs) if (j?.id && !known.current.get(j.id)?.state) known.current.set(j.id, j)
    setRun(jobs.map((j) => j.id))
    setAt(0)
  }

  useEffect(() => {
    if (!discover) return undefined
    let alive = true
    findLiveJobs(kind).then((found) => {
      if (!alive) return
      if (found.length) {
        setRun((cur) => {
          if (cur.length) return cur
          for (const j of found) known.current.set(j.id, j)
          return found.map((j) => j.id)
        })
      }
      setLooked(true)
    })
    return () => { alive = false }
  }, [kind, discover])

  useEffect(() => {
    if (!current || isLive(current) || ended.current.has(current.id)) return
    ended.current.set(current.id, current)
    if (at < run.length - 1) {
      setAt(at + 1)
      return
    }
    settle.current?.(mergeJobs(run.map((i) => ended.current.get(i))) || current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.state])

  // THE RUN AS ONE JOB for the screen's bar: the job in hand — its state, its
  // place in the queue — with the run's progress, every finished piece counted
  // whole.
  let job = current
  if (current && run.length > 1) {
    let done = 0
    let total = 0
    run.forEach((rid, n) => {
      const j = n === at ? current : ended.current.get(rid) || known.current.get(rid)
      total += num(j?.total)
      if (n < at) done += num(j?.done)
      else if (n === at) done += num(current.done)
    })
    job = { ...current, done, total }
  }

  async function start(params, { reuse = true } = {}) {
    if (reuse) {
      if (live) return { ok: true, job, joined: true }
      const found = await findLiveJobs(kind)
      if (found.length) {
        begin(found)
        return { ok: true, job: found[0], joined: true }
      }
    }
    const r = await startJobs(kind, params)
    if (!r.ok) return r
    if (r.jobs.length) begin(r.jobs)
    return r
  }

  // LIVE FROM THE PRESS, not from the first read: between the answer to the POST
  // and the first poll there is an id and no job yet, and a button that
  // re-enabled for that beat would invite the second press this exists to stop.
  // So is the beat between one piece of a run finishing and the next being read.
  // A job that cannot be read at all (it is gone) is not live.
  const more = at < run.length - 1
  const live = !!id && (current ? isLive(current) || more : more || !watched.error)
  return { job, live, looked, start }
}
