// SETTINGS › JOBS › COMMON JOBS — the jobs a reader runs again and again, each in
// a place of its own.
//
// THE OWNER'S ASK, 28 September: "add a list of common jobs, that can be
// restarted from there itself, and as such will have a persistent place." Asked
// which, the answer was four: Back up now, Fetch covers and details, Fill gaps in
// every work, Fetch missing people. Before this each lived on a screen of its own
// (a Server card, the Metadata page's header, a selection's bar, the People
// console), and "when did I last do that, and did it work?" had no answer short
// of scrolling Past jobs for it.
//
// A ROW IS ALWAYS THERE. It says what the job does, how it ended the last time
// (its state, when, what it did — and that line opens the job's log right here),
// and offers Run, or Run again once it has run. While that job runs or waits the
// row says so and offers Stop instead: the press that started it is the press that
// ends it, in the same place.
//
// THE ROWS ARE THE SERVER'S (GET /jobs/common, read through jobs.js): which of the
// four this reader may run — a reader gets two, the covers pass and the backup are
// an admin's — and the params each one's Run sends. Run is POST /jobs with them,
// the same job every other screen starts, so it queues, stops and is kept exactly
// as they are. What this file owns is the words for each row, keyed on the row's
// id.
//
// IT NEVER SPEAKS TO THE SERVER ITSELF, for jobsSection.jsx's reason: every path
// and field name is in jobs.js.
import { useState } from 'react'

import { t } from './i18n.js'
import {
  formatWhen,
  isLive,
  jobLogURL,
  jobStateLabel,
  jobSummary,
  jobTitle,
  jobWaitingText,
  pressStop,
  startJob,
  useCommonJobs,
  useLibraryGaps,
  useStoppingJobs,
} from './jobs.js'
import { JobsCard, PastLog } from './jobsSection.jsx'
import { coversCanClose, fetchable, fillCanClose } from './libraryGaps.js'
import {
  ErrorText,
  GhostButton,
  IconArchive,
  IconChevron,
  IconExport,
  IconMetadata,
  IconNavUsers,
  IconNavWorks,
  IconRerun,
  IconStop,
  Tally,
  toast,
  Tooltip,
} from './ui.jsx'

// What each row is called and does, and the glyph its Run wears: the glyph the
// same press wears where it lived before (Fill gaps and the two fetches wear
// IconMetadata, the arrow landing in a record; the backup its archive box), so a
// reader who knows the press there knows it here. A row the server sends that
// this list has no words for is not drawn: a press with no name is not a press.
//
// AND WHAT IT HAS LEFT TO DO, counted by Metadata's own tests (libraryGaps.js). The
// owner: "This card should also know about what all are pending (from metadata)."
// So each library job says how much of the library it could still fill in: a fill,
// the pinned works with a field it writes still empty; a people fetch, the People
// console's Fetch missing; a covers pass, the books with no cover and the films with
// a source and no poster (libraryGaps.js says why each is narrower than what
// Metadata flags). The backup has nothing a library is missing.
const closable = (can) => (g) => g.books.filter(can.book).length + g.movies.filter(can.movie).length
const works = { icon: <IconNavWorks />, word: (n) => t('unit.work', { count: n }) }
const people = { icon: <IconNavUsers />, word: (n) => t('unit.person', { count: n }) }
const ROWS = {
  'fill-all': { glyph: <IconMetadata />, pending: { ...works, count: closable(fillCanClose) } },
  'people-missing': { glyph: <IconMetadata />, pending: { ...people, count: (g) => g.people.filter(fetchable).length } },
  covers: { glyph: <IconMetadata />, missingOnly: true, pending: { ...works, count: closable(coversCanClose) } },
  backup: { glyph: <IconArchive />, credential: true },
}
const rowTitle = (id) => t(`settings.jobs.common.${id}.label`)

// CommonJobsCard. `credentialPrompt` draws Settings' own backup prompt, handed in
// as Past jobs is handed it: a backup cannot start without the credential that
// seals it, and the prompt a reader meets for it must be the one they met on the
// Server card — same fields, same rules.
export function CommonJobsCard({ user, credentialPrompt = null }) {
  const { rows, loaded, error, reload } = useCommonJobs()
  const [asking, setAsking] = useState(null) // a row waiting for its credential
  const [busy, setBusy] = useState('') // the row whose press is on its way
  // THE JOBS A STOP WAS PRESSED ON, marked from the instant of the press, before
  // the server has answered: a row that went on offering Stop until the answer
  // came would read as a press that did nothing. The mark is jobs.js's
  // (pressStop), shared with Current jobs, which draws the same job with a Stop of
  // its own: pressed on either row, it is pressed on both. The row goes back to
  // Run again when the close watch after the Stop, which every card that draws the
  // job shares (useCommonJobs), finds the job ended.
  const stopping = useStoppingJobs()
  const [open, setOpen] = useState('') // the row whose last run's log is open
  const shown = rows.filter((row) => ROWS[row.id])
  // Read again as a job starts or ends: the count a finished job left behind is
  // the one its row should say.
  const gaps = useLibraryGaps(rows.map((row) => row.current?.id || '').join(','))

  async function run(row, params, secret) {
    if (ROWS[row.id].credential && !secret) return setAsking(row)
    setBusy(row.id)
    const r = await startJob(row.kind, { ...params, ...(secret || {}) })
    setBusy('')
    // THE SAME JOB ALREADY RUNNING IS NOT AN ERROR to a reader who wanted it
    // running: the server names it, and the row shows it at its next read.
    if (!r.ok && !r.jobId) return toast(r.error)
    setAsking(null)
    setOpen('')
    reload()
  }

  // No toast, as on Current jobs: the row says "Stopping…" from the press, and
  // shows how the job ended once it has.
  async function stop(row) {
    const r = await pressStop(row.current.id)
    if (!r.ok) toast(r.error)
  }

  return (
    <JobsCard title={t('settings.jobs.common.title')}>
      {error && <ErrorText>{error}</ErrorText>}
      {loaded && !error && shown.length === 0 && <p className="microcopy">{t('settings.jobs.common.empty')}</p>}
      {shown.length > 0 && (
        <div className="job-list">
          {shown.map((row) => (
            <CommonJob
              key={row.id}
              row={row}
              user={user}
              gaps={gaps}
              busy={busy === row.id}
              stopping={!!row.current && stopping.has(row.current.id)}
              open={open === row.id}
              onToggle={() => setOpen((id) => (id === row.id ? '' : row.id))}
              onRun={(params) => run(row, params)}
              onStop={() => stop(row)}
            />
          ))}
        </div>
      )}
      {asking && credentialPrompt?.({
        me: user?.username,
        busy: busy === asking.id,
        onCancel: () => setAsking(null),
        onConfirm: (creds) => run(asking, asking.params, creds),
      })}
    </JobsCard>
  )
}

function CommonJob({ row, user, gaps, busy, stopping, open, onToggle, onRun, onStop }) {
  const spec = ROWS[row.id]
  const title = rowTitle(row.id)
  const now = isLive(row.current) ? row.current : null
  const last = row.last
  // Stop is offered where the server honours it, as on Current jobs: your own
  // job, or — for an admin — anybody's.
  const canStop = !!now && (now.own || !!user?.is_admin)
  // PRESSED, IT SAYS "Stopping…", running or waiting, as Current jobs' two rows
  // do: a Stop ends either at once, so the word promises nothing about an item in
  // hand, and one job reads the same on both cards.
  const again = !!last
  return (
    <div className="job-row common-job">
      <div className="job-row-head">
        <span className="job-line">
          <span className="job-title">{title}</span>
          <span className="job-meta common-job-what">{t(`settings.jobs.common.${row.id}.prose`)}</span>
          {/* Not while it runs: the line under the row says how far it has got. */}
          {!now && gaps && spec.pending && <Pending id={row.id} n={spec.pending.count(gaps)} of={spec.pending} />}
        </span>
        <div className="job-actions">
          {now ? (
            canStop && (stopping ? (
              <span className="microcopy">{t('settings.jobs.current.stopping')}</span>
            ) : (
              <GhostButton icon={<IconStop />} keepLabel className="tp-btn-danger" aria-label={t('settings.jobs.common.stop.aria', { title })} onClick={onStop}>
                {t('settings.jobs.current.stop.label')}
              </GhostButton>
            ))
          ) : (
            <>
              {/* THE COVERS PASS HAS TWO RUNS, as the Metadata page always had:
                  every cover and poster, better ones included, or only the
                  missing ones — the quick one that never replaces art a reader
                  is happy with. */}
              {spec.missingOnly && (
                <Tooltip label={t('settings.jobs.common.missing-only.tip')}>
                  <GhostButton icon={spec.glyph} keepLabel disabled={busy} aria-label={t('settings.jobs.common.missing-only.aria', { title })} onClick={() => onRun({ ...row.params, missing_only: true })}>
                    {t('settings.jobs.common.missing-only.label')}
                  </GhostButton>
                </Tooltip>
              )}
              <GhostButton
                icon={again ? <IconRerun /> : spec.glyph}
                keepLabel
                disabled={busy}
                aria-label={t(again ? 'settings.jobs.common.again.aria' : 'settings.jobs.common.run.aria', { title })}
                onClick={() => onRun(row.params)}
              >
                {t(again ? 'settings.jobs.common.again.label' : 'settings.jobs.common.run.label')}
              </GhostButton>
            </>
          )}
        </div>
      </div>
      {now ? (
        // WHERE ITS JOB STANDS, in Current jobs' own words: how far it has got,
        // or how many are ahead of it. Its log is open on that card above.
        <p className="job-meta common-job-now">
          {now.state === 'running'
            ? [jobStateLabel(now.state), jobSummary(now)].filter(Boolean).join(' · ')
            : jobWaitingText(now)}
        </p>
      ) : last ? (
        <LastRun last={last} title={title} open={open} onToggle={onToggle} />
      ) : (
        <p className="job-meta common-job-now">{t('settings.jobs.common.never')}</p>
      )}
    </div>
  )
}

// WHAT A JOB HAS LEFT, a count wearing the glyph of what it counts with its noun
// beside it, the roomy shape (Tally), and the words for what is missing after it:
// "38 works with a gap it can fill". None left is said, since that is the answer to "do I need
// to run this?".
function Pending({ id, n, of }) {
  return (
    <span className="job-meta common-job-pending">
      {n === 0 ? t('settings.jobs.common.pending.none') : (
        <>
          <Tally n={n} icon={of.icon} word={of.word(n)} showWord />
          {' '}
          {t(`settings.jobs.common.${id}.pending`)}
        </>
      )}
    </span>
  )
}

// THE LAST RUN, AND A DOOR TO ITS LOG. The log opens here, under the row, rather
// than by scrolling Past jobs to it: the last run can be anywhere in thirty days
// of other jobs, and past the first page Past jobs has not even read it yet.
function LastRun({ last, title, open, onToggle }) {
  const when = formatWhen(last.finished_at || last.created_at)
  const summary = jobSummary(last)
  const state = jobStateLabel(last.state)
  return (
    <>
      <button
        type="button"
        className="job-head common-job-last"
        aria-expanded={open}
        aria-label={t('settings.jobs.common.last.aria', { title, state, when })}
        onClick={onToggle}
      >
        <IconChevron open={open} size={16} />
        <span className="job-meta">{t('settings.jobs.common.last.label')}</span>
        <span className={`job-state is-${last.state}`}>{state}</span>
        <span className="job-meta">{when}</span>
        {/* An admin's backup row shows the server's last backup, whoever sealed
            it; the server names them only to an admin. */}
        {last.username && !last.own && <span className="job-who" data-content>{last.username}</span>}
        {summary && <span className="job-summary">{summary}</span>}
      </button>
      {open && (
        <div className="job-body">
          {/* What went wrong, in the server's words, as Past jobs' details say it. */}
          {last.error && (last.state === 'failed'
            ? <ErrorText>{last.error}</ErrorText>
            : <p className="microcopy" data-content>{last.error}</p>)}
          <PastLog job={last} title={jobTitle(last)} />
          <div className="job-actions">
            {/* An anchor, for the reason Past jobs' Export is one. */}
            <Tooltip label={t('settings.jobs.past.export.tip')}>
              <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={jobLogURL(last.id)} download>
                <IconExport />
                {t('common.action.export.label')}
              </a>
            </Tooltip>
          </div>
        </div>
      )}
    </>
  )
}
