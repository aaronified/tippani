// SETTINGS › JOBS — the three cards a reader opens to see what the server is doing
// for them, and what it did.
//
// WHY A FILE OF ITS OWN. Settings.jsx is six thousand lines of preferences, and
// nothing here is a preference: these are ACTS already in motion — a fill still
// running after its screen was closed, a backup waiting behind it, a lookup that
// failed an hour ago. The section is wired into Settings the way every other one
// is (SETTINGS_SECTIONS, SECTION_CARDS, the phone's index) and draws its cards
// from here, so the Settings file keeps its job of arranging sections and this
// one keeps the queue.
//
// IT NEVER SPEAKS TO THE SERVER ITSELF. Every path and every field name is in
// jobs.js, which is the one module the wire contract lives in; this file draws
// what that module hands it.
//
// FOUR CARDS, AND WHAT EACH IS FOR, in the order a reader reaches for them:
//   - CURRENT JOBS: is anything running, what is waiting, and a way to stop it.
//     The running job's log is OPEN when the card is, because "what is it doing
//     right now" is the question somebody opens this card to ask.
//   - COMMON JOBS (commonJobs.jsx, drawn with this file's card and log): the
//     jobs a reader runs again and again, each in a place of its own.
//   - PAST JOBS: what finished, how it ended, its log to read or export, and a
//     press to run it again.
//   - SYSTEM LOGS (an admin's only): the app's own log, narrowed by level, time
//     and a keyword typed into the shell's own search bar.
import { useCallback, useEffect, useRef, useState } from 'react'

import { t } from './i18n.js'
import {
  allSystemLogsURL,
  DEFAULT_LOG_LEVELS,
  DEFAULT_LOG_RANGE,
  FINISHED_STATES,
  formatClock,
  formatWhen,
  jobCounts,
  jobHasFindings,
  jobLabel,
  jobLogURL,
  jobStateLabel,
  jobSummary,
  jobTitle,
  jobTook,
  jobWaitingText,
  listJobs,
  LOG_LEVELS,
  LOG_RANGES,
  pressStop,
  pressStopAll,
  readSystemLogs,
  rerunJob,
  systemLogsURL,
  useCurrentJobs,
  useJob,
  useJobsAnnounced,
  useStoppingJobs,
} from './jobs.js'
import { CardHead } from './prefRow.jsx'
import {
  ariaLabelText,
  ChipSwitches,
  ErrorText,
  FilterChip,
  GhostButton,
  IconButton,
  IconChevron,
  IconExport,
  IconJobs,
  IconOpen,
  IconRerun,
  IconStop,
  ProgressBar,
  Scroller,
  Select,
  Tally,
  toast,
  Tooltip,
  useConfirm,
  useIsMobileScreen,
} from './ui.jsx'

// ---- the pieces every card shares --------------------------------------------

// A CARD, IN THE SHAPE EVERY SETTINGS GROUP HAS. PrefGroup would draw the same
// paper and head, but its head takes a fact and no controls, and two of these
// cards carry their verbs in the head — Stop all belongs beside the counts it
// acts on, not three rows down.
export function JobsCard({ title, aside = null, controls = null, children }) {
  return (
    <section className="hand-card pref-group jobs-card" aria-label={ariaLabelText(title)}>
      <CardHead title={title} aside={aside}>{controls}</CardHead>
      {children}
    </section>
  )
}

// JobLog — a job's lines, oldest first, in a pane that scrolls under a measured
// fade. A LIVE log follows its newest line while the reader is at the bottom and
// stops following the moment they scroll up to read — being dragged back down
// mid-sentence is the one thing a log pane must never do.
//
// KEYED ON THE NEWEST LINE, NOT ON HOW MANY THERE ARE. The pane keeps its last
// LOG_PANE_MAX lines, so once it is full every new line pushes the oldest out and
// the count stops moving — a long fill reaches that after several hundred works,
// and a pane that followed its length stopped following right there.
function JobLog({ lines, trimmed = false, loaded = true, label, follow = false }) {
  const ref = useRef(null)
  const atEnd = useRef(true)
  const newest = lines.length ? lines[lines.length - 1].id : 0
  useEffect(() => {
    const el = ref.current
    if (!el || !follow || !atEnd.current) return
    el.scrollTop = el.scrollHeight
  }, [newest, follow])
  const onScroll = () => {
    const el = ref.current
    if (el) atEnd.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
  }
  return (
    // `role="log"` is what the thing is — lines appended in order — and a screen
    // reader treats one as a polite live region without anything bolted on. It
    // takes focus so a keyboard can scroll it: a pane only a wheel can move is a
    // pane half its readers cannot read.
    <Scroller axis="v" drag={false} innerRef={ref} className="job-log" role="log" aria-label={label} tabIndex={0} onScroll={onScroll}>
      {trimmed && <p className="microcopy">{t('settings.jobs.log.trimmed')}</p>}
      {loaded && lines.length === 0 && <p className="microcopy">{t('settings.jobs.log.empty')}</p>}
      {lines.map((l) => (
        <div key={l.id} className={`job-log-line is-${l.level || 'info'}`}>
          <span className="job-log-at">{formatClock(l.at)}</span>
          <span className="job-log-text">
            {/* A WARNING OR AN ERROR SAYS SO IN WORDS, as every System logs row
                does. It was a warning drawn in the accent, which is the colour of
                a press — CLAUDE.md: "the accent is not a warning" — and a line in
                it read as a link. A word also reaches a reader who cannot tell
                the two colours apart. And a SPACE after it, as text: a margin
                alone read "WarningGET …" to a copy, a screen reader and
                find-in-page (index.css, .log-level). */}
            {(l.level === 'warn' || l.level === 'error') && (
              <><span className="log-level">{t(`settings.logs.level.${l.level}.label`)}</span>{' '}</>
            )}
            {/* THE LINE IS THE SERVER'S, and it is data out of the database — a
                URL, a title, a status — rather than copy this screen could
                translate. */}
            <span data-content>{l.line}</span>
          </span>
        </div>
      ))}
    </Scroller>
  )
}

// A job's name and what it was about, on one line. The subject is what the reader
// typed or chose — a title, an ISBN, a file's name — so it is theirs, drawn as it
// came; the username says whose job it is, and the server sends it only to an
// admin, who is the one reader who sees other people's.
function JobName({ job }) {
  return (
    <>
      <span className="job-title">{jobTitle(job)}</span>
      {job.subject && <span className="job-subject" data-content>{job.subject}</span>}
      {job.username && <span className="job-who" data-content>{job.username}</span>}
    </>
  )
}

// Stop is offered where the server will honour it: your own job, or — for an
// admin — anybody's (F3). Offering it to a reader for somebody else's queued job
// would be a press that ends in a 404.
const canStop = (job, user) => !!job?.own || !!user?.is_admin

// EVERY STOP ON THE CARD HAS A NAME OF ITS OWN. Each press of Fill gaps is a new
// job, so two waiting fills behind a running one were three buttons all called
// "Stop Fill gaps": a screen reader could not tell them apart, and a journey
// refuses a name that matches twice. Where a job stands is already on its row,
// is different for every job in the queue (`ahead` counts across all readers),
// and is what a reader chooses by — so the name carries it, with the subject
// when there is one.
function stopName(job) {
  const title = jobLabel(job)
  if (job.state === 'running') return t('settings.jobs.current.stop.running.aria', { title })
  const ahead = job.ahead || 0
  return ahead > 0
    ? t('settings.jobs.current.stop.ahead.aria', { title, count: ahead, n: ahead })
    : t('settings.jobs.current.stop.next.aria', { title })
}

// ---- Current jobs --------------------------------------------------------------

// JobsCurrentCard — what is running and what waits behind it.
//
// `compact` IS THE PHONE'S SETTINGS INDEX, and it is this card rather than a
// second one because the repo's rule is that two things that look the same
// behave the same: the count and the Stop all a reader meets on the index are the
// ones inside the section, with the same confirm and the same request behind them.
// The owner asked for exactly two things there — one red Stop all with a
// confirmation, and a count of what is queued — so that is all it draws.
export function JobsCurrentCard({ user, compact = false }) {
  const { jobs, running, waiting, loaded, error } = useCurrentJobs()
  const { ask, confirmDialog } = useConfirm()
  const [open, setOpen] = useState(true)
  // Running rows the reader folded. A running row's log is open until somebody
  // closes it, so the set holds the exceptions rather than the rule — a job that
  // starts running while the card is up opens itself.
  const [folded, setFolded] = useState(() => new Set())
  // THE JOBS A STOP WAS PRESSED ON, which say "Stopping…" from the instant of the
  // press, before the server has answered: the server stops a job at once, and a
  // row that went on offering its Stop until the answer came would read as a press
  // that did nothing. Each row leaves the card when the close watch after the
  // Stop (jobs.js) reads it stopped. The mark is jobs.js's (pressStop), not this
  // card's: a common job is drawn on the Common jobs card too, and a Stop pressed
  // on either row is pressed on both.
  const stopping = useStoppingJobs()
  const any = running + waiting > 0

  async function stopAll() {
    // THE CONFIRM SAYS WHAT WILL HAPPEN TO EACH HALF, and nothing that will not.
    // A reader with nothing running is not told about "the running job"; an admin
    // is told the press reaches every reader's queue, because it does (F3).
    const body = [
      running > 0 && t('settings.jobs.current.stop-all.confirm.running'),
      waiting > 0 && t('settings.jobs.current.stop-all.confirm.waiting', { count: waiting, n: waiting }),
      t('settings.jobs.current.stop-all.confirm.kept'),
      user?.is_admin && t('settings.jobs.current.stop-all.confirm.admin'),
    ].filter(Boolean).join(' ')
    const yes = await ask(t('settings.jobs.current.stop-all.confirm.title'), {
      body,
      confirmLabel: t('settings.jobs.current.stop-all.confirm.verb'),
      danger: true,
    })
    if (!yes) return
    // Every row the press reaches says so at once, as its own Stop would.
    const pressed = jobs.filter((j) => canStop(j, user)).map((j) => j.id)
    const r = await pressStopAll(pressed)
    if (!r.ok) return toast(r.error)
    // ONE COUNT, FIVE WORDS OR FEWER (the house's toast rule), and nothing at all
    // when the press reached nothing — the jobs ended between the confirm and the
    // press, and "0 jobs stopped" is news about nothing.
    const total = r.stopping + r.stoppedWaiting
    if (total > 0) toast(t('settings.jobs.current.stop-all.done', { count: total, n: total }))
  }

  // NO TOAST. The row said "Stopping…" at the press and leaves the card when the
  // job reads stopped, a moment later, for Past jobs, where its state is what it
  // ended as. A toast at the server's answer could only guess: a Stop that lands
  // once the last item is written leaves the job succeeded, not stopped.
  async function stopOne(job) {
    const r = await pressStop(job.id)
    if (!r.ok) toast(r.error)
  }

  // RED, WITH ITS WORDS, AND ABSENT RATHER THAN DISABLED when there is nothing to
  // stop (F6). A greyed Stop all over an empty queue is a control a reader has to
  // read to learn it does nothing; the count beside it already says zero.
  const stopAllButton = any && (
    <GhostButton icon={<IconStop />} keepLabel className="tp-btn-danger" onClick={stopAll}>
      {t('settings.jobs.current.stop-all.label')}
    </GhostButton>
  )
  const waitingTally = <Tally n={waiting} icon={<IconJobs />} word={t('settings.jobs.current.waiting.word')} showWord />
  const chevron = <IconChevron open={open} size={20} />

  if (compact) {
    return (
      <>
        {confirmDialog}
        <div className="section-index-verbs jobs-tile">
          {waitingTally}
          {stopAllButton}
        </div>
      </>
    )
  }

  return (
    <JobsCard
      title={t('settings.jobs.current.title')}
      // THE WORD AND THE GLYPH, because a card head is the roomy site where a
      // reader learns what the drawing means — every tighter count of jobs spends
      // what this one teaches.
      aside={(
        <span className="jobs-tallies">
          <Tally n={running} icon={<IconJobs />} word={t('settings.jobs.current.running.word')} showWord />
          {waitingTally}
        </span>
      )}
      controls={(
        <>
          {stopAllButton}
          {/* THE DOOR. The card folds to its head — the two counts and Stop all
              stay in view — for a reader who keeps Settings open beside their
              work and wants the log out of the way, not gone. */}
          <IconButton
            icon={chevron}
            ariaLabel={t(open ? 'settings.jobs.current.fold.label' : 'settings.jobs.current.unfold.label')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          />
        </>
      )}
    >
      {confirmDialog}
      {open && (
        <div className="job-list">
          {error && <ErrorText>{error}</ErrorText>}
          {loaded && !error && jobs.length === 0 && <p className="microcopy">{t('settings.jobs.current.empty')}</p>}
          {jobs.map((job) => (job.state === 'running' ? (
            <RunningJob
              key={job.id}
              job={job}
              user={user}
              open={!folded.has(job.id)}
              stopping={stopping.has(job.id)}
              onToggle={() => setFolded((s) => {
                const next = new Set(s)
                if (next.has(job.id)) next.delete(job.id)
                else next.add(job.id)
                return next
              })}
              onStop={() => stopOne(job)}
            />
          ) : (
            <WaitingJob key={job.id} job={job} user={user} stopping={stopping.has(job.id)} onStop={() => stopOne(job)} />
          )))}
        </div>
      )}
    </JobsCard>
  )
}

function RunningJob({ job, user, open, stopping, onToggle, onStop }) {
  // THE LOG IS READ ONLY WHILE IT IS OPEN. A folded row costs nothing; the card's
  // own poll keeps its progress moving.
  const live = useJob(open ? job.id : null)
  const j = live.job && live.job.id === job.id ? live.job : job
  const title = jobTitle(j)
  return (
    <div className="job-row">
      <div className="job-row-head">
        <button type="button" className="job-head" aria-expanded={open} onClick={onToggle}>
          <IconChevron open={open} size={16} />
          <JobName job={j} />
        </button>
        {canStop(j, user) && (stopping ? (
          <span className="microcopy">{t('settings.jobs.current.stopping')}</span>
        ) : (
          <GhostButton icon={<IconStop />} keepLabel className="tp-btn-danger" aria-label={stopName(j)} onClick={onStop}>
            {t('settings.jobs.current.stop.label')}
          </GhostButton>
        ))}
      </div>
      <div className="job-body">
        <ProgressBar value={j.done || 0} max={j.total || 0} label={jobSummary(j) || undefined} />
        {open && (
          <JobLog lines={live.lines} trimmed={live.trimmed} loaded={live.loaded} label={t('settings.jobs.log.aria', { title })} follow />
        )}
      </div>
    </div>
  )
}

// A WAITING JOB IS ONE LINE: what it is and how many are ahead of it. It has no
// log to open yet — nothing has happened to it — and a queue of ten reads as ten
// lines rather than ten cards.
const STOP_GLYPH = <IconStop size={20} />

function WaitingJob({ job, user, stopping, onStop }) {
  return (
    <div className="job-row is-waiting">
      <div className="job-row-head">
        <span className="job-line">
          <JobName job={job} />
          <span className="job-meta">{jobWaitingText(job)}</span>
        </span>
        {/* A GLYPH HERE, WHERE THE RUNNING ROW HAS WORDS. The running row's Stop
            is the one press the card exists for and keeps its label; a waiting
            row is one line of several, and the glyph it wears was taught by the
            Stop all in the head. The name still says it, to a hover and a hold.
            Pressed, here or on its Common jobs row, it says "Stopping…" in words,
            as the running row does. */}
        {canStop(job, user) && stopping && <span className="microcopy">{t('settings.jobs.current.stopping')}</span>}
        {canStop(job, user) && !stopping && (
          <IconButton
            icon={STOP_GLYPH}
            danger
            ariaLabel={stopName(job)}
            onClick={onStop}
          />
        )}
      </div>
    </div>
  )
}

// ---- Past jobs -----------------------------------------------------------------

// JobsPastCard — everything that finished in the last thirty days, newest first.
//
// `credentialPrompt` draws Settings' own backup prompt, handed in rather than
// imported: a backup cannot be run again without the credential that seals it
// (the server never keeps one), and the prompt a reader meets for that must be
// the one they met when they made the first backup — same fields, same rules.
// `onReview` is the shell's door to Metadata, where a re-verify's findings are
// chosen and applied.
export function JobsPastCard({ user, onReview = null, credentialPrompt = null }) {
  const [filter, setFilter] = useState('')
  const [rows, setRows] = useState(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [asking, setAsking] = useState(null) // a backup waiting for its credential
  const [busy, setBusy] = useState(false)
  const pruned = useRef(false)
  const stamp = useRef(0)

  const load = useCallback(async (append = false) => {
    const mine = ++stamp.current
    const before = append && rows && rows.length ? rows[rows.length - 1].id : null
    // THE TAB'S FIRST PAGE ASKS THE SERVER TO PRUNE, once per visit: "pruned when
    // the tab opens, with no timer" is this line and the server's answer to it.
    const prune = !pruned.current && !append
    pruned.current = true
    const r = await listJobs({ view: 'past', state: filter, before, limit: 30, prune })
    if (mine !== stamp.current) return // a newer filter's answer is on its way
    if (!r.ok) {
      setError(r.error)
      if (!append) setRows([])
      return
    }
    setError('')
    setMore(r.more)
    setRows((prev) => (append && prev ? prev.concat(r.jobs) : r.jobs))
  }, [filter, rows])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false) }, [filter])
  // A job that finished, or a press anywhere on this screen, makes this list stale.
  useJobsAnnounced(() => load(false))

  async function rerun(job, secret) {
    if (job.kind === 'backup' && !secret) return setAsking(job)
    setBusy(true)
    const r = await rerunJob(job.id, secret)
    setBusy(false)
    if (!r.ok) return toast(r.error)
    setAsking(null)
    toast(t('settings.jobs.past.rerun.done'))
  }

  return (
    <JobsCard title={t('settings.jobs.past.title')}>
      {/* HOW IT ENDED, AS CHIPS — the four finished states and All. A chip row
          rather than a dropdown, because the reader is scanning for the failed
          ones and a chip is one press where a menu is two. */}
      <Scroller axis="x" className="jobs-filters" role="group" aria-label={t('settings.jobs.past.filter.aria')}>
        <FilterChip active={filter === ''} label={t('settings.jobs.past.filter.all.label')} onClick={() => setFilter('')} />
        {FINISHED_STATES.map((s) => (
          <FilterChip key={s} active={filter === s} label={jobStateLabel(s)} onClick={() => setFilter(s)} />
        ))}
      </Scroller>
      {error && <ErrorText>{error}</ErrorText>}
      {rows && rows.length === 0 && !error && (
        <p className="microcopy">{t(filter ? 'settings.jobs.past.empty.filtered' : 'settings.jobs.past.empty')}</p>
      )}
      {rows && rows.length > 0 && (
        <div className="job-list">
          {rows.map((job) => (
            <PastJob
              key={job.id}
              job={job}
              user={user}
              open={openId === job.id}
              busy={busy}
              onToggle={() => setOpenId((id) => (id === job.id ? null : job.id))}
              onRerun={() => rerun(job)}
              onReview={onReview ? () => onReview(job.id) : null}
            />
          ))}
        </div>
      )}
      {more && (
        <GhostButton icon={<IconChevron size={16} />} keepLabel onClick={() => load(true)}>
          {t('settings.jobs.past.more.label')}
        </GhostButton>
      )}
      {asking && credentialPrompt?.({
        me: user?.username,
        busy,
        onCancel: () => setAsking(null),
        onConfirm: (creds) => rerun(asking, creds),
      })}
    </JobsCard>
  )
}

function PastJob({ job, user, open, busy, onToggle, onRerun, onReview }) {
  const title = jobTitle(job)
  const summary = jobSummary(job)
  const failed = job.state === 'failed'
  return (
    <div className="job-row">
      <button type="button" className="job-head" aria-expanded={open} onClick={onToggle}>
        <IconChevron open={open} size={16} />
        <JobName job={job} />
        <span className={`job-state is-${job.state}`}>{jobStateLabel(job.state)}</span>
        <span className="job-meta">{formatWhen(job.finished_at || job.created_at)}</span>
        {summary && <span className="job-summary">{summary}</span>}
      </button>
      {open && (
        <div className="job-body">
          <dl className="job-details">
            {job.username && (
              <>
                <dt>{t('settings.jobs.past.who.label')}</dt>
                <dd data-content>{job.username}</dd>
              </>
            )}
            <dt>{t('settings.jobs.past.when.label')}</dt>
            <dd>{formatWhen(job.started_at || job.created_at)}</dd>
            {jobTook(job) && (
              <>
                <dt>{t('settings.jobs.past.took.label')}</dt>
                <dd>{jobTook(job)}</dd>
              </>
            )}
            {jobCounts(job).length > 0 && (
              <>
                <dt>{t('settings.jobs.past.result.label')}</dt>
                <dd>{jobCounts(job).join(' · ')}</dd>
              </>
            )}
            {job.error && (
              <>
                <dt>{t('settings.jobs.past.error.label')}</dt>
                <dd className={failed ? 'is-error' : undefined} data-content>{job.error}</dd>
              </>
            )}
          </dl>
          <PastLog job={job} title={title} />
          <div className="job-actions">
            {/* AN ANCHOR, NOT A BUTTON, like the backup's download: the server
                sends the log as an attachment, and a real href is what gives a
                reader middle-click, "save link as" and an address to read first. */}
            <Tooltip label={t('settings.jobs.past.export.tip')}>
              <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={jobLogURL(job.id)} download>
                <IconExport />
                {t('common.action.export.label')}
              </a>
            </Tooltip>
            {job.rerunnable && (
              <GhostButton icon={<IconRerun />} keepLabel disabled={busy} onClick={onRerun}>
                {t('settings.jobs.past.rerun.label')}
              </GhostButton>
            )}
            {/* REVIEW IS THE OWNER'S, AND ONLY WHILE THERE IS SOMETHING TO REVIEW:
                a re-verify that finished, found something to change, and whose
                findings nobody has applied yet. An applied one has been decided;
                one that found everything up to date has nothing to decide;
                somebody else's is theirs to decide (F3); and one a restore
                carried over found its findings in the library the restore
                replaced, where the works it names may be other works now, so
                the server refuses its review and nothing offers one. */}
            {onReview && job.kind === 'reverify' && job.state === 'succeeded' && job.own && !job.applied && !job.carried && jobHasFindings(job) && (
              <Tooltip label={t('settings.jobs.past.review.tip')}>
                <GhostButton icon={<IconOpen />} keepLabel onClick={onReview}>
                  {t('settings.jobs.past.review.label')}
                </GhostButton>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function PastLog({ job, title }) {
  // A past row's job has finished: read its log until it is all here, then stop.
  const live = useJob(job.id, { final: true })
  return <JobLog lines={live.lines} trimmed={live.trimmed} loaded={live.loaded} label={t('settings.jobs.log.aria', { title })} />
}

// ---- System logs ---------------------------------------------------------------

// SystemLogsCard — the app's own log, for an admin.
//
// THE KEYWORD IS THE SHELL'S. Settings hands this card the query the top bar's
// search field types while the Jobs section is open — the omnibar rule: in
// Settings › Jobs, searching searches the logs — so `q` and `onQuery` come from
// the screen rather than living here. A desk also gets a field in the card,
// mirroring the same value, for the reason the Metadata consoles have one: on a
// wide screen a reader looks for the filter where the other filters are. A phone
// has no room for both and loses the copy, not the bar.
export function SystemLogsCard({ q = '', onQuery = null }) {
  const mobile = useIsMobileScreen()
  const [levels, setLevels] = useState(DEFAULT_LOG_LEVELS)
  const [range, setRange] = useState(DEFAULT_LOG_RANGE)
  const [lines, setLines] = useState(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  // The window the list was read over, as the server's answer names it — its
  // start by the server's clock and its newest line — which the next page and the
  // export send back: "what is shown" ends where the reader's list ends, whatever
  // this browser's clock says (jobs.js, logQuery). Null until the first answer.
  const [shown, setShown] = useState(null)
  // TYPING IS NOT A REQUEST PER KEY. The bar calls through on every keystroke,
  // which is right for a list already in memory and wrong for a table on the
  // server; a quarter-second pause is when the reader has finished the word.
  const [term, setTerm] = useState(q)
  useEffect(() => {
    const h = setTimeout(() => setTerm(q), 300)
    return () => clearTimeout(h)
  }, [q])
  const stamp = useRef(0)

  const load = async (append = false) => {
    const mine = ++stamp.current
    // New filters are a new window: the old one is not what they show.
    if (!append) setShown(null)
    const before = append && lines && lines.length ? lines[lines.length - 1].id : null
    const r = await readSystemLogs({ levels, range, q: term, before, ...(append ? shown : null) })
    if (mine !== stamp.current) return
    if (!r.ok) {
      setError(r.error)
      if (!append) setLines([])
      return
    }
    setError('')
    setMore(r.more)
    if (!append) setShown({ from: r.from, upto: r.upto })
    setLines((prev) => (append && prev ? prev.concat(r.lines) : r.lines))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false) }, [levels.join(','), range, term])

  const filters = { levels, range, q: term, ...shown }
  return (
    <JobsCard title={t('settings.logs.title')}>
      <div className="logs-filters">
        {/* ONE LEVEL STAYS ON. With none chosen the server would fall back to its
            default and show lines the chips say are hidden, so the last chip is
            held — and the reason is said in words beside the row, because a
            tooltip is something a reader has to know to ask for. */}
        <ChipSwitches
          ariaLabel={t('settings.logs.level.aria')}
          options={LOG_LEVELS.map((l) => ({
            key: l,
            label: t(`settings.logs.level.${l}.label`),
            on: levels.includes(l),
            locked: levels.length === 1 && levels.includes(l) ? t('settings.logs.level.last') : undefined,
          }))}
          onToggle={(key, on) => setLevels((cur) => (on ? LOG_LEVELS.filter((l) => l === key || cur.includes(l)) : cur.filter((l) => l !== key)))}
        />
        <div className="logs-controls">
          <Select
            ariaLabel={t('settings.logs.range.aria')}
            value={range}
            onChange={setRange}
            options={LOG_RANGES.map(([id]) => [id, t(`settings.logs.range.${id}.label`)])}
          />
          {!mobile && onQuery && (
            <input
              className="tp-input w-auto"
              type="search"
              placeholder={t('settings.logs.search.placeholder')}
              aria-label={t('settings.logs.search.aria')}
              value={q}
              onChange={(e) => onQuery(e.target.value)}
            />
          )}
        </div>
        {levels.length === 1 && <p className="microcopy">{t('settings.logs.level.last')}</p>}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {lines && lines.length === 0 && !error && <p className="microcopy">{t('settings.logs.empty')}</p>}
      {lines && lines.length > 0 && (
        <Scroller axis="v" drag={false} className="job-log logs-pane" role="log" aria-label={t('settings.logs.lines.aria')} tabIndex={0}>
          {lines.map((l) => (
            <div key={l.id} className={`job-log-line is-${l.level}`}>
              <span className="job-log-at">{formatClock(l.at)}</span>
              <span className="job-log-text">
                <span className="log-level">{LOG_LEVELS.includes(l.level) ? t(`settings.logs.level.${l.level}.label`) : l.level}</span>{' '}
                {/* The code and the line are the server's words out of the table —
                    a request path, a TIP code, an error — not this screen's copy.
                    The space before them is text, as in a job's log. */}
                <span data-content>{l.code ? `${l.code} ` : ''}{l.line}</span>
              </span>
            </div>
          ))}
        </Scroller>
      )}
      {more && (
        <GhostButton icon={<IconChevron size={16} />} keepLabel onClick={() => load(true)}>
          {t('settings.logs.more.label')}
        </GhostButton>
      )}
      {/* EXPORT ▸ TWO WAYS, and they are the owner's two: exactly what the
          filters show, or everything the server keeps. Anchors, for the reason the
          job export is one. */}
      <div className="job-actions logs-export">
        <span className="microcopy">{t('common.action.export.label')}</span>
        <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={systemLogsURL(filters)} download>
          <IconExport />
          {t('settings.logs.export.shown.label')}
        </a>
        <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={allSystemLogsURL()} download>
          <IconExport />
          {t('settings.logs.export.all.label')}
        </a>
      </div>
    </JobsCard>
  )
}
