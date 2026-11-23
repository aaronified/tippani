// SETTINGS › SERVER — the system logs card, the one thing left in the jobs file.
//
// The job queue, its common jobs and its past jobs were cut from the web app
// (ADR-0936): the phone asks the server for what it needs and does not show the
// queue. The logs are kept — an admin reads them to find out why something failed
// — and the card takes its filters from the shell's search bar.
//
// IT NEVER SPEAKS TO THE SERVER ITSELF. Every path and every field name is in
// jobs.js, which is the one module the wire contract lives in; this file draws
// what that module hands it.
//
import { useEffect, useRef, useState } from 'react'

import { copyText } from './api.js'
import { t } from './i18n.js'
import {
  allSystemLogsURL,
  DEFAULT_LOG_LEVELS,
  DEFAULT_LOG_RANGE,
  formatClock,
  LOG_LEVELS,
  LOG_RANGES,
  readSystemLogs,
  systemLogsURL,
} from './jobs.js'
import { CardHead } from './prefRow.jsx'
import {
  ariaLabelText,
  ChipSwitches,
  ErrorText,
  GhostButton,
  IconButton,
  IconChevron,
  IconCopy,
  IconExport,
  Scroller,
  Select,
  toast,
  Tooltip,
  useIsMobileScreen,
} from './ui.jsx'

// ---- the pieces every card shares --------------------------------------------

// A CARD, IN THE SHAPE EVERY SETTINGS GROUP HAS. PrefGroup would draw the same
// paper and head, but its head takes a fact and no controls, and two of these
// cards carry their verbs in the head — Stop all belongs beside the counts it
// acts on, not three rows down.
export function JobsCard({ title, aside = null, door = null, controls = null, children }) {
  return (
    <section className="hand-card pref-group jobs-card" aria-label={ariaLabelText(title)}>
      <CardHead title={title} aside={aside} door={door}>{controls}</CardHead>
      {children}
    </section>
  )
}

// LogWell — THE RECESSED WELL EVERY LOG IS READ IN, and the one place its shape is
// drawn: a job's live log, a finished job's, and the system logs.
//
// THE WELL DOES NOT FADE; THE LINES INSIDE IT DO. The fade is a mask, and a mask
// clips everything under it — so on the scrolling box itself it faded the well's
// own background and border into the card, and a pane scrolled part-way looked
// eaten at its edge. The owner, twice: "It is a recessed well. The log text should
// be inside it and edgemasked, not the well!" So the well is a still box that holds
// the paper, and the Scroller inside it holds only the lines.
//
// AND IT CARRIES ITS OWN COPY, the owner's, 30 September: "a hovering copy button,
// no label ... in all the log boxes". It is a glyph in the top-right corner that
// stays put while the lines scroll beside it, never under it: their box stops
// short of the button (index.css), or the end of a wrapped line would hide there
// for good. `copy` is asked for the text at the press, so it copies what is in the
// well then, as a reader reads it; a well with nothing in it has nothing to copy,
// and is handed none. Its name is the well's own (`copyLabel`): a job's log open
// beside System logs is two copy buttons on one screen, and two of one name are a
// press nobody can aim.
const COPY_GLYPH = <IconCopy size={18} />

function LogWell({ className = '', label, copy = null, copyLabel = null, innerRef = null, onScroll = undefined, children }) {
  async function onCopy() {
    const ok = await copyText(copy())
    toast(ok ? t('common.toast.copied') : t('error.copy.generic'))
  }
  return (
    <div className={`log-well ${className}`}>
      {/* `role="log"` is what the thing is — lines appended in order — and a screen
          reader treats one as a polite live region without anything bolted on. It
          takes focus so a keyboard can scroll it: a pane only a wheel can move is a
          pane half its readers cannot read. */}
      <Scroller axis="v" drag={false} innerRef={innerRef} className="log-well-lines" role="log" aria-label={label} tabIndex={0} onScroll={onScroll}>
        {children}
      </Scroller>
      {copy && <IconButton wrapClassName="log-well-copy" icon={COPY_GLYPH} ariaLabel={copyLabel || t('settings.logs.copy.aria')} onClick={onCopy} />}
    </div>
  )
}

// A line as it is read: the clock, a warning or an error named in words, then the
// server's line. What the copy button puts on the clipboard, one line to a line.
const logLineText = (l, level = null) => [formatClock(l.at), level, l.code, l.line].filter(Boolean).join(' ')

// — "volume|s?", "97814090831|08" (the owner's phone, 30 September). A <wbr> after
// each / ? & , = gives the break somewhere to go; `overflow-wrap: anywhere` stays
// as the last resort for a run with no joint in it, so nothing pushes the page
// sideways. <wbr> adds nothing to the text, so a copy or a search reads the line
// as the server wrote it.
function breakable(line) {
  const parts = String(line).split(/(?<=[/?&,=])/)
  if (parts.length < 2) return line
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<wbr key={i} />, part]))
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
          row
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
        <LogWell className="job-log logs-pane" label={t('settings.logs.lines.aria')}
          copy={() => lines.map((l) => logLineText(l, LOG_LEVELS.includes(l.level) ? t(`settings.logs.level.${l.level}.label`) : l.level)).join('\n')}>
          {lines.map((l) => (
            <div key={l.id} className={`job-log-line is-${l.level}`}>
              <span className="job-log-at">{formatClock(l.at)}</span>
              <span className="job-log-text">
                <span className="log-level">{LOG_LEVELS.includes(l.level) ? t(`settings.logs.level.${l.level}.label`) : l.level}</span>{' '}
                {/* The code and the line are the server's words out of the table —
                    a request path, a TIP code, an error — not this screen's copy.
                    The space before them is text, as in a job's log. */}
                <span data-content>{l.code ? `${l.code} ` : ''}{breakable(l.line)}</span>
              </span>
            </div>
          ))}
        </LogWell>
      )}
      {more && (
        <GhostButton icon={<IconChevron size={16} />} keepLabel onClick={() => load(true)}>
          {t('settings.logs.more.label')}
        </GhostButton>
      )}
      {/* EXPORT ▸ TWO WAYS, and they are the owner's two: exactly what the
          filters show, or everything the server keeps. Anchors, for the reason the
          job export is one. EACH GLYPH IS INSIDE ITS LABEL, at the head of the
          words rather than in a box beside them: the label wraps at the largest
          type on a phone, and a glyph beside a two-line label was centred between
          the two lines and squeezed narrower by the words next to it. */}
      <div className="job-actions logs-export">
        <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={systemLogsURL(filters)} download>
          <span className="logs-export-label"><IconExport />{t('settings.logs.export.shown.label')}</span>
        </a>
        {/* "ALL", AND ITS NAME SAYS ALL OF WHAT. The owner's, 30 September: no
            "Export" word before the pair, and the second is "All", beside the
            first. The glyph says export; the name a hover, a hold and a screen
            reader get says it is everything the server keeps, which a bare word
            cannot. */}
        <Tooltip label={t('settings.logs.export.all.aria')}>
          <a className="tp-btn tp-btn-ghost tactile inline-flex items-center gap-2" href={allSystemLogsURL()} download aria-label={t('settings.logs.export.all.aria')}>
            <span className="logs-export-label"><IconExport />{t('settings.logs.export.all.label')}</span>
          </a>
        </Tooltip>
      </div>
    </JobsCard>
  )
}
